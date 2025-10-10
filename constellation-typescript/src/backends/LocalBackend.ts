import { getLogger } from '@/utils/logger.js'
import { execSync, spawn } from 'child_process'
import { readdir } from 'fs/promises'
import { join } from 'path'
import { ERROR_CODES } from '../constants.js'
import { isCommandSafe, isDangerous } from '../safety.js'
import { DangerousOperationError, FileSystemError } from '../types.js'
import { LocalWorkspaceUtils } from '../utils/LocalWorkspaceUtils.js'
import { LocalWorkspace } from '../workspace/LocalWorkspace.js'
import type { Workspace } from '../workspace/Workspace.js'
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
  private readonly shell: string
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
    this.shell = this.detectShell()

    if (options.validateUtils) {
      this.validateEnvironment()
    }
    getLogger().debug('LocalBackend initialized for user:', this.userId)
  }
  
  /**
   * Detect the best available shell for command execution
   */
  private detectShell(): string {
    if (this.options.shell === 'bash') {
      return 'bash'
    } else if (this.options.shell === 'sh') {
      return 'sh'
    } else if (this.options.shell === 'auto') {
      // Auto-detection: prefer bash if available, fall back to sh
      try {
        execSync('command -v bash', { stdio: 'ignore' })
        return 'bash'
      } catch {
        return 'sh'
      }
    }
    
    // Fallback for any unexpected shell value
    return 'sh'
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
   * @returns Promise resolving to Workspace instance
   */
  async getWorkspace(workspaceName = 'default'): Promise<Workspace> {
    if (this.workspaceCache.has(workspaceName)) {
      return this.workspaceCache.get(workspaceName)!
    }

    // Create workspace directory for this user
    const fullPath = LocalWorkspaceUtils.ensureUserWorkspace(join(this.userId, workspaceName))

    const workspace = new LocalWorkspace(this, this.userId, workspaceName, fullPath)
    this.workspaceCache.set(workspaceName, workspace)

    getLogger().debug(`Created workspace for user ${this.userId}: ${workspaceName}`)

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
   * Execute command in a specific workspace path (internal use by Workspace)
   * @param workspacePath - Absolute path to workspace directory
   * @param command - Command to execute
   * @returns Promise resolving to command output
   */
  async execInWorkspace(workspacePath: string, command: string): Promise<string> {
    // Comprehensive safety check
    const safetyCheck = isCommandSafe(command)
    if (!safetyCheck.safe) {
      // Special handling for preventDangerous option
      if (this.options.preventDangerous && isDangerous(command)) {
        if (this.options.onDangerousOperation) {
          this.options.onDangerousOperation(command)
          return ''
        } else {
          throw new DangerousOperationError(command)
        }
      }

      // For other safety violations, always throw
      throw new FileSystemError(
        safetyCheck.reason || 'Command failed safety check',
        ERROR_CODES.DANGEROUS_OPERATION,
        command
      )
    }

    // Note: Path validation is already handled by safety checks above
    // The command will run in the workspace directory via cwd option

    return new Promise((resolve, reject) => {
      const child = spawn(this.shell, ['-c', command], {
        cwd: workspacePath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          // Start with minimal environment, including common npm/node locations
          PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/opt/homebrew/opt/node/bin:/usr/local/opt/node/bin',
          USER: process.env.USER,
          SHELL: this.shell,
          // Force working directory
          PWD: workspacePath,
          HOME: workspacePath,
          TMPDIR: join(workspacePath, '.tmp'),
          // Locale settings
          LANG: 'C',
          LC_ALL: 'C',
          // Block dangerous variables
          LD_PRELOAD: undefined,
          LD_LIBRARY_PATH: undefined,
          DYLD_INSERT_LIBRARIES: undefined,
          DYLD_LIBRARY_PATH: undefined,
        },
      })

      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        if (code === 0) {
          let output = stdout.trim()

          if (this.options.maxOutputLength && output.length > this.options.maxOutputLength) {
            const truncatedLength = this.options.maxOutputLength - 50
            output = `${output.substring(0, truncatedLength)}\n\n... [Output truncated. Full output was ${output.length} characters, showing first ${truncatedLength}]`
          }

          resolve(output)
        } else {
          reject(
            new FileSystemError(
              `Command execution failed with exit code ${code}: ${stderr.trim() || stdout.trim()}`,
              ERROR_CODES.EXEC_FAILED,
              command
            )
          )
        }
      })

      child.on('error', (err) => {
        reject(this.wrapError(err, 'Execute command', ERROR_CODES.EXEC_ERROR, command))
      })
    })
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
