"""ConstellationFS service for managing filesystem operations."""

import os
import asyncio
from pathlib import Path
from typing import List, Dict, Any
from constellation import FileSystem
from ..models.chat import FileInfo


class ConstellationFSService:
    """Service for managing ConstellationFS instances and operations."""
    
    def __init__(self):
        self._filesystems: Dict[str, FileSystem] = {}
    
    def get_filesystem(self, session_id: str) -> FileSystem:
        """Get or create a filesystem for a session."""
        if session_id not in self._filesystems:
            self._filesystems[session_id] = FileSystem(f"demo-{session_id}")
        return self._filesystems[session_id]
    
    async def get_file_tree(self, session_id: str) -> List[FileInfo]:
        """Get the file tree for a session's workspace."""
        fs = self.get_filesystem(session_id)
        
        try:
            # Get detailed file listing
            files_data = await fs.ls(details=True)
            
            file_infos = []
            for file_data in files_data:
                file_info = FileInfo(
                    name=file_data['name'],
                    type=file_data['type'],
                    size=file_data.get('size'),
                    path=file_data['name']  # Relative path
                )
                file_infos.append(file_info)
            
            return file_infos
        except Exception as e:
            print(f"Error getting file tree for session {session_id}: {e}")
            return []
    
    async def read_file(self, session_id: str, file_path: str) -> str:
        """Read a file from the session's workspace."""
        fs = self.get_filesystem(session_id)
        return await fs.read(file_path)
    
    async def write_file(self, session_id: str, file_path: str, content: str) -> None:
        """Write a file to the session's workspace."""
        fs = self.get_filesystem(session_id)
        await fs.write(file_path, content)
    
    async def execute_command(self, session_id: str, command: str) -> str:
        """Execute a command in the session's workspace."""
        fs = self.get_filesystem(session_id)
        return await fs.exec(command)
    
    def get_workspace_path(self, session_id: str) -> str:
        """Get the workspace path for a session."""
        fs = self.get_filesystem(session_id)
        return fs.workspace
    
    def cleanup_session(self, session_id: str) -> None:
        """Clean up a session's filesystem."""
        if session_id in self._filesystems:
            # ConstellationFS handles cleanup automatically
            del self._filesystems[session_id]


# Global service instance
fs_service = ConstellationFSService()