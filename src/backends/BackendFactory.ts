import { BackendConfig, BackendConfigSchema, FileSystemBackend, FileSystemError } from '../types.js'
import { LocalBackend } from './LocalBackend.js'
import { RemoteBackend } from './RemoteBackend.js'
import { DockerBackend } from './DockerBackend.js'
import { BACKEND_TYPES, type BackendType, ERROR_CODES } from '../constants.js'

/**
 * Factory for creating different types of filesystem backends
 * Handles validation and instantiation of backend implementations
 */
export class BackendFactory {
  /**
   * Create a backend instance based on configuration
   * @param config - Backend configuration object
   * @returns Configured backend instance
   * @throws {FileSystemError} When backend type is unsupported
   */
  static create(config: BackendConfig): FileSystemBackend {
    const validatedConfig = BackendConfigSchema.parse(config)

    switch (validatedConfig.type) {
      case 'local':
        return new LocalBackend(validatedConfig)
      
      case 'remote':
        return new RemoteBackend(validatedConfig)
      
      case 'docker':
        return new DockerBackend(validatedConfig)
      
      default:
        throw new FileSystemError(
          `Unsupported backend type: ${(validatedConfig as { type: string }).type}`,
          ERROR_CODES.UNSUPPORTED_BACKEND
        )
    }
  }

  /**
   * Get list of available backend types
   * @returns Array of supported backend type strings
   */
  static getAvailableBackends(): readonly BackendType[] {
    return BACKEND_TYPES
  }

  /**
   * Check if a backend type is supported
   * @param backendType - Backend type to check
   * @returns True if backend type is supported
   */
  static isSupported(backendType: string): backendType is BackendType {
    return BACKEND_TYPES.includes(backendType as BackendType)
  }

  /**
   * Get default configuration for a backend type
   */
  static getDefaultConfig(backendType: 'local' | 'remote' | 'docker', workspace: string): Partial<BackendConfig> {
    const baseConfig = {
      workspace,
      preventDangerous: true,
    }

    switch (backendType) {
      case 'local':
        return {
          ...baseConfig,
          type: 'local',
          shell: 'auto' as const,
          validateUtils: false,
        }
      
      case 'remote':
        return {
          ...baseConfig,
          type: 'remote',
          host: '',
          auth: {
            type: 'key' as const,
            credentials: {},
          },
        }
      
      case 'docker':
        return {
          ...baseConfig,
          type: 'docker',
          image: 'ubuntu:latest',
          options: {},
        }
      
      default:
        throw new FileSystemError(
          `Unknown backend type: ${backendType}`,
          ERROR_CODES.UNKNOWN_BACKEND
        )
    }
  }
}