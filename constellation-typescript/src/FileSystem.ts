import { BackendPool } from './backends/BackendPool.js'
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
  private readonly shouldReleaseBackend: boolean

  /**
   * Create a new FileSystem instance
   * @param input - Backend configuration object with userId
   * @param useBackendPool - Whether to use backend pooling (default: true)
   * @throws {FileSystemError} When configuration is invalid
   */
  constructor(input: Partial<BackendConfig>, useBackendPool = true) {
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

    // Get backend from pool or create new one
    this.backend = useBackendPool
      ? BackendPool.getBackend(this.backendConfig)
      : BackendFactory.create(this.backendConfig)

    this.shouldReleaseBackend = useBackendPool
  }

  /**
   * Get or create a workspace
   * @param workspacePath - Workspace identifier (defaults to 'default')
   * @returns Promise resolving to Workspace instance
   */
  async getWorkspace(workspacePath = 'default'): Promise<Workspace> {
    return this.backend.getWorkspace(workspacePath)
  }

  /**
   * List all workspaces for this user
   * @returns Promise resolving to array of workspace paths
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
   * Releases backend reference if using backend pooling
   */
  async destroy(): Promise<void> {
    if (this.shouldReleaseBackend) {
      await BackendPool.releaseBackend(this.backend)
    } else {
      await this.backend.destroy()
    }
  }
}
