import asyncio
from typing import Union, List, Optional, Dict, Any, overload, cast
from pathlib import Path

from .backends.factory import BackendFactory
from .backends.base import FileSystemBackend
from .types import (
    FileInfo,
    FileSystemError,
    BackendConfig,
    LocalBackendConfig,
    ConfigDict
)
from .constants import ERROR_CODES


class FileSystem:
    """Main FileSystem class providing a unified interface for file operations.
    
    Supports multiple backend types (local, remote, docker) with automatic backend selection
    and configuration validation.
    
    Examples:
        Simple usage with user ID:
        >>> fs = FileSystem("user123")
        >>> await fs.exec("echo 'Hello World'")
        'Hello World'
        
        With full configuration:
        >>> fs = FileSystem({
        ...     "type": "local",
        ...     "user_id": "user123",
        ...     "shell": "bash",
        ...     "prevent_dangerous": True
        ... })
    """
    
    def __init__(self, config: Union[str, Dict[str, Any]]) -> None:
        """Initialize FileSystem with configuration.
        
        Args:
            config: Either a user_id string for simple usage, or a full configuration dict
            
        Raises:
            FileSystemError: When configuration is invalid
        """
        # Convert string user_id to config dict
        if isinstance(config, str):
            backend_config: BackendConfig = cast(LocalBackendConfig, {
                "type": "local",
                "user_id": config,
                "shell": "auto",
                "prevent_dangerous": True,
                "validate_utils": False
            })
        else:
            # Handle dict configuration
            if "type" not in config:
                # Default to local backend if type not specified
                backend_config = cast(LocalBackendConfig, {
                    "type": "local",
                    "shell": "auto",
                    "prevent_dangerous": True,
                    "validate_utils": False,
                    **config
                })
            else:
                backend_config = config  # type: ignore
        
        # Create backend through factory
        self.backend: FileSystemBackend = BackendFactory.create(backend_config)
        self._config = backend_config
    
    @property
    def workspace(self) -> str:
        """Get the workspace directory path.
        
        Returns:
            Absolute path to the workspace directory
        """
        return self.backend.workspace
    
    @property
    def backend_config(self) -> BackendConfig:
        """Get the full backend configuration.
        
        Returns:
            Complete backend configuration object
        """
        return self._config
    
    async def exec(self, command: str) -> str:
        """Execute a shell command in the workspace.
        
        Args:
            command: The shell command to execute
            
        Returns:
            Command output as string
            
        Raises:
            FileSystemError: When command is empty or execution fails
            DangerousOperationError: When dangerous operations are blocked
        """
        if not command.strip():
            raise FileSystemError("Command cannot be empty", ERROR_CODES.EMPTY_COMMAND)
        
        return await self.backend.exec(command)
    
    async def read(self, path: str) -> str:
        """Read the contents of a file.
        
        Args:
            path: Relative path to the file within the workspace
            
        Returns:
            File contents as UTF-8 string
            
        Raises:
            FileSystemError: When path is empty, file doesn't exist, or read fails
        """
        if not path.strip():
            raise FileSystemError("Path cannot be empty", ERROR_CODES.EMPTY_PATH)
        
        return await self.backend.read(path)
    
    async def write(self, path: str, content: str) -> None:
        """Write content to a file.
        
        Args:
            path: Relative path to the file within the workspace
            content: Content to write to the file as UTF-8 string
            
        Raises:
            FileSystemError: When path is empty or write fails
        """
        if not path.strip():
            raise FileSystemError("Path cannot be empty", ERROR_CODES.EMPTY_PATH)
        
        return await self.backend.write(path, content)
    
    @overload
    async def ls(self, pattern: Optional[str] = None) -> List[str]:
        """List files and directories (names only).
        
        Args:
            pattern: Optional glob pattern to filter results
            
        Returns:
            List of file/directory names
        """
        ...
    
    @overload
    async def ls(self, pattern: str, *, details: bool) -> List[FileInfo]:
        """List files and directories with detailed metadata.
        
        Args:
            pattern: Glob pattern to filter results
            details: If True, return FileInfo objects with metadata
            
        Returns:
            List of FileInfo objects with file metadata
        """
        ...
    
    @overload
    async def ls(self, *, details: bool) -> List[FileInfo]:
        """List all files and directories with detailed metadata.
        
        Args:
            details: If True, return FileInfo objects with metadata
            
        Returns:
            List of FileInfo objects with file metadata
        """
        ...
    
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
            List of file names or FileInfo objects depending on details flag
            
        Raises:
            FileSystemError: When directory listing fails
        """
        return await self.backend.ls(pattern, details=details)
    
    # Synchronous convenience methods
    def exec_sync(self, command: str) -> str:
        """Synchronous version of exec."""
        return asyncio.run(self.exec(command))
    
    def read_sync(self, path: str) -> str:
        """Synchronous version of read."""
        return asyncio.run(self.read(path))
    
    def write_sync(self, path: str, content: str) -> None:
        """Synchronous version of write."""
        asyncio.run(self.write(path, content))
    
    def ls_sync(
        self, 
        pattern: Optional[str] = None, 
        *, 
        details: bool = False
    ) -> Union[List[str], List[FileInfo]]:
        """Synchronous version of ls."""
        if pattern is None:
            return asyncio.run(self.ls(details=details))
        else:
            return asyncio.run(self.ls(pattern, details=details))
    
    async def __aenter__(self) -> "FileSystem":
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit."""
        # Cleanup if backend supports it
        if hasattr(self.backend, 'cleanup'):
            await self.backend.cleanup()
    
    def __enter__(self) -> "FileSystem":
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Context manager exit."""
        # Cleanup if backend supports it
        if hasattr(self.backend, 'cleanup'):
            asyncio.run(self.backend.cleanup())