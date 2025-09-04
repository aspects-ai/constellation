import { BackendFactory } from './backends/index.js'
import { ERROR_CODES } from './constants.js'
import type {
  BackendConfig,
  FileSystemBackend,
  FileSystemInterface,
  LocalBackendConfig,
} from './types.js'
import {
  FileSystemError,
} from './types.js'

/**
 * Main FileSystem class providing a unified interface for file operations
 * Supports multiple backend types (local, remote, docker) with automatic backend selection
 * and configuration validation
 * 
 * @example
 * ```typescript
 * // Simple userId-based workspace (recommended)
 * const fs = new FileSystem({ userId: 'user123' })
 * 
 * // Default workspace for single-user apps
 * const fs = new FileSystem({ userId: 'default' })
 * 
 * // Full backend configuration
 * const fs = new FileSystem({
 *   type: 'local',
 *   userId: 'user123',
 *   shell: 'bash',
 *   preventDangerous: true
 * })
 * ```
 */
export class FileSystem implements FileSystemInterface {
  private readonly backend: FileSystemBackend

  /**
   * Create a new FileSystem instance
   * @param input - Backend configuration object with userId
   * @throws {FileSystemError} When configuration is invalid
   */
  constructor(input: Partial<BackendConfig>) {
    let backendConfig: BackendConfig
    
    if (input.type) {
      // Full backend config - use as-is with defaults for missing fields
      backendConfig = input as BackendConfig
    } else {
      // Partial config - assume local backend and fill in defaults
      backendConfig = {
        type: 'local',
        shell: 'auto',
        validateUtils: false,
        preventDangerous: true,
        ...input,
      } as LocalBackendConfig
    }
    
    this.backend = BackendFactory.create(backendConfig)
  }

  /**
   * Get the workspace directory path
   * @returns Absolute path to the workspace directory
   */
  get workspace(): string {
    return this.backend.workspace
  }

  /**
   * Get the full backend configuration
   * @returns Complete backend configuration object
   */
  get backendConfig(): BackendConfig {
    return this.backend.options
  }

  /**
   * Execute a shell command in the workspace
   * @param command - The shell command to execute
   * @returns Promise resolving to the command output
   * @throws {FileSystemError} When command is empty or execution fails
   * @throws {DangerousOperationError} When dangerous operations are blocked
   */
  async exec(command: string): Promise<string> {
    if (!command.trim()) {
      throw new FileSystemError('Command cannot be empty', ERROR_CODES.EMPTY_COMMAND)
    }
    
    return this.backend.exec(command)
  }

  /**
   * Read the contents of a file
   * @param path - Relative path to the file within the workspace
   * @returns Promise resolving to the file contents as UTF-8 string
   * @throws {FileSystemError} When path is empty, file doesn't exist, or read fails
   */
  async read(path: string): Promise<string> {
    if (!path.trim()) {
      throw new FileSystemError('Path cannot be empty', ERROR_CODES.EMPTY_PATH)
    }
    
    return this.backend.read(path)
  }

  /**
   * Write content to a file
   * @param path - Relative path to the file within the workspace
   * @param content - Content to write to the file as UTF-8 string
   * @returns Promise that resolves when the write is complete
   * @throws {FileSystemError} When path is empty or write fails
   */
  async write(path: string, content: string): Promise<void> {
    if (!path.trim()) {
      throw new FileSystemError('Path cannot be empty', ERROR_CODES.EMPTY_PATH)
    }
    
    return this.backend.write(path, content)
  }


}
