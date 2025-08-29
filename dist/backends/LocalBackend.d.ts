import { FileInfo } from '../types.js';
import { FileSystemBackend, LocalBackendConfig } from './types.js';
/**
 * Local filesystem backend implementation
 * Executes commands and file operations on the local machine using Node.js APIs
 * and POSIX-compliant shell commands for cross-platform compatibility
 */
export declare class LocalBackend implements FileSystemBackend {
    readonly workspace: string;
    readonly options: LocalBackendConfig;
    private readonly shell;
    /**
     * Create a new LocalBackend instance
     * @param options - Configuration options for the local backend
     * @throws {FileSystemError} When workspace doesn't exist or utilities are missing
     */
    constructor(options: LocalBackendConfig);
    /**
     * Detect the best available shell for command execution
     */
    private detectShell;
    /**
     * Validate that required POSIX utilities are available
     */
    private validateEnvironment;
    exec(command: string): Promise<string>;
    read(path: string): Promise<string>;
    write(path: string, content: string): Promise<void>;
    ls(patternOrOptions?: string | {
        details: true;
    }): Promise<string[] | FileInfo[]>;
    ls(pattern: string, options: {
        details: true;
    }): Promise<FileInfo[]>;
    private lsNamesOnly;
    private lsWithDetails;
    /**
     * Wrap errors consistently across all operations
     */
    private wrapError;
    /**
     * Resolve a relative path within the workspace and validate it's safe
     */
    private resolvePath;
}
//# sourceMappingURL=LocalBackend.d.ts.map