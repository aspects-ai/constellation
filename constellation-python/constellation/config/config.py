"""Configuration validation and management using Pydantic."""

import os
import re
from pathlib import Path
from typing import Any, Callable, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field, validator, root_validator

HAS_PYDANTIC = True

from ..constants import (
    DEFAULT_SHELL,
    DEFAULT_PREVENT_DANGEROUS,
    DEFAULT_VALIDATE_UTILS,
    DEFAULT_MAX_OUTPUT_LENGTH,
    USER_ID_PATTERN,
    MAX_USER_ID_LENGTH
)


class BaseBackendConfig(BaseModel):
    """Base configuration for all backend types."""
    
    class Config:
            extra = "forbid"  # Don't allow extra fields
            validate_assignment = True  # Validate on assignment
    
    user_id: str = Field(
        ...,
        description="User identifier for workspace isolation",
        min_length=1,
        max_length=MAX_USER_ID_LENGTH
    )
    
    prevent_dangerous: bool = Field(
        DEFAULT_PREVENT_DANGEROUS,
        description="Block dangerous operations"
    )
    
    max_output_length: Optional[int] = Field(
        None,
        description="Maximum length of command output (truncates if exceeded)",
        gt=0,
        le=10_000_000  # 10MB limit
    )
    
    on_dangerous_operation: Optional[Callable[[str], None]] = Field(
        None,
        description="Callback function for dangerous operations"
    )
    
    @validator('user_id')
    def validate_user_id(cls, v: str) -> str:
        """Validate user ID format and content."""
        if not v or not v.strip():
            raise ValueError("user_id cannot be empty")
        
        v = v.strip()
        
        # Check pattern (alphanumeric, dash, underscore only)
        if not re.match(USER_ID_PATTERN, v):
            raise ValueError(
                "user_id can only contain letters, numbers, dashes, and underscores"
            )
        
        # Check for forbidden names
        forbidden_names = {'.', '..', 'root', 'admin', 'system', 'null', 'undefined'}
        if v.lower() in forbidden_names:
            raise ValueError(f"user_id '{v}' is not allowed")
        
        return v
    
    @validator('on_dangerous_operation')
    def validate_callback(cls, v: Optional[Callable]) -> Optional[Callable]:
        """Validate callback function."""
        if v is not None and not callable(v):
            raise ValueError("on_dangerous_operation must be callable")
        return v


class LocalBackendConfig(BaseBackendConfig):
    """Configuration for local filesystem backend."""
    
    type: Literal['local'] = Field(
        'local',
        description="Backend type identifier"
    )
    
    shell: Literal['bash', 'sh', 'auto'] = Field(
        DEFAULT_SHELL,
        description="Shell to use for command execution"
    )
    
    validate_utils: bool = Field(
        DEFAULT_VALIDATE_UTILS,
        description="Validate that required POSIX utilities are available"
    )
    
    timeout_seconds: Optional[float] = Field(
        None,
        description="Command execution timeout in seconds",
        gt=0,
        le=3600  # 1 hour max
    )
    
    max_concurrent_commands: int = Field(
        10,
        description="Maximum number of concurrent command executions",
        gt=0,
        le=100
    )
    
    resource_limits: Optional[Dict[str, Any]] = Field(
        None,
        description="Resource limits for command execution"
    )
    
    @validator('resource_limits')
    def validate_resource_limits(cls, v: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Validate resource limits configuration."""
        if v is None:
            return v
        
        allowed_keys = {
            'max_memory_mb', 'max_cpu_percent', 'max_processes',
            'max_file_size_mb', 'max_open_files'
        }
        
        for key in v.keys():
            if key not in allowed_keys:
                raise ValueError(f"Unknown resource limit: {key}")
        
        # Validate specific limits
        if 'max_memory_mb' in v:
            if not isinstance(v['max_memory_mb'], (int, float)) or v['max_memory_mb'] <= 0:
                raise ValueError("max_memory_mb must be a positive number")
        
        if 'max_cpu_percent' in v:
            if not isinstance(v['max_cpu_percent'], (int, float)) or not 0 < v['max_cpu_percent'] <= 100:
                raise ValueError("max_cpu_percent must be between 0 and 100")
        
        return v


class RemoteBackendConfig(BaseBackendConfig):
    """Configuration for remote filesystem backend (SSH-based)."""
    
    type: Literal['remote'] = Field(
        'remote',
        description="Backend type identifier"
    )
    
    host: str = Field(
        ...,
        description="Remote host address",
        min_length=1
    )
    
    port: int = Field(
        22,
        description="SSH port number",
        ge=1,
        le=65535
    )
    
    username: str = Field(
        ...,
        description="SSH username",
        min_length=1
    )
    
    password: Optional[str] = Field(
        None,
        description="SSH password (use key_file instead if possible)"
    )
    
    key_file: Optional[str] = Field(
        None,
        description="Path to SSH private key file"
    )
    
    connect_timeout: float = Field(
        30.0,
        description="SSH connection timeout in seconds",
        gt=0,
        le=300
    )
    
    command_timeout: float = Field(
        300.0,
        description="Command execution timeout in seconds", 
        gt=0,
        le=3600
    )
    
    @validator('key_file')
    def validate_key_file(cls, v: Optional[str]) -> Optional[str]:
        """Validate SSH key file exists."""
        if v is not None:
            key_path = Path(v).expanduser()
            if not key_path.exists():
                raise ValueError(f"SSH key file not found: {v}")
            if not key_path.is_file():
                raise ValueError(f"SSH key path is not a file: {v}")
        return v
    
    @root_validator(pre=True)
    def validate_auth_method(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        """Ensure at least one authentication method is provided."""
        password = values.get('password')
        key_file = values.get('key_file')
        
        if not password and not key_file:
            raise ValueError("Either password or key_file must be provided")
        
        return values


class DockerBackendConfig(BaseBackendConfig):
    """Configuration for Docker container backend."""
    
    type: Literal['docker'] = Field(
        'docker',
        description="Backend type identifier"
    )
    
    image: str = Field(
        ...,
        description="Docker image to use",
        min_length=1
    )
    
    container_name: Optional[str] = Field(
        None,
        description="Custom container name (auto-generated if None)"
    )
    
    volumes: Optional[Dict[str, str]] = Field(
        None,
        description="Volume mounts (host_path: container_path)"
    )
    
    environment: Optional[Dict[str, str]] = Field(
        None,
        description="Environment variables"
    )
    
    network_mode: str = Field(
        'none',
        description="Docker network mode"
    )
    
    memory_limit: Optional[str] = Field(
        None,
        description="Memory limit (e.g., '512m', '1g')"
    )
    
    cpu_limit: Optional[float] = Field(
        None,
        description="CPU limit (fraction of CPU cores)",
        gt=0,
        le=32  # Reasonable upper limit
    )
    
    auto_remove: bool = Field(
        True,
        description="Automatically remove container when done"
    )
    
    container_timeout: float = Field(
        300.0,
        description="Container execution timeout in seconds",
        gt=0,
        le=3600
    )
    
    @validator('container_name')
    def validate_container_name(cls, v: Optional[str]) -> Optional[str]:
        """Validate Docker container name format."""
        if v is not None:
            # Docker container names must match: [a-zA-Z0-9][a-zA-Z0-9_.-]*
            if not re.match(r'^[a-zA-Z0-9][a-zA-Z0-9_.-]*$', v):
                raise ValueError("Invalid Docker container name format")
        return v
    
    @validator('memory_limit')
    def validate_memory_limit(cls, v: Optional[str]) -> Optional[str]:
        """Validate Docker memory limit format."""
        if v is not None:
            # Should match Docker memory format: number + unit (k, m, g)
            if not re.match(r'^\d+[kmg]?$', v.lower()):
                raise ValueError("Invalid memory limit format (e.g., '512m', '1g')")
        return v
    
    @validator('environment')
    def validate_environment(cls, v: Optional[Dict[str, str]]) -> Optional[Dict[str, str]]:
        """Validate environment variables."""
        if v is not None:
            # Check for dangerous environment variables
            dangerous_vars = {'LD_PRELOAD', 'LD_LIBRARY_PATH', 'DYLD_INSERT_LIBRARIES'}
            for var_name in v.keys():
                if var_name in dangerous_vars:
                    raise ValueError(f"Dangerous environment variable not allowed: {var_name}")
        return v


# Union type for all backend configurations
BackendConfig = Union[LocalBackendConfig, RemoteBackendConfig, DockerBackendConfig]


class ConstellationConfig(BaseModel):
    """Main ConstellationFS configuration."""
    
    class Config:
        extra = "forbid"
        validate_assignment = True
    
    # Global settings
    log_level: str = Field(
        'INFO',
        description="Global logging level"
    )
    
    log_file: Optional[str] = Field(
        None,
        description="Path to log file"
    )
    
    json_logs: bool = Field(
        False,
        description="Output logs in JSON format"
    )
    
    # Security settings
    strict_path_validation: bool = Field(
        True,
        description="Enable strict path validation"
    )
    
    audit_commands: bool = Field(
        True,
        description="Audit all command executions"
    )
    
    rate_limit_per_user: Optional[int] = Field(
        None,
        description="Commands per minute limit per user",
        gt=0,
        le=10000
    )
    
    # Workspace settings
    workspace_base_dir: Optional[str] = Field(
        None,
        description="Base directory for user workspaces"
    )
    
    workspace_cleanup_on_exit: bool = Field(
        True,
        description="Clean up workspaces on process exit"
    )
    
    max_workspace_size_mb: Optional[int] = Field(
        None,
        description="Maximum workspace size in MB",
        gt=0
    )
    
    @validator('log_level')
    def validate_log_level(cls, v: str) -> str:
        """Validate log level."""
        valid_levels = {'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'}
        if v.upper() not in valid_levels:
            raise ValueError(f"Invalid log level. Must be one of: {', '.join(valid_levels)}")
        return v.upper()
    
    @validator('workspace_base_dir')
    def validate_workspace_dir(cls, v: Optional[str]) -> Optional[str]:
        """Validate workspace base directory."""
        if v is not None:
            path = Path(v)
            if path.exists() and not path.is_dir():
                raise ValueError("workspace_base_dir must be a directory")
        return v


def load_config_from_file(file_path: Union[str, Path]) -> ConstellationConfig:
    """Load configuration from a file.
    
    Args:
        file_path: Path to configuration file (JSON or YAML)
        
    Returns:
        Loaded configuration
        
    Raises:
        ValueError: When file format is unsupported or invalid
        FileNotFoundError: When file doesn't exist
    """
    file_path = Path(file_path)
    
    if not file_path.exists():
        raise FileNotFoundError(f"Configuration file not found: {file_path}")
    
    import json
    
    try:
        with open(file_path, 'r') as f:
            if file_path.suffix.lower() == '.json':
                data = json.load(f)
            elif file_path.suffix.lower() in ('.yml', '.yaml'):
                try:
                    import yaml  # type: ignore
                    data = yaml.safe_load(f)
                except ImportError:
                    raise ValueError("PyYAML not installed, cannot load YAML configuration")
            else:
                raise ValueError(f"Unsupported configuration file format: {file_path.suffix}")
    
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in configuration file: {e}")
    except Exception as e:
        raise ValueError(f"Failed to load configuration file: {e}")
    
    return ConstellationConfig(**data)


def load_config_from_env() -> ConstellationConfig:
    """Load configuration from environment variables.
    
    Environment variables should be prefixed with CONSTELLATION_.
    
    Returns:
        Configuration loaded from environment
    """
    config_data: Dict[str, Any] = {}
    
    # Map environment variables to config fields
    env_mapping = {
        'CONSTELLATION_LOG_LEVEL': 'log_level',
        'CONSTELLATION_LOG_FILE': 'log_file', 
        'CONSTELLATION_JSON_LOGS': 'json_logs',
        'CONSTELLATION_STRICT_PATH_VALIDATION': 'strict_path_validation',
        'CONSTELLATION_AUDIT_COMMANDS': 'audit_commands',
        'CONSTELLATION_RATE_LIMIT_PER_USER': 'rate_limit_per_user',
        'CONSTELLATION_WORKSPACE_BASE_DIR': 'workspace_base_dir',
        'CONSTELLATION_WORKSPACE_CLEANUP_ON_EXIT': 'workspace_cleanup_on_exit',
        'CONSTELLATION_MAX_WORKSPACE_SIZE_MB': 'max_workspace_size_mb',
    }
    
    for env_var, config_key in env_mapping.items():
        value = os.environ.get(env_var)
        if value is not None:
            # Convert string values to appropriate types
            if config_key in ('json_logs', 'strict_path_validation', 'audit_commands', 'workspace_cleanup_on_exit'):
                config_data[config_key] = value.lower() in ('true', '1', 'yes', 'on')
            elif config_key in ('rate_limit_per_user', 'max_workspace_size_mb'):
                try:
                    config_data[config_key] = int(value)
                except ValueError:
                    pass  # Skip invalid numeric values
            else:
                config_data[config_key] = value
    
    return ConstellationConfig(**config_data)


def create_backend_config(config_dict: Dict[str, Any]) -> BackendConfig:
    """Create a backend configuration from a dictionary.
    
    Args:
        config_dict: Configuration dictionary
        
    Returns:
        Appropriate backend configuration instance
        
    Raises:
        ValueError: When backend type is unknown or configuration is invalid
    """
    backend_type = config_dict.get('type', 'local')
    
    if backend_type == 'local':
        return LocalBackendConfig(**config_dict)
    elif backend_type == 'remote':
        return RemoteBackendConfig(**config_dict)
    elif backend_type == 'docker':
        return DockerBackendConfig(**config_dict)
    else:
        raise ValueError(f"Unknown backend type: {backend_type}")


def validate_backend_config(config: Dict[str, Any]) -> BackendConfig:
    """Validate backend configuration dictionary.
    
    Args:
        config: Configuration dictionary to validate
        
    Returns:
        Validated backend configuration
        
    Raises:
        ValueError: When configuration is invalid
    """
    return create_backend_config(config)