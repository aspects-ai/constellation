import type { Workspace } from '@/workspace/Workspace.js'
import type { CodebuffClientOptions } from '@codebuff/sdk'
import type { FileSystem } from '../../FileSystem.js'
import { BaseSDKAdapter } from '../BaseAdapter.js'

export type CodebuffToolHandlers = CodebuffClientOptions['overrideTools']

/**
 * Adapter for Codebuff SDK that provides direct tool override capabilities.
 * 
 * Unlike the ClaudeCodeAdapter which uses monkey-patching, this adapter
 * allows direct override of tool handlers in the Codebuff SDK, providing
 * cleaner integration with ConstellationFS backends.
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
      run_terminal_command: async (input: { command: string, cwd?: string }) => {
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

      read_files: async (input: { filePaths: string[] }) => {
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

      write_file: async (input: { type: 'file' | 'patch'; path: string; content: string; } & Record<string, unknown>) => {
        console.debug(`✍️ [ConstellationFS/Codebuff] Writing file: ${input.path}`)
        try {
          await this.workspace.write(input.path, input.content)
          return [{
            type: 'json',
            value: {
              file: input.path,
              message: 'File written successfully',
              unifiedDiff: `--- ${input.path}\n+++ ${input.path}\n@@ File written @@`
            }
          }]
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`[ConstellationFS/Codebuff] Failed to write ${input.path}:`, error)
          return [{
            type: 'json',
            value: {
              file: input.path,
              errorMessage,
              patch: undefined
            }
          }]
        }
      },

      str_replace: async (input: { type: 'file' | 'patch'; path: string; content: string; } & Record<string, unknown>) => {
        try {
          // Apply patch diff for both 'file' and 'patch' types since content is in diff format
          const tempPatchFile = `/tmp/patch_${Date.now()}.patch`
          await this.workspace.write(tempPatchFile, input.content)
          
          try {
            await this.workspace.exec(`patch -p1 < ${tempPatchFile}`)
            // Clean up temp file
            await this.workspace.exec(`rm -f ${tempPatchFile}`)
            
            return [{
              type: 'json',
              value: {
                file: input.path,
                message: 'Patch applied successfully',
                unifiedDiff: input.content
              }
            }]
          } catch (patchError) {
            // Clean up temp file on error
            await this.workspace.exec(`rm -f ${tempPatchFile}`).catch(() => {})
            throw patchError
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          return [{
            type: 'json',
            value: {
              file: input.path,
              errorMessage,
              patch: input.content
            }
          }]
        }
      },

      code_search: async (input: { pattern: string; maxResults: number; flags?: string; cwd?: string }) => {
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

  /**
   * Get statistics about tool usage (for debugging/verification)
   */
  private toolStats = {
    run_terminal_command: 0,
    read_files: 0,
    write_file: 0,
    str_replace: 0,
    find_files: 0,
    code_search: 0
  }

  /**
   * Get tool usage statistics
   */
  getToolStats() {
    return { ...this.toolStats }
  }

  /**
   * Reset tool usage statistics
   */
  resetToolStats() {
    this.toolStats = {
      run_terminal_command: 0,
      read_files: 0,
      write_file: 0,
      str_replace: 0,
      find_files: 0,
      code_search: 0
    }
  }
}
