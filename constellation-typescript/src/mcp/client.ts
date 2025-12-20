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
/**
 * Create an HTTP transport for connecting to a ConstellationFS MCP server.
 * Use this with Vercel AI SDK's createMCPClient.
 *
 * @example
 * ```typescript
 * import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp'
 * import { createConstellationMCPTransport } from 'constellationfs'
 *
 * const transport = createConstellationMCPTransport({
 *   url: 'http://your-server:3001',
 *   authToken: 'your-token',
 *   userId: 'user123',
 *   workspace: 'default',
 * })
 *
 * const mcpClient = await createMCPClient({ transport })
 * const tools = await mcpClient.tools()
 * ```
 */
export function createConstellationMCPTransport(
  options: ConstellationMCPClientOptions
): StreamableHTTPClientTransport {
  return new StreamableHTTPClientTransport(
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
}

export async function createConstellationMCPClient(
  options: ConstellationMCPClientOptions
): Promise<Client> {
  const transport = createConstellationMCPTransport(options)

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
