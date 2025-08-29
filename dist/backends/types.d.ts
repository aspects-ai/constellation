import { z } from 'zod';
import { FileInfo } from '../types.js';
/**
 * Backend-specific configuration schemas
 */
declare const LocalBackendConfigSchema: z.ZodObject<{
    preventDangerous: z.ZodDefault<z.ZodBoolean>;
    onDangerousOperation: z.ZodOptional<z.ZodFunction<z.ZodTuple<[z.ZodString], z.ZodUnknown>, z.ZodVoid>>;
    maxOutputLength: z.ZodOptional<z.ZodNumber>;
} & {
    type: z.ZodDefault<z.ZodLiteral<"local">>;
    shell: z.ZodDefault<z.ZodEnum<["bash", "sh", "auto"]>>;
    validateUtils: z.ZodDefault<z.ZodBoolean>;
    userId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    preventDangerous: boolean;
    type: "local";
    shell: "bash" | "sh" | "auto";
    validateUtils: boolean;
    userId: string;
    onDangerousOperation?: ((args_0: string, ...args: unknown[]) => void) | undefined;
    maxOutputLength?: number | undefined;
}, {
    userId: string;
    preventDangerous?: boolean | undefined;
    type?: "local" | undefined;
    onDangerousOperation?: ((args_0: string, ...args: unknown[]) => void) | undefined;
    maxOutputLength?: number | undefined;
    shell?: "bash" | "sh" | "auto" | undefined;
    validateUtils?: boolean | undefined;
}>;
declare const RemoteBackendConfigSchema: z.ZodObject<{
    preventDangerous: z.ZodDefault<z.ZodBoolean>;
    onDangerousOperation: z.ZodOptional<z.ZodFunction<z.ZodTuple<[z.ZodString], z.ZodUnknown>, z.ZodVoid>>;
    maxOutputLength: z.ZodOptional<z.ZodNumber>;
} & {
    type: z.ZodLiteral<"remote">;
    workspace: z.ZodString;
    host: z.ZodString;
    auth: z.ZodObject<{
        type: z.ZodEnum<["key", "password"]>;
        credentials: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        type: "key" | "password";
        credentials: Record<string, unknown>;
    }, {
        type: "key" | "password";
        credentials: Record<string, unknown>;
    }>;
}, "strip", z.ZodTypeAny, {
    preventDangerous: boolean;
    type: "remote";
    workspace: string;
    host: string;
    auth: {
        type: "key" | "password";
        credentials: Record<string, unknown>;
    };
    onDangerousOperation?: ((args_0: string, ...args: unknown[]) => void) | undefined;
    maxOutputLength?: number | undefined;
}, {
    type: "remote";
    workspace: string;
    host: string;
    auth: {
        type: "key" | "password";
        credentials: Record<string, unknown>;
    };
    preventDangerous?: boolean | undefined;
    onDangerousOperation?: ((args_0: string, ...args: unknown[]) => void) | undefined;
    maxOutputLength?: number | undefined;
}>;
declare const DockerBackendConfigSchema: z.ZodObject<{
    preventDangerous: z.ZodDefault<z.ZodBoolean>;
    onDangerousOperation: z.ZodOptional<z.ZodFunction<z.ZodTuple<[z.ZodString], z.ZodUnknown>, z.ZodVoid>>;
    maxOutputLength: z.ZodOptional<z.ZodNumber>;
} & {
    type: z.ZodLiteral<"docker">;
    workspace: z.ZodString;
    image: z.ZodDefault<z.ZodString>;
    options: z.ZodOptional<z.ZodObject<{
        network: z.ZodOptional<z.ZodString>;
        volumes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        environment: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        network?: string | undefined;
        volumes?: string[] | undefined;
        environment?: Record<string, string> | undefined;
    }, {
        network?: string | undefined;
        volumes?: string[] | undefined;
        environment?: Record<string, string> | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    preventDangerous: boolean;
    type: "docker";
    workspace: string;
    image: string;
    options?: {
        network?: string | undefined;
        volumes?: string[] | undefined;
        environment?: Record<string, string> | undefined;
    } | undefined;
    onDangerousOperation?: ((args_0: string, ...args: unknown[]) => void) | undefined;
    maxOutputLength?: number | undefined;
}, {
    type: "docker";
    workspace: string;
    preventDangerous?: boolean | undefined;
    options?: {
        network?: string | undefined;
        volumes?: string[] | undefined;
        environment?: Record<string, string> | undefined;
    } | undefined;
    onDangerousOperation?: ((args_0: string, ...args: unknown[]) => void) | undefined;
    maxOutputLength?: number | undefined;
    image?: string | undefined;
}>;
export declare const BackendConfigSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    preventDangerous: z.ZodDefault<z.ZodBoolean>;
    onDangerousOperation: z.ZodOptional<z.ZodFunction<z.ZodTuple<[z.ZodString], z.ZodUnknown>, z.ZodVoid>>;
    maxOutputLength: z.ZodOptional<z.ZodNumber>;
} & {
    type: z.ZodDefault<z.ZodLiteral<"local">>;
    shell: z.ZodDefault<z.ZodEnum<["bash", "sh", "auto"]>>;
    validateUtils: z.ZodDefault<z.ZodBoolean>;
    userId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    preventDangerous: boolean;
    type: "local";
    shell: "bash" | "sh" | "auto";
    validateUtils: boolean;
    userId: string;
    onDangerousOperation?: ((args_0: string, ...args: unknown[]) => void) | undefined;
    maxOutputLength?: number | undefined;
}, {
    userId: string;
    preventDangerous?: boolean | undefined;
    type?: "local" | undefined;
    onDangerousOperation?: ((args_0: string, ...args: unknown[]) => void) | undefined;
    maxOutputLength?: number | undefined;
    shell?: "bash" | "sh" | "auto" | undefined;
    validateUtils?: boolean | undefined;
}>, z.ZodObject<{
    preventDangerous: z.ZodDefault<z.ZodBoolean>;
    onDangerousOperation: z.ZodOptional<z.ZodFunction<z.ZodTuple<[z.ZodString], z.ZodUnknown>, z.ZodVoid>>;
    maxOutputLength: z.ZodOptional<z.ZodNumber>;
} & {
    type: z.ZodLiteral<"remote">;
    workspace: z.ZodString;
    host: z.ZodString;
    auth: z.ZodObject<{
        type: z.ZodEnum<["key", "password"]>;
        credentials: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        type: "key" | "password";
        credentials: Record<string, unknown>;
    }, {
        type: "key" | "password";
        credentials: Record<string, unknown>;
    }>;
}, "strip", z.ZodTypeAny, {
    preventDangerous: boolean;
    type: "remote";
    workspace: string;
    host: string;
    auth: {
        type: "key" | "password";
        credentials: Record<string, unknown>;
    };
    onDangerousOperation?: ((args_0: string, ...args: unknown[]) => void) | undefined;
    maxOutputLength?: number | undefined;
}, {
    type: "remote";
    workspace: string;
    host: string;
    auth: {
        type: "key" | "password";
        credentials: Record<string, unknown>;
    };
    preventDangerous?: boolean | undefined;
    onDangerousOperation?: ((args_0: string, ...args: unknown[]) => void) | undefined;
    maxOutputLength?: number | undefined;
}>, z.ZodObject<{
    preventDangerous: z.ZodDefault<z.ZodBoolean>;
    onDangerousOperation: z.ZodOptional<z.ZodFunction<z.ZodTuple<[z.ZodString], z.ZodUnknown>, z.ZodVoid>>;
    maxOutputLength: z.ZodOptional<z.ZodNumber>;
} & {
    type: z.ZodLiteral<"docker">;
    workspace: z.ZodString;
    image: z.ZodDefault<z.ZodString>;
    options: z.ZodOptional<z.ZodObject<{
        network: z.ZodOptional<z.ZodString>;
        volumes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        environment: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        network?: string | undefined;
        volumes?: string[] | undefined;
        environment?: Record<string, string> | undefined;
    }, {
        network?: string | undefined;
        volumes?: string[] | undefined;
        environment?: Record<string, string> | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    preventDangerous: boolean;
    type: "docker";
    workspace: string;
    image: string;
    options?: {
        network?: string | undefined;
        volumes?: string[] | undefined;
        environment?: Record<string, string> | undefined;
    } | undefined;
    onDangerousOperation?: ((args_0: string, ...args: unknown[]) => void) | undefined;
    maxOutputLength?: number | undefined;
}, {
    type: "docker";
    workspace: string;
    preventDangerous?: boolean | undefined;
    options?: {
        network?: string | undefined;
        volumes?: string[] | undefined;
        environment?: Record<string, string> | undefined;
    } | undefined;
    onDangerousOperation?: ((args_0: string, ...args: unknown[]) => void) | undefined;
    maxOutputLength?: number | undefined;
    image?: string | undefined;
}>]>;
export type BackendConfig = z.infer<typeof BackendConfigSchema>;
export type LocalBackendConfig = z.infer<typeof LocalBackendConfigSchema>;
export type RemoteBackendConfig = z.infer<typeof RemoteBackendConfigSchema>;
export type DockerBackendConfig = z.infer<typeof DockerBackendConfigSchema>;
/**
 * Validation helper for LocalBackendConfig
 */
export declare function validateLocalBackendConfig(config: LocalBackendConfig): void;
/**
 * Backend interface that all filesystem implementations must satisfy
 * Provides the low-level operations for different execution environments
 */
export interface FileSystemBackend {
    /** The resolved absolute path to the workspace directory */
    readonly workspace: string;
    /** The configuration options for this backend */
    readonly options: BackendConfig;
    /**
     * Execute a shell command in the backend environment
     * @param command - The shell command to execute
     * @returns Promise resolving to the command output
     * @throws {FileSystemError} When command execution fails
     * @throws {DangerousOperationError} When dangerous operations are blocked
     */
    exec(command: string): Promise<string>;
    /**
     * Read the contents of a file from the backend storage
     * @param path - Relative path to the file within the workspace
     * @returns Promise resolving to the file contents as UTF-8 string
     * @throws {FileSystemError} When file cannot be read or doesn't exist
     */
    read(path: string): Promise<string>;
    /**
     * Write content to a file in the backend storage
     * @param path - Relative path to the file within the workspace
     * @param content - Content to write to the file as UTF-8 string
     * @returns Promise that resolves when the write is complete
     * @throws {FileSystemError} When file cannot be written
     */
    write(path: string, content: string): Promise<void>;
    /**
     * List files and directories in the backend storage
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
export {};
//# sourceMappingURL=types.d.ts.map