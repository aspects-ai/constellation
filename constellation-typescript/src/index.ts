// Core API
export { FileSystem } from './FileSystem.js'
export { ConstellationFS } from './config/Config.js'

// Backend Management
export { BackendFactory } from './backends/BackendFactory.js'

// Workspace Classes
export type { Workspace, WorkspaceConfig } from './workspace/Workspace.js'
export { BaseWorkspace } from './workspace/Workspace.js'
export { LocalWorkspace } from './workspace/LocalWorkspace.js'
export { RemoteWorkspace } from './workspace/RemoteWorkspace.js'

// Backend Classes
export { LocalBackend } from './backends/LocalBackend.js'
export { RemoteBackend } from './backends/RemoteBackend.js'

// SDK Adapters
export {
  BaseSDKAdapter,
  ClaudeCodeAdapter,
  CodebuffAdapter,
  type SDKAdapter,
  type CodebuffToolHandlers
} from './adapters/index.js'

// Error Classes
export { DangerousOperationError, FileSystemError } from './types.js'

// Platform Detection
export {
  detectPlatformCapabilities,
  findNativeLibrary,
  validateNativeLibrary,
  getRemoteBackendLibrary,
  getPlatformGuidance,
  type PlatformCapabilities
} from './utils/nativeLibrary.js'

// Public Types
export type {
  BackendConfig,
  FileSystemBackend,
  FileInfo,
  FileSystemInterface,
  LocalBackendConfig,
  RemoteBackendConfig
} from './types.js'
