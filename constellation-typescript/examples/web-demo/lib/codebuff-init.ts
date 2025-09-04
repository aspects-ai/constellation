// Codebuff SDK integration for ConstellationFS
import { CodebuffClient, CustomToolDefinition } from '@codebuff/sdk'
import type { FileSystem } from 'constellationfs'
import { CodebuffAdapter } from 'constellationfs'
import { z } from 'zod'

function getCustomToolDefinition({ toolName, description, inputSchema, handler }: { toolName: string, description: string, inputSchema: z.ZodSchema, handler: (params: any) => Promise<any> }): CustomToolDefinition {
  return {
    toolName,
    description,
    zodSchema: inputSchema,
    inputJsonSchema: z.toJSONSchema(inputSchema),
    outputSchema: z.array(z.any()),
    endsAgentStep: false,
    exampleInputs: [],
    handler,
  }
}

let isInitialized = false
let codebuffClient: any = null

export async function getCodebuffClient(fs: FileSystem, apiKey: string) {
  if (!isInitialized) {
    console.log('[ConstellationFS] Initializing Codebuff integration')
    
    // Create Codebuff client
    codebuffClient = new CodebuffClient({
      apiKey,
      cwd: fs.workspace,
      onError: (e) => console.error('❌ Codebuff error:', e.message),
    })
    
    isInitialized = true
    console.log('[ConstellationFS] Codebuff integration initialized')
  }
  
  return codebuffClient
}

export function createConstellationToolDefinitions(adapter: CodebuffAdapter): CustomToolDefinition[] {
  const toolHandlers = adapter.getToolHandlers()
  
  try {
    const tools = [
    // Override run_terminal_command
    getCustomToolDefinition({
      toolName: 'run_terminal_command',
      description: 'Execute shell commands in secure isolated environment',
      inputSchema: z.object({
        command: z.string().describe('The command to execute'),
      }),
      handler: async ({ command }: { command: string }) => {
        console.log(`\n🔍 [ConstellationFS] Executing: ${command}`)
        const result = await toolHandlers.run_terminal_command!(command)
        
        if (result.exitCode === 0) {
          return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode }
        } else {
          return { stdout: '', stderr: result.stderr, exitCode: result.exitCode }
        }
      },
    }),

    // Override write_file
    getCustomToolDefinition({
      toolName: 'write_file',
      description: 'Write content to a file in secure workspace',
      inputSchema: z.object({
        path: z.string().describe('File path to write to'),
        content: z.string().describe('Content to write'),
      }),
      handler: async ({ path, content }: { path: string; content: string }) => {
        console.log(`\n✍️ [ConstellationFS] Writing: ${path}`)
        await toolHandlers.write_file!(path, content)
        return { message: `Successfully wrote ${path}` }
      },
    }),

    // Override read_files
    getCustomToolDefinition({
      toolName: 'read_files',
      description: 'Read file contents from secure workspace',
      inputSchema: z.object({
        paths: z.array(z.string()).describe('Array of file paths to read'),
      }),
      handler: async ({ paths }: { paths: string[] }) => {
        console.log(`\n📖 [ConstellationFS] Reading: ${paths.join(', ')}`)
        const results = await toolHandlers.read_files!(paths)
        
        let output = ''
        for (const [path, content] of Object.entries(results)) {
          output += `=== ${path} ===\n${content}\n\n`
        }
        return { content: output }
      },
    }),

    // Override find_files  
    getCustomToolDefinition({
      toolName: 'find_files',
      description: 'Find files by pattern in secure workspace',
      inputSchema: z.object({
        pattern: z.string().describe('File pattern to search for (e.g., "*.js")'),
      }),
      handler: async ({ pattern }: { pattern: string }) => {
        console.log(`\n🔍 [ConstellationFS] Finding files: ${pattern}`)
        const files = await toolHandlers.find_files!(pattern)
        return files
      },
    }),
  ]
    
    console.log('[ConstellationFS] Tool definitions created:', tools.map(t => t.toolName).join(', '))
    
    return tools
  } catch (error) {
    console.error('[ConstellationFS] Error creating tool definitions:', error)
    throw error
  }
}

export { CodebuffAdapter }
