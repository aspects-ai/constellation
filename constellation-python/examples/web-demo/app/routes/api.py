"""API routes for the web demo."""

import json
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from ..models.chat import ChatRequest, ChatMessage, FilesystemResponse
from ..services.ai_service import ai_service
from ..services.fs_service import fs_service

router = APIRouter()

# Store chat history per session (in production, use a proper database)
chat_sessions = {}

@router.post("/message")
async def send_message(request: ChatRequest):
    """Send a message to the AI and get a streaming response."""
    
    # Generate session ID if not provided
    session_id = request.session_id or str(uuid.uuid4())
    
    # Initialize chat history if new session
    if session_id not in chat_sessions:
        chat_sessions[session_id] = []
    
    # Add user message to history
    user_message = ChatMessage(role="user", content=request.message)
    chat_sessions[session_id].append(user_message)
    
    return {
        "session_id": session_id,
        "message": "Message received, check /api/stream/{session_id} for response"
    }

@router.get("/stream/{session_id}")
async def stream_response(session_id: str):
    """Stream AI response for a session."""
    
    if session_id not in chat_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    async def event_stream():
        try:
            messages = chat_sessions[session_id]
            
            # Stream AI response
            assistant_content = ""
            async for event in ai_service.chat_stream(messages, session_id):
                # Accumulate assistant content for chat history
                if event.type == "text" and event.content:
                    assistant_content += event.content
                
                # Send event to client
                yield f"data: {json.dumps(event.model_dump())}\n\n"
            
            # Add assistant response to chat history
            if assistant_content:
                assistant_message = ChatMessage(role="assistant", content=assistant_content)
                chat_sessions[session_id].append(assistant_message)
            
        except Exception as e:
            error_event = {
                "type": "error",
                "content": f"Stream error: {str(e)}"
            }
            yield f"data: {json.dumps(error_event)}\n\n"
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )

@router.get("/filesystem/{session_id}")
async def get_filesystem(session_id: str) -> FilesystemResponse:
    """Get the current filesystem state for a session."""
    
    files = await fs_service.get_file_tree(session_id)
    workspace_path = fs_service.get_workspace_path(session_id)
    
    return FilesystemResponse(
        session_id=session_id,
        files=files,
        workspace_path=workspace_path
    )

@router.post("/filesystem/{session_id}/read")
async def read_file(session_id: str, file_path: str):
    """Read a file from the session's workspace."""
    try:
        content = await fs_service.read_file(session_id, file_path)
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/session/{session_id}")
async def cleanup_session(session_id: str):
    """Clean up a session."""
    # Remove from chat history
    if session_id in chat_sessions:
        del chat_sessions[session_id]
    
    # Cleanup filesystem
    fs_service.cleanup_session(session_id)
    
    return {"message": f"Session {session_id} cleaned up"}