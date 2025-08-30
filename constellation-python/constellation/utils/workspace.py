"""Workspace management utilities for user isolation."""

import os
import re
import tempfile
import shutil
import atexit
from pathlib import Path
from typing import Dict, Optional
from ..types import FileSystemError
from ..constants import (
    ERROR_CODES, 
    WORKSPACE_BASE_DIR, 
    WORKSPACE_PERMISSIONS,
    MAX_USER_ID_LENGTH,
    USER_ID_PATTERN
)


class WorkspaceManager:
    """Manages user-isolated workspaces."""
    
    _workspaces: Dict[str, Path] = {}
    _base_dir: Optional[Path] = None
    _cleanup_registered = False
    
    @classmethod
    def _get_base_dir(cls) -> Path:
        """Get or create the base directory for all workspaces."""
        if cls._base_dir is None:
            cls._base_dir = Path(tempfile.gettempdir()) / WORKSPACE_BASE_DIR
        return cls._base_dir
    
    @classmethod
    def validate_user_id(cls, user_id: str) -> None:
        """Validate user ID format and safety.
        
        Args:
            user_id: User identifier to validate
            
        Raises:
            FileSystemError: When user_id is invalid
        """
        if not user_id:
            raise FileSystemError("user_id cannot be empty", ERROR_CODES.INVALID_USER_ID)
        
        if not isinstance(user_id, str):
            raise FileSystemError("user_id must be a string", ERROR_CODES.INVALID_USER_ID)
        
        if len(user_id) > MAX_USER_ID_LENGTH:
            raise FileSystemError(
                f"user_id too long (max {MAX_USER_ID_LENGTH} characters)",
                ERROR_CODES.INVALID_USER_ID
            )
        
        # Only allow safe characters: alphanumeric, dash, underscore
        if not re.match(USER_ID_PATTERN, user_id):
            raise FileSystemError(
                "user_id can only contain letters, numbers, dashes, and underscores",
                ERROR_CODES.INVALID_USER_ID
            )
        
        # Prevent special directory names
        forbidden_names = {'.', '..', 'root', 'admin', 'system'}
        if user_id.lower() in forbidden_names:
            raise FileSystemError(
                f"user_id '{user_id}' is not allowed",
                ERROR_CODES.INVALID_USER_ID
            )
    
    @classmethod
    def ensure_user_workspace(cls, user_id: str) -> str:
        """Create or get user workspace directory.
        
        Args:
            user_id: User identifier
            
        Returns:
            Absolute path to user workspace as string
            
        Raises:
            FileSystemError: When workspace cannot be created
        """
        cls.validate_user_id(user_id)
        
        # Return cached workspace if already exists
        if user_id in cls._workspaces:
            workspace = cls._workspaces[user_id]
            if workspace.exists():
                return str(workspace)
            # If cached path no longer exists, remove from cache
            del cls._workspaces[user_id]
        
        # Create new workspace
        base_dir = cls._get_base_dir()
        workspace = base_dir / user_id
        
        try:
            # Create directory structure
            workspace.mkdir(parents=True, exist_ok=True)
            
            # Set restrictive permissions (Unix systems only)
            if hasattr(os, 'chmod'):
                os.chmod(workspace, WORKSPACE_PERMISSIONS)
            
            # Create temporary directory within workspace
            temp_dir = workspace / ".tmp"
            temp_dir.mkdir(exist_ok=True)
            if hasattr(os, 'chmod'):
                os.chmod(temp_dir, WORKSPACE_PERMISSIONS)
            
            # Cache the workspace
            cls._workspaces[user_id] = workspace
            
            # Register cleanup on first workspace creation
            if not cls._cleanup_registered:
                atexit.register(cls._cleanup_all_workspaces)
                cls._cleanup_registered = True
            
            return str(workspace)
        
        except Exception as e:
            raise FileSystemError(
                f"Failed to create workspace for user '{user_id}': {str(e)}",
                ERROR_CODES.WORKSPACE_ERROR
            ) from e
    
    @classmethod
    def cleanup_user_workspace(cls, user_id: str) -> None:
        """Clean up a specific user's workspace.
        
        Args:
            user_id: User identifier whose workspace to clean up
        """
        if user_id in cls._workspaces:
            workspace = cls._workspaces[user_id]
            cls._cleanup_workspace(workspace)
            del cls._workspaces[user_id]
    
    @classmethod
    def _cleanup_workspace(cls, workspace: Path) -> None:
        """Clean up a single workspace directory.
        
        Args:
            workspace: Path to workspace to clean up
        """
        try:
            if workspace.exists() and workspace.is_dir():
                # Remove all contents
                shutil.rmtree(workspace)
        except Exception:
            # Best effort cleanup - don't raise errors
            pass
    
    @classmethod 
    def _cleanup_all_workspaces(cls) -> None:
        """Clean up all known workspaces on exit."""
        for workspace in cls._workspaces.values():
            cls._cleanup_workspace(workspace)
        
        # Also try to clean up the entire base directory if it's empty
        try:
            base_dir = cls._get_base_dir()
            if base_dir.exists():
                # Remove empty parent directories up to base
                try:
                    base_dir.rmdir()  # Only succeeds if empty
                    # Try to remove parent "constellation-fs" if empty
                    base_dir.parent.rmdir()
                except OSError:
                    pass  # Directory not empty, which is fine
        except Exception:
            pass
    
    @classmethod
    def get_workspace_path(cls, user_id: str) -> Optional[str]:
        """Get workspace path if it exists, without creating it.
        
        Args:
            user_id: User identifier
            
        Returns:
            Absolute path to workspace if it exists, None otherwise
        """
        if user_id in cls._workspaces:
            workspace = cls._workspaces[user_id]
            if workspace.exists():
                return str(workspace)
        return None
    
    @classmethod
    def list_user_workspaces(cls) -> list[str]:
        """List all active user workspaces.
        
        Returns:
            List of user IDs with active workspaces
        """
        active_users = []
        for user_id, workspace in cls._workspaces.items():
            if workspace.exists():
                active_users.append(user_id)
        return active_users