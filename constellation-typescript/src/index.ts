// Core API
export { FileSystem } from './FileSystem.js'
export { ConstellationFS } from './config/Config.js'

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

// Public Types
export type {
  BackendConfig,
  FileInfo,
  FileSystemInterface,
  LocalBackendConfig,
  RemoteBackendConfig
} from './types.js'
