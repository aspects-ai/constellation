import { FileSystem as FS } from './FileSystem.js'

export { FileSystem } from './FileSystem.js'
export { 
  FileSystemError, 
  DangerousOperationError,
  type FileSystemInterface,
  type FileSystemBackend,
  type FileSystemOptions,
  type FileSystemInput,
  type FileInfo,
  type BackendConfig,
  type LocalBackendConfig,
  type RemoteBackendConfig,
  type DockerBackendConfig
} from './types.js'
export { isDangerous, getBaseCommand } from './safety.js'
export { BaseSDKAdapter, type SDKAdapter, ClaudeCodeAdapter } from './adapters/index.js'
export { BackendFactory, LocalBackend, RemoteBackend, DockerBackend } from './backends/index.js'
export { POSIXCommands, type LSOptions, type GrepOptions, type FindOptions } from './utils/POSIXCommands.js'
export { 
  BACKEND_TYPES,
  SHELL_TYPES, 
  AUTH_TYPES,
  DEFAULTS,
  ERROR_CODES,
  type BackendType,
  type ShellType,
  type AuthType,
  type ErrorCode
} from './constants.js'
export {
  setLogger,
  enableConsoleLogging,
  getLogger,
  type Logger,
  type LogLevel
} from './utils/logger.js'

// Default export for convenience
export default FS