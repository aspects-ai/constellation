import { CodebuffClient } from '@codebuff/sdk'
import { CodebuffAdapter, type FileSystem } from 'constellationfs'

/**
 * Create a new Codebuff client with ConstellationFS workspace
 * Clients are stateless, so we create a new instance for each request
 */
export async function getCodebuffClient(fs: FileSystem, apiKey: string) {
  const workspace = await fs.getWorkspace()
  const adapter = new CodebuffAdapter(fs)

  console.log('Creating new Codebuff client for workspace:', workspace.path)

  return new CodebuffClient({
    apiKey,
    cwd: workspace.path,
    overrideTools: adapter.getToolHandlers()
  })
}
