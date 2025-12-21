import { tmpdir } from 'os'
import { join } from 'path'
import { getLogger } from '../utils/logger'

/**
 * Library-level configuration interface for ConstellationFS
 */
export interface LibraryConfig {
  /** Application identifier for isolating workspaces */
  appId: string
  /** Base mount directory for all ConstellationFS workspaces. Defaults to /constellationfs */
  workspaceRoot?: string
}

/**
 * Static configuration manager for ConstellationFS library.
 *
 * @example
 * ```typescript
 * // Set config at app startup
 * ConstellationFS.setConfig({ appId: 'my-app' })
 *
 * // Access config anywhere
 * const config = ConstellationFS.getConfig()
 * const appId = ConstellationFS.getAppId()
 * const workspaceRoot = ConstellationFS.getWorkspaceRoot()
 * ```
 */
export class ConstellationFS {
  private static config: LibraryConfig | null = null

  private constructor() {
    // Prevent instantiation
  }

  /**
   * Set configuration programmatically. Must be called before using ConstellationFS.
   * @param config Configuration to apply
   */
  static setConfig(config: Partial<LibraryConfig>): void {
    if (!config.appId) {
      throw new Error('appId is required in ConstellationFS configuration')
    }

    ConstellationFS.config = {
      appId: config.appId,
      workspaceRoot: config.workspaceRoot || join(tmpdir(), 'constellation-fs'),
    }
    getLogger().info('ConstellationFS configuration set:', ConstellationFS.config)
  }

  /**
   * Get the full configuration object.
   * @throws {Error} If setConfig() has not been called
   */
  static getConfig(): Readonly<LibraryConfig> {
    if (!ConstellationFS.config) {
      throw new Error('ConstellationFS.setConfig() must be called before use')
    }
    return { ...ConstellationFS.config }
  }

  /**
   * Get the configured app ID.
   * @throws {Error} If setConfig() has not been called
   */
  static getAppId(): string {
    if (!ConstellationFS.config) {
      throw new Error('ConstellationFS.setConfig() must be called before use')
    }
    return ConstellationFS.config.appId
  }

  /**
   * Get the workspace root directory (includes app ID).
   * @throws {Error} If setConfig() has not been called
   */
  static getWorkspaceRoot(): string {
    if (!ConstellationFS.config) {
      throw new Error('ConstellationFS.setConfig() must be called before use')
    }
    return join(ConstellationFS.config.workspaceRoot!, ConstellationFS.config.appId)
  }

  /**
   * Reset configuration (useful for testing)
   */
  static reset(): void {
    ConstellationFS.config = null
  }
}
