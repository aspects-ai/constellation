from abc import ABC, abstractmethod
from typing import Protocol, List, Optional, Dict, Any, Union, runtime_checkable
from ..filesystem import FileSystem
from ..types import FileInfo


@runtime_checkable
class SDKAdapterProtocol(Protocol):
    """Protocol defining the interface for SDK adapters."""
    
    filesystem: FileSystem
    """Reference to the ConstellationFS instance."""
    
    def __init__(self, filesystem: FileSystem) -> None:
        """Initialize adapter with filesystem instance."""
        ...
    
    async def bash(self, command: str) -> str:
        """Execute a bash command through the filesystem.
        
        Args:
            command: Shell command to execute
            
        Returns:
            Command output as string
        """
        ...
    
    async def read(self, path: str) -> str:
        """Read file contents.
        
        Args:
            path: File path to read
            
        Returns:
            File contents as string
        """
        ...
    
    async def write(self, path: str, content: str) -> None:
        """Write content to file.
        
        Args:
            path: File path to write to
            content: Content to write
        """
        ...
    
    async def ls(self, path: Optional[str] = None, *, details: bool = False) -> Union[List[str], List[FileInfo]]:
        """List directory contents.
        
        Args:
            path: Directory path (None for workspace root)
            details: Return detailed file information
            
        Returns:
            List of filenames or FileInfo objects
        """
        ...
    
    def exec_sync(self, command: str) -> str:
        """Synchronous version of bash command execution.
        
        Args:
            command: Shell command to execute
            
        Returns:
            Command output as string
        """
        ...
    
    def read_sync(self, path: str) -> str:
        """Synchronous version of file reading.
        
        Args:
            path: File path to read
            
        Returns:
            File contents as string
        """
        ...
    
    def write_sync(self, path: str, content: str) -> None:
        """Synchronous version of file writing.
        
        Args:
            path: File path to write to
            content: Content to write
        """
        ...


class BaseSDKAdapter(ABC):
    """Abstract base class for SDK adapters.
    
    Provides common functionality and enforces the adapter interface.
    """
    
    def __init__(self, filesystem: FileSystem) -> None:
        """Initialize adapter with filesystem instance.
        
        Args:
            filesystem: ConstellationFS instance to use for operations
        """
        self.filesystem = filesystem
        self._enabled = False
    
    @property
    def enabled(self) -> bool:
        """Check if adapter is enabled."""
        return self._enabled
    
    @property
    def workspace(self) -> str:
        """Get workspace path from filesystem."""
        return self.filesystem.workspace
    
    async def bash(self, command: str) -> str:
        """Execute a bash command through the filesystem.
        
        Args:
            command: Shell command to execute
            
        Returns:
            Command output as string
            
        Raises:
            FileSystemError: If command execution fails
        """
        return await self.filesystem.exec(command)
    
    async def read(self, path: str) -> str:
        """Read file contents.
        
        Args:
            path: File path to read
            
        Returns:
            File contents as string
            
        Raises:
            FileSystemError: If file cannot be read
        """
        return await self.filesystem.read(path)
    
    async def write(self, path: str, content: str) -> None:
        """Write content to file.
        
        Args:
            path: File path to write to
            content: Content to write
            
        Raises:
            FileSystemError: If file cannot be written
        """
        await self.filesystem.write(path, content)
    
    async def ls(self, path: Optional[str] = None, *, details: bool = False) -> Union[List[str], List[FileInfo]]:
        """List directory contents.
        
        Args:
            path: Directory path (None for workspace root)  
            details: Return detailed file information
            
        Returns:
            List of filenames or FileInfo objects
            
        Raises:
            FileSystemError: If directory listing fails
        """
        if path is None:
            return await self.filesystem.ls(details=details)
        else:
            return await self.filesystem.ls(path, details=details)
    
    def exec_sync(self, command: str) -> str:
        """Synchronous version of bash command execution.
        
        Args:
            command: Shell command to execute
            
        Returns:
            Command output as string
            
        Raises:
            FileSystemError: If command execution fails
        """
        return self.filesystem.exec_sync(command)
    
    def read_sync(self, path: str) -> str:
        """Synchronous version of file reading.
        
        Args:
            path: File path to read
            
        Returns:
            File contents as string
            
        Raises:
            FileSystemError: If file cannot be read
        """
        return self.filesystem.read_sync(path)
    
    def write_sync(self, path: str, content: str) -> None:
        """Synchronous version of file writing.
        
        Args:
            path: File path to write to
            content: Content to write
            
        Raises:
            FileSystemError: If file cannot be written
        """
        self.filesystem.write_sync(path, content)
    
    def ls_sync(self, path: Optional[str] = None, *, details: bool = False) -> Union[List[str], List[FileInfo]]:
        """Synchronous version of directory listing.
        
        Args:
            path: Directory path (None for workspace root)
            details: Return detailed file information
            
        Returns:
            List of filenames or FileInfo objects
            
        Raises:
            FileSystemError: If directory listing fails
        """
        return self.filesystem.ls_sync(path, details=details)
    
    @abstractmethod
    def enable(self) -> None:
        """Enable the adapter (e.g., monkey-patching).
        
        Subclasses should implement this to activate their specific
        integration mechanisms.
        """
        pass
    
    @abstractmethod
    def disable(self) -> None:
        """Disable the adapter (e.g., restore original functions).
        
        Subclasses should implement this to deactivate their specific
        integration mechanisms.
        """
        pass
    
    def __enter__(self) -> "BaseSDKAdapter":
        """Context manager entry - enable adapter."""
        self.enable()
        return self
    
    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Context manager exit - disable adapter."""
        self.disable()
    
    async def __aenter__(self) -> "BaseSDKAdapter":
        """Async context manager entry - enable adapter."""
        self.enable()
        return self
    
    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit - disable adapter."""
        self.disable()