"""Base backend protocol for filesystem operations."""

from typing import Protocol, List, Optional, Union, runtime_checkable, Dict, Any
from ..types import ConfigDict, FileInfo


@runtime_checkable
class FileSystemBackend(Protocol):
    """Protocol defining the interface for filesystem backends.
    
    All backend implementations must conform to this protocol.
    """
    
    workspace: str
    """Absolute path to the workspace directory."""
    
    def __init__(self, config: ConfigDict) -> None:
        """Initialize backend with configuration.
        
        Args:
            config: Backend configuration dictionary
        """
        ...
    
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
        ...
    
    async def read(self, path: str) -> str:
        """Read file contents.
        
        Args:
            path: Relative path to file within workspace
            
        Returns:
            File contents as UTF-8 string
            
        Raises:
            FileSystemError: When file cannot be read
        """
        ...
    
    async def write(self, path: str, content: str) -> None:
        """Write content to file.
        
        Args:
            path: Relative path to file within workspace
            content: Content to write as UTF-8 string
            
        Raises:
            FileSystemError: When file cannot be written
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
            List of file names or FileInfo objects
            
        Raises:
            FileSystemError: When directory listing fails
        """
        ...
    
    async def cleanup(self) -> None:
        """Clean up resources (optional).
        
        Called when the backend is no longer needed.
        """
        pass