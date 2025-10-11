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
  readonly workspace: Workspace

  constructor(
    protected readonly fs: FileSystem,
    workspace: Workspace
  ) {
    this.workspace = workspace
  }

  get fileSystem(): FileSystem {
    return this.fs
  }

  get workspacePath(): string {
    return this.workspace.workspacePath
  }

  get backendConfig(): BackendConfig {
    return this.fs.config
  }

}
