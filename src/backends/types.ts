import { z } from 'zod'
import { AUTH_TYPES, DEFAULTS, SHELL_TYPES } from '../constants.js'
import type { FileInfo } from '../types.js'

/**
 * Base configuration schema shared by all backends
 */
const BaseBackendConfigSchema = z.object({
  workspace: z.string().min(1, 'Workspace path cannot be empty').optional(),
  preventDangerous: z.boolean().default(DEFAULTS.PREVENT_DANGEROUS),
  onDangerousOperation: z
    .function()
    .args(z.string())
    .returns(z.void())
    .optional(),
  maxOutputLength: z.number().positive().optional(),
})

/**
 * Backend-specific configuration schemas
 */
const LocalBackendConfigSchema = BaseBackendConfigSchema.extend({
  type: z.literal('local').default('local'),
  shell: z.enum(SHELL_TYPES).default(DEFAULTS.SHELL),
  validateUtils: z.boolean().default(DEFAULTS.VALIDATE_UTILS),
  userId: z.string().optional(),
})

const RemoteBackendConfigSchema = BaseBackendConfigSchema.extend({
  type: z.literal('remote'),
  workspace: z.string().min(1, 'Workspace path is required for remote backend'),
  host: z.string().min(1, 'Host is required for remote backend'),
  auth: z.object({
    type: z.enum(AUTH_TYPES),
    credentials: z.record(z.unknown()),
  }),
})

const DockerBackendConfigSchema = BaseBackendConfigSchema.extend({
  type: z.literal('docker'),
  workspace: z.string().min(1, 'Workspace path is required for docker backend'),
  image: z.string().default(DEFAULTS.DOCKER_IMAGE),
  options: z.object({
    network: z.string().optional(),
    volumes: z.array(z.string()).optional(),
    environment: z.record(z.string()).optional(),
  }).optional(),
})

export const BackendConfigSchema = z.discriminatedUnion('type', [
  LocalBackendConfigSchema,
  RemoteBackendConfigSchema,
  DockerBackendConfigSchema,
])

export type BackendConfig = z.infer<typeof BackendConfigSchema>
export type LocalBackendConfig = z.infer<typeof LocalBackendConfigSchema>
export type RemoteBackendConfig = z.infer<typeof RemoteBackendConfigSchema>
export type DockerBackendConfig = z.infer<typeof DockerBackendConfigSchema>

/**
 * Validation helper for LocalBackendConfig
 */
export function validateLocalBackendConfig(config: LocalBackendConfig): void {
  if (!config.workspace && !config.userId) {
    throw new Error('Either workspace or userId must be provided')
  }
}

/**
 * Backend interface that all filesystem implementations must satisfy
 * Provides the low-level operations for different execution environments
 */
export interface FileSystemBackend {
  /** The resolved absolute path to the workspace directory */
  readonly workspace: string
  /** The configuration options for this backend */
  readonly options: BackendConfig
  
  /**
   * Execute a shell command in the backend environment
   * @param command - The shell command to execute
   * @returns Promise resolving to the command output
   * @throws {FileSystemError} When command execution fails
   * @throws {DangerousOperationError} When dangerous operations are blocked
   */
  exec(command: string): Promise<string>
  
  /**
   * Read the contents of a file from the backend storage
   * @param path - Relative path to the file within the workspace
   * @returns Promise resolving to the file contents as UTF-8 string
   * @throws {FileSystemError} When file cannot be read or doesn't exist
   */
  read(path: string): Promise<string>
  
  /**
   * Write content to a file in the backend storage
   * @param path - Relative path to the file within the workspace
   * @param content - Content to write to the file as UTF-8 string
   * @returns Promise that resolves when the write is complete
   * @throws {FileSystemError} When file cannot be written
   */
  write(path: string, content: string): Promise<void>
  
  /**
   * List files and directories in the backend storage
   * @param patternOrOptions - Optional glob pattern or options object
   * @returns Promise resolving to file/directory names or FileInfo objects
   * @throws {FileSystemError} When directory listing fails
   */
  ls(patternOrOptions?: string | { details: true }): Promise<string[] | FileInfo[]>
  
  /**
   * List files and directories with detailed metadata
   * @param pattern - Glob pattern to filter results  
   * @param options - Options including details flag
   * @returns Promise resolving to an array of FileInfo objects
   * @throws {FileSystemError} When directory listing fails
   */
  ls(pattern: string, options: { details: true }): Promise<FileInfo[]>
}
