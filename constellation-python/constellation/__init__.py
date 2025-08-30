"""ConstellationFS - Filesystem abstraction for AI agents."""

from .filesystem import FileSystem
from .types import (
    FileInfo,
    FileSystemError,
    DangerousOperationError,
    BackendConfig,
    LocalBackendConfig,
    RemoteBackendConfig,
    DockerBackendConfig,
)
from .constants import ERROR_CODES
from .safety import (
    is_command_safe, 
    is_dangerous_operation, 
    validate_command_structure,
    detect_obfuscation,
    check_resource_limits
)
from .utils import (
    get_logger,
    configure_logging, 
    POSIXCommands,
    PathValidator
)

__version__ = "0.1.0"
__author__ = "ConstellationFS Contributors"

__all__ = [
    # Main API
    "FileSystem",
    
    # Types
    "FileInfo",
    "BackendConfig",
    "LocalBackendConfig", 
    "RemoteBackendConfig",
    "DockerBackendConfig",
    
    # Exceptions
    "FileSystemError",
    "DangerousOperationError",
    
    # Constants
    "ERROR_CODES",
    
    # Safety utilities
    "is_command_safe",
    "is_dangerous_operation",
    "validate_command_structure",
    "detect_obfuscation", 
    "check_resource_limits",
    
    # Utility classes
    "get_logger",
    "configure_logging",
    "POSIXCommands", 
    "PathValidator",
    
    # Metadata
    "__version__",
    "__author__",
]