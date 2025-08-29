/**
 * Manages user workspace directories for multi-tenant support
 */
export declare class WorkspaceManager {
    /**
     * Get the workspace path for a specific user
     * @param userId - The user identifier
     * @returns Absolute path to the user's workspace
     */
    static getUserWorkspacePath(userId: string): string;
    /**
     * Ensure a user's workspace directory exists
     * @param userId - The user identifier
     * @returns Absolute path to the created/existing workspace
     */
    static ensureUserWorkspace(userId: string): string;
    /**
     * Check if a user workspace exists
     * @param userId - The user identifier
     * @returns True if the workspace exists
     */
    static workspaceExists(userId: string): boolean;
    /**
     * Validate a user ID for safe directory naming
     * @param userId - The user identifier to validate
     * @throws Error if userId is invalid
     */
    static validateUserId(userId: string): void;
}
//# sourceMappingURL=workspaceManager.d.ts.map