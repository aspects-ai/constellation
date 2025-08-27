import { FileSystem as FS } from './FileSystem.js'

export { BaseSDKAdapter, ClaudeCodeAdapter, type SDKAdapter } from './adapters/index.js'
export { BackendFactory, DockerBackend, LocalBackend, RemoteBackend } from './backends/index.js'
export { ConstellationFS } from './config/Config.js'
export {
  AUTH_TYPES, BACKEND_TYPES, DEFAULTS,
  ERROR_CODES, SHELL_TYPES, type AuthType, type BackendType, type ErrorCode, type ShellType
} from './constants.js'
export { FileSystem } from './FileSystem.js'
export { getBaseCommand, isDangerous } from './safety.js'
export {
  DangerousOperationError, FileSystemError, type BackendConfig, type DockerBackendConfig, type FileInfo, type FileSystemBackend, type FileSystemInput, type FileSystemInterface, type FileSystemOptions, type LocalBackendConfig,
  type RemoteBackendConfig
} from './types.js'
export {
  enableConsoleLogging,
  getLogger, setLogger, type Logger,
  type LogLevel
} from './utils/logger.js'
export { POSIXCommands, type FindOptions, type GrepOptions, type LSOptions } from './utils/POSIXCommands.js'
export { WorkspaceManager } from './utils/workspaceManager.js'

// Default export for convenience
export default FS
