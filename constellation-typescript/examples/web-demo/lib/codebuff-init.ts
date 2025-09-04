// Codebuff SDK integration for ConstellationFS
import { CodebuffClient } from '@codebuff/sdk'
import type { CodebuffToolHandlers, FileSystem } from 'constellationfs'
import { CodebuffAdapter } from 'constellationfs'

let codebuffClient: CodebuffClient | null = null

export async function getCodebuffClient(fs: FileSystem, apiKey: string) {
  if (!codebuffClient) {
    console.log('[ConstellationFS] Initializing Codebuff integration')
    
    // Get tool handlers from ConstellationFS adapter
    const adapter = new CodebuffAdapter(fs)
    const toolHandlers: CodebuffToolHandlers = adapter.getToolHandlers()
    
    // Create Codebuff client with tool overrides
    codebuffClient = new CodebuffClient({
      apiKey,
      cwd: fs.workspace,
      onError: (e) => console.error('❌ Codebuff error:', e.message),
      overrideTools: {
        run_terminal_command: async (input) => {
          console.log(`\n🔍 [ConstellationFS] Executing: ${input.command}`)
          const result = await toolHandlers.run_terminal_command(input.command)
          
          return [{
            type: 'json',
            value: {
              command: input.command,
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.exitCode
            }
          }]
        },
        
        read_files: async (input) => {
          console.log(`\n📖 [ConstellationFS] Reading: ${input.filePaths.join(', ')}`)
          const results = await toolHandlers.read_files(input.filePaths)
          return [{
            type: 'json',
            value: results
          }]
        },
        
        find_files: async (input) => {
          console.log(`\n🔍 [ConstellationFS] Finding files: ${input.prompt}`)
          const files = await toolHandlers.find_files(input.prompt)
          return [{
            type: 'json',
            value: files
          }]
        },
        
        write_file: async (input) => {
          console.log(`\n✍️ [ConstellationFS] Writing: ${input.path}`)
          await toolHandlers.write_file(input.path, input.content)
          return [{
            type: 'json',
            value: { message: `Successfully wrote ${input.path}` }
          }]
        }
      }
    })
    
    console.log('[ConstellationFS] Codebuff integration initialized with tool overrides')
  }
  
  return codebuffClient
}

export { CodebuffAdapter }
