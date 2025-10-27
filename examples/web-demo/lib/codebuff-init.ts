import { CodebuffClient } from '@codebuff/sdk'
import { type FileSystem } from 'constellationfs'

/**
 * Create a new Codebuff client with ConstellationFS workspace
 * Clients are stateless, so we create a new instance for each request
 */
export async function getCodebuffClient(fs: FileSystem, apiKey: string) {
  const workspace = await fs.getWorkspace('default')

  console.log('Creating new Codebuff client for workspace:', workspace.workspacePath)

  return new CodebuffClient({
    apiKey,
    cwd: workspace.workspacePath,
    fsSource: workspace
  })
}
