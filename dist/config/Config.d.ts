/**
 * Library-level configuration interface for ConstellationFS
 */
interface LibraryConfig {
    /** Base directory for all user workspaces */
    workspaceRoot: string;
}
/**
 * Singleton configuration manager for ConstellationFS library
 * Automatically loads from .constellationfs.json if present
 */
export declare class ConstellationFS {
    private static instance;
    private config;
    private constructor();
    /**
     * Load configuration from .constellationfs.json if it exists
     */
    private loadConfigFile;
    /**
     * Get the singleton instance
     * @returns ConstellationFS instance (creates with defaults if not loaded)
     */
    static getInstance(): ConstellationFS;
    /**
     * Get the workspace root directory
     */
    get workspaceRoot(): string;
    /**
     * Get the full configuration object
     */
    get configuration(): Readonly<LibraryConfig>;
    /**
     * Reset the singleton instance (useful for testing)
     */
    static reset(): void;
}
export {};
//# sourceMappingURL=Config.d.ts.map