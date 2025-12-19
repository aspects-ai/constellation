import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

export interface LocalConstellationMCPClientOptions {
  /** Application ID for workspace isolation (used by ConstellationFS.setConfig) */
  appId: string
  /** User ID for workspace isolation */
  userId: string
  /** Workspace name to scope operations to */
  workspace: string
}

/**
 * Create an MCP client that spawns a local ConstellationFS MCP server.
 * Uses stdio transport (server runs as child process).
 *
 * @example
 * ```typescript
 * const mcpClient = await createLocalConstellationMCPClient({
 *   appId: 'my-app',
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
  const transport = new StdioClientTransport({
    command: 'npx',
    args: [
      'constellation-fs-mcp',
      '--appId', options.appId,
      '--userId', options.userId,
      '--workspace', options.workspace,
    ],
  })

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
