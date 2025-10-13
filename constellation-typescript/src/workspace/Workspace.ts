import { isAbsolute, join, relative, resolve } from 'path'
import { ERROR_CODES } from '../constants.js'
import { FileSystemError } from '../types.js'
import type { FileSystemBackend } from '../backends/types.js'

/**
 * Workspace interface representing an isolated directory environment
 * for executing commands and file operations
 */
export interface Workspace {
  /** Absolute path to the workspace directory */
  readonly workspacePath: string

  /** Name of the workspace (e.g., "project-a", "default") */
  readonly workspaceName: string

  /** User identifier this workspace belongs to */
  readonly userId: string

  /** Reference to the backend powering this workspace */
  readonly backend: FileSystemBackend

  /**
   * Execute a shell command in the workspace
   * @param command - The shell command to execute
   * @param encoding - Output encoding: 'utf8' for text (default) or 'buffer' for binary data
   * @returns Promise resolving to the command output as string or Buffer
   */
  exec(command: string, encoding?: 'utf8' | 'buffer'): Promise<string | Buffer>

  /**
   * Read the contents of a file
   * @param path - Relative path to the file within the workspace
   * @returns Promise resolving to the file contents as UTF-8 string
   */
  read(path: string): Promise<string>

  /**
   * Write content to a file
   * @param path - Relative path to the file within the workspace
   * @param content - Content to write to the file as UTF-8 string
   * @returns Promise that resolves when the write is complete
   */
  write(path: string, content: string): Promise<void>

  /**
   * Create a directory
   * @param path - Relative path to the directory within the workspace
   * @param recursive - Create parent directories if they don't exist (default: true)
   * @returns Promise that resolves when the directory is created
   */
  mkdir(path: string, recursive?: boolean): Promise<void>

  /**
   * Create an empty file
   * @param path - Relative path to the file within the workspace
   * @returns Promise that resolves when the file is created
   */
  touch(path: string): Promise<void>

  /**
   * Check if the workspace directory exists
   * @returns Promise resolving to true if the workspace exists
   */
  exists(): Promise<boolean>

  /**
   * Delete the entire workspace directory
   * @returns Promise that resolves when the workspace is deleted
   */
  delete(): Promise<void>

  /**
   * List files in the workspace
   * @returns Promise resolving to array of file paths
   */
  list(): Promise<string[]>
}

/**
 * Base workspace implementation with common functionality
 * Provides path validation and security checks
 */
export abstract class BaseWorkspace implements Workspace {
  constructor(
    public readonly backend: FileSystemBackend,
    public readonly userId: string,
    public readonly workspaceName: string,
    public readonly workspacePath: string
  ) {
    // Verify userId matches backend for security
    if (backend.userId !== userId) {
      throw new FileSystemError(
        'Workspace userId must match backend userId',
        ERROR_CODES.INVALID_CONFIGURATION
      )
    }
  }

  /**
   * Resolve a relative path within the workspace and validate it's safe
   * @param relativePath - Path relative to workspace root
   * @returns Absolute path within workspace
   * @throws {FileSystemError} When path is invalid or escapes workspace
   */
  protected resolvePath(relativePath: string): string {
    if (isAbsolute(relativePath)) {
      throw new FileSystemError(
        'Absolute paths are not allowed',
        ERROR_CODES.ABSOLUTE_PATH_REJECTED,
        relativePath
      )
    }

    const fullPath = resolve(join(this.workspacePath, relativePath))

    const rel = relative(this.workspacePath, fullPath)
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new FileSystemError(
        'Path escapes workspace boundary',
        ERROR_CODES.PATH_ESCAPE_ATTEMPT,
        relativePath
      )
    }

    return fullPath
  }

  /**
   * Validate path input
   * @param path - Path to validate
   * @throws {FileSystemError} When path is empty
   */
  protected validatePath(path: string): void {
    if (!path.trim()) {
      throw new FileSystemError('Path cannot be empty', ERROR_CODES.EMPTY_PATH)
    }
  }

  // Abstract methods that must be implemented by concrete workspace types
  abstract exec(command: string, encoding?: 'utf8' | 'buffer'): Promise<string | Buffer>
  abstract read(path: string): Promise<string>
  abstract write(path: string, content: string): Promise<void>
  abstract mkdir(path: string, recursive?: boolean): Promise<void>
  abstract touch(path: string): Promise<void>
  abstract exists(): Promise<boolean>
  abstract delete(): Promise<void>
  abstract list(): Promise<string[]>
}
