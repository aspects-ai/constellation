import { 
  BackendConfig, 
  FileInfo, 
  FileSystemBackend, 
  FileSystemError,
  FileSystemInput,
  FileSystemInterface,
  FileSystemOptions,
  FileSystemOptionsSchema,
  LocalBackendConfig
} from './types.js'
import { BackendFactory } from './backends/index.js'
import { ERROR_CODES } from './constants.js'

/**
 * Main FileSystem class providing a unified interface for file operations
 * Supports multiple backend types (local, remote, docker) with automatic backend selection
 * and configuration validation
 * 
 * @example
 * ```typescript
 * // Simple string workspace (uses local backend)
 * const fs = new FileSystem('./my-workspace')
 * 
 * // Advanced configuration with backend options
 * const fs = new FileSystem({
 *   type: 'local',
 *   workspace: './my-workspace',
 *   shell: 'bash',
 *   preventDangerous: true
 * })
 * ```
 */
export class FileSystem implements FileSystemInterface {
  private readonly backend: FileSystemBackend

  /**
   * Create a new FileSystem instance
   * @param input - Workspace path string or full configuration object
   * @throws {FileSystemError} When workspace doesn't exist or configuration is invalid
   */
  constructor(input: FileSystemInput | BackendConfig) {
    if (this.isBackendConfig(input)) {
      this.backend = BackendFactory.create(input)
    } else {
      const options = this.parseInput(input)
      const validatedOptions = FileSystemOptionsSchema.parse(options)
      
      const backendConfig: LocalBackendConfig = {
        type: 'local',
        workspace: validatedOptions.workspace,
        shell: 'auto',
        validateUtils: false,
        preventDangerous: validatedOptions.preventDangerous,
        onDangerousOperation: validatedOptions.onDangerousOperation,
        maxOutputLength: validatedOptions.maxOutputLength,
      }
      
      this.backend = BackendFactory.create(backendConfig)
    }
  }

  /**
   * Type guard to check if input is a BackendConfig
   */
  private isBackendConfig(input: unknown): input is BackendConfig {
    return input !== null && typeof input === 'object' && 'type' in input
  }

  /**
   * Get the workspace directory path
   * @returns Absolute path to the workspace directory
   */
  get workspace(): string {
    return this.backend.workspace
  }

  /**
   * Get the current configuration options (legacy format for backward compatibility)
   * @returns FileSystemOptions in legacy format
   */
  get options(): FileSystemOptions {
    const backendOptions = this.backend.options
    
    return {
      workspace: backendOptions.workspace,
      backend: 'local',
      preventDangerous: backendOptions.preventDangerous,
      onDangerousOperation: backendOptions.onDangerousOperation,
      maxOutputLength: backendOptions.maxOutputLength,
    }
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

  /**
   * List files and directories
   * @param patternOrOptions - Optional glob pattern or options object
   * @returns Promise resolving to file/directory names or FileInfo objects
   * @throws {FileSystemError} When directory listing fails
   */
  // eslint-disable-next-line no-dupe-class-members
  async ls(patternOrOptions?: string | { details: true }): Promise<string[] | FileInfo[]>
  
  /**
   * List files and directories with detailed metadata
   * @param pattern - Glob pattern to filter results  
   * @param options - Options including details flag
   * @returns Promise resolving to an array of FileInfo objects
   * @throws {FileSystemError} When directory listing fails
   */
  // eslint-disable-next-line no-dupe-class-members
  async ls(pattern: string, options: { details: true }): Promise<FileInfo[]>
  
  // eslint-disable-next-line no-dupe-class-members
  async ls(
    patternOrOptions?: string | { details: true },
    options?: { details: true }
  ): Promise<string[] | FileInfo[]> {
    if (typeof patternOrOptions === 'string' && options?.details === true) {
      return this.backend.ls(patternOrOptions, options)
    } else if (patternOrOptions && typeof patternOrOptions === 'object' && patternOrOptions.details === true) {
      return this.backend.ls(patternOrOptions)
    } else {
      return this.backend.ls(patternOrOptions as string | undefined)
    }
  }

  /**
   * Parse the input parameter to create FileSystemOptions
   */
  private parseInput(input: FileSystemInput): FileSystemOptions {
    if (typeof input === 'string') {
      return {
        workspace: input,
        backend: 'local',
        preventDangerous: true,
      }
    }
    
    return input
  }
}