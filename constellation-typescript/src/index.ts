// Core API
export { ConstellationFS } from './config/Config.js'
export { FileSystem } from './FileSystem.js'

// Backend Management
export { BackendFactory } from './backends/BackendFactory.js'

// Workspace Classes
export { LocalWorkspace } from './workspace/LocalWorkspace.js'
export { RemoteWorkspace } from './workspace/RemoteWorkspace.js'
export { BaseWorkspace } from './workspace/Workspace.js'
export type { ExecOptions, Workspace, WorkspaceConfig } from './workspace/Workspace.js'

// Backend Classes
export { LocalBackend } from './backends/LocalBackend.js'
export { RemoteBackend } from './backends/RemoteBackend.js'

// SDK Adapters
export {
  BaseSDKAdapter,
  ClaudeCodeAdapter, type SDKAdapter
} from './adapters/index.js'

// Operations Logging
export {
  ArrayOperationsLogger,
  ConsoleOperationsLogger,
  MODIFYING_OPERATIONS,
  shouldLogOperation,
} from './logging/index.js'
export type {
  LoggingMode,
  OperationLogEntry,
  OperationsLogger,
  OperationType,
} from './logging/index.js'

// Error Classes
export { DangerousOperationError, FileSystemError } from './types.js'

// Platform Detection
export {
  detectPlatformCapabilities,
  findNativeLibrary, getPlatformGuidance, getRemoteBackendLibrary, validateNativeLibrary, type PlatformCapabilities
} from './utils/nativeLibrary.js'

// Public Types
export type {
  BackendConfig, FileInfo, FileSystemBackend, FileSystemInterface,
  LocalBackendConfig,
  RemoteBackendConfig
} from './types.js'

