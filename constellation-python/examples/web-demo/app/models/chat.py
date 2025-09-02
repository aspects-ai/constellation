"""Data models for the chat interface."""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class ChatMessage(BaseModel):
    """A chat message from user or assistant."""
    role: str = Field(..., description="Message role: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")
    timestamp: datetime = Field(default_factory=datetime.now)


class ChatRequest(BaseModel):
    """Request to send a message to the AI."""
    message: str = Field(..., description="User message")
    session_id: Optional[str] = Field(None, description="Session ID for workspace isolation")


class FileInfo(BaseModel):
    """Information about a file in the workspace."""
    name: str
    type: str  # 'file' or 'directory'
    size: Optional[int] = None
    path: str


class FilesystemResponse(BaseModel):
    """Response containing filesystem information."""
    session_id: str
    files: List[FileInfo]
    workspace_path: str


class StreamEvent(BaseModel):
    """Server-sent event for streaming responses."""
    type: str = Field(..., description="Event type: 'text', 'tool_call', 'file_update', 'error', 'complete'")
    content: Optional[str] = Field(None, description="Event content")
    data: Optional[Dict[str, Any]] = Field(None, description="Additional event data")