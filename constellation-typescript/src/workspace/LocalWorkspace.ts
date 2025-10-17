import { existsSync } from 'fs'
import { mkdir as fsMkdir, readdir, readFile, rm, writeFile } from 'fs/promises'
import type { LocalBackend } from '../backends/LocalBackend.js'
import { ERROR_CODES } from '../constants.js'
import { FileSystemError } from '../types.js'
import { checkSymlinkSafety } from '../utils/pathValidator.js'
import { BaseWorkspace } from './Workspace.js'

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
    workspacePath: string
  ) {
    super(backend, userId, workspaceName, workspacePath)
  }

  async exec(command: string, encoding: 'utf8' | 'buffer' = 'utf8'): Promise<string | Buffer> {
    if (!command.trim()) {
      throw new FileSystemError('Command cannot be empty', ERROR_CODES.EMPTY_COMMAND)
    }

    // Delegate to backend with this workspace's path
    return this.backend.execInWorkspace(this.workspacePath, command, encoding)
  }

  async read(path: string): Promise<string> {
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
      return await readFile(fullPath, 'utf-8')
    } catch (error) {
      throw this.wrapError(error, 'Read file', ERROR_CODES.READ_FAILED, `read ${path}`)
    }
  }

  async write(path: string, content: string): Promise<void> {
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
        await fsMkdir(fullParentPath, { recursive: true })
      }
      
      await writeFile(fullPath, content, 'utf-8')
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
      await fsMkdir(fullPath, { recursive })
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
      await writeFile(fullPath, '', { flag: 'a' })
    } catch (error) {
      throw this.wrapError(error, 'Create file', ERROR_CODES.WRITE_FAILED, `touch ${path}`)
    }
  }

  async exists(): Promise<boolean> {
    return existsSync(this.workspacePath)
  }

  async delete(): Promise<void> {
    try {
      await rm(this.workspacePath, { recursive: true, force: true })
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
      return await readdir(this.workspacePath)
    } catch (error) {
      throw this.wrapError(
        error,
        'List workspace',
        ERROR_CODES.READ_FAILED,
        `list ${this.workspaceName}`
      )
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

    return new FileSystemError(`${operation} failed: ${message}`, errorCode, command)
  }
}
