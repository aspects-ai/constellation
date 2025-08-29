import { FileInfo } from '../types.js';
import { FileSystemBackend, RemoteBackendConfig } from './types.js';
/**
 * Stub implementation for remote filesystem backend
 * Will provide SSH-based remote command execution and file operations in a future release
 */
export declare class RemoteBackend implements FileSystemBackend {
    readonly workspace: string;
    readonly options: RemoteBackendConfig;
    /**
     * Create a new RemoteBackend instance
     * @param options - Configuration for remote backend
     * @throws {FileSystemError} Always throws as this backend is not yet implemented
     */
    constructor(options: RemoteBackendConfig);
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
//# sourceMappingURL=RemoteBackend.d.ts.map