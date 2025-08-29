/**
 * Simple internal logger for ConstellationFS
 * Provides controlled logging that can be easily disabled or redirected
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export interface Logger {
    error(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    debug(message: string, ...args: unknown[]): void;
}
/**
 * Set a custom logger implementation
 * @param logger - Logger instance to use
 */
export declare function setLogger(logger: Logger): void;
/**
 * Enable default console logging
 * @param enabled - Whether to enable logging
 */
export declare function enableConsoleLogging(enabled?: boolean): void;
/**
 * Get the current logger instance
 * @returns Current logger
 */
export declare function getLogger(): Logger;
//# sourceMappingURL=logger.d.ts.map