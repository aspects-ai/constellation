"""Claude SDK adapter for ConstellationFS integration."""

import re
import shlex
from typing import TYPE_CHECKING, List, Dict, Any, Optional, Union
from .base_adapter import BaseSDKAdapter
from .subprocess_patch import SubprocessInterceptor
from ..types import FileInfo
from ..utils.posix_commands import POSIXCommands
from ..utils.logger import get_logger

if TYPE_CHECKING:
    from ..filesystem import FileSystem


class ClaudeAdapter(BaseSDKAdapter):
    """Adapter for Claude SDK integration.
    
    Provides Claude-specific tool implementations that route through ConstellationFS
    while maintaining compatibility with existing Claude tool interfaces.
    """
    
    def __init__(self, filesystem: 'FileSystem') -> None:
        """Initialize Claude adapter.
        
        Args:
            filesystem: ConstellationFS instance
        """
        super().__init__(filesystem)
        self.interceptor = SubprocessInterceptor(self)
        # Use workspace as identifier since backend may not have user_id
        workspace_id = getattr(filesystem.backend, 'user_id', filesystem.workspace.split('/')[-1])
        self.logger = get_logger(f'constellation.adapter.claude.{workspace_id}')
    
    def enable(self) -> None:
        """Enable Claude adapter with subprocess interception."""
        if self._enabled:
            return
        
        self.logger.info("Enabling Claude adapter")
        self.interceptor.enable()
        self._enabled = True
    
    def disable(self) -> None:
        """Disable Claude adapter and restore original functions."""
        if not self._enabled:
            return
        
        self.logger.info("Disabling Claude adapter") 
        self.interceptor.disable()
        self._enabled = False
    
    # Claude Tool Implementations
    
    async def bash(self, command: str, *, timeout: Optional[int] = None) -> str:
        """Claude's Bash tool implementation.
        
        Args:
            command: Shell command to execute
            timeout: Command timeout in seconds (ignored - uses backend timeout)
            
        Returns:
            Command output as string
            
        Raises:
            FileSystemError: If command execution fails
        """
        self.logger.info("Claude Bash tool", command=command[:100])
        return await super().bash(command)
    
    async def read(self, file_path: str) -> str:
        """Claude's Read tool implementation.
        
        Args:
            file_path: Absolute or relative path to file
            
        Returns:
            File contents as string
            
        Raises:
            FileSystemError: If file cannot be read
        """
        # Convert absolute paths to relative for workspace safety
        if file_path.startswith('/'):
            self.logger.warning("Converting absolute path to relative", 
                              original_path=file_path)
            file_path = file_path.lstrip('/')
        
        self.logger.info("Claude Read tool", file_path=file_path)
        return await super().read(file_path)
    
    async def write(self, file_path: str, content: str) -> None:
        """Claude's Write tool implementation.
        
        Args:
            file_path: Absolute or relative path to file
            content: Content to write
            
        Raises:
            FileSystemError: If file cannot be written
        """
        # Convert absolute paths to relative for workspace safety  
        if file_path.startswith('/'):
            self.logger.warning("Converting absolute path to relative",
                              original_path=file_path)
            file_path = file_path.lstrip('/')
        
        self.logger.info("Claude Write tool", file_path=file_path, 
                        content_length=len(content))
        await super().write(file_path, content)
    
    async def edit(self, file_path: str, old_string: str, new_string: str, *, replace_all: bool = False) -> None:
        """Claude's Edit tool implementation.
        
        Args:
            file_path: Path to file to edit
            old_string: String to replace
            new_string: Replacement string
            replace_all: Replace all occurrences (default: False)
            
        Raises:
            FileSystemError: If edit operation fails
        """
        self.logger.info("Claude Edit tool", file_path=file_path, 
                        replace_all=replace_all)
        
        # Read current content
        content = await self.read(file_path)
        
        if replace_all:
            # Replace all occurrences
            new_content = content.replace(old_string, new_string)
        else:
            # Replace only first occurrence
            if old_string not in content:
                raise ValueError(f"String not found in file: {old_string[:50]}...")
            
            # Ensure the string appears only once to avoid ambiguity
            occurrences = content.count(old_string)
            if occurrences > 1:
                raise ValueError(f"String appears {occurrences} times. Use replace_all=True for multiple replacements.")
            
            new_content = content.replace(old_string, new_string, 1)
        
        # Write back the modified content
        await self.write(file_path, new_content)
    
    async def ls(self, path: Optional[str] = None, *, details: bool = False, 
                ignore: Optional[List[str]] = None) -> Union[List[str], List[FileInfo]]:
        """Claude's LS tool implementation.
        
        Args:
            path: Directory path to list (None for workspace root)
            details: Return detailed file information
            ignore: List of glob patterns to ignore
            
        Returns:
            List of filenames or FileInfo objects
            
        Raises:
            FileSystemError: If directory listing fails
        """
        self.logger.info("Claude LS tool", path=path, details=details)
        
        # Get base listing
        result: Union[List[str], List[FileInfo]] = await super().ls(path, details=details)
        
        # Apply ignore patterns if specified
        if ignore and isinstance(result, list):
            import fnmatch
            if details and isinstance(result[0], dict):
                # Filter FileInfo objects
                filtered: List[FileInfo] = []
                for item in result:
                    item_dict = item if isinstance(item, dict) else item.__dict__
                    name = item_dict.get('name', str(item))
                    if not any(fnmatch.fnmatch(name, pattern) for pattern in ignore):
                        filtered.append(item)  # type: ignore
                result = filtered
            else:
                # Filter string names - cast to str to match expected type
                filtered_str: List[str] = [str(item) for item in result 
                                          if not any(fnmatch.fnmatch(str(item), pattern) for pattern in ignore)]
                result = filtered_str
        
        return result
    
    async def glob(self, pattern: str, *, details: bool = False) -> Union[List[str], List[FileInfo]]:
        """Claude's Glob tool implementation.
        
        Args:
            pattern: Glob pattern to match files
            details: Return detailed file information
            
        Returns:
            List of matching filenames or FileInfo objects
        """
        self.logger.info("Claude Glob tool", pattern=pattern, details=details)
        
        # Use find command to implement glob functionality
        find_cmd = POSIXCommands.find('.', name_pattern=pattern)
        
        try:
            # Use filesystem.exec directly to avoid recursion when subprocess interception is enabled
            output = await self.filesystem.exec(find_cmd)
            file_paths = [line.strip() for line in output.splitlines() if line.strip()]
            
            if details:
                # Get detailed info for each file
                detailed_results: List[FileInfo] = []
                for file_path in file_paths:
                    try:
                        file_info_list = await self.ls(file_path, details=True)
                        if file_info_list and isinstance(file_info_list[0], dict):
                            detailed_results.extend(file_info_list)  # type: ignore[arg-type]
                    except Exception:
                        # Skip files we can't stat
                        continue
                return detailed_results
            else:
                return file_paths
        except Exception as e:
            self.logger.error("Glob operation failed", pattern=pattern, error=str(e))
            return []
    
    async def grep(self, pattern: str, path: Optional[str] = None, 
                  ignore_case: bool = False, line_numbers: bool = False,
                  context: Optional[int] = None, recursive: bool = False, **kwargs: Any) -> str:
        """Claude's Grep tool implementation.
        
        Args:
            pattern: Search pattern
            path: File/directory path to search (None for workspace)
            ignore_case: Case-insensitive search
            line_numbers: Include line numbers
            context: Lines of context around matches
            recursive: Search recursively
            
        Returns:
            Grep output as string
        """
        self.logger.info("Claude Grep tool", pattern=pattern[:50], 
                        path=path, recursive=recursive)
        
        # Build grep command using POSIXCommands
        cmd_parts = ['grep']
        
        # Add flags
        flags = ''
        if ignore_case:
            flags += 'i'
        if line_numbers:
            flags += 'n'
        if recursive:
            flags += 'r'
        
        if flags:
            cmd_parts.append(f'-{flags}')
        
        # Add context
        if context and context > 0:
            cmd_parts.extend(['-C', str(context)])
        
        # Add pattern (properly escaped)
        cmd_parts.append(shlex.quote(pattern))
        
        # Add path
        if path:
            cmd_parts.append(shlex.quote(path))
        else:
            cmd_parts.append('.')
        
        command = ' '.join(cmd_parts)
        
        try:
            # Use filesystem.exec directly to avoid recursion when subprocess interception is enabled
            return await self.filesystem.exec(command)
        except Exception as e:
            # Grep not finding matches isn't an error in Claude context
            if 'exit status 1' in str(e).lower():
                return ""  # No matches found
            raise
    
    # Legacy method names for backward compatibility
    
    def bash_sync(self, command: str) -> str:
        """Synchronous bash execution (legacy alias)."""
        return self.exec_sync(command)
    
    def run_command(self, command: str) -> str:
        """Run command synchronously (legacy alias)."""
        return self.exec_sync(command)
    
    async def run_command_async(self, command: str) -> str:
        """Run command asynchronously (legacy alias)."""
        return await self.bash(command)
    
    # Utility methods for Claude-specific functionality
    
    def get_workspace_info(self) -> Dict[str, Any]:
        """Get information about the current workspace."""
        return {
            'workspace_path': self.workspace,
            'user_id': getattr(self.filesystem.backend, 'user_id', 'unknown'),
            'backend_type': getattr(self.filesystem, 'backend_config', {}).get('type'),
            'adapter_enabled': self._enabled,
            'interceptor_enabled': self.interceptor.enabled if hasattr(self.interceptor, 'enabled') else False
        }
    
    def create_safe_command(self, command_template: str, **params: Any) -> str:
        """Create a safe command by escaping parameters.
        
        Args:
            command_template: Command template with {param} placeholders
            **params: Parameters to substitute
            
        Returns:
            Safe command string with escaped parameters
        """
        # Escape all parameters
        safe_params = {key: shlex.quote(str(value)) for key, value in params.items()}
        return command_template.format(**safe_params)