import { query } from '@anthropic-ai/claude-code'
import { FileSystem } from 'constellationfs'
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { broadcastToStream } from '../../../lib/streams'

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId, apiKey } = await request.json()

    if (!message || !sessionId) {
      return NextResponse.json({ error: 'Message and sessionId are required' }, { status: 400 })
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    // Create a unique stream ID for this request
    const streamId = uuidv4()

    // Initialize ConstellationFS with session-based userId
    const fs = new FileSystem({ userId: sessionId })

    // Initialize workspace with sample files if empty
    await initializeWorkspace(fs)

    // Start the AI processing in the background using Claude Code SDK
    processWithClaudeCode(fs, message, sessionId, apiKey)
    return NextResponse.json({ streamId })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function initializeWorkspace(fs: FileSystem) {
  try {
    const files = await fs.ls()
    
    // If workspace is empty, create some sample files
    if (files.length === 0) {
      await fs.write('README.md', `# Welcome to ConstellationFS Demo

This is a sample workspace where you can interact with an AI assistant that can:
- Create and edit files
- Run shell commands
- Build projects
- Help with development tasks

Try asking me to:
- "Create a simple Node.js application"
- "Add a package.json file"
- "Write a Python hello world script"
- "List all files in the workspace"
`)

      await fs.write('hello.txt', 'Hello from ConstellationFS!')
    }
  } catch (error) {
    console.error('Failed to initialize workspace:', error)
  }
}

async function processWithClaudeCode(
  fs: FileSystem,
  message: string, 
  sessionId: string,
  apiKey: string
) {
  try {
    const systemPrompt = `You are a helpful AI assistant working in a secure, isolated filesystem workspace.

Workspace Details:
- Current working directory: ${fs.workspace}
- This is a completely isolated environment where you can safely create, modify, and delete files
- You can run shell commands, build projects, and help with general tasks as your tools allow.
- All operations are sandboxed to this workspace only

Always explain what you're doing and show the results of your operations. The workspace is yours to use freely and safely.`
    
    for await (const sdkMessage of query({
      prompt: message,
      options: {
        customSystemPrompt: systemPrompt,
        maxTurns: 3,
        cwd: fs.workspace,
        continue: true,
        env: {
          ANTHROPIC_API_KEY: apiKey,
          PATH: process.env.PATH, // Include PATH to ensure node/npm are found
          NODE_ENV: process.env.NODE_ENV,
        },
        executable: 'node', // Explicitly use node for consistency
        allowedTools: [
          "Read",
          "Write", 
          "Bash",
          "LS",
          "Glob",
          "Grep",
          "Edit"
        ]
      }
    })) {
      if (sdkMessage.type === 'assistant') {
        // Start new assistant message
        broadcastToStream(sessionId, { type: 'message_start', role: 'assistant' })
        
        // Stream assistant message content
        const content = sdkMessage.message.content
        
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text') {
              // Stream text content in chunks
              const text = block.text
              
              // Send in smaller chunks for better streaming experience
              const chunkSize = 50
              for (let i = 0; i < text.length; i += chunkSize) {
                const chunk = text.slice(i, i + chunkSize)
                broadcastToStream(sessionId, { type: 'content', text: chunk })
                // Small delay for streaming effect
                await new Promise(resolve => setTimeout(resolve, 10))
              }
            } else if (block.type === 'tool_use') {
              // Stream tool use information
              const toolText = `🔧 Using ${block.name} tool...`
              broadcastToStream(sessionId, { type: 'content', text: toolText })
            }
          }
        }
        
        // End assistant message
        broadcastToStream(sessionId, { type: 'message_end', role: 'assistant' })
        
      } else if (sdkMessage.type === 'user') {
        // Start new tool result message
        broadcastToStream(sessionId, { type: 'message_start', role: 'tool' })
        
        // This contains tool results - stream them
        const content = sdkMessage.message?.content
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_result') {
              const toolResult = `📋 **Tool Output:**\n\`\`\`\n${block.content}\n\`\`\``
              broadcastToStream(sessionId, { type: 'content', text: toolResult })
            }
          }
        }
        
        // End tool result message
        broadcastToStream(sessionId, { type: 'message_end', role: 'tool' })
        
      } else if (sdkMessage.type === 'result') {
        // Handle completion - only send errors, not duplicate content
        if (sdkMessage.subtype === 'error_max_turns') {
          broadcastToStream(sessionId, { type: 'error', message: 'Max turns reached' })
        } else if (sdkMessage.subtype === 'error_during_execution') {
          broadcastToStream(sessionId, { type: 'error', message: 'Error during execution' })
        }
        
        // Signal completion
        broadcastToStream(sessionId, { type: 'done' })
        break
      } else if (sdkMessage.type === 'system') {
        console.log('[Claude SDK] System init:', { subtype: sdkMessage.subtype, cwd: (sdkMessage as any).cwd })
      } else {
        console.warn('[Claude SDK] Unhandled message type:', sdkMessage)
      }
    }
    
  } catch (error) {
    console.error('Claude Code Processing Error:', error)
    broadcastToStream(sessionId, { 
      type: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

