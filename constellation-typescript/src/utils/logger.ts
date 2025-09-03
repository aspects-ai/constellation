/**
 * Simple internal logger for ConstellationFS
 * Provides controlled logging that can be easily disabled or redirected
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

export interface Logger {
  error(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  debug(message: string, ...args: unknown[]): void
}

/**
 * Default logger implementation that writes to console
 * Can be replaced with custom implementation via setLogger
 */
class DefaultLogger implements Logger {
  constructor(private enabled = false) {}

  error(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      // eslint-disable-next-line no-console
      console.error(`[ConstellationFS] ${message}`, ...args)
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      // eslint-disable-next-line no-console
      console.warn(`[ConstellationFS] ${message}`, ...args)
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      // eslint-disable-next-line no-console
      console.info(`[ConstellationFS] ${message}`, ...args)
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.enabled) {
      // eslint-disable-next-line no-console
      console.debug(`[ConstellationFS] ${message}`, ...args)
    }
  }
}

/**
 * No-op logger that discards all messages
 */
class NoOpLogger implements Logger {
  error(): void {}
  warn(): void {}
  info(): void {}
  debug(): void {}
}

let currentLogger: Logger = new NoOpLogger()

/**
 * Set a custom logger implementation
 * @param logger - Logger instance to use
 */
export function setLogger(logger: Logger): void {
  currentLogger = logger
}

/**
 * Enable default console logging
 * @param enabled - Whether to enable logging
 */
export function enableConsoleLogging(enabled = true): void {
  currentLogger = enabled ? new DefaultLogger(true) : new NoOpLogger()
}

/**
 * Get the current logger instance
 * @returns Current logger
 */
export function getLogger(): Logger {
  return currentLogger
}
