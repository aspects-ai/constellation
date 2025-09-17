// Codebuff SDK integration for ConstellationFS
import { CodebuffClient } from '@codebuff/sdk'
import type { FileSystem } from 'constellationfs'

// Client pool to maintain persistent connections per workspace
const clientPool = new Map<string, CodebuffClient>()

/**
 * Initialize Codebuff client with ConstellationFS workspace
 */
export async function getCodebuffClient(fs: FileSystem, apiKey: string) {
  const workspaceKey = `${fs.workspace}-${apiKey.slice(-8)}`
  let client = clientPool.get(workspaceKey)

  if (!client) {
    console.log('Creating new Codebuff client for workspace:', fs.workspace)
    client = new CodebuffClient({
      apiKey,
      cwd: fs.workspace,
      onError: (e: { message: string }) => {
        clientPool.delete(workspaceKey)
      }
    })
    clientPool.set(workspaceKey, client)
  }

  return client
}

/**
 * Get current client pool size for monitoring
 */
export function getClientPoolSize() {
  return clientPool.size
}

/**
 * Cleanup all clients (useful for server shutdown)
 */
export function closeAllClients() {
  for (const [_, client] of clientPool.entries()) {
    try {
      client.closeConnection()
    } catch {
      // silently ignore errors
    }
  }
  clientPool.clear()
}
