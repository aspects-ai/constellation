import { FileSystem } from '../FileSystem.js';
import { BackendConfig } from '../types.js';
/**
 * Base interface that all Agent SDK adapters should implement
 * Provides common functionality and access to the underlying FileSystem
 */
export interface AgentSDKAdapter {
    /**
     * Get the underlying FileSystem instance
     */
    readonly fileSystem: FileSystem;
    /**
     * Get the workspace path
     */
    readonly workspace: string;
    /**
     * Get the backend configuration
     */
    readonly backendConfig: BackendConfig;
}
/**
 * Abstract base class for SDK adapters
 * Provides common functionality that all adapters can use to interact with different AI frameworks
 *
 * New adapters should extend this class. General shell commands can be routed through the `exec` method, while specific shell commands
 * should be implemented in the adapter via POSIXCommands.
 */
export declare abstract class BaseSDKAdapter implements AgentSDKAdapter {
    protected readonly fs: FileSystem;
    constructor(fs: FileSystem);
    get fileSystem(): FileSystem;
    get workspace(): string;
    get backendConfig(): BackendConfig;
    /**
     * Execute a shell command (common across most SDKs)
     * @param command - The shell command to execute
     * @returns Promise resolving to command output
     */
    protected exec(command: string): Promise<string>;
    /**
     * Read a file (common across most SDKs)
     * @param path - Path to file to read
     * @returns Promise resolving to file contents
     */
    protected read(path: string): Promise<string>;
    /**
     * Write a file (common across most SDKs)
     * @param path - Path to file to write
     * @param content - Content to write
     * @returns Promise that resolves when write is complete
     */
    protected write(path: string, content: string): Promise<void>;
    /**
     * List files (common across most SDKs)
     * @param pattern - Optional pattern to filter files
     * @returns Promise resolving to file list
     */
    protected ls(pattern?: string): Promise<string[] | import('../types.js').FileInfo[]>;
}
//# sourceMappingURL=BaseAdapter.d.ts.map