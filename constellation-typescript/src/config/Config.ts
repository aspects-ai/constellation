import { tmpdir } from 'os'
import { join } from 'path'
import { getLogger } from '../utils/logger'

/**
 * Library-level configuration interface for ConstellationFS
 */
export interface LibraryConfig {
  /** Application identifier for isolating workspaces */
  appId: string
  /** Base directory for all user workspaces */
  workspaceRoot: string
}

/**
 * Singleton configuration manager for ConstellationFS library.
 * Supports programmatic configuration via setConfig() or automatic loading from .constellationfs.json
 */
export class ConstellationFS {
  private static instance: ConstellationFS | null = null
  private static programmaticConfig: Partial<LibraryConfig> | null = null
  private config: LibraryConfig
  private appId: string

  private constructor() {
    // Programmatic config must be set via setConfig() before getInstance()
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
   * Get the singleton instance
   * @returns ConstellationFS instance
   * @throws {Error} if setConfig() has not been called first
   */
  static getInstance(): ConstellationFS {
    if (!ConstellationFS.instance) {
      ConstellationFS.instance = new ConstellationFS()
    }
    return ConstellationFS.instance
  }

  /**
   * Set configuration programmatically
   * This will override any configuration file settings for all future getInstance calls
   * @param config Partial configuration to apply
   */
  static setConfig(config: Partial<LibraryConfig>): void {
    ConstellationFS.programmaticConfig = config
    // Reset the instance so next getInstance call will use the new config
    ConstellationFS.instance = null
    getLogger().info('ConstellationFS configuration set programmatically')
  }

  /**
   * Get the workspace root directory. Always has APP ID appended.
   */
  get workspaceRoot(): string {
    return join(this.config.workspaceRoot, this.appId)
  }

  /**
   * Get the full configuration object.
   */
  get configuration(): Readonly<LibraryConfig> {
    return { ...this.config }
  }

  /**
   * Reset the singleton instance (useful for testing)
   * Also clears any programmatic configuration
   */
  static reset(): void {
    ConstellationFS.instance = null
    ConstellationFS.programmaticConfig = null
  }
}
