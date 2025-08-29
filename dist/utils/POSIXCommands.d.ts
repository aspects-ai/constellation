/**
 * POSIX-compliant command utilities for consistent behavior across Unix-like systems
 * Focuses on GNU coreutils compatibility for macOS and Linux distributions
 */
export interface LSOptions {
    long?: boolean;
    all?: boolean;
    recursive?: boolean;
}
export interface GrepOptions {
    ignoreCase?: boolean;
    lineNumbers?: boolean;
    context?: number;
    recursive?: boolean;
}
export interface FindOptions {
    type?: 'f' | 'd' | 'l';
    maxDepth?: number;
}
/**
 * Standardized POSIX commands that work consistently across supported platforms.
 * These commands are specific shell commands used in agent SDKs outside of the general shell execution command (e.g. Claude Code's `bash`), which we implement a simple convenience wrapper for.
 */
export declare class POSIXCommands {
    /**
     * Generate ls command with consistent options
     */
    static ls(path?: string, options?: LSOptions): string;
    /**
     * Generate find command with proper escaping and options
     */
    static find(pattern: string, searchPath?: string, options?: FindOptions): string;
    /**
     * Generate grep command with consistent options
     */
    static grep(pattern: string, files?: string, options?: GrepOptions): string;
    /**
     * cat command for file reading
     */
    static cat(path: string): string;
    /**
     * touch command for file creation
     */
    static touch(path: string): string;
    /**
     * mkdir command with parent directory creation
     */
    static mkdir(path: string, parents?: boolean): string;
    /**
     * stat command for file information
     */
    static stat(path: string): string;
    /**
     * wc command for counting
     */
    static wc(path?: string, options?: {
        lines?: boolean;
        words?: boolean;
        chars?: boolean;
    }): string;
    /**
     * head command for reading file beginnings
     */
    static head(path: string, lines?: number): string;
    /**
     * tail command for reading file endings
     */
    static tail(path: string, lines?: number): string;
    /**
     * sort command
     */
    static sort(path?: string, options?: {
        reverse?: boolean;
        numeric?: boolean;
        unique?: boolean;
    }): string;
    /**
     * uniq command for removing duplicates
     */
    static uniq(path?: string, count?: boolean): string;
    /**
     * cut command for column extraction
     */
    static cut(fields: string, path?: string, delimiter?: string): string;
    /**
     * Escape shell arguments to prevent command injection
     */
    static escapeShellArg(arg: string): string;
    /**
     * Check if a command exists in the system
     */
    static checkCommand(command: string): string;
}
//# sourceMappingURL=POSIXCommands.d.ts.map