import { getLogger } from '../utils/logger.js'
import { execSync, spawn, type ChildProcess, type SpawnOptions } from 'child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, type Dirent, type Stats } from 'fs'
import { mkdir as fsMkdir, readdir, readFile, rm, writeFile } from 'fs/promises'
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

  // ========================================================================
  // Filesystem Operation Methods
  // These methods can be overridden in custom LocalBackend implementations
  // to provide custom behavior for filesystem operations
  // ========================================================================

  /**
   * Spawn a child process for command execution
   * Override this method to customize process spawning behavior
   */
  spawnProcess(shell: string, args: string[], options: SpawnOptions): ChildProcess {
    return spawn(shell, args, options)
  }

  /**
   * Execute a synchronous command
   * Override this method to customize synchronous command execution
   */
  execSyncCommand(command: string, options?: { stdio?: 'ignore' }): Buffer | string {
    return execSync(command, options)
  }

  // Async filesystem operations

  /**
   * Read file asynchronously
   */
  async readFileAsync(path: string, encoding: 'utf-8'): Promise<string> {
    return await readFile(path, encoding)
  }

  /**
   * Write file asynchronously
   */
  async writeFileAsync(path: string, content: string, encoding: 'utf-8'): Promise<void>
  async writeFileAsync(path: string, content: string, options: { flag: string }): Promise<void>
  async writeFileAsync(path: string, content: string, encodingOrOptions: 'utf-8' | { flag: string }): Promise<void> {
    await writeFile(path, content, encodingOrOptions as any)
  }

  /**
   * Create directory asynchronously
   */
  async mkdirAsync(path: string, options: { recursive?: boolean }): Promise<void> {
    await fsMkdir(path, options)
  }

  /**
   * Read directory asynchronously
   */
  async readdirAsync(path: string): Promise<string[]>
  async readdirAsync(path: string, options: { withFileTypes: true }): Promise<Dirent[]>
  async readdirAsync(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | Dirent[]> {
    if (options?.withFileTypes) {
      return await readdir(path, { withFileTypes: true })
    }
    return await readdir(path)
  }

  /**
   * Remove file or directory asynchronously
   */
  async removeAsync(path: string, options: { recursive: boolean; force: boolean }): Promise<void> {
    await rm(path, options)
  }

  // Sync filesystem operations

  /**
   * Check if path exists synchronously
   */
  existsSyncFS(path: string): boolean {
    return existsSync(path)
  }

  /**
   * Create directory synchronously
   */
  mkdirSyncFS(path: string, options: { recursive?: boolean }): void {
    mkdirSync(path, options)
  }

  /**
   * Read directory synchronously
   */
  readdirSyncFS(path: string): string[]
  readdirSyncFS(path: string, options: { withFileTypes: true }): Dirent[]
  readdirSyncFS(path: string, options?: { withFileTypes?: boolean }): string[] | Dirent[] {
    if (options?.withFileTypes) {
      return readdirSync(path, { withFileTypes: true })
    }
    return readdirSync(path)
  }

  /**
   * Read file synchronously
   */
  readFileSyncFS(path: string, encoding: NodeJS.BufferEncoding): string {
    return readFileSync(path, encoding)
  }

  /**
   * Get file stats synchronously
   */
  statSyncFS(path: string): Stats {
    return statSync(path)
  }

  /**
   * Write file synchronously
   */
  writeFileSyncFS(path: string, content: string, encoding: NodeJS.BufferEncoding): void {
    writeFileSync(path, content, encoding)
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
