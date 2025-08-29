import { FileSystem } from '../FileSystem.js';
import { BaseSDKAdapter } from './BaseAdapter.js';
/**
 * Adapter mapping Claude Code tools to ConstellationFS operations
 * This provides a plug-and-play interface for agents using Claude Code SDK.
 * Available tools for Claude Code SDK: https://docs.anthropic.com/en/docs/claude-code/settings#tools-available-to-claude
 */
export declare class ClaudeCodeAdapter extends BaseSDKAdapter {
    constructor(fs: FileSystem);
    /**
     * Execute shell commands - maps to Claude's Bash tool
     * @param command - The shell command to execute
     * @returns Promise resolving to command output
     */
    Bash(command: string): Promise<string>;
    /**
     * List files and directories - maps to Claude's LS tool
     * @param path - Optional path to list (defaults to workspace root)
     * @returns Promise resolving to array of file/directory names
     */
    LS(path?: string): Promise<string[]>;
    /**
     * Find files using glob patterns - maps to Claude's Glob tool
     * @param pattern - Glob pattern to match files
     * @param path - Optional path to search in (defaults to current directory)
     * @returns Promise resolving to array of matching file paths
     */
    Glob(pattern: string, path?: string): Promise<string[]>;
    /**
     * Search for patterns in file contents - maps to Claude's Grep tool
     * @param pattern - Pattern to search for
     * @param options - Search options
     * @returns Promise resolving to search results
     */
    Grep(pattern: string, options?: {
        files?: string;
        ignoreCase?: boolean;
        lineNumbers?: boolean;
        context?: number;
    }): Promise<string>;
    /**
     * Read file contents - maps to Claude's Read tool
     * @param path - Path to file to read
     * @returns Promise resolving to file contents
     */
    Read(path: string): Promise<string>;
    /**
     * Write content to file - maps to Claude's Write tool
     * @param path - Path to file to write
     * @param content - Content to write to file
     * @returns Promise that resolves when write is complete
     */
    Write(path: string, content: string): Promise<void>;
    /**
     * Edit files by replacing specific text - maps to Claude's Edit tool
     * This is a simplified version that uses sed for basic find-replace operations
     * @param path - Path to file to edit
     * @param oldText - Text to replace
     * @param newText - Replacement text
     * @returns Promise that resolves when edit is complete
     */
    Edit(path: string, oldText: string, newText: string): Promise<void>;
}
//# sourceMappingURL=ClaudeCodeAdapter.d.ts.map