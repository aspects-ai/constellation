import { BackendType } from '../constants.js';
import { BackendConfig, FileSystemBackend } from './types.js';
/**
 * Factory for creating different types of filesystem backends
 * Handles validation and instantiation of backend implementations
 */
export declare class BackendFactory {
    /**
     * Create a backend instance based on configuration
     * @param config - Backend configuration object
     * @returns Configured backend instance
     * @throws {FileSystemError} When backend type is unsupported
     */
    static create(config: BackendConfig): FileSystemBackend;
    /**
     * Get list of available backend types
     * @returns Array of supported backend type strings
     */
    static getAvailableBackends(): readonly BackendType[];
    /**
     * Get default configuration for a backend type
     */
    static getDefaultConfig(backendType: 'local' | 'remote' | 'docker', workspace: string): Partial<BackendConfig>;
}
//# sourceMappingURL=BackendFactory.d.ts.map