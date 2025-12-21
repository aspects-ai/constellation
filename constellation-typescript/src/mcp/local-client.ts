import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { ConstellationFS } from '../config/Config.js'

export interface LocalConstellationMCPClientOptions {
  /** User ID for workspace isolation */
  userId: string
  /** Workspace name to scope operations to */
  workspace: string
  /** Workspace root directory (optional - defaults to ConstellationFS.getWorkspaceRoot()) */
  workspaceRoot?: string
}

/**
 * Stdio transport options for spawning a local ConstellationFS MCP server.
 * Compatible with Vercel AI SDK's StdioMCPTransport.
 */
export interface LocalMCPTransportOptions {
  command: string
  args: string[]
}

/**
 * Get stdio transport options for spawning a local ConstellationFS MCP server.
 * Use this with Vercel AI SDK's StdioMCPTransport.
 *
 * @example
 * ```typescript
 * import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp'
 * import { Experimental_StdioMCPTransport as StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio'
 * import { createLocalConstellationMCPTransportOptions } from 'constellationfs'
 *
 * const transportOptions = createLocalConstellationMCPTransportOptions({
 *   userId: 'user123',
 *   workspace: 'default',
 * })
 *
 * const transport = new StdioMCPTransport(transportOptions)
 * const mcpClient = await createMCPClient({ transport })
 * const tools = await mcpClient.tools()
 * ```
 */
export function createLocalConstellationMCPTransportOptions(
  options: LocalConstellationMCPClientOptions
): LocalMCPTransportOptions {
  const workspaceRoot = options.workspaceRoot ?? ConstellationFS.getWorkspaceRoot()
  return {
    command: 'npx',
    args: [
      'constellation-fs-mcp',
      '--workspaceRoot', workspaceRoot,
      '--userId', options.userId,
      '--workspace', options.workspace,
    ],
  }
}

/**
 * Create an MCP client that spawns a local ConstellationFS MCP server.
 * Uses stdio transport (server runs as child process).
 *
 * @example
 * ```typescript
 * const mcpClient = await createLocalConstellationMCPClient({
 *   userId: 'user123',
 *   workspace: 'my-project',
 * })
 *
 * // Get tool definitions
 * const { tools } = await mcpClient.listTools()
 *
 * // Call a tool directly
 * const result = await mcpClient.callTool({
 *   name: 'read_text_file',
 *   arguments: { path: 'package.json' }
 * })
 *
 * // When done
 * await mcpClient.close()
 * ```
 */
export async function createLocalConstellationMCPClient(
  options: LocalConstellationMCPClientOptions
): Promise<Client> {
  const transportOptions = createLocalConstellationMCPTransportOptions(options)
  const transport = new StdioClientTransport(transportOptions)

  const client = new Client({
    name: 'constellation-mcp-client-local',
    version: '1.0.0',
  }, {
    capabilities: {}
  })

  await client.connect(transport)

  return client
}

export type LocalConstellationMCPClient = Client
