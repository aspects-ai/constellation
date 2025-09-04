import { CodebuffClient } from '@codebuff/sdk'
import { CodebuffAdapter, FileSystem } from 'constellationfs'
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getCodebuffClient } from '../../../lib/codebuff-init'
import { broadcastToStream } from '../../../lib/streams'

export async function POST(request: NextRequest) {
  try {
    // Check if request has a body
    const contentType = request.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 400 })
    }

    // Parse JSON with better error handling
    let body
    try {
      const text = await request.text()
      if (!text) {
        return NextResponse.json({ error: 'Request body is empty' }, { status: 400 })
      }
      body = JSON.parse(text)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    const { message, sessionId, apiKey } = body

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

    // Start the AI processing in the background using Codebuff SDK
    processWithCodebuff(fs, message, sessionId, apiKey)
    return NextResponse.json({ streamId })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function initializeWorkspace(fs: FileSystem) {
  try {
    const result = await fs.exec('ls')
    const files = result ? result.split('\n').filter(Boolean) : []
    
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

async function processWithCodebuff(
  fs: FileSystem,
  message: string, 
  sessionId: string,
  apiKey: string
) {
  try {
    console.log('[ConstellationFS] Processing with Codebuff SDK - clean tool overrides enabled')
    console.log('[ConstellationFS] Workspace:', fs.workspace)
    
    // Get Codebuff client with tool overrides already configured
    const client: CodebuffClient = await getCodebuffClient(fs, apiKey)
    
    console.log('🔧 [ConstellationFS] Using tool overrides for secure execution')
    
    // Start streaming response
    broadcastToStream(sessionId, { type: 'message_start', role: 'assistant' })
    
    // Run Codebuff agent (tool overrides are handled by client configuration)
    const result = await client.run({
      agent: 'base',
      prompt: message,
      
      handleEvent: (event: any) => {
        if (event.type === 'assistant_message_delta') {
          // Stream assistant message content in chunks for real-time typing
          const text = event.delta
          const chunkSize = 30
          
          for (let i = 0; i < text.length; i += chunkSize) {
            const chunk = text.slice(i, i + chunkSize)
            broadcastToStream(sessionId, { type: 'assistant_delta', text: chunk })
          }
        } else if (event.type === 'tool_call') {
          // Send tool call as a separate message type with unique ID
          broadcastToStream(sessionId, { 
            type: 'tool_use',
            id: uuidv4(),
            toolName: event.toolName,
            params: event.params || {}
          })
        } else if (event.type === 'tool_result') {
          // Send tool result as a separate message type with unique ID
          broadcastToStream(sessionId, {
            type: 'tool_result',
            id: uuidv4(),
            toolName: event.toolName,
            output: event.output 
          })
        } else if (event.type === 'text') {
          // Send text as complete message that gets interleaved with tools
          broadcastToStream(sessionId, { 
            type: 'assistant_message',
            id: uuidv4(),
            text: event.text 
          })
        }
      }
    })
    
    console.log('✅ [ConstellationFS] Codebuff agent execution completed')
    
    // End assistant message and signal completion
    broadcastToStream(sessionId, { type: 'message_end', id: uuidv4(), role: 'assistant' })
    broadcastToStream(sessionId, { type: 'done' })
    
    // Close connection
    client.closeConnection()
    
  } catch (error) {
    console.error('Codebuff Processing Error:', error)
    broadcastToStream(sessionId, { 
      type: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

