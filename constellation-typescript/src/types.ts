export { BackendConfigSchema, validateLocalBackendConfig } from './backends/types.js'
export type {
  BackendConfig, DockerBackendConfig,
  FileSystemBackend, LocalBackendConfig,
  RemoteBackendConfig
} from './backends/types.js'

/**
 * File metadata information returned by detailed directory listings
 */
export interface FileInfo {
  /** The name of the file or directory */
  name: string
  /** The type of filesystem entry */
  type: 'file' | 'directory' | 'symlink'
  /** Size in bytes */
  size: number
  /** Last modified timestamp */
  modified: Date
}

/**
 * Main interface for filesystem operations
 * Provides a consistent API for executing commands and manipulating files
 * regardless of the underlying backend implementation (local, remote, docker)
 */
export interface FileSystemInterface {
  /**
   * Execute a shell command in the workspace
   * @param command - The shell command to execute
   * @returns Promise resolving to the command output
   * @throws {FileSystemError} When command execution fails
   * @throws {DangerousOperationError} When dangerous operations are blocked
   */
  exec(command: string): Promise<string>

  /**
   * Read the contents of a file
   * @param path - Relative path to the file within the workspace
   * @returns Promise resolving to the file contents as UTF-8 string
   * @throws {FileSystemError} When file cannot be read or doesn't exist
   */
  read(path: string): Promise<string>

  /**
   * Write content to a file
   * @param path - Relative path to the file within the workspace
   * @param content - Content to write to the file as UTF-8 string
   * @returns Promise that resolves when the write is complete
   * @throws {FileSystemError} When file cannot be written
   */
  write(path: string, content: string): Promise<void>

}

export class FileSystemError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly command?: string,
  ) {
    super(message)
    this.name = 'FileSystemError'
  }
}

export class DangerousOperationError extends FileSystemError {
  constructor(command: string) {
    super(
      `Dangerous operation blocked: ${command}`,
      'DANGEROUS_OPERATION',
      command,
    )
    this.name = 'DangerousOperationError'
  }
}
