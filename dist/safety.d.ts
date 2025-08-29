/**
 * Check if a command contains dangerous operations
 * @param command - The command to check
 * @returns true if the command is considered dangerous
 */
export declare function isDangerous(command: string): boolean;
/**
 * Check if a command attempts to escape the workspace
 * @param command - The command to check
 * @returns true if the command attempts to access outside workspace
 */
export declare function isEscapingWorkspace(command: string): boolean;
/**
 * Extract the base command from a command string for logging/reporting
 * @param command - The full command string
 * @returns The base command (first word)
 */
export declare function getBaseCommand(command: string): string;
//# sourceMappingURL=safety.d.ts.map