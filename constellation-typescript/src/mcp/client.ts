import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

export interface ConstellationMCPClientOptions {
  /** MCP server URL (e.g., 'http://backend.example.com:3000') */
  url: string
  /** Authentication token */
  authToken: string
  /** User ID for workspace isolation */
  userId: string
  /** Workspace name to scope operations to */
  workspace: string
}

/**
 * Create an MCP client connected to a ConstellationFS remote instance.
 * The client is scoped to a specific user and workspace.
 *
 * @example
 * ```typescript
 * const mcpClient = await createConstellationMCPClient({
 *   url: 'http://backend.example.com:3000',
 *   authToken: process.env.MCP_AUTH_TOKEN,
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
export async function createConstellationMCPClient(
  options: ConstellationMCPClientOptions
): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(
    new URL('/mcp', options.url),
    {
      requestInit: {
        headers: {
          'Authorization': `Bearer ${options.authToken}`,
          'X-User-ID': options.userId,
          'X-Workspace': options.workspace,
        },
      },
    }
  )

  const client = new Client({
    name: 'constellation-mcp-client',
    version: '1.0.0',
  }, {
    capabilities: {}
  })

  await client.connect(transport)

  return client
}

export type ConstellationMCPClient = Client
