import { getLogger } from '../utils/logger.js'
import { execSync } from 'child_process'
import { readdir } from 'fs/promises'
import { join } from 'path'
import { ERROR_CODES } from '../constants.js'
import { FileSystemError } from '../types.js'
import { LocalWorkspaceUtils } from '../utils/LocalWorkspaceUtils.js'
import { LocalWorkspace } from '../workspace/LocalWorkspace.js'
import type { Workspace, WorkspaceConfig } from '../workspace/Workspace.js'
import type { FileSystemBackend, LocalBackendConfig } from './types.js'
import { validateLocalBackendConfig } from './types.js'

/**
 * Local filesystem backend implementation
 * Executes commands and file operations on the local machine using Node.js APIs
 * and POSIX-compliant shell commands for cross-platform compatibility
 *
 * Manages multiple workspaces for a single user
 */
export class LocalBackend implements FileSystemBackend {
  public readonly type = 'local' as const
  public readonly userId: string
  public readonly options: LocalBackendConfig
  public readonly connected: boolean
  private workspaceCache = new Map<string, LocalWorkspace>()

  /**
   * Create a new LocalBackend instance
   * @param options - Configuration options for the local backend
   * @throws {FileSystemError} When utilities are missing
   */
  constructor(options: LocalBackendConfig) {
    validateLocalBackendConfig(options)
    this.options = options
    this.userId = options.userId

    // Validate userId
    LocalWorkspaceUtils.validateWorkspacePath(options.userId)

    this.connected = true

    if (options.validateUtils) {
      this.validateEnvironment()
    }
    getLogger().debug('LocalBackend initialized for user:', this.userId)
  }

  /**
   * Validate that required POSIX utilities are available
   */
  private validateEnvironment(): void {
    const requiredUtils = ['ls', 'find', 'grep', 'cat', 'wc', 'head', 'tail', 'sort']
    const missing: string[] = []

    for (const util of requiredUtils) {
      try {
        execSync(`command -v ${util}`, { stdio: 'ignore' })
      } catch {
        missing.push(util)
      }
    }

    if (missing.length > 0) {
      throw new FileSystemError(
        `Missing required POSIX utilities: ${missing.join(', ')}. ` +
        'Please ensure they are installed and available in PATH.',
        ERROR_CODES.MISSING_UTILITIES,
      )
    }
  }

  /**
   * Get or create a workspace for this user
   * @param workspaceName - Workspace name (defaults to 'default')
   * @param config - Optional workspace configuration including custom environment variables
   * @returns Promise resolving to Workspace instance
   */
  async getWorkspace(workspaceName = 'default', config?: WorkspaceConfig): Promise<Workspace> {
    // Generate cache key that includes env config to support different configs for same workspace name
    const cacheKey = config?.env ? `${workspaceName}:${JSON.stringify(config.env)}` : workspaceName

    if (this.workspaceCache.has(cacheKey)) {
      return this.workspaceCache.get(cacheKey)!
    }

    // Create workspace directory for this user
    const fullPath = LocalWorkspaceUtils.ensureUserWorkspace(join(this.userId, workspaceName))

    const workspace = new LocalWorkspace(this, this.userId, workspaceName, fullPath, config)
    this.workspaceCache.set(cacheKey, workspace)

    getLogger().debug(`Created workspace for user ${this.userId}: ${workspaceName}`, config?.env ? 'with custom env' : '')

    return workspace
  }

  /**
   * List all workspaces for this user
   * @returns Promise resolving to array of workspace paths
   */
  async listWorkspaces(): Promise<string[]> {
    const userRoot = LocalWorkspaceUtils.getUserWorkspacePath(this.userId)

    try {
      const entries = await readdir(userRoot, { withFileTypes: true })
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
    } catch (error) {
      // If user root doesn't exist yet, return empty array
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return []
      }
      throw this.wrapError(error, 'List workspaces', ERROR_CODES.READ_FAILED)
    }
  }


  /**
   * Clean up backend resources
   */
  async destroy(): Promise<void> {
    this.workspaceCache.clear()
    getLogger().debug(`LocalBackend destroyed for user: ${this.userId}`)
  }

  /**
   * Wrap errors consistently across all operations
   */
  private wrapError(
    error: unknown,
    operation: string,
    errorCode: string,
    command?: string
  ): FileSystemError {
    // If it's already our error type, re-throw as-is
    if (error instanceof FileSystemError) {
      return error
    }

    // Get error message from Error objects or fallback
    const message = error instanceof Error ? error.message : 'Unknown error occurred'

    return new FileSystemError(`${operation} failed: ${message}`, errorCode, command)
  }
}
