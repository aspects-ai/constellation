import { BackendFactory } from './backends/index.js'
import type { BackendConfig, FileSystemBackend, LocalBackendConfig } from './types.js'
import { getLogger } from './utils/logger.js'
import type { Workspace } from './workspace/Workspace.js'

/**
 * FileSystem class - Frontend abstraction for backend management
 *
 * This class:
 * - Manages backend configuration and pooling
 * - Provides workspace access via getWorkspace()
 * - Hides backend pool complexity from users
 *
 * FileSystem is 1:1 with a backend (keyed by userId + backend type)
 * Workspaces are obtained from the FileSystem as needed
 *
 * @example
 * ```typescript
 * // Create a filesystem (gets/creates backend from pool)
 * const fs = new FileSystem({ userId: 'user123' })
 *
 * // Get workspaces and use them
 * const ws1 = await fs.getWorkspace('project-a')
 * const ws2 = await fs.getWorkspace('project-b')
 *
 * await ws1.exec('npm install')
 * await ws2.exec('npm test')
 *
 * // Cleanup when done
 * await fs.destroy()
 * ```
 */
export class FileSystem {
  private readonly backend: FileSystemBackend
  private readonly backendConfig: BackendConfig

  /**
   * Create a new FileSystem instance
   * @param input - Backend configuration object with userId
   * @throws {FileSystemError} When configuration is invalid
   */
  constructor(input: Partial<BackendConfig>) {
    // Normalize config
    if (input.type) {
      // Full backend config - use as-is with defaults for missing fields
      this.backendConfig = input as BackendConfig
    } else {
      getLogger().debug('No backend config provided, assuming local backend: %s', input)
      // Partial config - assume local backend and fill in defaults
      this.backendConfig = {
        type: 'local',
        shell: 'auto',
        validateUtils: false,
        preventDangerous: true,
        ...input,
      } as LocalBackendConfig
    }

    // Create a new backend instance for this FileSystem
    this.backend = BackendFactory.create(this.backendConfig)
  }

  /**
   * Get or create a workspace
   * @param workspaceName - Workspace name identifier (defaults to 'default')
   * @returns Promise resolving to Workspace instance
   */
  async getWorkspace(workspaceName: string): Promise<Workspace> {
    return this.backend.getWorkspace(workspaceName)
  }

  /**
   * List all workspaces for this user
   * @returns Promise resolving to array of workspace names
   */
  async listWorkspaces(): Promise<string[]> {
    return this.backend.listWorkspaces()
  }

  /**
   * Get the backend configuration
   * @returns Backend configuration object
   */
  get config(): BackendConfig {
    return this.backendConfig
  }

  /**
   * Get the user ID this filesystem is associated with
   * @returns User identifier
   */
  get userId(): string {
    return this.backendConfig.userId
  }

  /**
   * Clean up resources
   * Destroys the backend instance
   */
  async destroy(): Promise<void> {
    await this.backend.destroy()
  }
}
