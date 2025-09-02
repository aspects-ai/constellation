import json
from pathlib import Path
from typing import Optional, Dict, Any, Union
from dataclasses import dataclass, asdict

from ..utils.logger import get_logger


@dataclass
class ConstellationFSConfig:
    """Main configuration for ConstellationFS.
    
    This class handles all library settings with a focus on essential functionality.
    Supports both programmatic configuration and loading from .constellationfs.json files.
    """
    
    workspace_root: str = "~/.constellationfs"
    """Base directory where user workspaces are stored"""
    
    default_user_id: str = "default"
    """Default user ID when none provided (single-tenant mode)"""
    
    max_workspace_size_mb: Optional[int] = None
    """Maximum size limit for individual workspaces in MB"""
    
    workspace_permissions: int = 0o755
    """File permissions for created workspace directories"""
    
    cleanup_on_exit: bool = True
    """Clean up temporary files on library exit"""
    
    log_level: str = "INFO"
    """Global logging level for ConstellationFS"""

    def __post_init__(self):
        """Validate and normalize configuration after initialization."""
        # Expand user directory notation
        self.workspace_root = str(Path(self.workspace_root).expanduser().resolve())
        
        # Validate user ID
        if not self.default_user_id or not self.default_user_id.strip():
            raise ValueError("default_user_id cannot be empty")
        
        # Validate workspace permissions
        if not isinstance(self.workspace_permissions, int) or self.workspace_permissions < 0:
            raise ValueError("workspace_permissions must be a positive integer")
        
        # Validate max workspace size
        if self.max_workspace_size_mb is not None and self.max_workspace_size_mb <= 0:
            raise ValueError("max_workspace_size_mb must be positive")
        
        # Validate log level
        valid_levels = {'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'}
        if self.log_level.upper() not in valid_levels:
            raise ValueError(f"Invalid log_level. Must be one of: {', '.join(valid_levels)}")
        self.log_level = self.log_level.upper()
    
    def get_user_workspace_path(self, user_id: Optional[str] = None) -> Path:
        """Get the full path to a user's workspace.
        
        Args:
            user_id: User identifier. If None, uses default_user_id
            
        Returns:
            Path to user's workspace directory
        """
        effective_user_id = user_id or self.default_user_id
        return Path(self.workspace_root) / "users" / effective_user_id
    
    def ensure_workspace_exists(self, user_id: Optional[str] = None) -> Path:
        """Ensure a user's workspace directory exists.
        
        Args:
            user_id: User identifier. If None, uses default_user_id
            
        Returns:
            Path to created workspace directory
            
        Raises:
            OSError: If workspace creation fails
            PermissionError: If insufficient permissions to create workspace
        """
        workspace_path = self.get_user_workspace_path(user_id)
        
        if not workspace_path.exists():
            try:
                workspace_path.mkdir(parents=True, exist_ok=True, mode=0o755)
                get_logger('constellation.config').info(
                    f"Created workspace: {workspace_path}",
                    user_id=user_id or self.default_user_id
                )
            except (OSError, PermissionError) as e:
                get_logger('constellation.config').error(
                    f"Failed to create workspace: {workspace_path}",
                    error=str(e)
                )
                raise
        
        return workspace_path
    
    def get_workspace_size_mb(self, user_id: Optional[str] = None) -> float:
        """Get the current size of a user's workspace in MB.
        
        Args:
            user_id: User identifier. If None, uses default_user_id
            
        Returns:
            Workspace size in megabytes
        """
        workspace_path = self.get_user_workspace_path(user_id)
        
        if not workspace_path.exists():
            return 0.0
        
        total_size = 0
        try:
            for item in workspace_path.rglob('*'):
                if item.is_file():
                    total_size += item.stat().st_size
        except (OSError, PermissionError):
            # Return 0 if we can't read the workspace
            return 0.0
        
        return total_size / (1024 * 1024)  # Convert to MB
    
    def check_workspace_size_limit(self, user_id: Optional[str] = None) -> bool:
        """Check if a user's workspace is within size limits.
        
        Args:
            user_id: User identifier. If None, uses default_user_id
            
        Returns:
            True if within limits or no limit set, False if over limit
        """
        if self.max_workspace_size_mb is None:
            return True
        
        current_size = self.get_workspace_size_mb(user_id)
        return current_size <= self.max_workspace_size_mb
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert configuration to dictionary.
        
        Returns:
            Configuration as dictionary
        """
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ConstellationFSConfig':
        """Create configuration from dictionary.
        
        Args:
            data: Configuration dictionary
            
        Returns:
            New configuration instance
        """
        # Filter out unknown keys to avoid TypeError
        valid_keys = {field.name for field in cls.__dataclass_fields__.values()}  # type: ignore
        filtered_data = {k: v for k, v in data.items() if k in valid_keys}
        return cls(**filtered_data)
    
    def save_to_file(self, file_path: Union[str, Path]) -> None:
        """Save configuration to a JSON file.
        
        Args:
            file_path: Path to save configuration file
            
        Raises:
            OSError: If file cannot be written
        """
        file_path = Path(file_path)
        
        try:
            with open(file_path, 'w') as f:
                json.dump(self.to_dict(), f, indent=2, sort_keys=True)
        except OSError as e:
            get_logger('constellation.config').error(
                f"Failed to save configuration to {file_path}",
                error=str(e)
            )
            raise
    
    @classmethod
    def load_from_file(cls, file_path: Union[str, Path]) -> 'ConstellationFSConfig':
        """Load configuration from a JSON file.
        
        Args:
            file_path: Path to configuration file
            
        Returns:
            Loaded configuration
            
        Raises:
            FileNotFoundError: If file doesn't exist
            ValueError: If file is invalid JSON or contains invalid configuration
        """
        file_path = Path(file_path)
        
        if not file_path.exists():
            raise FileNotFoundError(f"Configuration file not found: {file_path}")
        
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            if not isinstance(data, dict):
                raise ValueError("Configuration file must contain a JSON object")
            
            return cls.from_dict(data)
        
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in configuration file: {e}")
        except (OSError, IOError) as e:
            raise ValueError(f"Failed to read configuration file: {e}")
    
    @classmethod
    def find_and_load_config(cls, start_dir: Optional[Union[str, Path]] = None) -> 'ConstellationFSConfig':
        """Find and load configuration from .constellationfs.json file.
        
        Searches for .constellationfs.json in the following order:
        1. Current working directory
        2. Parent directories (walking up)
        3. User's home directory
        
        If no config file is found, returns default configuration.
        
        Args:
            start_dir: Directory to start search from. Defaults to current directory.
            
        Returns:
            Loaded or default configuration
        """
        start_path = Path(start_dir) if start_dir else Path.cwd()
        config_filename = '.constellationfs.json'
        
        # Search in current directory and parents
        current = start_path.resolve()
        while current != current.parent:  # Stop at filesystem root
            config_path = current / config_filename
            if config_path.exists():
                get_logger('constellation.config').info(f"Loading config from {config_path}")
                try:
                    return cls.load_from_file(config_path)
                except (ValueError, FileNotFoundError) as e:
                    get_logger('constellation.config').warning(
                        f"Failed to load config from {config_path}: {e}"
                    )
            current = current.parent
        
        # Search in home directory
        home_config = Path.home() / config_filename
        if home_config.exists():
            get_logger('constellation.config').info(f"Loading config from {home_config}")
            try:
                return cls.load_from_file(home_config)
            except (ValueError, FileNotFoundError) as e:
                get_logger('constellation.config').warning(
                    f"Failed to load config from {home_config}: {e}"
                )
        
        # Return default configuration
        get_logger('constellation.config').info("No configuration file found, using defaults")
        return cls()


# Global configuration instance
_global_config: Optional[ConstellationFSConfig] = None


def get_global_config() -> ConstellationFSConfig:
    """Get the global ConstellationFS configuration.
    
    Returns:
        Global configuration instance
    """
    global _global_config
    if _global_config is None:
        _global_config = ConstellationFSConfig.find_and_load_config()
    return _global_config


def set_global_config(config: ConstellationFSConfig) -> None:
    """Set the global ConstellationFS configuration.
    
    Args:
        config: Configuration instance to use globally
    """
    global _global_config
    _global_config = config


def reset_global_config() -> None:
    """Reset global configuration to default.
    
    This will cause the next call to get_global_config() to reload from files.
    """
    global _global_config
    _global_config = None


# Convenience functions for common operations

def get_workspace_root() -> str:
    """Get the configured workspace root directory.
    
    Returns:
        Workspace root directory path
    """
    return get_global_config().workspace_root


def get_user_workspace_path(user_id: Optional[str] = None) -> Path:
    """Get path to a user's workspace using global configuration.
    
    Args:
        user_id: User identifier. If None, uses configured default
        
    Returns:
        Path to user's workspace directory
    """
    return get_global_config().get_user_workspace_path(user_id)


def ensure_user_workspace(user_id: Optional[str] = None) -> Path:
    """Ensure a user's workspace exists using global configuration.
    
    Args:
        user_id: User identifier. If None, uses configured default
        
    Returns:
        Path to created workspace directory
    """
    return get_global_config().ensure_workspace_exists(user_id)