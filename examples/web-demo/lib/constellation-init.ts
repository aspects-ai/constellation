import { ConstellationFS, FileSystem, type LocalBackendConfig, type RemoteBackendConfig } from 'constellationfs'

/**
 * Initialize ConstellationFS configuration (call once at startup)
 */
export function initConstellationFS() {
  ConstellationFS.setConfig({
    appId: 'web-demo',
    workspaceRoot: process.env.CONSTELLATION_WORKSPACE_ROOT || '/tmp/constellation'
  })
}

/**
 * Check if MCP mode is enabled
 */
export function isMCPMode(): boolean {
  return process.env.USE_MCP === 'true'
}

/**
 * Get remote MCP server configuration from environment variables.
 * Returns null if remote MCP is not configured.
 */
export function getRemoteMCPConfig(): {
  url: string
  authToken: string
} | null {
  const mcpUrl = process.env.REMOTE_MCP_URL
  const mcpAuthToken = process.env.REMOTE_MCP_AUTH_TOKEN

  if (!mcpUrl || !mcpAuthToken) return null

  return { url: mcpUrl, authToken: mcpAuthToken }
}

/**
 * Get MCP server command and args for spawning the constellation-fs-mcp server.
 * Used by Vercel AI SDK's stdio transport.
 *
 * Uses `npx constellationfs mcp-server` which works in any environment
 * where the constellationfs package is available.
 */
export function getMCPServerCommand(sessionId: string): {
  command: string
  args: string[]
} {
  const workspaceRoot = process.env.CONSTELLATION_WORKSPACE_ROOT || '/tmp/constellation'
  return {
    command: 'npx',
    args: [
      'constellationfs',
      'mcp-server',
      '--appId', 'web-demo',
      '--workspaceRoot', workspaceRoot,
      '--userId', sessionId,
      '--workspace', 'default'
    ]
  }
}

/**
 * Create a FileSystem instance with proper backend configuration
 */
export function createFileSystem(sessionId: string): FileSystem {
  const backendType = (process.env.NEXT_PUBLIC_CONSTELLATION_BACKEND_TYPE as 'local' | 'remote') || 'local'

  if (backendType === 'remote') {
    const remoteHost = process.env.REMOTE_VM_HOST
    if (!remoteHost) {
      throw new Error('REMOTE_VM_HOST environment variable is required for remote backend')
    }

    const backendConfig: RemoteBackendConfig = {
      type: 'remote',
      host: remoteHost,
      userId: sessionId,
      preventDangerous: true,
      auth: {
        type: 'password',
        credentials: {
          username: process.env.REMOTE_VM_USER || 'root',
          password: process.env.REMOTE_VM_PASSWORD || 'constellation'
        }
      }
    }
    console.log('Using remote backend config:', {
      ...backendConfig,
      auth: {
        ...backendConfig.auth,
        credentials: {
          username: (backendConfig.auth.credentials as any).username,
          password: '[REDACTED]'
        }
      }
    })
    return new FileSystem(backendConfig)
  } else {
    const backendConfig: LocalBackendConfig = {
      type: 'local',
      userId: sessionId,
      shell: 'auto',
      validateUtils: false,
      preventDangerous: true
    }
    console.log('Using local backend config')
    return new FileSystem(backendConfig)
  }
}
