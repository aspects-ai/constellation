import type { FileSystem } from '../FileSystem.js'
import type { FileInfo } from '../types.js'
import type { GrepOptions } from '../utils/POSIXCommands.js'
import { POSIXCommands } from '../utils/POSIXCommands.js'
import { BaseSDKAdapter } from './BaseAdapter.js'

/**
 * Adapter mapping Claude Code tools to ConstellationFS operations
 * This provides a plug-and-play interface for agents using Claude Code SDK.
 * Available tools for Claude Code SDK: https://docs.anthropic.com/en/docs/claude-code/settings#tools-available-to-claude
 */
export class ClaudeCodeAdapter extends BaseSDKAdapter {
  constructor(fs: FileSystem) {
    super(fs)
  }

  /**
   * Execute shell commands - maps to Claude's Bash tool
   * @param command - The shell command to execute
   * @returns Promise resolving to command output
   */
  async Bash(command: string): Promise<string> {
    return this.exec(command)
  }

  /**
   * List files and directories - maps to Claude's LS tool
   * @param path - Optional path to list (defaults to workspace root)
   * @returns Promise resolving to array of file/directory names
   */
  async LS(path?: string): Promise<string[]> {
    if (path) {
      const command = POSIXCommands.ls(path)
      return this.exec(command).then(output => 
        output ? output.split('\n').filter(Boolean) : [],
      )
    } else {
      const result = await this.ls()
      return Array.isArray(result) && typeof result[0] === 'string' 
        ? result as string[]
        : (result as FileInfo[]).map(f => f.name)
    }
  }

  /**
   * Find files using glob patterns - maps to Claude's Glob tool
   * @param pattern - Glob pattern to match files
   * @param path - Optional path to search in (defaults to current directory)
   * @returns Promise resolving to array of matching file paths
   */
  async Glob(pattern: string, path?: string): Promise<string[]> {
    const searchPath = path || '.'
    const command = POSIXCommands.find(pattern, searchPath, { type: 'f' })
    const result = await this.exec(command)
    return result ? result.split('\n').filter(Boolean) : []
  }

  /**
   * Search for patterns in file contents - maps to Claude's Grep tool
   * @param pattern - Pattern to search for
   * @param options - Search options
   * @returns Promise resolving to search results
   */
  async Grep(
    pattern: string, 
    options: {
      files?: string
      ignoreCase?: boolean
      lineNumbers?: boolean
      context?: number
    } = {},
  ): Promise<string> {
     // We use recursive search if no specific files are provided
    const grepOptions: GrepOptions = {
      ignoreCase: options.ignoreCase,
      lineNumbers: options.lineNumbers,
      context: options.context,
      recursive: !options.files,
    }
    
    const command = POSIXCommands.grep(pattern, options.files, grepOptions)
    
    try {
      return await this.exec(command)
    } catch {
      return ''
    }
  }

  /**
   * Read file contents - maps to Claude's Read tool
   * @param path - Path to file to read
   * @returns Promise resolving to file contents
   */
  async Read(path: string): Promise<string> {
    return this.read(path)
  }

  /**
   * Write content to file - maps to Claude's Write tool
   * @param path - Path to file to write
   * @param content - Content to write to file
   * @returns Promise that resolves when write is complete
   */
  async Write(path: string, content: string): Promise<void> {
    return this.write(path, content)
  }

  /**
   * Edit files by replacing specific text - maps to Claude's Edit tool
   * This is a simplified version that uses sed for basic find-replace operations
   * @param path - Path to file to edit
   * @param oldText - Text to replace
   * @param newText - Replacement text
   * @returns Promise that resolves when edit is complete
   */
  async Edit(path: string, oldText: string, newText: string): Promise<void> {
    // Escape special characters for sed
    const escapedOld = oldText.replace(/[/\\&]/g, '\\$&')
    const escapedNew = newText.replace(/[/\\&]/g, '\\$&')
    
    // Use sed for in-place editing
    await this.exec(`sed -i '' 's/${escapedOld}/${escapedNew}/g' "${path}"`)
  }
}
