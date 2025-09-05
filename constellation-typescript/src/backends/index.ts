export { BackendFactory } from './BackendFactory.js'
export { LocalBackend } from './LocalBackend.js'
export { RemoteBackend } from './RemoteBackend.js'

// Re-export types
export { BackendConfigSchema, validateLocalBackendConfig } from './types.js'
export type {
  BackendConfig,
  FileSystemBackend, LocalBackendConfig,
  RemoteBackendConfig
} from './types.js'

