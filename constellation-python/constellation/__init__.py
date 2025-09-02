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
from .security import (
    is_command_safe, 
    is_dangerous_operation, 
    validate_path_safety,
    SecurityValidator,
    SecurityConfig
)
from .utils import (
    get_logger,
    configure_logging, 
    POSIXCommands,
    PathValidator
)
from .adapters import (
    BaseSDKAdapter,
    SDKAdapterProtocol,
    ClaudeAdapter,
    SubprocessInterceptor,
)
from .config import (
    ConstellationFSConfig,
    WorkspaceManager,
    WorkspaceInfo,
    get_global_config,
    set_global_config,
    reset_global_config,
    get_workspace_manager,
    set_workspace_manager
)
from .security import (
    WorkspaceSafetyValidator,
    WorkspaceSafetyConfig,
    validate_user_path,
    is_path_safe,
    create_safe_workspace_validator
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
    
    # SDK Adapters
    "BaseSDKAdapter",
    "SDKAdapterProtocol",
    "ClaudeAdapter",
    "SubprocessInterceptor",
    
    # Configuration & Workspace Management (Phase 4)
    "ConstellationFSConfig",
    "WorkspaceManager",
    "WorkspaceInfo", 
    "get_global_config",
    "set_global_config",
    "reset_global_config",
    "get_workspace_manager", 
    "set_workspace_manager",
    
    # Enhanced Safety
    "WorkspaceSafetyValidator",
    "WorkspaceSafetyConfig",
    "validate_user_path",
    "is_path_safe",
    "create_safe_workspace_validator",
    
    # Metadata
    "__version__",
    "__author__",
]