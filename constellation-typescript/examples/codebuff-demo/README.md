# ConstellationFS Codebuff SDK Demo

This demo showcases the integration between ConstellationFS and the Codebuff SDK, demonstrating how to provide secure, isolated file system operations for real AI agents.

## Key Features

The Codebuff adapter provides:

- **Real AI Agent Integration**: Works with actual Codebuff agents, not just tool handlers
- **Custom Tool Definitions**: Uses Codebuff's `getCustomToolDefinition` API
- **Security First**: All operations run in isolated workspaces with dangerous operation blocking
- **Full Control**: Complete control over how tools are executed
- **No Monkey-Patching**: Clean integration using Codebuff's native tool system

## How It Works

The Codebuff SDK allows you to define custom tools that replace the built-in ones. ConstellationFS provides a clean way to create these custom tool definitions:

```javascript
import { CodebuffClient, getCustomToolDefinition } from '@codebuff/sdk'
import { FileSystem, CodebuffAdapter } from 'constellationfs'

// Create isolated filesystem and adapter
const fs = new FileSystem({ userId: 'my-user' })
const adapter = new CodebuffAdapter(fs)

// Create Codebuff client with custom tool definitions
const client = new CodebuffClient({
  apiKey: process.env.CODEBUFF_API_KEY,
  cwd: fs.workspace,
})

// Run agent with ConstellationFS tools
const result = await client.run({
  agent: 'base',
  prompt: 'Create a Node.js project',
  customToolDefinitions: createConstellationToolDefinitions(adapter),
})
```

## Tool Overrides

The adapter provides overrides for common Codebuff tools:

- `run_terminal_command` → Executes through ConstellationFS backend
- `read_files` → Reads from isolated workspace
- `write_file` → Writes to isolated workspace
- `str_replace` → Edits files in workspace
- `find_files` → Searches within workspace boundaries
- `code_search` → Greps within workspace

## Prerequisites

For the full demo with real AI agents:

1. Install the Codebuff SDK: `npm install @codebuff/sdk zod`
2. Get your Codebuff API key from [https://codebuff.dev](https://codebuff.dev)  
3. Set the environment variable: `export CODEBUFF_API_KEY="your_api_key_here"`

## Running the Demo

```bash
# Install dependencies
npm install

# Optional: Install Codebuff SDK for full demo
npm install @codebuff/sdk zod

# Set your API key (required for full demo)
export CODEBUFF_API_KEY="your_api_key_here"

# Run the demo
npm start
```

The demo will automatically detect if the Codebuff SDK is available:
- **With SDK + API key**: Full demo with real AI agents
- **Without SDK or API key**: Adapter-only demo showing integration structure

## Integration with Real Codebuff Agents

The demo shows how to integrate ConstellationFS with real Codebuff agents:

```javascript
import { CodebuffClient, getCustomToolDefinition } from '@codebuff/sdk'
import { FileSystem, CodebuffAdapter } from 'constellationfs'
import { z } from 'zod'

// Create secure filesystem
const fs = new FileSystem({ userId: 'my-user' })
const adapter = new CodebuffAdapter(fs)

// Create custom tool definitions
const customToolDefinitions = [
  getCustomToolDefinition({
    toolName: 'run_terminal_command',
    description: 'Execute shell commands in secure isolated environment',
    inputSchema: z.object({
      command: z.string().describe('The command to execute'),
    }),
    handler: async ({ command }) => {
      const result = await adapter.getToolHandlers().run_terminal_command(command)
      return { toolResultMessage: result.stdout || result.stderr }
    },
  }),
  // ... more tool definitions
]

// Use with Codebuff client
const client = new CodebuffClient({
  apiKey: process.env.CODEBUFF_API_KEY,
  cwd: fs.workspace,
})

const result = await client.run({
  agent: 'base',
  prompt: 'Create a secure Node.js project',
  customToolDefinitions,
})
```

## Security Benefits

1. **Workspace Isolation**: Each user gets an isolated temporary workspace
2. **Path Validation**: Prevents directory traversal and escape attempts
3. **Command Safety**: Blocks dangerous operations like `rm -rf /`
4. **No Host Access**: Commands can't access system files outside workspace

## Architecture

```
Codebuff Agent
     ↓
Tool Call (e.g., run_terminal_command)
     ↓
CodebuffAdapter.handleSteps (intercepts)
     ↓
CodebuffAdapter.toolHandlers.run_terminal_command
     ↓
FileSystem.exec()
     ↓
Backend (Local/Remote/Docker)
     ↓
Isolated Workspace
```

This architecture ensures all file operations are safely contained within the ConstellationFS security boundaries.