/**
 * Command parser for extracting and analyzing file paths in shell commands
 */
interface ParsedCommand {
    command: string;
    args: string[];
    filePaths: string[];
    hasAbsolutePath: boolean;
    hasDangerousPattern: boolean;
    issues: string[];
}
/**
 * Parse a shell command to extract file paths and identify security issues
 */
export declare function parseCommand(command: string): ParsedCommand;
/**
 * Check if a command is safe to execute within a workspace
 */
export declare function isCommandSafe(command: string): {
    safe: boolean;
    reason?: string;
};
/**
 * Sanitize a command by removing dangerous elements
 * Returns null if command cannot be safely sanitized
 */
export declare function sanitizeCommand(command: string): string | null;
export {};
//# sourceMappingURL=commandParser.d.ts.map