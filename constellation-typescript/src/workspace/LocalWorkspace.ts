import type { Dirent, Stats } from 'fs'
import { join } from 'path'
import type { LocalBackend } from '../backends/LocalBackend.js'
import { ERROR_CODES } from '../constants.js'
import { isCommandSafe, isDangerous } from '../safety.js'
import { DangerousOperationError, FileSystemError } from '../types.js'
import { getLogger } from '../utils/logger.js'
import { checkSymlinkSafety } from '../utils/pathValidator.js'
import { BaseWorkspace, type WorkspaceConfig } from './Workspace.js'

/**
 * Local filesystem workspace implementation
 * Executes operations on the local machine using Node.js APIs
 */
export class LocalWorkspace extends BaseWorkspace {
  declare readonly backend: LocalBackend

  constructor(
    backend: LocalBackend,
    userId: string,
    workspaceName: string,
    workspacePath: string,
    config?: WorkspaceConfig
  ) {
    super(backend, userId, workspaceName, workspacePath, config)
  }

  async exec(command: string, encoding: 'utf8' | 'buffer' = 'utf8'): Promise<string | Buffer> {
    if (!command.trim()) {
      throw new FileSystemError('Command cannot be empty', ERROR_CODES.EMPTY_COMMAND)
    }

    // Comprehensive safety check
    const safetyCheck = isCommandSafe(command)
    if (!safetyCheck.safe) {
      // Special handling for preventDangerous option
      if (this.backend.options.preventDangerous && isDangerous(command)) {
        if (this.backend.options.onDangerousOperation) {
          this.backend.options.onDangerousOperation(command)
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

    const shell = this.detectShell()
    const env = this.buildEnvironment()

    return new Promise((resolve, reject) => {
      const child = this.backend.spawnProcess(shell, ['-c', command], {
        cwd: this.workspacePath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
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

            if (this.backend.options.maxOutputLength && output.length > this.backend.options.maxOutputLength) {
              const truncatedLength = this.backend.options.maxOutputLength - 50
              output = `${output.substring(0, truncatedLength)}\n\n... [Output truncated. Full output was ${output.length} characters, showing first ${truncatedLength}]`
            }

            resolve(output)
          }
        } else {
          const stderrBuffer = Buffer.concat(stderrChunks)
          const stdoutBuffer = Buffer.concat(stdoutChunks)
          const errorMessage = stderrBuffer.toString('utf-8').trim() || stdoutBuffer.toString('utf-8').trim()

          getLogger().error(`Command execution failed in workspace: ${this.workspacePath}, cwd: ${this.workspacePath}, exit code: ${code}`)

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
        getLogger().error(`Command execution error in workspace: ${this.workspacePath}, cwd: ${this.workspacePath}`, err)
        reject(this.wrapError(err, 'Execute command', ERROR_CODES.EXEC_ERROR, command))
      })
    })
  }

  /**
   * Detect the best available shell for command execution
   */
  private detectShell(): string {
    if (this.backend.options.shell === 'bash') {
      return 'bash'
    } else if (this.backend.options.shell === 'sh') {
      return 'sh'
    } else if (this.backend.options.shell === 'auto') {
      // Auto-detection: prefer bash if available, fall back to sh
      try {
        this.backend.execSyncCommand('command -v bash', { stdio: 'ignore' })
        return 'bash'
      } catch {
        return 'sh'
      }
    }

    // Fallback for any unexpected shell value
    return 'sh'
  }

  /**
   * Build environment variables for command execution
   * Merges safe defaults with validated custom environment variables
   */
  private buildEnvironment(): Record<string, string | undefined> {
    // Start with safe base environment
    const safeEnv: Record<string, string | undefined> = {
      // Start with minimal environment, including common npm/node locations
      PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/opt/homebrew/opt/node/bin:/usr/local/opt/node/bin',
      USER: process.env.USER,
      SHELL: this.detectShell(),
      // Force working directory
      PWD: this.workspacePath,
      HOME: this.workspacePath,
      TMPDIR: join(this.workspacePath, '.tmp'),
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
    if (this.customEnv && Object.keys(this.customEnv).length > 0) {
      const validatedCustomEnv = this.validateCustomEnv(this.customEnv)
      // Custom env vars override safe defaults (except blocked ones)
      Object.assign(safeEnv, validatedCustomEnv)
    }

    return safeEnv
  }

  /**
   * Validate custom environment variables for security
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
        continue
      }

      // Warn about protected variables (allow but log)
      if (PROTECTED_VARS.includes(key)) {
        // Could add logging here if needed
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

  async write(path: string, content: string | Buffer): Promise<void> {
    this.validatePath(path)

    // Check symlink safety for parent directories
    const parentPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '.'
    if (parentPath !== '.') {
      const symlinkCheck = checkSymlinkSafety(this.workspacePath, parentPath)
      if (!symlinkCheck.safe) {
        throw new FileSystemError(
          `Cannot write file: ${symlinkCheck.reason}`,
          ERROR_CODES.PATH_ESCAPE_ATTEMPT,
          `write ${path}`
        )
      }
    }

    const fullPath = this.resolvePath(path)

    try {
      // Create parent directories if they don't exist
      if (parentPath !== '.') {
        const fullParentPath = this.resolvePath(parentPath)
        await this.backend.mkdirAsync(fullParentPath, { recursive: true })
      }

      // Handle Buffer or string content
      if (Buffer.isBuffer(content)) {
        await this.backend.writeFileAsync(fullPath, content, { flag: 'w' })
      } else {
        await this.backend.writeFileAsync(fullPath, content, 'utf-8')
      }
    } catch (error) {
      throw this.wrapError(error, 'Write file', ERROR_CODES.WRITE_FAILED, `write ${path}`)
    }
  }

  async mkdir(path: string, recursive = true): Promise<void> {
    this.validatePath(path)

    // Check symlink safety for parent directories
    const parentPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '.'
    if (parentPath !== '.') {
      const symlinkCheck = checkSymlinkSafety(this.workspacePath, parentPath)
      if (!symlinkCheck.safe) {
        throw new FileSystemError(
          `Cannot create directory: ${symlinkCheck.reason}`,
          ERROR_CODES.PATH_ESCAPE_ATTEMPT,
          `mkdir ${path}`
        )
      }
    }

    const fullPath = this.resolvePath(path)

    try {
      await this.backend.mkdirAsync(fullPath, { recursive })
    } catch (error) {
      throw this.wrapError(error, 'Create directory', ERROR_CODES.WRITE_FAILED, `mkdir ${path}`)
    }
  }

  async touch(path: string): Promise<void> {
    this.validatePath(path)

    // Check symlink safety for parent directories
    const parentPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '.'
    if (parentPath !== '.') {
      const symlinkCheck = checkSymlinkSafety(this.workspacePath, parentPath)
      if (!symlinkCheck.safe) {
        throw new FileSystemError(
          `Cannot create file: ${symlinkCheck.reason}`,
          ERROR_CODES.PATH_ESCAPE_ATTEMPT,
          `touch ${path}`
        )
      }
    }

    const fullPath = this.resolvePath(path)

    try {
      // Create empty file or update timestamp if it exists
      await this.backend.writeFileAsync(fullPath, '', { flag: 'a' })
    } catch (error) {
      throw this.wrapError(error, 'Create file', ERROR_CODES.WRITE_FAILED, `touch ${path}`)
    }
  }

  async exists(): Promise<boolean> {
    return await this.backend.existsAsync(this.workspacePath)
  }

  async fileExists(path: string): Promise<boolean> {
    this.validatePath(path)

    try {
      const fullPath = this.resolvePath(path)
      return await this.backend.existsAsync(fullPath)
    } catch {
      // If path validation fails, the file doesn't exist (or is inaccessible)
      return false
    }
  }

  async stat(path: string): Promise<Stats> {
    this.validatePath(path)

    // Check symlink safety
    const symlinkCheck = checkSymlinkSafety(this.workspacePath, path)
    if (!symlinkCheck.safe) {
      throw new FileSystemError(
        `Cannot stat file: ${symlinkCheck.reason}`,
        ERROR_CODES.PATH_ESCAPE_ATTEMPT,
        `stat ${path}`
      )
    }

    const fullPath = this.resolvePath(path)

    try {
      return await this.backend.statAsync(fullPath)
    } catch (error) {
      throw this.wrapError(error, 'Stat file', ERROR_CODES.READ_FAILED, `stat ${path}`)
    }
  }

  async readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | Dirent[]> {
    this.validatePath(path)
    const fullPath = this.resolvePath(path)

    try {
      if (options?.withFileTypes) {
        return await this.backend.readdirAsync(fullPath, { withFileTypes: true })
      }
      return await this.backend.readdirAsync(fullPath)
    } catch (error) {
      throw this.wrapError(error, 'Read directory', ERROR_CODES.READ_FAILED, `readdir ${path}`)
    }
  }

  async readFile(path: string, encoding?: NodeJS.BufferEncoding | null): Promise<string | Buffer> {
    this.validatePath(path)

    // Check symlink safety
    const symlinkCheck = checkSymlinkSafety(this.workspacePath, path)
    if (!symlinkCheck.safe) {
      throw new FileSystemError(
        `Cannot read file: ${symlinkCheck.reason}`,
        ERROR_CODES.PATH_ESCAPE_ATTEMPT,
        `readFile ${path}`
      )
    }

    const fullPath = this.resolvePath(path)

    try {
      if (encoding) {
        return await this.backend.readFileAsync(fullPath, encoding)
      }
      return await this.backend.readFileAsync(fullPath)
    } catch (error) {
      throw this.wrapError(error, 'Read file', ERROR_CODES.READ_FAILED, `readFile ${path}`)
    }
  }

  async writeFile(path: string, content: string | Buffer, encoding: NodeJS.BufferEncoding = 'utf-8'): Promise<void> {
    this.validatePath(path)

    // Check symlink safety for parent directories
    const parentPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '.'
    if (parentPath !== '.') {
      const symlinkCheck = checkSymlinkSafety(this.workspacePath, parentPath)
      if (!symlinkCheck.safe) {
        throw new FileSystemError(
          `Cannot write file: ${symlinkCheck.reason}`,
          ERROR_CODES.PATH_ESCAPE_ATTEMPT,
          `writeFile ${path}`
        )
      }
    }

    const fullPath = this.resolvePath(path)

    try {
      // Create parent directories if they don't exist
      if (parentPath !== '.') {
        const fullParentPath = this.resolvePath(parentPath)
        await this.backend.mkdirAsync(fullParentPath, { recursive: true })
      }

      // Handle Buffer or string content
      if (Buffer.isBuffer(content)) {
        await this.backend.writeFileAsync(fullPath, content, { flag: 'w' })
      } else {
        await this.backend.writeFileAsync(fullPath, content, encoding as 'utf-8')
      }
    } catch (error) {
      throw this.wrapError(error, 'Write file', ERROR_CODES.WRITE_FAILED, `writeFile ${path}`)
    }
  }

  async delete(): Promise<void> {
    try {
      await this.backend.removeAsync(this.workspacePath, { recursive: true, force: true })
    } catch (error) {
      throw this.wrapError(
        error,
        'Delete workspace',
        ERROR_CODES.WRITE_FAILED,
        `delete ${this.workspaceName}`
      )
    }
  }

  async list(): Promise<string[]> {
    try {
      return await this.backend.readdirAsync(this.workspacePath)
    } catch (error) {
      throw this.wrapError(
        error,
        'List workspace',
        ERROR_CODES.READ_FAILED,
        `list ${this.workspaceName}`
      )
    }
  }

  // Synchronous filesystem methods for Codebuff compatibility
  existsSync(path: string): boolean {
    this.validatePath(path)
    const fullPath = this.resolvePath(path)
    return this.backend.existsSyncFS(fullPath)
  }

  mkdirSync(path: string, options?: { recursive?: boolean }): void {
    this.validatePath(path)

    // Check symlink safety for parent directories
    const parentPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '.'
    if (parentPath !== '.') {
      const symlinkCheck = checkSymlinkSafety(this.workspacePath, parentPath)
      if (!symlinkCheck.safe) {
        throw new FileSystemError(
          `Cannot create directory: ${symlinkCheck.reason}`,
          ERROR_CODES.PATH_ESCAPE_ATTEMPT,
          `mkdir ${path}`
        )
      }
    }

    const fullPath = this.resolvePath(path)

    try {
      this.backend.mkdirSyncFS(fullPath, { recursive: options?.recursive ?? true })
    } catch (error) {
      throw this.wrapError(error, 'Create directory (sync)', ERROR_CODES.WRITE_FAILED, `mkdir ${path}`)
    }
  }

  readdirSync(path: string, options?: { withFileTypes?: boolean }): string[] | Dirent[] {
    this.validatePath(path)
    const fullPath = this.resolvePath(path)

    try {
      if (options?.withFileTypes) {
        return this.backend.readdirSyncFS(fullPath, { withFileTypes: true })
      }
      return this.backend.readdirSyncFS(fullPath)
    } catch (error) {
      throw this.wrapError(error, 'Read directory (sync)', ERROR_CODES.READ_FAILED, `readdir ${path}`)
    }
  }

  readFileSync(path: string, encoding?: NodeJS.BufferEncoding | null): string | Buffer {
    this.validatePath(path)

    // Check symlink safety
    const symlinkCheck = checkSymlinkSafety(this.workspacePath, path)
    if (!symlinkCheck.safe) {
      throw new FileSystemError(
        `Cannot read file: ${symlinkCheck.reason}`,
        ERROR_CODES.PATH_ESCAPE_ATTEMPT,
        `read ${path}`
      )
    }

    const fullPath = this.resolvePath(path)

    try {
      // Return Buffer when encoding is null/undefined
      if (encoding === null || encoding === undefined) {
        return this.backend.readFileSyncFS(fullPath, null)
      }
      return this.backend.readFileSyncFS(fullPath, encoding)
    } catch (error) {
      throw this.wrapError(error, 'Read file (sync)', ERROR_CODES.READ_FAILED, `read ${path}`)
    }
  }

  statSync(path: string): Stats {
    this.validatePath(path)
    const fullPath = this.resolvePath(path)

    try {
      return this.backend.statSyncFS(fullPath)
    } catch (error) {
      throw this.wrapError(error, 'Stat file (sync)', ERROR_CODES.READ_FAILED, `stat ${path}`)
    }
  }

  writeFileSync(path: string, content: string | Buffer, encoding: NodeJS.BufferEncoding = 'utf-8'): void {
    this.validatePath(path)

    // Check symlink safety for parent directories
    const parentPath = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '.'
    if (parentPath !== '.') {
      const symlinkCheck = checkSymlinkSafety(this.workspacePath, parentPath)
      if (!symlinkCheck.safe) {
        throw new FileSystemError(
          `Cannot write file: ${symlinkCheck.reason}`,
          ERROR_CODES.PATH_ESCAPE_ATTEMPT,
          `write ${path}`
        )
      }
    }

    const fullPath = this.resolvePath(path)

    try {
      // Create parent directories if they don't exist
      if (parentPath !== '.') {
        const fullParentPath = this.resolvePath(parentPath)
        this.backend.mkdirSyncFS(fullParentPath, { recursive: true })
      }

      // Handle Buffer or string content
      if (Buffer.isBuffer(content)) {
        this.backend.writeFileSyncFS(fullPath, content)
      } else {
        this.backend.writeFileSyncFS(fullPath, content, encoding)
      }
    } catch (error) {
      throw this.wrapError(error, 'Write file (sync)', ERROR_CODES.WRITE_FAILED, `write ${path}`)
    }
  }

  // Promises API for Codebuff compatibility
  promises = {
    readdir: async (path: string, options?: { withFileTypes?: boolean }): Promise<string[] | Dirent[]> => {
      this.validatePath(path)
      const fullPath = this.resolvePath(path)

      try {
        if (options?.withFileTypes) {
          return await this.backend.readdirAsync(fullPath, { withFileTypes: true })
        }
        return await this.backend.readdirAsync(fullPath)
      } catch (error) {
        throw this.wrapError(error, 'Read directory (async)', ERROR_CODES.READ_FAILED, `readdir ${path}`)
      }
    }
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

    // Log the error with workspace context
    getLogger().error(`${operation} failed in workspace: ${this.workspacePath}${command ? `, command: ${command}` : ''}`, error)

    return new FileSystemError(`${operation} failed: ${message}`, errorCode, command)
  }
}
