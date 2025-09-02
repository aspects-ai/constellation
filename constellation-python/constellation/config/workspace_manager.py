"""Workspace management with user isolation for ConstellationFS."""

import os
import shutil
import tempfile
from pathlib import Path
from typing import Optional, Dict, Set, Any, List
from contextlib import contextmanager
import atexit
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from .config import ConstellationFSConfig, get_global_config
from ..utils.logger import get_logger
from ..types import FileSystemError
from ..constants import ERROR_CODES
from ..security import validate_user_path, is_path_safe


@dataclass
class WorkspaceInfo:
    """Information about a user workspace."""
    
    user_id: str
    path: Path
    created_at: datetime
    last_accessed: datetime
    size_mb: float = 0.0
    is_temporary: bool = False
    is_active: bool = True
    
    def update_access_time(self) -> None:
        """Update the last accessed timestamp."""
        self.last_accessed = datetime.now()
    
    def update_size(self) -> None:
        """Update the workspace size."""
        if self.path.exists():
            total_size = 0
            try:
                for item in self.path.rglob('*'):
                    if item.is_file():
                        total_size += item.stat().st_size
                self.size_mb = total_size / (1024 * 1024)
            except (OSError, PermissionError):
                self.size_mb = 0.0


class WorkspaceManager:
    """Manages user workspaces with isolation and resource controls."""
    
    def __init__(self, config: Optional[ConstellationFSConfig] = None):
        """Initialize workspace manager.
        
        Args:
            config: Configuration to use. If None, uses global config.
        """
        self.config = config or get_global_config()
        self.logger = get_logger('constellation.workspace')
        self._lock = threading.RLock()
        self._workspaces: Dict[str, WorkspaceInfo] = {}
        self._temp_workspaces: Set[str] = set()
        
        # Register cleanup on exit
        atexit.register(self.cleanup_all)
        
        # Ensure base workspace directory exists
        self._ensure_base_directory()
    
    def _ensure_base_directory(self) -> None:
        """Ensure the base workspace directory exists."""
        base_path = Path(self.config.workspace_root)
        users_path = base_path / "users"
        
        try:
            users_path.mkdir(parents=True, exist_ok=True, mode=self.config.workspace_permissions)
        except (OSError, PermissionError) as e:
            self.logger.error(f"Failed to create base workspace directory: {base_path}", error=str(e))
            raise FileSystemError(f"Cannot create workspace directory: {e}", ERROR_CODES.WORKSPACE_ERROR)
    
    def _validate_user_id(self, user_id: str) -> str:
        """Validate and normalize user ID.
        
        Args:
            user_id: User identifier to validate
            
        Returns:
            Normalized user ID
            
        Raises:
            ValueError: If user ID is invalid
        """
        if not user_id or not isinstance(user_id, str):
            raise ValueError("User ID must be a non-empty string")
        
        user_id = user_id.strip()
        
        if not user_id:
            raise ValueError("User ID cannot be empty or whitespace")
        
        if len(user_id) > 64:  # Reasonable limit
            raise ValueError("User ID too long (max 64 characters)")
        
        # Check for dangerous characters
        dangerous_chars = {'/', '\\', '..', '.', '<', '>', ':', '"', '|', '?', '*', '\0'}
        if any(char in user_id for char in dangerous_chars):
            raise ValueError("User ID contains dangerous characters")
        
        # Check for dangerous names
        dangerous_names = {'root', 'admin', 'system', 'daemon', 'bin', 'sys', 'tmp', 'temp'}
        if user_id.lower() in dangerous_names:
            raise ValueError(f"User ID '{user_id}' is reserved")
        
        return user_id
    
    def get_workspace_path(self, user_id: Optional[str] = None) -> Path:
        """Get the path to a user's workspace.
        
        Args:
            user_id: User identifier. If None, uses default from config.
            
        Returns:
            Path to user's workspace
        """
        effective_user_id = user_id or self.config.default_user_id
        validated_user_id = self._validate_user_id(effective_user_id)
        
        return self.config.get_user_workspace_path(validated_user_id)
    
    def create_workspace(self, user_id: Optional[str] = None, temporary: bool = False) -> Path:
        """Create and initialize a user workspace.
        
        Args:
            user_id: User identifier. If None, uses default from config.
            temporary: If True, create a temporary workspace that will be cleaned up
            
        Returns:
            Path to created workspace
            
        Raises:
            FileSystemError: If workspace creation fails
            ValueError: If user_id is invalid
        """
        effective_user_id = user_id or self.config.default_user_id
        validated_user_id = self._validate_user_id(effective_user_id)
        
        with self._lock:
            # Check if workspace already exists
            if validated_user_id in self._workspaces:
                workspace_info = self._workspaces[validated_user_id]
                if workspace_info.path.exists():
                    workspace_info.update_access_time()
                    self.logger.info(f"Using existing workspace for user {validated_user_id}")
                    return workspace_info.path
            
            if temporary:
                # Create temporary workspace
                try:
                    temp_dir = tempfile.mkdtemp(
                        prefix=f"constellation_{validated_user_id}_",
                        dir=tempfile.gettempdir()
                    )
                    workspace_path = Path(temp_dir)
                    self._temp_workspaces.add(validated_user_id)
                    self.logger.info(f"Created temporary workspace for user {validated_user_id}: {workspace_path}")
                except OSError as e:
                    raise FileSystemError(f"Failed to create temporary workspace: {e}", ERROR_CODES.WORKSPACE_ERROR)
            else:
                # Create persistent workspace
                workspace_path = self.get_workspace_path(validated_user_id)
                
                try:
                    workspace_path.mkdir(parents=True, exist_ok=True, mode=self.config.workspace_permissions)
                    self.logger.info(f"Created workspace for user {validated_user_id}: {workspace_path}")
                except (OSError, PermissionError) as e:
                    raise FileSystemError(f"Failed to create workspace for {validated_user_id}: {e}", ERROR_CODES.WORKSPACE_ERROR)
            
            # Create workspace info
            now = datetime.now()
            workspace_info = WorkspaceInfo(
                user_id=validated_user_id,
                path=workspace_path,
                created_at=now,
                last_accessed=now,
                is_temporary=temporary
            )
            
            self._workspaces[validated_user_id] = workspace_info
            
            # Check size limits if configured
            if self.config.max_workspace_size_mb is not None:
                self._check_size_limit(workspace_info)
            
            return workspace_path
    
    def get_workspace_info(self, user_id: Optional[str] = None) -> Optional[WorkspaceInfo]:
        """Get information about a user's workspace.
        
        Args:
            user_id: User identifier. If None, uses default from config.
            
        Returns:
            WorkspaceInfo if workspace exists, None otherwise
        """
        effective_user_id = user_id or self.config.default_user_id
        
        try:
            validated_user_id = self._validate_user_id(effective_user_id)
        except ValueError:
            return None
        
        with self._lock:
            workspace_info = self._workspaces.get(validated_user_id)
            if workspace_info:
                workspace_info.update_size()
                workspace_info.update_access_time()
                return workspace_info
            
            # Check if workspace exists on disk but not in memory
            workspace_path = self.get_workspace_path(validated_user_id)
            if workspace_path.exists():
                # Create workspace info from existing directory
                try:
                    stat = workspace_path.stat()
                    created_at = datetime.fromtimestamp(stat.st_ctime)
                    last_accessed = datetime.fromtimestamp(stat.st_atime)
                    
                    workspace_info = WorkspaceInfo(
                        user_id=validated_user_id,
                        path=workspace_path,
                        created_at=created_at,
                        last_accessed=last_accessed,
                        is_temporary=False
                    )
                    workspace_info.update_size()
                    self._workspaces[validated_user_id] = workspace_info
                    return workspace_info
                except (OSError, PermissionError):
                    pass
        
        return None
    
    def ensure_workspace_exists(self, user_id: Optional[str] = None) -> Path:
        """Ensure a user's workspace exists, creating it if necessary.
        
        Args:
            user_id: User identifier. If None, uses default from config.
            
        Returns:
            Path to workspace
        """
        workspace_info = self.get_workspace_info(user_id)
        if workspace_info and workspace_info.path.exists():
            return workspace_info.path
        
        return self.create_workspace(user_id)
    
    def _check_size_limit(self, workspace_info: WorkspaceInfo) -> None:
        """Check if workspace is within size limits.
        
        Args:
            workspace_info: Workspace to check
            
        Raises:
            FileSystemError: If workspace exceeds size limit
        """
        if self.config.max_workspace_size_mb is None:
            return
        
        workspace_info.update_size()
        if workspace_info.size_mb > self.config.max_workspace_size_mb:
            self.logger.warning(
                f"Workspace size limit exceeded for user {workspace_info.user_id}",
                size_mb=workspace_info.size_mb,
                limit_mb=self.config.max_workspace_size_mb
            )
            raise FileSystemError(
                f"Workspace size limit exceeded: {workspace_info.size_mb:.1f}MB > "
                f"{self.config.max_workspace_size_mb}MB",
                ERROR_CODES.WORKSPACE_ERROR
            )
    
    def validate_path_in_workspace(self, path: str, user_id: Optional[str] = None) -> Path:
        """Validate that a path is within the user's workspace.
        
        Args:
            path: Path to validate
            user_id: User identifier. If None, uses default from config.
            
        Returns:
            Resolved absolute path within workspace
            
        Raises:
            FileSystemError: If path is outside workspace or unsafe
        """
        effective_user_id = user_id or self.config.default_user_id
        validated_user_id = self._validate_user_id(effective_user_id)
        
        workspace_path = self.get_workspace_path(validated_user_id)
        
        # Resolve the requested path
        try:
            if os.path.isabs(path):
                # For absolute paths, they must be within the workspace
                requested_path = Path(path).resolve()
            else:
                # For relative paths, resolve relative to workspace
                requested_path = (workspace_path / path).resolve()
        except (OSError, ValueError) as e:
            raise FileSystemError(f"Invalid path: {path}", ERROR_CODES.INVALID_PATH) from e
        
        # Check if path is within workspace
        try:
            requested_path.relative_to(workspace_path)
        except ValueError:
            raise FileSystemError(f"Path outside workspace: {path}", ERROR_CODES.PATH_TRAVERSAL)
        
        # Additional safety checks on original path
        if not is_path_safe(path):
            raise FileSystemError(f"Unsafe path: {path}", ERROR_CODES.UNSAFE_PATH)
        
        return requested_path
    
    def cleanup_workspace(self, user_id: str, force: bool = False) -> bool:
        """Clean up a user's workspace.
        
        Args:
            user_id: User identifier
            force: If True, force cleanup even if workspace is active
            
        Returns:
            True if workspace was cleaned up, False otherwise
        """
        validated_user_id = self._validate_user_id(user_id)
        
        with self._lock:
            workspace_info = self._workspaces.get(validated_user_id)
            
            if not workspace_info:
                return False
            
            if workspace_info.is_active and not force:
                self.logger.info(f"Skipping cleanup of active workspace for user {validated_user_id}")
                return False
            
            try:
                if workspace_info.path.exists():
                    if workspace_info.is_temporary or force:
                        shutil.rmtree(workspace_info.path)
                        self.logger.info(f"Cleaned up workspace for user {validated_user_id}")
                    else:
                        self.logger.info(f"Preserving persistent workspace for user {validated_user_id}")
                
                # Remove from tracking
                del self._workspaces[validated_user_id]
                self._temp_workspaces.discard(validated_user_id)
                
                return True
                
            except (OSError, PermissionError) as e:
                self.logger.error(f"Failed to cleanup workspace for user {validated_user_id}", error=str(e))
                return False
    
    def cleanup_all(self) -> None:
        """Clean up all temporary workspaces."""
        if not self.config.cleanup_on_exit:
            return
        
        self.logger.info("Cleaning up all temporary workspaces")
        
        with self._lock:
            temp_users = list(self._temp_workspaces)
            
        for user_id in temp_users:
            try:
                self.cleanup_workspace(user_id, force=True)
            except Exception as e:
                self.logger.error(f"Error cleaning up workspace for user {user_id}", error=str(e))
    
    def list_workspaces(self) -> List[WorkspaceInfo]:
        """List all known workspaces.
        
        Returns:
            List of workspace information
        """
        with self._lock:
            # Update sizes for all workspaces
            for workspace_info in self._workspaces.values():
                workspace_info.update_size()
            
            return list(self._workspaces.values())
    
    def get_workspace_stats(self) -> Dict[str, Any]:
        """Get statistics about all workspaces.
        
        Returns:
            Dictionary with workspace statistics
        """
        workspaces = self.list_workspaces()
        
        total_workspaces = len(workspaces)
        active_workspaces = sum(1 for w in workspaces if w.is_active)
        temporary_workspaces = sum(1 for w in workspaces if w.is_temporary)
        total_size_mb = sum(w.size_mb for w in workspaces)
        
        return {
            'total_workspaces': total_workspaces,
            'active_workspaces': active_workspaces,
            'temporary_workspaces': temporary_workspaces,
            'persistent_workspaces': total_workspaces - temporary_workspaces,
            'total_size_mb': round(total_size_mb, 2),
            'average_size_mb': round(total_size_mb / max(total_workspaces, 1), 2),
            'workspace_root': self.config.workspace_root,
        }
    
    def set_workspace_active(self, user_id: str, active: bool = True) -> None:
        """Set workspace active status.
        
        Args:
            user_id: User identifier
            active: Whether workspace is active
        """
        validated_user_id = self._validate_user_id(user_id)
        
        with self._lock:
            workspace_info = self._workspaces.get(validated_user_id)
            if workspace_info:
                workspace_info.is_active = active
                workspace_info.update_access_time()
    
    @contextmanager
    def temporary_workspace(self, user_id: Optional[str] = None):
        """Context manager for temporary workspace.
        
        Args:
            user_id: User identifier. If None, uses default from config.
            
        Yields:
            Path to temporary workspace
        """
        effective_user_id = user_id or self.config.default_user_id
        workspace_path = None
        
        try:
            workspace_path = self.create_workspace(effective_user_id, temporary=True)
            yield workspace_path
        finally:
            if workspace_path:
                self.cleanup_workspace(effective_user_id, force=True)


# Global workspace manager instance
_global_workspace_manager: Optional[WorkspaceManager] = None


def get_workspace_manager() -> WorkspaceManager:
    """Get the global workspace manager instance.
    
    Returns:
        Global workspace manager
    """
    global _global_workspace_manager
    if _global_workspace_manager is None:
        _global_workspace_manager = WorkspaceManager()
    return _global_workspace_manager


def set_workspace_manager(manager: WorkspaceManager) -> None:
    """Set the global workspace manager.
    
    Args:
        manager: Workspace manager to use globally
    """
    global _global_workspace_manager
    _global_workspace_manager = manager