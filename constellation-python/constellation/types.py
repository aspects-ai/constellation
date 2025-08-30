from typing import TypedDict, Optional, Literal, Union, Any, Dict
from datetime import datetime
from typing import TypeAlias


class FileInfo(TypedDict):
    """File metadata information returned by detailed directory listings."""
    
    name: str
    type: Literal['file', 'directory', 'symlink']
    size: int
    modified: datetime


class FileSystemError(Exception):
    """Base exception for all filesystem operations."""
    
    def __init__(
        self, 
        message: str, 
        code: str, 
        command: Optional[str] = None
    ) -> None:
        """Initialize filesystem error.
        
        Args:
            message: Human-readable error message
            code: Error code for programmatic handling
            command: The command that caused the error (if applicable)
        """
        self.code = code
        self.command = command
        super().__init__(message)
        
    def __str__(self) -> str:
        if self.command:
            return f"{super().__str__()} (command: {self.command})"
        return super().__str__()


class DangerousOperationError(FileSystemError):
    """Exception raised when a dangerous operation is attempted."""
    
    def __init__(self, command: str) -> None:
        """Initialize dangerous operation error.
        
        Args:
            command: The dangerous command that was blocked
        """
        super().__init__(
            f"Dangerous operation blocked: {command}",
            "DANGEROUS_OPERATION",
            command
        )


# Configuration type aliases
ConfigDict: TypeAlias = Dict[str, Any]

class LocalBackendConfig(ConfigDict):
    """Configuration for local filesystem backend."""
    
    type: Literal['local']
    user_id: str
    shell: Literal['bash', 'sh', 'auto']
    prevent_dangerous: bool
    validate_utils: bool
    max_output_length: Optional[int]
    on_dangerous_operation: Optional[Any]  # Callback function


class RemoteBackendConfig(ConfigDict):
    """Configuration for remote filesystem backend (future)."""
    
    type: Literal['remote']
    user_id: str
    host: str
    port: int
    username: str
    password: Optional[str]
    key_file: Optional[str]
    prevent_dangerous: bool
    max_output_length: Optional[int]


class DockerBackendConfig(ConfigDict):
    """Configuration for Docker container backend (future)."""
    
    type: Literal['docker']
    user_id: str
    image: str
    container_name: Optional[str]
    volumes: Optional[Dict[str, str]]
    environment: Optional[Dict[str, str]]
    prevent_dangerous: bool
    max_output_length: Optional[int]


# Union type for all backend configurations
BackendConfig: TypeAlias = Union[
    LocalBackendConfig,
    RemoteBackendConfig,
    DockerBackendConfig
]


class SafetyCheckResult(TypedDict):
    """Result of command safety validation."""
    
    safe: bool
    reason: Optional[str]