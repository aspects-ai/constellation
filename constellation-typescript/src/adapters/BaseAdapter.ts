import type { FileSystem } from '../FileSystem.js'
import type { BackendConfig } from '../types.js'
import type { Workspace } from '../workspace/Workspace.js'

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
   * Get the workspace instance
   */
  readonly workspace: Workspace

  /**
   * Get the absolute workspace path
   */
  readonly workspacePath: string

  /**
   * Get the backend configuration
   */
  readonly backendConfig: BackendConfig
}

/**
 * Abstract base class for SDK adapters
 * Provides common functionality that all adapters can use to interact with different AI frameworks
 *
 * Adapters work with a specific workspace obtained from the FileSystem
 * New adapters should extend this class. General shell commands can be routed through the `exec` method, while specific shell commands
 * should be implemented in the adapter via POSIXCommands.
 */
export abstract class BaseSDKAdapter implements AgentSDKAdapter {
  private workspaceInstance?: Workspace
  private readonly defaultWorkspacePath: string

  constructor(
    protected readonly fs: FileSystem,
    workspaceName = 'default'
  ) {
    this.defaultWorkspacePath = workspaceName
  }

  /**
   * Lazily initialize and get the workspace instance
   */
  private async getWorkspaceInstance(): Promise<Workspace> {
    if (!this.workspaceInstance) {
      this.workspaceInstance = await this.fs.getWorkspace(this.defaultWorkspacePath)
    }
    return this.workspaceInstance
  }

  get fileSystem(): FileSystem {
    return this.fs
  }

  get workspace(): Workspace {
    if (!this.workspaceInstance) {
      throw new Error('Workspace not initialized. Call an async method first.')
    }
    return this.workspaceInstance
  }

  get workspacePath(): string {
    if (!this.workspaceInstance) {
      throw new Error('Workspace not initialized. Call an async method first.')
    }
    return this.workspaceInstance.workspacePath
  }

  get backendConfig(): BackendConfig {
    return this.fs.config
  }

  /**
   * Execute a shell command (common across most SDKs)
   * @param command - The shell command to execute
   * @returns Promise resolving to command output
   */
  protected async exec(command: string): Promise<string> {
    const ws = await this.getWorkspaceInstance()
    return ws.exec(command)
  }

  /**
   * Read a file (common across most SDKs)
   * @param path - Path to file to read
   * @returns Promise resolving to file contents
   */
  protected async read(path: string): Promise<string> {
    const ws = await this.getWorkspaceInstance()
    return ws.read(path)
  }

  /**
   * Write a file (common across most SDKs)
   * @param path - Path to file to write
   * @param content - Content to write
   * @returns Promise that resolves when write is complete
   */
  protected async write(path: string, content: string): Promise<void> {
    const ws = await this.getWorkspaceInstance()
    return ws.write(path, content)
  }
}
