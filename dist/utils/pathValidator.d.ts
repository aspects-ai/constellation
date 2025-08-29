/**
 * Path validation utilities for ensuring file operations stay within workspace boundaries
 */
/**
 * Check if a path is attempting to escape the workspace
 */
export declare function isPathEscaping(workspacePath: string, targetPath: string): boolean;
/**
 * Resolve a path safely within workspace boundaries
 * Throws if the path would escape the workspace
 */
export declare function resolvePathSafely(workspacePath: string, targetPath: string): string;
/**
 * Check if a path contains a symlink that could escape the workspace
 */
export declare function checkSymlinkSafety(workspacePath: string, targetPath: string): {
    safe: boolean;
    reason?: string;
};
/**
 * Validate multiple paths at once
 */
export declare function validatePaths(workspacePath: string, paths: string[]): {
    valid: boolean;
    invalidPaths: Array<{
        path: string;
        reason: string;
    }>;
};
//# sourceMappingURL=pathValidator.d.ts.map