import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp'
import { Experimental_StdioMCPTransport as StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { getMCPServerCommand, getRemoteMCPConfig } from './constellation-init'

/**
 * MCP client wrapper that holds the client and tools.
 * Must be closed after use to clean up the spawned MCP server process.
 */
export interface MCPToolsClient {
  tools: Awaited<ReturnType<Awaited<ReturnType<typeof createMCPClient>>['tools']>>
  close: () => Promise<void>
}

/**
 * Create an MCP client connected to the ConstellationFS MCP server.
 * Returns tools that can be passed to Vercel AI SDK's streamText/generateText.
 *
 * Supports two modes:
 * - Remote MCP: If REMOTE_MCP_URL and REMOTE_MCP_AUTH_TOKEN are set, connects via HTTP
 * - Local MCP: Otherwise, spawns a local MCP server process via stdio
 *
 * @param sessionId - Session ID for workspace isolation
 * @returns MCP tools client with tools and close method
 */
export async function createMCPToolsClient(sessionId: string): Promise<MCPToolsClient> {
  const remoteMCPConfig = getRemoteMCPConfig()

  let transport: StdioMCPTransport | StreamableHTTPClientTransport

  if (remoteMCPConfig) {
    // Remote MCP via HTTP
    console.log('[VERCEL-AI] Using remote MCP at:', remoteMCPConfig.url)
    transport = new StreamableHTTPClientTransport(
      new URL('/mcp', remoteMCPConfig.url),
      {
        requestInit: {
          headers: {
            'Authorization': `Bearer ${remoteMCPConfig.authToken}`,
            'X-User-ID': sessionId,
            'X-Workspace': 'default',
          },
        },
      }
    )
  } else {
    // Local MCP via stdio (existing behavior)
    const { command, args } = getMCPServerCommand(sessionId)
    console.log('[VERCEL-AI] Using local MCP with command:', command, args.join(' '))
    transport = new StdioMCPTransport({ command, args })
  }

  const mcpClient = await createMCPClient({ transport })
  const tools = await mcpClient.tools()

  console.log('[VERCEL-AI] MCP client created, tools:', Object.keys(tools))

  return {
    tools,
    close: async () => {
      console.log('[VERCEL-AI] Closing MCP client')
      await mcpClient.close()
    }
  }
}

/**
 * Get the model for use with Vercel AI SDK via OpenRouter.
 * Uses OPENROUTER_API_KEY environment variable.
 */
export function getModel() {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  })
  return openrouter('anthropic/claude-sonnet-4')
}

/**
 * System prompt for the MCP-enabled assistant.
 */
export const SYSTEM_PROMPT = `You are a helpful coding assistant with access to a filesystem through MCP tools.

You have access to the following filesystem tools:
- read_text_file: Read file contents
- read_multiple_files: Read multiple files at once
- write_file: Create or overwrite files
- edit_file: Make selective edits to files
- create_directory: Create directories
- list_directory: List directory contents
- directory_tree: Get recursive directory structure
- move_file: Move or rename files
- search_files: Search for files by pattern
- get_file_info: Get file metadata
- exec: Execute shell commands

Always use read_text_file to examine files before modifying them.
Use exec to run shell commands when needed (e.g., npm install, git commands).
When creating new files, ensure parent directories exist first.`
