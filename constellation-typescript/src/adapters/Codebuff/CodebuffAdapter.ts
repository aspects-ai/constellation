import type { Workspace } from '../../workspace/Workspace.js'
import type { ClientToolCall, CodebuffClientOptions, CodebuffToolOutput } from '@codebuff/sdk'
import type { FileSystem } from '../../FileSystem.js'
import { BaseSDKAdapter } from '../BaseAdapter.js'

export type CodebuffToolHandlers = CodebuffClientOptions['overrideTools']

/**
 * Adapter for Codebuff SDK that provides direct tool override capabilities.
 *
 * Unlike the ClaudeCodeAdapter which uses monkey-patching, this adapter
 * allows direct override of tool handlers in the Codebuff SDK, providing
 * cleaner integration with ConstellationFS backends.
 *
 * Note: ConstellationFS Workspace instances are now directly compatible with
 * Codebuff's filesystem API. You can pass a Workspace directly as the `filesystem`
 * option when creating a CodebuffClient, or use this adapter for custom tool
 * handling.
 *
 * @example
 * ```typescript
 * // Direct filesystem usage (recommended for most cases)
 * const workspace = await fs.getWorkspace('my-project')
 * const client = new CodebuffClient({
 *   apiKey: 'your-key',
 *   filesystem: workspace
 * })
 *
 * // Using the adapter for custom tool handling
 * const adapter = new CodebuffAdapter(fs, workspace)
 * const client = new CodebuffClient({
 *   apiKey: 'your-key',
 *   overrideTools: adapter.getToolHandlers()
 * })
 * ```
 */
export class CodebuffAdapter extends BaseSDKAdapter {
  
  private handlers: CodebuffToolHandlers

  constructor(fs: FileSystem, workspace: Workspace) {
    super(fs, workspace)
    this.handlers = this.getDefaultHandlers()
  }

  /**
   * Set up default tool handlers that route through ConstellationFS
   */
  private getDefaultHandlers(): CodebuffToolHandlers {
    return {
      run_terminal_command: async (input: ClientToolCall<'run_terminal_command'>['input']): Promise<CodebuffToolOutput<'run_terminal_command'>> => {
        try {
          // If cwd is provided, prepend cd command
          const fullCommand = input.cwd ? `cd "${input.cwd}" && ${input.command}` : input.command
          const output = await this.workspace.exec(fullCommand)

          // Convert Buffer to string if needed
          const stdoutStr = output instanceof Buffer ? output.toString('utf-8') : output

          return [{
            type: 'json' as const,
            value: {
              command: input.command,
              startingCwd: input.cwd,
              message: 'Command executed successfully',
              stdout: stdoutStr as string,
              stderr: '',
              exitCode: 0
            }
          }]
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`[ConstellationFS/Codebuff] Command failed: ${errorMessage}`)
          return [{
            type: 'json',
            value: {
              command: input.command,
              startingCwd: input.cwd,
              message: 'Command failed',
              stdout: '',
              stderr: errorMessage,
              exitCode: 1
            }
          }]
        }
      },

      read_files: async (input: { filePaths: string[] }): Promise<Record<string, string | null>> => {
        const results: Record<string, string | null> = {}
        
        for (const path of input.filePaths) {
          try {
            console.debug(`📖 [ConstellationFS/Codebuff] Reading file: ${path}`)
            const content = await this.workspace.read(path)
            results[path] = content
          } catch (error) {
            results[path] = `ERROR: ${error instanceof Error ? error.message : String(error)}`
          }
        }
        
        return results
      },

      code_search: async (input: ClientToolCall<'code_search'>['input']): Promise<CodebuffToolOutput<'code_search'>> => {
        const basePath = input.cwd || '.'
        let command = `grep -rn "${input.pattern}" ${basePath}`

        // Add flags if specified
        if (input.flags) {
          command += ` ${input.flags}`
        }

        command += ' 2>/dev/null || true'

        try {
          const output = await this.workspace.exec(command)
          // Convert Buffer to string if needed
          const outputStr: string = (output instanceof Buffer) ? output.toString('utf-8') : output as string
          const lines = outputStr.split('\n').filter((line: string) => line.trim())

          // Limit results based on maxResults
          const limitedLines = lines.slice(0, input.maxResults)

          return [{
            type: 'json',
            value: {
              stdout: limitedLines.join('\n'),
              stderr: undefined,
              exitCode: 0,
              message: `Found ${limitedLines.length} matches for pattern "${input.pattern}"`
            }
          }]
        } catch (error) {
          console.error('[ConstellationFS/Codebuff] Search failed:', error)
          return [{
            type: 'json',
            value: {
              errorMessage: error instanceof Error ? error.message : String(error)
            }
          }]
        }
      }
    }
  }

  /**
   * Get the tool handlers for integration with Codebuff SDK
   * 
   * @returns Tool handler overrides to pass to Codebuff agent configuration
   */
  getToolHandlers(): CodebuffToolHandlers {
    return this.handlers
  }

  /**
   * Override specific tool handlers
   * 
   * @param handlers - Partial set of handlers to override
   */
  setToolHandlers(handlers: Partial<CodebuffToolHandlers>) {
    this.handlers = {
      ...this.handlers,
      ...handlers
    }
  }

}
