"""Local filesystem backend implementation."""

import asyncio
import os
import shlex
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import List, Optional, Union, Dict, Any, Tuple

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
from ..types import (
    FileInfo,
    FileSystemError, 
    DangerousOperationError,
    LocalBackendConfig
)
from ..constants import (
    ERROR_CODES,
    DEFAULT_SHELL,
    DEFAULT_PREVENT_DANGEROUS,
    DEFAULT_VALIDATE_UTILS,
    SAFE_PATH,
    SAFE_LOCALE
)
from ..safety import is_command_safe, validate_path_safety, is_dangerous_operation
from ..utils.workspace import WorkspaceManager
from ..utils.logger import get_logger
from ..utils.path_validator import PathValidator
from .base import FileSystemBackend


class ResourceMonitor:
    """Monitor and enforce resource limits for command execution."""
    
    def __init__(self, limits: Dict[str, Any]):
        """Initialize resource monitor.
        
        Args:
            limits: Dictionary of resource limits
        """
        self.limits = limits
        
        # Set default limits if not provided
        self.max_memory_mb = limits.get('max_memory_mb', 1024)  # 1GB default
        self.max_cpu_percent = limits.get('max_cpu_percent', 80)  # 80% CPU
        self.max_processes = limits.get('max_processes', 50)
        self.max_file_size_mb = limits.get('max_file_size_mb', 100)  # 100MB files
        self.max_open_files = limits.get('max_open_files', 1000)
    
    def check_system_resources(self) -> Optional[str]:
        """Check if system has enough resources for new process.
        
        Returns:
            None if resources are available, error message if not
        """
        if not PSUTIL_AVAILABLE:
            return None  # Skip checks if psutil not available
            
        try:
            # Check memory usage
            memory = psutil.virtual_memory()
            if memory.percent > 90:  # System memory > 90%
                return f"System memory usage too high: {memory.percent:.1f}%"
            
            # Check CPU usage
            cpu_percent = psutil.cpu_percent(interval=0.1)
            if cpu_percent > 95:  # System CPU > 95%
                return f"System CPU usage too high: {cpu_percent:.1f}%"
            
            # Check disk space for workspace
            disk = psutil.disk_usage('/')
            if disk.percent > 95:  # Disk > 95% full
                return f"Disk space too low: {disk.percent:.1f}% used"
            
            return None  # All checks passed
        except Exception:
            return None  # If checks fail, allow execution
    
    def monitor_process(self, pid: int) -> Tuple[bool, Optional[str]]:
        """Monitor process resource usage.
        
        Args:
            pid: Process ID to monitor
            
        Returns:
            Tuple of (should_continue, reason_to_stop)
        """
        if not PSUTIL_AVAILABLE:
            return True, None
        
        try:
            process = psutil.Process(pid)
            
            # Check memory usage
            memory_info = process.memory_info()
            memory_mb = memory_info.rss / 1024 / 1024  # Convert to MB
            if memory_mb > self.max_memory_mb:
                return False, f"Process exceeded memory limit: {memory_mb:.1f}MB > {self.max_memory_mb}MB"
            
            # Check CPU usage (over last second)
            cpu_percent = process.cpu_percent()
            if cpu_percent > self.max_cpu_percent:
                return False, f"Process exceeded CPU limit: {cpu_percent:.1f}% > {self.max_cpu_percent}%"
            
            # Check number of child processes
            children = process.children(recursive=True)
            if len(children) > self.max_processes:
                return False, f"Process exceeded process limit: {len(children)} > {self.max_processes}"
            
            # Check open files
            try:
                open_files = len(process.open_files())
                if open_files > self.max_open_files:
                    return False, f"Process exceeded open files limit: {open_files} > {self.max_open_files}"
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass  # Process might have ended or access denied
            
            return True, None
        
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            # Process ended or access denied
            return False, "Process no longer accessible"
        except Exception:
            # If monitoring fails, allow process to continue
            return True, None


class LocalBackend(FileSystemBackend):
    """Local filesystem backend implementation.
    
    Executes commands and file operations on the local machine using Python's
    asyncio subprocess and aiofiles for async file operations.
    """
    
    def __init__(self, config: LocalBackendConfig) -> None:
        """Initialize local backend.
        
        Args:
            config: Local backend configuration
            
        Raises:
            FileSystemError: When configuration is invalid or workspace cannot be created
        """
        self.config = config
        self.user_id = config.get("user_id", "default")
        
        # Configuration with defaults
        self.shell = config.get("shell", DEFAULT_SHELL)
        self.prevent_dangerous = config.get("prevent_dangerous", DEFAULT_PREVENT_DANGEROUS)
        self.validate_utils = config.get("validate_utils", DEFAULT_VALIDATE_UTILS)
        self.max_output_length = config.get("max_output_length")
        self.on_dangerous_operation = config.get("on_dangerous_operation")
        self.timeout_seconds = config.get("timeout_seconds", 300.0)  # 5 minute default
        self.max_concurrent_commands = config.get("max_concurrent_commands", 10)
        self.resource_limits = config.get("resource_limits", {})
        
        # Create workspace first
        self.workspace = WorkspaceManager.ensure_user_workspace(self.user_id)
        self.workspace_path = Path(self.workspace)
        
        # Initialize components
        self.logger = get_logger(f'constellation.backend.local.{self.user_id}')
        self.path_validator = PathValidator(self.workspace, strict_mode=True)
        self._command_semaphore = asyncio.Semaphore(self.max_concurrent_commands)
        self._active_processes: Dict[int, subprocess.Popen] = {}
        
        # Resource monitoring
        self._resource_monitor = ResourceMonitor(self.resource_limits)
        
        # Thread pool for CPU-intensive operations
        self._thread_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix=f'constellation-{self.user_id}')
        
        # Detect shell
        self._shell_cmd = self._detect_shell()
        
        # Log backend initialization
        self.logger.info(f"LocalBackend initialized for user {self.user_id}", 
                        workspace=self.workspace, shell=self._shell_cmd,
                        timeout_seconds=self.timeout_seconds, 
                        max_concurrent=self.max_concurrent_commands)
        
        # Validate environment if requested
        if self.validate_utils:
            self._validate_environment()
    
    def _detect_shell(self) -> str:
        """Detect the best available shell for command execution.
        
        Returns:
            Shell command to use
        """
        if self.shell == "bash":
            return "bash"
        elif self.shell == "sh":
            return "sh"
        elif self.shell == "auto":
            # Auto-detection: prefer bash if available, fall back to sh
            try:
                subprocess.run(
                    ["command", "-v", "bash"], 
                    check=True, 
                    capture_output=True,
                    timeout=5
                )
                return "bash"
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
                return "sh"
        else:
            # Fallback for any unexpected shell value
            return "sh"
    
    def _validate_environment(self) -> None:
        """Validate that required POSIX utilities are available.
        
        Raises:
            FileSystemError: When required utilities are missing
        """
        required_utils = ["ls", "find", "grep", "cat", "wc", "head", "tail", "sort"]
        missing: List[str] = []
        
        for util in required_utils:
            try:
                subprocess.run(
                    ["command", "-v", util],
                    check=True,
                    capture_output=True,
                    timeout=5
                )
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired, FileNotFoundError):
                missing.append(util)
        
        if missing:
            raise FileSystemError(
                f"Missing required POSIX utilities: {', '.join(missing)}. "
                "Please ensure they are installed and available in PATH.",
                ERROR_CODES.MISSING_UTILITIES
            )
    
    async def exec(self, command: str) -> str:
        """Execute a shell command in the workspace.
        
        Args:
            command: Shell command to execute
            
        Returns:
            Command output as string
            
        Raises:
            FileSystemError: When command execution fails
            DangerousOperationError: When dangerous operations are blocked
        """
        # Comprehensive safety check
        safety_check = is_command_safe(command)
        if not safety_check["safe"]:
            # Special handling for prevent_dangerous option
            if self.prevent_dangerous and is_dangerous_operation(command):
                if self.on_dangerous_operation:
                    # Call callback and return empty string
                    try:
                        self.on_dangerous_operation(command)
                    except Exception:
                        pass  # Ignore callback errors
                    return ""
                else:
                    raise DangerousOperationError(command)
            
            # For other safety violations, always throw
            raise FileSystemError(
                safety_check["reason"] or "Command failed safety check",
                ERROR_CODES.DANGEROUS_OPERATION,
                command
            )
        
        # Execute command with safe environment
        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.workspace,
                env=self._get_safe_environment(),
                shell=True
            )
            
            stdout_data, stderr_data = await proc.communicate()
            
            # Decode output
            stdout = stdout_data.decode('utf-8', errors='replace')
            stderr = stderr_data.decode('utf-8', errors='replace')
            
            if proc.returncode != 0:
                error_msg = stderr.strip() or stdout.strip()
                raise FileSystemError(
                    f"Command execution failed with exit code {proc.returncode}: {error_msg}",
                    ERROR_CODES.EXEC_FAILED,
                    command
                )
            
            # Process output
            output = stdout.rstrip('\n\r')  # Remove trailing newlines but preserve internal ones
            
            # Truncate if needed
            if self.max_output_length and len(output) > self.max_output_length:
                truncated_length = self.max_output_length - 50
                output = (
                    f"{output[:truncated_length]}\n\n"
                    f"... [Output truncated. Full output was {len(output)} characters, "
                    f"showing first {truncated_length}]"
                )
            
            return output
            
        except asyncio.TimeoutError:
            raise FileSystemError(
                "Command execution timed out",
                ERROR_CODES.EXEC_FAILED,
                command
            )
        except Exception as e:
            if isinstance(e, FileSystemError):
                raise
            raise FileSystemError(
                f"Command execution failed: {str(e)}",
                ERROR_CODES.EXEC_ERROR,
                command
            ) from e
    
    async def read(self, path: str) -> str:
        """Read file contents.
        
        Args:
            path: Relative path to file within workspace
            
        Returns:
            File contents as UTF-8 string
            
        Raises:
            FileSystemError: When file cannot be read
        """
        # Validate path safety
        validate_path_safety(self.workspace_path, path)
        
        full_path = self.workspace_path / path
        
        try:
            # Use asyncio thread pool for file I/O until aiofiles is available
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                None, 
                lambda: full_path.read_text(encoding='utf-8')
            )
        except FileNotFoundError:
            raise FileSystemError(
                f"File not found: {path}",
                ERROR_CODES.READ_FAILED,
                f"read {path}"
            )
        except PermissionError:
            raise FileSystemError(
                f"Permission denied reading file: {path}",
                ERROR_CODES.READ_FAILED,
                f"read {path}"
            )
        except Exception as e:
            raise FileSystemError(
                f"Failed to read file {path}: {str(e)}",
                ERROR_CODES.READ_FAILED,
                f"read {path}"
            ) from e
    
    async def write(self, path: str, content: str) -> None:
        """Write content to file.
        
        Args:
            path: Relative path to file within workspace
            content: Content to write as UTF-8 string
            
        Raises:
            FileSystemError: When file cannot be written
        """
        # Validate path safety
        validate_path_safety(self.workspace_path, path)
        
        full_path = self.workspace_path / path
        
        try:
            # Ensure parent directory exists
            full_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Use asyncio thread pool for file I/O until aiofiles is available
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: full_path.write_text(content, encoding='utf-8')
            )
        except PermissionError:
            raise FileSystemError(
                f"Permission denied writing to file: {path}",
                ERROR_CODES.WRITE_FAILED,
                f"write {path}"
            )
        except Exception as e:
            raise FileSystemError(
                f"Failed to write file {path}: {str(e)}",
                ERROR_CODES.WRITE_FAILED,
                f"write {path}"
            ) from e
    
    async def ls(
        self,
        pattern: Optional[str] = None,
        *,
        details: bool = False
    ) -> Union[List[str], List[FileInfo]]:
        """List files and directories.
        
        Args:
            pattern: Optional glob pattern to filter results
            details: If True, return FileInfo objects with metadata
            
        Returns:
            List of file names or FileInfo objects
            
        Raises:
            FileSystemError: When directory listing fails
        """
        try:
            if details:
                return await self._ls_with_details(pattern)
            else:
                return await self._ls_names_only(pattern)
        except Exception as e:
            if isinstance(e, FileSystemError):
                raise
            raise FileSystemError(
                f"Directory listing failed: {str(e)}",
                ERROR_CODES.LS_FAILED,
                f"ls {pattern or ''}"
            ) from e
    
    async def _ls_names_only(self, pattern: Optional[str] = None) -> List[str]:
        """List file/directory names only.
        
        Args:
            pattern: Optional glob pattern
            
        Returns:
            List of file/directory names
        """
        if pattern:
            # Use shell glob for pattern matching
            try:
                # Escape pattern for safe shell execution
                escaped_pattern = shlex.quote(pattern)
                
                # Use shell expansion but only return filenames
                command = f"ls -1 {escaped_pattern} 2>/dev/null || true"
                output = await self.exec(command)
                
                if output.strip():
                    return [name for name in output.split('\n') if name.strip()]
                else:
                    return []
            except FileSystemError:
                # Fallback to empty list if pattern matching fails
                return []
        else:
            # List all files/directories using Python
            try:
                entries = []
                for entry in self.workspace_path.iterdir():
                    entries.append(entry.name)
                return sorted(entries)  # Sort for consistent output
            except Exception as e:
                raise FileSystemError(
                    f"Failed to list directory contents: {str(e)}",
                    ERROR_CODES.LS_FAILED
                ) from e
    
    async def _ls_with_details(self, pattern: Optional[str] = None) -> List[FileInfo]:
        """List files with detailed metadata.
        
        Args:
            pattern: Optional glob pattern
            
        Returns:
            List of FileInfo objects
        """
        # Get file names first
        filenames = await self._ls_names_only(pattern)
        file_infos: List[FileInfo] = []
        
        for name in filenames:
            try:
                full_path = self.workspace_path / name
                stat_result = full_path.stat()
                
                # Determine file type
                if full_path.is_file():
                    file_type = "file"
                elif full_path.is_dir():
                    file_type = "directory"
                elif full_path.is_symlink():
                    file_type = "symlink"
                else:
                    file_type = "file"  # Default fallback
                
                from datetime import datetime
                
                file_info: FileInfo = {
                    "name": name,
                    "type": file_type,  # type: ignore
                    "size": stat_result.st_size,
                    "modified": datetime.fromtimestamp(stat_result.st_mtime)
                }
                
                file_infos.append(file_info)
                
            except Exception:
                # Skip files that we can't stat (permissions, etc.)
                continue
        
        return file_infos
    
    def _get_safe_environment(self) -> Dict[str, str]:
        """Create a minimal safe environment for command execution.
        
        Returns:
            Environment dictionary with safe defaults
        """
        return {
            # Essential PATH with common safe locations
            'PATH': SAFE_PATH,
            
            # User information
            'USER': os.environ.get('USER', 'constellationfs'),
            
            # Shell
            'SHELL': self._shell_cmd,
            
            # Working directory
            'PWD': self.workspace,
            'HOME': self.workspace,
            
            # Temporary directory within workspace
            'TMPDIR': str(self.workspace_path / '.tmp'),
            'TMP': str(self.workspace_path / '.tmp'),
            
            # Locale settings for consistent behavior
            'LANG': SAFE_LOCALE,
            'LC_ALL': SAFE_LOCALE,
            
            # Block dangerous environment variables
            'LD_PRELOAD': '',
            'LD_LIBRARY_PATH': '',
            'DYLD_INSERT_LIBRARIES': '',
            'DYLD_LIBRARY_PATH': '',
            
            # Python-specific
            'PYTHONDONTWRITEBYTECODE': '1',  # Don't create .pyc files
            'PYTHONUNBUFFERED': '1',        # Unbuffered output
        }
    
    async def cleanup(self) -> None:
        """Clean up workspace resources."""
        # Cleanup is handled by WorkspaceManager
        WorkspaceManager.cleanup_user_workspace(self.user_id)