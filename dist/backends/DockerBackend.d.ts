import { FileInfo } from '../types.js';
import { DockerBackendConfig, FileSystemBackend } from './types.js';
/**
 * Stub implementation for Docker-based filesystem backend
 * Will provide containerized execution for enhanced security and isolation in a future release
 */
export declare class DockerBackend implements FileSystemBackend {
    readonly workspace: string;
    readonly options: DockerBackendConfig;
    /**
     * Create a new DockerBackend instance
     * @param options - Configuration for Docker backend
     * @throws {FileSystemError} Always throws as this backend is not yet implemented
     */
    constructor(options: DockerBackendConfig);
    exec(_command: string): Promise<string>;
    read(_path: string): Promise<string>;
    write(_path: string, _content: string): Promise<void>;
    ls(_patternOrOptions?: string | {
        details: true;
    }): Promise<string[] | FileInfo[]>;
    ls(_pattern: string, _options: {
        details: true;
    }): Promise<FileInfo[]>;
}
//# sourceMappingURL=DockerBackend.d.ts.map