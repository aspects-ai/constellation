/**
 * Application-wide constants and configuration
 */
/**
 * Supported backend types
 */
export declare const BACKEND_TYPES: readonly ["local", "remote", "docker"];
export type BackendType = typeof BACKEND_TYPES[number];
/**
 * Supported shell types for local backend
 */
export declare const SHELL_TYPES: readonly ["bash", "sh", "auto"];
export type ShellType = typeof SHELL_TYPES[number];
/**
 * Authentication types for remote backend
 */
export declare const AUTH_TYPES: readonly ["key", "password"];
export type AuthType = typeof AUTH_TYPES[number];
/**
 * Default values for configuration
 */
export declare const DEFAULTS: {
    readonly PREVENT_DANGEROUS: true;
    readonly SHELL: ShellType;
    readonly VALIDATE_UTILS: false;
    readonly DOCKER_IMAGE: "ubuntu:latest";
};
/**
 * Error codes used throughout the application
 */
export declare const ERROR_CODES: {
    readonly BACKEND_NOT_IMPLEMENTED: "BACKEND_NOT_IMPLEMENTED";
    readonly UNSUPPORTED_BACKEND: "UNSUPPORTED_BACKEND";
    readonly UNKNOWN_BACKEND: "UNKNOWN_BACKEND";
    readonly WORKSPACE_NOT_FOUND: "WORKSPACE_NOT_FOUND";
    readonly MISSING_UTILITIES: "MISSING_UTILITIES";
    readonly ABSOLUTE_PATH_REJECTED: "ABSOLUTE_PATH_REJECTED";
    readonly PATH_ESCAPE_ATTEMPT: "PATH_ESCAPE_ATTEMPT";
    readonly EXEC_FAILED: "EXEC_FAILED";
    readonly EXEC_ERROR: "EXEC_ERROR";
    readonly READ_FAILED: "READ_FAILED";
    readonly WRITE_FAILED: "WRITE_FAILED";
    readonly LS_FAILED: "LS_FAILED";
    readonly EMPTY_COMMAND: "EMPTY_COMMAND";
    readonly EMPTY_PATH: "EMPTY_PATH";
    readonly DANGEROUS_OPERATION: "DANGEROUS_OPERATION";
};
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
//# sourceMappingURL=constants.d.ts.map