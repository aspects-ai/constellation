// Codebuff SDK integration for ConstellationFS
import { CodebuffClient } from '@codebuff/sdk'
import type { FileSystem } from 'constellationfs'

let codebuffClient: CodebuffClient | null = null

export async function getCodebuffClient(fs: FileSystem, apiKey: string) {
  if (!codebuffClient) {
    console.log('Workspace path:', fs.workspace)
    
    // We just pass the workspace path directly to Codebuff
    codebuffClient = new CodebuffClient({
      apiKey,
      cwd: fs.workspace,
      onError: (e) => console.error('❌ Codebuff error:', e.message)
    })
    
    console.log('Codebuff initialized with ConstellationFS workspace')
  }
  
  return codebuffClient
}
