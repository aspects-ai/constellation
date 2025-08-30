"""Constants and error codes for ConstellationFS."""

from typing import Final


class ErrorCodes:
    """Error codes for filesystem operations."""
    
    # Command execution errors
    EMPTY_COMMAND: Final[str] = "EMPTY_COMMAND"
    EXEC_FAILED: Final[str] = "EXEC_FAILED"
    EXEC_ERROR: Final[str] = "EXEC_ERROR"
    
    # File operation errors
    EMPTY_PATH: Final[str] = "EMPTY_PATH"
    READ_FAILED: Final[str] = "READ_FAILED"
    WRITE_FAILED: Final[str] = "WRITE_FAILED"
    LS_FAILED: Final[str] = "LS_FAILED"
    
    # Security errors
    DANGEROUS_OPERATION: Final[str] = "DANGEROUS_OPERATION"
    ABSOLUTE_PATH_REJECTED: Final[str] = "ABSOLUTE_PATH_REJECTED"
    PATH_ESCAPE_ATTEMPT: Final[str] = "PATH_ESCAPE_ATTEMPT"
    
    # Configuration errors
    INVALID_CONFIG: Final[str] = "INVALID_CONFIG"
    INVALID_USER_ID: Final[str] = "INVALID_USER_ID"
    INVALID_BACKEND: Final[str] = "INVALID_BACKEND"
    
    # Environment errors
    MISSING_UTILITIES: Final[str] = "MISSING_UTILITIES"
    WORKSPACE_ERROR: Final[str] = "WORKSPACE_ERROR"


# Create singleton instance
ERROR_CODES = ErrorCodes()


# Default configuration values
DEFAULT_SHELL: Final[str] = "auto"
DEFAULT_MAX_OUTPUT_LENGTH: Final[int] = 100000
DEFAULT_PREVENT_DANGEROUS: Final[bool] = True
DEFAULT_VALIDATE_UTILS: Final[bool] = False

# Workspace settings
WORKSPACE_BASE_DIR: Final[str] = "constellation-fs/users"
WORKSPACE_PERMISSIONS: Final[int] = 0o700

# Security settings
MAX_USER_ID_LENGTH: Final[int] = 255
USER_ID_PATTERN: Final[str] = r'^[a-zA-Z0-9_-]+$'

# Environment settings
SAFE_PATH: Final[str] = "/usr/local/bin:/usr/bin:/bin"
SAFE_LOCALE: Final[str] = "C"