import { z } from 'zod'
import { AUTH_TYPES, DEFAULTS, SHELL_TYPES } from '../constants.js'
import type { Workspace } from '../workspace/Workspace.js'

/**
 * Base configuration schema shared by all backends
 */
const BaseBackendConfigSchema = z.object({
  userId: z.string().min(1, 'userId is required for all backends'),
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
})

const RemoteBackendConfigSchema = BaseBackendConfigSchema.extend({
  type: z.literal('remote'),
  auth: z.object({
    type: z.enum(AUTH_TYPES),
    credentials: z.record(z.string(), z.unknown()),
  }),
  host: z.string().optional(),
  port: z.number().optional(),
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
 *
 * Backends are keyed by userId and can manage multiple workspaces for that user
 */
export interface FileSystemBackend {
  /** Backend type identifier */
  readonly type: 'local' | 'remote' | 'docker'

  /** User identifier this backend is associated with */
  readonly userId: string

  /** The configuration options for this backend */
  readonly options: BackendConfig

  /** Whether backend connection was successfully established */
  readonly connected: boolean

  /**
   * Get or create a workspace for this user
   * @param workspaceName - Optional workspace name (defaults to 'default')
   * @returns Promise resolving to a Workspace instance
   * @throws {FileSystemError} When workspace cannot be created
   */
  getWorkspace(workspaceName?: string): Promise<Workspace>

  /**
   * List all workspaces for this user
   * @returns Promise resolving to array of workspace names
   */
  listWorkspaces(): Promise<string[]>

  /**
   * Execute command in a specific workspace (internal use by Workspace)
   * @param workspacePath - Absolute path to workspace directory
   * @param command - Command to execute
   * @returns Promise resolving to command output
   * @internal
   */
  execInWorkspace(workspacePath: string, command: string): Promise<string>

  /**
   * Clean up backend resources
   * @returns Promise that resolves when cleanup is complete
   */
  destroy(): Promise<void>
}
