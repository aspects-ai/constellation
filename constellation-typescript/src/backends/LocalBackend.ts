import { getLogger } from '@/utils/logger.js'
import { execSync, spawn } from 'child_process'
import { readdir } from 'fs/promises'
import { join } from 'path'
import { ERROR_CODES } from '../constants.js'
import { isCommandSafe, isDangerous } from '../safety.js'
import { DangerousOperationError, FileSystemError } from '../types.js'
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
   * Validate custom environment variables for security
   * @param customEnv - Custom environment variables to validate
   * @returns Validated environment variables
   */
  private validateCustomEnv(customEnv: Record<string, string>): Record<string, string> {
    const BLOCKED_VARS = [
      'LD_PRELOAD',
      'LD_LIBRARY_PATH',
      'DYLD_INSERT_LIBRARIES',
      'DYLD_LIBRARY_PATH',
      'IFS',
      'BASH_ENV',
      'ENV',
    ]

    const PROTECTED_VARS = ['PATH', 'HOME', 'PWD', 'TMPDIR', 'TMP', 'SHELL', 'USER']

    const validated: Record<string, string> = {}

    for (const [key, value] of Object.entries(customEnv)) {
      // Block dangerous variables that could lead to code injection
      if (BLOCKED_VARS.includes(key)) {
        getLogger().warn(`Blocked dangerous environment variable: ${key}`)
        continue
      }

      // Warn about protected variables (allow but log)
      if (PROTECTED_VARS.includes(key)) {
        getLogger().warn(`Overriding protected environment variable: ${key}`)
      }

      // Validate value doesn't contain null bytes or other dangerous chars
      if (value.includes('\0')) {
        throw new FileSystemError(
          `Environment variable ${key} contains null byte`,
          ERROR_CODES.INVALID_CONFIGURATION
        )
      }

      validated[key] = value
    }

    return validated
  }

  /**
   * Build environment variables for workspace execution
   * Merges safe defaults with validated custom environment variables
   * @param workspacePath - Absolute path to workspace directory
   * @param customEnv - Optional custom environment variables
   * @returns Merged environment variables
   */
  private buildEnvironment(
    workspacePath: string,
    customEnv?: Record<string, string>
  ): Record<string, string | undefined> {
    // Start with safe base environment
    const safeEnv: Record<string, string | undefined> = {
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
    }

    // Validate and merge custom environment variables
    if (customEnv && Object.keys(customEnv).length > 0) {
      const validatedCustomEnv = this.validateCustomEnv(customEnv)
      // Custom env vars override safe defaults (except blocked ones)
      Object.assign(safeEnv, validatedCustomEnv)
    }

    return safeEnv
  }

  /**
   * Execute command in a specific workspace path (internal use by Workspace)
   * @param workspacePath - Absolute path to workspace directory
   * @param command - Command to execute
   * @param encoding - Output encoding: 'utf8' for text (default) or 'buffer' for binary data
   * @param customEnv - Optional custom environment variables for this workspace
   * @returns Promise resolving to command output as string or Buffer
   */
  async execInWorkspace(
    workspacePath: string,
    command: string,
    encoding: 'utf8' | 'buffer' = 'utf8',
    customEnv?: Record<string, string>
  ): Promise<string | Buffer> {
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
        env: this.buildEnvironment(workspacePath, customEnv),
      })

      // Collect output based on encoding mode
      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []

      child.stdout?.on('data', (data) => {
        stdoutChunks.push(data)
      })

      child.stderr?.on('data', (data) => {
        stderrChunks.push(data)
      })

      child.on('close', (code) => {
        if (code === 0) {
          const stdoutBuffer = Buffer.concat(stdoutChunks)

          if (encoding === 'buffer') {
            // Return raw binary data as Buffer
            resolve(stdoutBuffer)
          } else {
            // Return as UTF-8 string (default behavior)
            let output = stdoutBuffer.toString('utf-8').trim()

            if (this.options.maxOutputLength && output.length > this.options.maxOutputLength) {
              const truncatedLength = this.options.maxOutputLength - 50
              output = `${output.substring(0, truncatedLength)}\n\n... [Output truncated. Full output was ${output.length} characters, showing first ${truncatedLength}]`
            }

            resolve(output)
          }
        } else {
          const stderrBuffer = Buffer.concat(stderrChunks)
          const stdoutBuffer = Buffer.concat(stdoutChunks)
          const errorMessage = stderrBuffer.toString('utf-8').trim() || stdoutBuffer.toString('utf-8').trim()

          reject(
            new FileSystemError(
              `Command execution failed with exit code ${code}: ${errorMessage}`,
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
