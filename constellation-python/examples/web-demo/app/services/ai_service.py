"""AI service for handling interactions with Claude."""

import os
import json
import asyncio
from typing import AsyncGenerator, List, Dict, Any, Optional
import anthropic
from anthropic.types import ToolUseBlock, TextBlock
from ..models.chat import ChatMessage, StreamEvent
from .fs_service import fs_service


class AIService:
    """Service for handling AI interactions with ConstellationFS integration."""
    
    def __init__(self):
        self.client = anthropic.Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )
    
    def get_constellationfs_tools(self) -> List[Dict[str, Any]]:
        """Get tool definitions for ConstellationFS operations."""
        return [
            {
                "name": "fs_read",
                "description": "Read the contents of a file in the workspace",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "file_path": {
                            "type": "string",
                            "description": "Path to the file to read (relative to workspace)"
                        }
                    },
                    "required": ["file_path"]
                }
            },
            {
                "name": "fs_write",
                "description": "Write content to a file in the workspace",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "file_path": {
                            "type": "string",
                            "description": "Path to the file to write (relative to workspace)"
                        },
                        "content": {
                            "type": "string",
                            "description": "Content to write to the file"
                        }
                    },
                    "required": ["file_path", "content"]
                }
            },
            {
                "name": "fs_exec",
                "description": "Execute a shell command in the workspace",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "command": {
                            "type": "string",
                            "description": "Shell command to execute"
                        }
                    },
                    "required": ["command"]
                }
            },
            {
                "name": "fs_ls",
                "description": "List files and directories in the workspace",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Path to list (default: current directory)",
                            "default": "."
                        },
                        "details": {
                            "type": "boolean",
                            "description": "Include detailed file information",
                            "default": False
                        }
                    }
                }
            }
        ]
    
    async def execute_tool(self, session_id: str, tool_name: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a ConstellationFS tool."""
        try:
            if tool_name == "fs_read":
                content = await fs_service.read_file(session_id, tool_input["file_path"])
                return {"success": True, "content": content}
            
            elif tool_name == "fs_write":
                await fs_service.write_file(session_id, tool_input["file_path"], tool_input["content"])
                return {"success": True, "message": f"File '{tool_input['file_path']}' written successfully"}
            
            elif tool_name == "fs_exec":
                output = await fs_service.execute_command(session_id, tool_input["command"])
                return {"success": True, "output": output}
            
            elif tool_name == "fs_ls":
                path = tool_input.get("path", ".")
                details = tool_input.get("details", False)
                
                # For now, always use the root of workspace
                file_tree = await fs_service.get_file_tree(session_id)
                
                if details:
                    files = [{"name": f.name, "type": f.type, "size": f.size} for f in file_tree]
                else:
                    files = [f.name for f in file_tree]
                
                return {"success": True, "files": files}
            
            else:
                return {"success": False, "error": f"Unknown tool: {tool_name}"}
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    async def chat_stream(
        self, 
        messages: List[ChatMessage], 
        session_id: str
    ) -> AsyncGenerator[StreamEvent, None]:
        """Stream chat responses with tool execution."""
        
        # Convert messages to Anthropic format
        anthropic_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
            if msg.role in ["user", "assistant"]
        ]
        
        try:
            # Start streaming response from Claude
            async with self.client.messages.stream(
                model="claude-3-5-sonnet-20241022",
                max_tokens=2000,
                messages=anthropic_messages,
                tools=self.get_constellationfs_tools(),
                temperature=0.1
            ) as stream:
                
                async for event in stream:
                    if event.type == "text":
                        yield StreamEvent(
                            type="text",
                            content=event.text
                        )
                    
                    elif event.type == "tool_use":
                        # Execute the tool
                        tool_result = await self.execute_tool(
                            session_id,
                            event.name,
                            event.input
                        )
                        
                        # Yield tool execution event
                        yield StreamEvent(
                            type="tool_call",
                            content=f"Executed {event.name}",
                            data={
                                "tool_name": event.name,
                                "tool_input": event.input,
                                "tool_result": tool_result
                            }
                        )
                        
                        # Send tool result back to Claude for continued processing
                        # This would require a more complex implementation
                        # For now, we'll just indicate the tool was executed
                        
                        # Notify about file system changes
                        if event.name in ["fs_write", "fs_exec"]:
                            yield StreamEvent(
                                type="file_update",
                                content="Filesystem updated",
                                data={"session_id": session_id}
                            )
            
            # Send completion event
            yield StreamEvent(type="complete", content="Response completed")
        
        except Exception as e:
            yield StreamEvent(
                type="error",
                content=f"Error: {str(e)}"
            )


# Global service instance
ai_service = AIService()