import { BackendFactory } from './backends/index.js'
import type { BackendConfig, FileSystemBackend, LocalBackendConfig } from './types.js'
import { getLogger } from './utils/logger.js'
import type { Workspace, WorkspaceConfig } from './workspace/Workspace.js'

/**
 * Type guard to check if input is a FileSystemBackend instance
 */
function isBackendInstance(input: Partial<BackendConfig> | FileSystemBackend): input is FileSystemBackend {
  return (
    typeof input === 'object' &&
    input !== null &&
    'type' in input &&
    'userId' in input &&
    'options' in input &&
    'connected' in input &&
    'getWorkspace' in input &&
    typeof (input as FileSystemBackend).getWorkspace === 'function'
  )
}

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
 * // Create a filesystem with config (creates backend automatically)
 * const fs = new FileSystem({ userId: 'user123' })
 *
 * // Or provide a custom backend instance
 * const customBackend = new LocalBackend({ userId: 'user123', type: 'local' })
 * const fs = new FileSystem(customBackend)
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
   * @param input - Backend configuration object or a FileSystemBackend instance
   * @throws {FileSystemError} When configuration is invalid
   */
  constructor(input: Partial<BackendConfig> | FileSystemBackend) {
    // Check if input is a backend instance
    if (isBackendInstance(input)) {
      // Use the provided backend instance
      this.backend = input
      this.backendConfig = input.options
    } else {
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
  }

  /**
   * Get or create a workspace
   * @param workspaceName - Workspace name identifier (defaults to 'default')
   * @param config - Optional workspace configuration including custom environment variables
   * @returns Promise resolving to Workspace instance
   *
   * @example
   * ```typescript
   * // Create workspace with custom environment variables
   * const workspace = await fs.getWorkspace('my-project', {
   *   env: {
   *     NODE_ENV: 'development',
   *     API_KEY: 'secret-key',
   *     DATABASE_URL: 'postgres://localhost:5432/db'
   *   }
   * })
   *
   * // Environment variables are available in all commands
   * await workspace.exec('echo $NODE_ENV')
   * ```
   */
  async getWorkspace(workspaceName: string, config?: WorkspaceConfig): Promise<Workspace> {
    return this.backend.getWorkspace(workspaceName, config)
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
