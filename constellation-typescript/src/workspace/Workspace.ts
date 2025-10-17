import type { Dirent, Stats } from 'fs'
import { isAbsolute, join, relative, resolve } from 'path'
import type { FileSystemBackend } from '../backends/types.js'
import { ERROR_CODES } from '../constants.js'
import { FileSystemError } from '../types.js'

/**
 * Configuration options for creating a workspace
 */
export interface WorkspaceConfig {
  /** Custom environment variables to be available throughout the workspace lifecycle */
  env?: Record<string, string>
}

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

  /** Custom environment variables for this workspace */
  readonly customEnv?: Record<string, string>

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

  /**
   * Check if a file or directory exists (sync)
   * @param path - Relative path to check within the workspace
   * @returns true if the path exists
   */
  existsSync(path: string): boolean

  /**
   * Create a directory synchronously
   * @param path - Relative path to the directory within the workspace
   * @param options - Options including recursive flag
   */
  mkdirSync(path: string, options?: { recursive?: boolean }): void

  /**
   * Read directory contents synchronously
   * @param path - Relative path to the directory within the workspace
   * @param options - Options for reading directory
   * @returns Array of directory entries
   */
  readdirSync(path: string, options?: { withFileTypes?: boolean }): string[] | Dirent[]

  /**
   * Read file contents synchronously
   * @param path - Relative path to the file within the workspace
   * @param encoding - File encoding (defaults to 'utf-8')
   * @returns File contents as string
   */
  readFileSync(path: string, encoding?: NodeJS.BufferEncoding): string

  /**
   * Get file stats synchronously
   * @param path - Relative path to the file within the workspace
   * @returns File stats
   */
  statSync(path: string): Stats

  /**
   * Write file contents synchronously
   * @param path - Relative path to the file within the workspace
   * @param content - Content to write
   * @param encoding - File encoding (defaults to 'utf-8')
   */
  writeFileSync(path: string, content: string, encoding?: NodeJS.BufferEncoding): void

  /**
   * Promises API for compatibility with Node.js fs.promises
   */
  promises: {
    /**
     * Read directory contents
     * @param path - Relative path to the directory within the workspace
     * @param options - Options for reading directory
     * @returns Promise resolving to array of directory entries
     */
    readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | Dirent[]>
  }
}

/**
 * Base workspace implementation with common functionality
 * Provides path validation and security checks
 */
export abstract class BaseWorkspace implements Workspace {
  public readonly customEnv?: Record<string, string>

  constructor(
    public readonly backend: FileSystemBackend,
    public readonly userId: string,
    public readonly workspaceName: string,
    public readonly workspacePath: string,
    config?: WorkspaceConfig
  ) {
    this.customEnv = config?.env
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

  // Sync methods for Codebuff compatibility
  abstract existsSync(path: string): boolean
  abstract mkdirSync(path: string, options?: { recursive?: boolean }): void
  abstract readdirSync(path: string, options?: { withFileTypes?: boolean }): string[] | Dirent[]
  abstract readFileSync(path: string, encoding?: NodeJS.BufferEncoding): string
  abstract statSync(path: string): Stats
  abstract writeFileSync(path: string, content: string, encoding?: NodeJS.BufferEncoding): void
  abstract promises: {
    readdir(path: string, options?: { withFileTypes?: boolean }): Promise<string[] | Dirent[]>
  }
}
