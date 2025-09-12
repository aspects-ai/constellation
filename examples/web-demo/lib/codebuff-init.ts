// Codebuff SDK integration for ConstellationFS
import { CodebuffClient } from '@codebuff/sdk'
import type { FileSystem } from 'constellationfs'

// Client pool to maintain persistent connections per workspace
const clientPool = new Map<string, CodebuffClient>()

/**
 * Initialize Codebuff client with ConstellationFS workspace
 * 
 * Available custom agents in .agents folder:
 * - project-builder: Builds JS/TS projects and iteratively fixes build errors
 *   Usage: Spawn with @project-builder or use spawn_agents tool
 *   Example prompt: "@project-builder build and fix any errors"
 * 
 * The main agent can spawn these custom agents to perform specialized tasks.
 * Custom agents are automatically discovered from the .agents folder.
 */
export async function getCodebuffClient(fs: FileSystem, apiKey: string) {
  const workspaceKey = `${fs.workspace}-${apiKey.slice(-8)}`; // Use workspace + API key suffix as key
  
  let client = clientPool.get(workspaceKey)
  
  if (!client) {
    console.log('[CODEBUFF-INIT] 🔗 Creating new persistent client for workspace:', fs.workspace)
    
    // Pass the workspace path directly to Codebuff
    // The .agents folder in the project root contains custom agents
    client = new CodebuffClient({
      apiKey,
      cwd: fs.workspace,
      onError: (e) => {
        console.error('❌ Codebuff error:', e.message)
        // Remove failed client from pool so it can be recreated
        clientPool.delete(workspaceKey)
      }
    })
    
    clientPool.set(workspaceKey, client)
    console.log('[CODEBUFF-INIT] ✅ Persistent client created and cached')
    console.log('[CODEBUFF-INIT] 📋 Custom agents available: project-builder')
  } else {
    console.log('[CODEBUFF-INIT] ♻️ Reusing existing persistent client')
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
  console.log('[CODEBUFF-INIT] 🧹 Closing all persistent clients...')
  for (const [key, client] of clientPool.entries()) {
    try {
      client.closeConnection()
      console.log('[CODEBUFF-INIT] ✅ Closed client for:', key)
    } catch (error) {
      console.error('[CODEBUFF-INIT] ❌ Error closing client:', error)
    }
  }
  clientPool.clear()
  console.log('[CODEBUFF-INIT] 🏁 All clients closed')
}
