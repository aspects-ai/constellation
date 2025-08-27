import type { FileSystem } from '../FileSystem.js'
import type { FileSystemOptions } from '../types.js'

/**
 * Base interface that all Agent SDK adapters should implement
 * Provides common functionality and access to the underlying FileSystem
 */
export interface AgentSDKAdapter {
  /**
   * Get the underlying FileSystem instance
   */
  readonly fileSystem: FileSystem

  /**
   * Get the workspace path
   */
  readonly workspace: string

  /**
   * Get the filesystem options
   */
  readonly options: FileSystemOptions
}

/**
 * Abstract base class for SDK adapters
 * Provides common functionality that all adapters can use to interact with different AI frameworks
 * 
 * New adapters should extend this class. General shell commands can be routed through the `exec` method, while specific shell commands
 * should be implemented in the adapter via POSIXCommands.
 */
export abstract class BaseSDKAdapter implements AgentSDKAdapter {
  constructor(protected readonly fs: FileSystem) {}

  get fileSystem(): FileSystem {
    return this.fs
  }

  get workspace(): string {
    return this.fs.workspace
  }

  get options(): FileSystemOptions {
    return this.fs.options
  }

  /**
   * Execute a shell command (common across most SDKs)
   * @param command - The shell command to execute
   * @returns Promise resolving to command output
   */
  protected async exec(command: string): Promise<string> {
    return this.fs.exec(command)
  }

  /**
   * Read a file (common across most SDKs)  
   * @param path - Path to file to read
   * @returns Promise resolving to file contents
   */
  protected async read(path: string): Promise<string> {
    return this.fs.read(path)
  }

  /**
   * Write a file (common across most SDKs)
   * @param path - Path to file to write
   * @param content - Content to write
   * @returns Promise that resolves when write is complete
   */
  protected async write(path: string, content: string): Promise<void> {
    return this.fs.write(path, content)
  }

  /**
   * List files (common across most SDKs)
   * @param pattern - Optional pattern to filter files
   * @returns Promise resolving to file list
   */
  protected async ls(pattern?: string) {
    return this.fs.ls(pattern)
  }
}
