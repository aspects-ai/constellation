// Codebuff SDK integration for ConstellationFS
import { CodebuffClient } from '@codebuff/sdk'
import type { FileSystem } from 'constellationfs'

let codebuffClient: CodebuffClient | null = null

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
  if (!codebuffClient) {
    console.log('Workspace path:', fs.workspace)
    
    // Pass the workspace path directly to Codebuff
    // The .agents folder in the project root contains custom agents
    codebuffClient = new CodebuffClient({
      apiKey,
      cwd: fs.workspace,
      onError: (e) => console.error('❌ Codebuff error:', e.message)
    })
    
    console.log('Codebuff initialized with ConstellationFS workspace')
    console.log('Custom agents available: project-builder')
  }
  
  return codebuffClient
}
