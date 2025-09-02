"""Configuration management for ConstellationFS."""

from .config import ConstellationFSConfig, get_global_config, set_global_config, reset_global_config
from .workspace_manager import WorkspaceManager, WorkspaceInfo, get_workspace_manager, set_workspace_manager

__all__ = [
    # Main configuration
    "ConstellationFSConfig",
    "get_global_config",
    "set_global_config", 
    "reset_global_config",
    
    # Workspace management
    "WorkspaceManager",
    "WorkspaceInfo",
    "get_workspace_manager",
    "set_workspace_manager",
]