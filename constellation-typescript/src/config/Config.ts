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
 * Configuration manager for ConstellationFS library.
 * Supports programmatic configuration via setConfig() or automatic loading from .constellationfs.json
 */
export class ConstellationFS {
  private static programmaticConfig: Partial<LibraryConfig> | null = null
  private config: LibraryConfig
  private appId: string

  private constructor() {
    if (!ConstellationFS.programmaticConfig) {
      throw new Error(
        'ConstellationFS configuration must be set via ConstellationFS.setConfig() before use'
      )
    }

    // Validate required fields
    if (!ConstellationFS.programmaticConfig.appId) {
      throw new Error('appId is required in ConstellationFS configuration')
    }

    // Default configuration
    const baseConfig: LibraryConfig = {
      appId: ConstellationFS.programmaticConfig.appId,
      workspaceRoot: ConstellationFS.programmaticConfig.workspaceRoot || join(tmpdir(), 'constellation-fs'),
    }

    this.config = baseConfig
    this.appId = baseConfig.appId
    getLogger().info('ConstellationFS initialized with config:', this.config)
  }

  /**
   * Set configuration programmatically
   * This will override any configuration file settings for all future getInstance calls
   * @param config Partial configuration to apply
   */
  static setConfig(config: Partial<LibraryConfig>): void {
    ConstellationFS.programmaticConfig = config
    getLogger().info('ConstellationFS configuration set programmatically')
  }

  /**
   * Get the workspace root directory. Always has APP ID appended.
   */
  get workspaceRoot(): string {
    return join(this.config.workspaceRoot || '/constellationfs', this.appId)
  }

  /**
   * Get the full configuration object.
   */
  get configuration(): Readonly<LibraryConfig> {
    return { ...this.config }
  }

  /**
   * Get the configured app ID.
   * @returns The app ID from programmatic configuration
   * @throws {Error} If setConfig has not been called with an appId
   */
  static getAppId(): string {
    if (!ConstellationFS.programmaticConfig?.appId) {
      throw new Error('ConstellationFS.setConfig must be called with appId before use')
    }
    return ConstellationFS.programmaticConfig.appId
  }

  /**
   * Reset the programmatic configuration (useful for testing)
   */
  static reset(): void {
    ConstellationFS.programmaticConfig = null
  }
}
