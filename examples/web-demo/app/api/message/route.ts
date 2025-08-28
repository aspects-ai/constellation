import Anthropic from '@anthropic-ai/sdk'
import { FileSystem } from 'constellationfs'
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { broadcastToStream } from '../../../lib/streams'

export async function POST(request: NextRequest) {
  try {
    const { message, sessionId } = await request.json()

    if (!message || !sessionId) {
      return NextResponse.json({ error: 'Message and sessionId are required' }, { status: 400 })
    }

    // Create a unique stream ID for this request
    const streamId = uuidv4()

    // Initialize ConstellationFS with session-based userId
    const fs = new FileSystem({ userId: sessionId })

    // Initialize workspace with sample files if empty
    await initializeWorkspace(fs)

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
    })

    // Start the AI processing in the background
    // Note: We use sessionId for stream identification, not streamId
    processWithAI(anthropic, fs, message, sessionId, sessionId)
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

async function processWithAI(
  anthropic: Anthropic, 
  fs: FileSystem, 
  message: string, 
  sessionId: string, 
  streamId: string
) {
  try {
    const systemPrompt = `You are a helpful coding assistant with access to a filesystem through ConstellationFS. You can:

1. Read files using: await fs.read('filename')
2. Write files using: await fs.write('filename', 'content')
3. Execute shell commands using: await fs.exec('command')
4. List files using: await fs.ls()

Always explain what you're doing and show the results of any operations.

Current workspace: ${fs.workspace}

When executing commands or file operations, use the FileSystem instance provided.`

    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-0',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
      stream: true,
    })

    // Process the stream and execute any filesystem operations
    let fullResponse = ''
    
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        const text = chunk.delta.text || ''
        fullResponse += text
        
        // Send chunk to client via Server-Sent Events
        broadcastToStream(streamId, { type: 'content', text })
      }
    }

    // Execute any filesystem operations mentioned in the response
    await executeFileSystemOperations(fs, fullResponse)

    // Signal completion
    broadcastToStream(streamId, { type: 'done' })
    
  } catch (error) {
    console.error('AI Processing Error:', error)
    broadcastToStream(streamId, { 
      type: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}


async function executeFileSystemOperations(fs: FileSystem, response: string) {
  // Simple pattern matching to find and execute filesystem operations
  // This is a basic implementation - in a real app you'd want more sophisticated parsing
  
  const writeMatches = response.match(/await fs\.write\('([^']+)',\s*'([^']+)'\)/g)
  if (writeMatches) {
    for (const match of writeMatches) {
      const [, filename, content] = match.match(/await fs\.write\('([^']+)',\s*'([^']+)'\)/) || []
      if (filename && content) {
        try {
          await fs.write(filename, content)
        } catch (error) {
          console.error(`Failed to write ${filename}:`, error)
        }
      }
    }
  }

  const execMatches = response.match(/await fs\.exec\('([^']+)'\)/g)
  if (execMatches) {
    for (const match of execMatches) {
      const [, command] = match.match(/await fs\.exec\('([^']+)'\)/) || []
      if (command) {
        try {
          await fs.exec(command)
        } catch (error) {
          console.error(`Failed to execute ${command}:`, error)
        }
      }
    }
  }
}

