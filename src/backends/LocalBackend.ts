import { execSync, spawn } from 'child_process'
import { readFile, readdir, stat, writeFile } from 'fs/promises'
import { isAbsolute, join, relative, resolve } from 'path'
import { ERROR_CODES } from '../constants.js'
import { isDangerous } from '../safety.js'
import type { FileInfo } from '../types.js'
import { DangerousOperationError, FileSystemError } from '../types.js'
import { getLogger } from '../utils/logger.js'
import { POSIXCommands } from '../utils/POSIXCommands.js'
import { WorkspaceManager } from '../utils/workspaceManager.js'
import type { FileSystemBackend, LocalBackendConfig } from './types.js'
import { validateLocalBackendConfig } from './types.js'

/**
 * Local filesystem backend implementation
 * Executes commands and file operations on the local machine using Node.js APIs
 * and POSIX-compliant shell commands for cross-platform compatibility
 */
export class LocalBackend implements FileSystemBackend {

  public readonly workspace: string
  public readonly options: LocalBackendConfig
  private readonly shell: string

  /**
   * Create a new LocalBackend instance
   * @param options - Configuration options for the local backend
   * @throws {FileSystemError} When workspace doesn't exist or utilities are missing
   */
  constructor(options: LocalBackendConfig) {
    validateLocalBackendConfig(options)
    this.options = options
    
    // Use userId-based workspace management
    WorkspaceManager.validateUserId(options.userId)
    this.workspace = WorkspaceManager.ensureUserWorkspace(options.userId)
    
    this.shell = this.detectShell()

    if (options.validateUtils) {
      this.validateEnvironment()
    }
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

  async exec(command: string): Promise<string> {
    // Check for dangerous operations
    if (this.options.preventDangerous && isDangerous(command)) {
      if (this.options.onDangerousOperation) {
        this.options.onDangerousOperation(command)
        return ''
      } else {
        throw new DangerousOperationError(command)
      }
    }

    return new Promise((resolve, reject) => {
      const child = spawn(this.shell, ['-c', command], {
        cwd: this.workspace,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PWD: this.workspace,
          LANG: 'C',
          LC_ALL: 'C',
        },
      })

      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', data => {
        stdout += data.toString()
      })

      child.stderr?.on('data', data => {
        stderr += data.toString()
      })

      child.on('close', code => {
        if (code === 0) {
          let output = stdout.trim()
          
          if (this.options.maxOutputLength && output.length > this.options.maxOutputLength) {
            const truncatedLength = this.options.maxOutputLength - 50
            output = `${output.substring(0, truncatedLength)  
              }\n\n... [Output truncated. Full output was ${output.length} characters, showing first ${truncatedLength}]`
          }
          
          resolve(output)
        } else {
          reject(
            new FileSystemError(
              `Command execution failed with exit code ${code}: ${stderr.trim() || stdout.trim()}`,
              ERROR_CODES.EXEC_FAILED,
              command,
            ),
          )
        }
      })

      child.on('error', err => {
        reject(this.wrapError(err, 'Execute command', ERROR_CODES.EXEC_ERROR, command))
      })
    })
  }

  async read(path: string): Promise<string> {
    const fullPath = this.resolvePath(path)
    try {
      return await readFile(fullPath, 'utf-8')
    } catch (error) {
      throw this.wrapError(error, 'Read file', ERROR_CODES.READ_FAILED, `read ${path}`)
    }
  }

  async write(path: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(path)
    try {
      await writeFile(fullPath, content, 'utf-8')
    } catch (error) {
      throw this.wrapError(error, 'Write file', ERROR_CODES.WRITE_FAILED, `write ${path}`)
    }
  }

  // eslint-disable-next-line no-dupe-class-members
  async ls(patternOrOptions?: string | { details: true }): Promise<string[] | FileInfo[]>
  // eslint-disable-next-line no-dupe-class-members
  async ls(pattern: string, options: { details: true }): Promise<FileInfo[]>
  // eslint-disable-next-line no-dupe-class-members
  async ls(
    patternOrOptions?: string | { details: true },
    options?: { details: true },
  ): Promise<string[] | FileInfo[]> {
    try {
      // Parse arguments to determine what was requested
      let pattern: string | undefined
      let wantDetails = false

      if (typeof patternOrOptions === 'string') {
        pattern = patternOrOptions
        wantDetails = options?.details === true
      } else if (patternOrOptions?.details === true) {
        wantDetails = true
      }

      if (wantDetails) {
        return this.lsWithDetails(pattern)
      } else {
        return this.lsNamesOnly(pattern)
      }
    } catch (error) {
      throw this.wrapError(error, 'List directory', ERROR_CODES.LS_FAILED, `ls ${patternOrOptions || ''}`)
    }
  }

  private async lsNamesOnly(pattern?: string): Promise<string[]> {
    if (pattern) {
      const result = await this.exec(POSIXCommands.ls(pattern))
      return result ? result.split('\n').filter(Boolean) : []
    } else {
      return await readdir(this.workspace)
    }
  }

  private async lsWithDetails(pattern?: string): Promise<FileInfo[]> {
    const filenames = await this.lsNamesOnly(pattern)
    const fileInfos: FileInfo[] = []

    for (const name of filenames) {
      try {
        const fullPath = join(this.workspace, name)
        const stats = await stat(fullPath)
        
        let type: 'file' | 'directory' | 'symlink'
        if (stats.isFile()) {
          type = 'file'
        } else if (stats.isDirectory()) {
          type = 'directory'
        } else if (stats.isSymbolicLink()) {
          type = 'symlink'
        } else {
          type = 'file'
        }

        fileInfos.push({
          name,
          type,
          size: stats.size,
          modified: stats.mtime,
        })
      } catch (error) {
        getLogger().warn(`Failed to get stats for ${name}:`, error)
      }
    }

    return fileInfos
  }

  /**
   * Wrap errors consistently across all operations
   */
  private wrapError(
    error: unknown,
    operation: string,
    errorCode: string,
    command?: string,
  ): FileSystemError {
    // If it's already our error type, re-throw as-is
    if (error instanceof FileSystemError) {
      return error
    }
    
    // Get error message from Error objects or fallback
    const message = error instanceof Error 
      ? error.message 
      : 'Unknown error occurred'
    
    return new FileSystemError(
      `${operation} failed: ${message}`,
      errorCode,
      command,
    )
  }

  /**
   * Resolve a relative path within the workspace and validate it's safe
   */
  private resolvePath(path: string): string {
    if (isAbsolute(path)) {
      throw new FileSystemError(
        'Absolute paths are not allowed',
        ERROR_CODES.ABSOLUTE_PATH_REJECTED,
        path,
      )
    }

    const fullPath = resolve(join(this.workspace, path))
    
    const relativePath = relative(this.workspace, fullPath)
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw new FileSystemError(
        'Path escapes workspace boundary',
        ERROR_CODES.PATH_ESCAPE_ATTEMPT,
        path,
      )
    }

    return fullPath
  }
}
