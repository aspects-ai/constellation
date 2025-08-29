import type { FileSystem } from '../FileSystem.js'
import { BaseSDKAdapter } from './BaseAdapter.js'

/**
 * Adapter for Claude Code SDK that provides file system operations.
 * 
 * Claude Code SDK executes all commands with the specified working directory (cwd),
 * which provides automatic isolation within the workspace. The SDK's built-in safety
 * features combined with ConstellationFS's workspace isolation ensure secure operation.
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
   * @param _path - Optional path to list (defaults to workspace root)
   * @returns Promise resolving to array of file/directory names
   */
  async LS(_path?: string): Promise<string[]> {
    // Claude Code SDK will handle this via bash commands with proper cwd
    throw new Error('LS operations should be handled via Bash tool with proper cwd set in Claude Code SDK')
  }

  /**
   * Find files using glob patterns - maps to Claude's Glob tool
   * @param _pattern - Glob pattern to match files
   * @param _path - Optional path to search in (defaults to current directory)
   * @returns Promise resolving to array of matching file paths
   */
  async Glob(_pattern: string, _path?: string): Promise<string[]> {
    // Claude Code SDK will handle this via bash commands with proper cwd
    throw new Error('Glob operations should be handled via Bash tool with proper cwd set in Claude Code SDK')
  }

  /**
   * Search for patterns in file contents - maps to Claude's Grep tool
   * @param _pattern - Pattern to search for
   * @param _options - Search options
   * @returns Promise resolving to search results
   */
  async Grep(
    _pattern: string, 
    _options: {
      files?: string
      ignoreCase?: boolean
      lineNumbers?: boolean
      context?: number
    } = {},
  ): Promise<string> {
    // Claude Code SDK will handle this via bash commands with proper cwd
    throw new Error('Grep operations should be handled via Bash tool with proper cwd set in Claude Code SDK')
  }

  /**
   * Read file contents - maps to Claude's Read tool
   * @param _path - Path to file to read
   * @returns Promise resolving to file contents
   */
  async Read(_path: string): Promise<string> {
    // Claude Code SDK will handle this via bash commands with proper cwd
    throw new Error('Read operations should be handled via Bash tool with proper cwd set in Claude Code SDK')
  }

  /**
   * Write content to file - maps to Claude's Write tool
   * @param _path - Path to file to write
   * @param _content - Content to write to file
   * @returns Promise that resolves when write is complete
   */
  async Write(_path: string, _content: string): Promise<void> {
    // Claude Code SDK will handle this via bash commands with proper cwd
    throw new Error('Write operations should be handled via Bash tool with proper cwd set in Claude Code SDK')
  }

  /**
   * Edit files by replacing specific text - maps to Claude's Edit tool
   * @param _path - Path to file to edit
   * @param _oldText - Text to replace
   * @param _newText - Replacement text
   * @returns Promise that resolves when edit is complete
   */
  async Edit(_path: string, _oldText: string, _newText: string): Promise<void> {
    // Claude Code SDK will handle this via bash commands with proper cwd
    throw new Error('Edit operations should be handled via Bash tool with proper cwd set in Claude Code SDK')
  }
}