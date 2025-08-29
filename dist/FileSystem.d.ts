import { BackendConfig, FileInfo, FileSystemInterface } from './types.js';
/**
 * Main FileSystem class providing a unified interface for file operations
 * Supports multiple backend types (local, remote, docker) with automatic backend selection
 * and configuration validation
 *
 * @example
 * ```typescript
 * // Simple userId-based workspace (recommended)
 * const fs = new FileSystem({ userId: 'user123' })
 *
 * // Default workspace for single-user apps
 * const fs = new FileSystem({ userId: 'default' })
 *
 * // Full backend configuration
 * const fs = new FileSystem({
 *   type: 'local',
 *   userId: 'user123',
 *   shell: 'bash',
 *   preventDangerous: true
 * })
 * ```
 */
export declare class FileSystem implements FileSystemInterface {
    private readonly backend;
    /**
     * Create a new FileSystem instance
     * @param input - Backend configuration object with userId
     * @throws {FileSystemError} When configuration is invalid
     */
    constructor(input: Partial<BackendConfig>);
    /**
     * Get the workspace directory path
     * @returns Absolute path to the workspace directory
     */
    get workspace(): string;
    /**
     * Get the full backend configuration
     * @returns Complete backend configuration object
     */
    get backendConfig(): BackendConfig;
    /**
     * Execute a shell command in the workspace
     * @param command - The shell command to execute
     * @returns Promise resolving to the command output
     * @throws {FileSystemError} When command is empty or execution fails
     * @throws {DangerousOperationError} When dangerous operations are blocked
     */
    exec(command: string): Promise<string>;
    /**
     * Read the contents of a file
     * @param path - Relative path to the file within the workspace
     * @returns Promise resolving to the file contents as UTF-8 string
     * @throws {FileSystemError} When path is empty, file doesn't exist, or read fails
     */
    read(path: string): Promise<string>;
    /**
     * Write content to a file
     * @param path - Relative path to the file within the workspace
     * @param content - Content to write to the file as UTF-8 string
     * @returns Promise that resolves when the write is complete
     * @throws {FileSystemError} When path is empty or write fails
     */
    write(path: string, content: string): Promise<void>;
    /**
     * List files and directories
     * @param patternOrOptions - Optional glob pattern or options object
     * @returns Promise resolving to file/directory names or FileInfo objects
     * @throws {FileSystemError} When directory listing fails
     */
    ls(patternOrOptions?: string | {
        details: true;
    }): Promise<string[] | FileInfo[]>;
    /**
     * List files and directories with detailed metadata
     * @param pattern - Glob pattern to filter results
     * @param options - Options including details flag
     * @returns Promise resolving to an array of FileInfo objects
     * @throws {FileSystemError} When directory listing fails
     */
    ls(pattern: string, options: {
        details: true;
    }): Promise<FileInfo[]>;
}
//# sourceMappingURL=FileSystem.d.ts.map