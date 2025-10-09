import { z } from 'zod'
import { AUTH_TYPES, DEFAULTS, SHELL_TYPES } from '../constants.js'

/**
 * Base configuration schema shared by all backends
 */
const BaseBackendConfigSchema = z.object({
  preventDangerous: z.boolean().default(DEFAULTS.PREVENT_DANGEROUS),
  onDangerousOperation: z
    .function({
      input: [z.string()],
      output: z.void(),
    })
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
  userId: z.string().min(1, 'userId is required for local backend'),
  workspacePath: z.string().optional(),
})

const RemoteBackendConfigSchema = BaseBackendConfigSchema.extend({
  type: z.literal('remote'),
  userId: z.string().min(1, 'userId is required for remote backend'),
  workspacePath: z.string().optional(),
  auth: z.object({
    type: z.enum(AUTH_TYPES),
    credentials: z.record(z.string(), z.unknown()),
  }),
})

export const BackendConfigSchema = z.discriminatedUnion('type', [
  LocalBackendConfigSchema,
  RemoteBackendConfigSchema,
])

export type BackendConfig = z.infer<typeof BackendConfigSchema>
export type LocalBackendConfig = z.infer<typeof LocalBackendConfigSchema>
export type RemoteBackendConfig = z.infer<typeof RemoteBackendConfigSchema>

/**
 * Validation helper for LocalBackendConfig
 */
export function validateLocalBackendConfig(config: LocalBackendConfig): void {
  if (!config.userId) {
    throw new Error('userId is required for local backend')
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
  /** Whether backend connection was successfully established */
  readonly connected: boolean
  
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
   * Create a directory in the backend storage
   * @param path - Relative path to the directory within the workspace
   * @param recursive - Create parent directories if they don't exist (default: true)
   * @returns Promise that resolves when the directory is created
   * @throws {FileSystemError} When directory cannot be created
   */
  mkdir(path: string, recursive?: boolean): Promise<void>

  /**
   * Create an empty file in the backend storage
   * @param path - Relative path to the file within the workspace
   * @returns Promise that resolves when the file is created
   * @throws {FileSystemError} When file cannot be created
   */
  touch(path: string): Promise<void>

}
