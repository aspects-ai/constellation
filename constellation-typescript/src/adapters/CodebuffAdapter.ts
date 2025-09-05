import type { FileSystem } from '../FileSystem.js';
import { BaseSDKAdapter } from './BaseAdapter.js';

/**
 * Tool handler interface for Codebuff SDK
 * Allows overriding how specific tools are executed
 */
export interface CodebuffToolHandlers {
  /**
   * Override for run_terminal_command tool
   * @param command - Command to execute
   * @param cwd - Current working directory
   * @returns Command output or error
   */
  run_terminal_command: (command: string, cwd?: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  
  /**
   * Override for read_files tool
   * @param paths - Array of file paths to read
   * @returns File contents mapped by path
   */
  read_files: (paths: string[]) => Promise<Record<string, string>>
  
  /**
   * Override for write_file tool
   * @param path - File path to write
   * @param content - Content to write
   */
  write_file: (path: string, content: string) => Promise<void>
  
  /**
   * Override for str_replace tool
   * @param path - File path to edit
   * @param replacements - Array of replacement objects
   */
  str_replace: (path: string, replacements: Array<{old: string, new: string, allowMultiple?: boolean}>) => Promise<{
    file: string
    message?: string
    unifiedDiff?: string
    errorMessage?: string
    patch?: string
  }>
  
  /**
   * Override for find_files tool
   * @param pattern - Search pattern
   * @param path - Directory to search in
   * @returns Array of matching file paths
   */
  find_files: (pattern: string, path?: string) => Promise<Record<string, string | boolean>>
  
  /**
   * Override for code_search tool
   * @param pattern - Search pattern (regex)
   * @param path - Directory to search in
   * @param fileType - File type filter
   * @returns Search results with matches
   */
  code_search: (pattern: string, path?: string, fileType?: string) => Promise<Array<{ file: string; line: number; content: string }>>
}

/**
 * Adapter for Codebuff SDK that provides direct tool override capabilities.
 * 
 * Unlike the ClaudeCodeAdapter which uses monkey-patching, this adapter
 * allows direct override of tool handlers in the Codebuff SDK, providing
 * cleaner integration with ConstellationFS backends.
 */
export class CodebuffAdapter extends BaseSDKAdapter {
  
  private handlers: CodebuffToolHandlers

  constructor(fs: FileSystem) {
    super(fs)
    this.handlers = this.getDefaultHandlers()
  }

  /**
   * Set up default tool handlers that route through ConstellationFS
   */
  private getDefaultHandlers(): CodebuffToolHandlers {
    return {
      run_terminal_command: async (command: string, cwd?: string) => {
        console.log(`🔍 [ConstellationFS/Codebuff] Executing command: ${command}`)
        
        try {
          // If cwd is provided, prepend cd command
          const fullCommand = cwd ? `cd "${cwd}" && ${command}` : command
          const output = await this.exec(fullCommand)
          
          return {
            stdout: output,
            stderr: '',
            exitCode: 0
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`[ConstellationFS/Codebuff] Command failed: ${errorMessage}`)
          
          return {
            stdout: '',
            stderr: errorMessage,
            exitCode: 1
          }
        }
      },

      read_files: async (paths: string[]) => {
        const results: Record<string, string> = {}
        
        for (const path of paths) {
          try {
            console.log(`📖 [ConstellationFS/Codebuff] Reading file: ${path}`)
            results['path'] = path
            results['content'] = await this.read(path)
          } catch (error) {
            console.error(`[ConstellationFS/Codebuff] Failed to read ${path}:`, error)
            results['path'] = path
            results['content'] = `ERROR: Could not read file - ${error instanceof Error ? error.message : String(error)}`
          }
        }
        
        return results
      },

      write_file: async (path: string, content: string) => {
        console.log(`✍️ [ConstellationFS/Codebuff] Writing file: ${path}`)
        await this.write(path, content)
      },

      str_replace: async (path: string, replacements: Array<{old: string, new: string, allowMultiple?: boolean}>) => {
        console.log(`🔄 [ConstellationFS/Codebuff] Replacing text in: ${path}`)
        
        try {
          // Read the file
          const originalContent = await this.read(path)
          let currentContent = originalContent
          
          // Apply each replacement
          for (const replacement of replacements) {
            const { old: oldText, new: newText, allowMultiple = false } = replacement
            
            // Check if old text exists
            if (!currentContent.includes(oldText)) {
              throw new Error(`Text to replace not found: "${oldText}"`)
            }
            
            if (allowMultiple) {
              currentContent = currentContent.replaceAll(oldText, newText)
            } else if (!allowMultiple) {
              const occurrences = (currentContent.match(new RegExp(oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
              if (occurrences > 1) {
                throw new Error(`Multiple occurrences found for "${oldText}" but allowMultiple is false`)
              }
            }
            currentContent = currentContent.replace(oldText, newText)
          }
          
          // Write back
          await this.write(path, currentContent)
          
          // Generate simple diff info
          const linesChanged = originalContent !== currentContent
          return {
            file: path,
            message: linesChanged ? `Successfully applied ${replacements.length} replacement(s)` : 'No changes made',
            unifiedDiff: linesChanged ? `--- ${path}\n+++ ${path}\n@@ Changes applied @@` : 'No changes'
          }
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          return {
            file: path,
            errorMessage,
            patch: undefined
          }
        }
      },
      
      find_files: async (pattern: string, _path?: string): Promise<Record<string, string | boolean>> => {
        console.log(`🔍 [ConstellationFS/Codebuff] Finding files with pattern: ${pattern}`)
        
        try {
          const result = await this.exec(`find . -name "${pattern}"`)
          const files = result ? result.split('\n').filter(Boolean) : []
          const results: Record<string, string | boolean> = {}
          
          // Convert string[] to Record<string, string>
          if (Array.isArray(files) && files.length > 0) {
            for (const fileName of files) {
              results['path'] = fileName
              results['contentOmittedForLength'] = true
            }
          }
          
          return results
        } catch (error) {
          console.error(`[ConstellationFS/Codebuff] Find failed: ${error}`)
          return {}
        }
      },

      code_search: async (pattern: string, path?: string, fileType?: string) => {
        console.log(`🔎 [ConstellationFS/Codebuff] Searching for pattern: ${pattern}`)
        
        const basePath = path || '.'
        let command = `grep -rn "${pattern}" ${basePath}`
        
        // Add file type filter if specified
        if (fileType) {
          command += ` --include="*.${fileType}"`
        }
        
        command += ' 2>/dev/null || true'
        
        try {
          const output = await this.exec(command)
          const lines = output.split('\n').filter(line => line.trim())
          
          const results: Array<{ file: string; line: number; content: string }> = []
          
          for (const line of lines) {
            // Parse grep output format: filename:linenumber:content
            const match = line.match(/^([^:]+):(\d+):(.*)$/)
            if (match) {
              results.push({
                file: match[1],
                line: parseInt(match[2], 10),
                content: match[3]
              })
            }
          }
          
          return results
        } catch (error) {
          console.error('[ConstellationFS/Codebuff] Search failed:', error)
          return []
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
   * Create a Codebuff agent configuration with ConstellationFS tool overrides
   * 
   * @param agentConfig - Base agent configuration
   * @returns Agent configuration with tool handlers attached
   */
  createAgentConfig(agentConfig: any): any {
    return {
      ...agentConfig,
      // Override the handleSteps to inject our tool handlers
      handleSteps: this.createHandleSteps(agentConfig.handleSteps)
    }
  }

  /**
   * Create a handleSteps generator that intercepts tool calls
   * 
   * @param originalHandleSteps - Original handleSteps function from agent config
   * @returns Modified handleSteps that uses our tool handlers
   */
  private createHandleSteps(originalHandleSteps?: any) {
    const handlers = this.handlers
    
    return function* (context: any): Generator<any, any, any> {
      // If there's an original handleSteps, wrap it
      if (originalHandleSteps) {
        const gen = originalHandleSteps(context)
        let result = gen.next()
        
        while (!result.done) {
          // Intercept tool calls
          if (result.value && typeof result.value === 'object' && 'toolName' in result.value) {
            const toolCall = result.value
            
            // Check if we have a handler for this tool
            if (toolCall.toolName === 'run_terminal_command' && handlers.run_terminal_command) {
              const { command, cwd } = toolCall.input || {}
              const output = yield handlers.run_terminal_command(command, cwd)
              result = gen.next(output)
            } else if (toolCall.toolName === 'read_files' && handlers.read_files) {
              const { paths } = toolCall.input || {}
              const output = yield handlers.read_files(paths || [])
              result = gen.next(output)
            } else if (toolCall.toolName === 'write_file' && handlers.write_file) {
              const { path, content } = toolCall.input || {}
              yield handlers.write_file(path, content)
              result = gen.next()
            } else if (toolCall.toolName === 'str_replace' && handlers.str_replace) {
              const { path, replacements } = toolCall.input || {}
              const output = yield handlers.str_replace(path, replacements || [])
              result = gen.next(output)
            } else if (toolCall.toolName === 'find_files' && handlers.find_files) {
              const { pattern, path } = toolCall.input || {}
              const output = yield handlers.find_files(pattern, path)
              result = gen.next(output)
            } else if (toolCall.toolName === 'code_search' && handlers.code_search) {
              const { pattern, path, fileType } = toolCall.input || {}
              const output = yield handlers.code_search(pattern, path, fileType)
              result = gen.next(output)
            } else {
              // Pass through unhandled tool calls
              const output = yield result.value
              result = gen.next(output)
            }
          } else {
            // Pass through non-tool values
            const output = yield result.value
            result = gen.next(output)
          }
        }
        
        return result.value
      } else {
        // No original handleSteps, just run to completion
        yield 'STEP_ALL'
      }
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
