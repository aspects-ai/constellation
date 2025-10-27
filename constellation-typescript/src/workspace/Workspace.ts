import type { Dirent, Stats } from 'fs'
import type { FileSystemBackend } from '../backends/types.js'
import { ERROR_CODES } from '../constants.js'
import { FileSystemError } from '../types.js'
import { resolvePathSafely } from '../utils/pathValidator.js'

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
   * Check if a file or directory exists within the workspace
   * @param path - Relative path to check within the workspace
   * @returns Promise resolving to true if the file or directory exists
   */
  fileExists(path: string): Promise<boolean>

  /**
   * Get file or directory stats
   * @param path - Relative path to the file or directory within the workspace
   * @returns Promise resolving to file stats
   */
  stat(path: string): Promise<Stats>

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
   * Resolve a path within the workspace and validate it's safe
   * Accepts both relative and absolute paths, as long as they resolve within the workspace
   *
   * @param path - Path to resolve (relative or absolute)
   * @returns Absolute path within workspace
   * @throws {FileSystemError} When path escapes workspace boundary
   */
  protected resolvePath(path: string): string {
    try {
      return resolvePathSafely(this.workspacePath, path)
    } catch (error) {
      throw new FileSystemError(
        error instanceof Error ? error.message : 'Path validation failed',
        ERROR_CODES.PATH_ESCAPE_ATTEMPT,
        path
      )
    }
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
  abstract fileExists(path: string): Promise<boolean>
  abstract stat(path: string): Promise<Stats>
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
