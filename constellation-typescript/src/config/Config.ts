import { existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { getLogger } from '../utils/logger'

/**
 * Library-level configuration interface for ConstellationFS
 */
export interface LibraryConfig {
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

  private constructor(appId: string) {
    this.appId = appId

    // Default configuration
    let baseConfig: LibraryConfig = {
      workspaceRoot: join(tmpdir(), 'constellation-fs'),
    }

    // If programmatic config is set, use it and skip file loading
    if (ConstellationFS.programmaticConfig) {
      baseConfig = {
        ...baseConfig,
        ...ConstellationFS.programmaticConfig,
      }
      this.config = baseConfig
      getLogger().info('ConstellationFS initialized with programmatic config:', this.config)
    } else {
      // Otherwise, try to load from .constellationfs.json
      const configPath = '.constellationfs.json'
      if (existsSync(configPath)) {
        try {
          const fileContent = readFileSync(configPath, 'utf-8')
          const loadedConfig = JSON.parse(fileContent) as Partial<LibraryConfig>
          baseConfig = {
            ...baseConfig,
            ...loadedConfig,
          }
        } catch (error) {
          console.warn(`Failed to load config from ${configPath}:`, error)
          // Continue with defaults
        }
      }
      this.config = baseConfig
      getLogger().info('ConstellationFS initialized with config:', this.config)
    }
  }

  /**
   * Get the singleton instance
   * @returns ConstellationFS instance (creates with defaults if not loaded)
   */
  static getInstance(): ConstellationFS {
    if (!ConstellationFS.instance) {
      const appId = process.env.CONSTELLATIONFS_APP_ID
      if (!appId) {
        throw new Error('CONSTELLATIONFS_APP_ID is not set')
      }
      ConstellationFS.instance = new ConstellationFS(appId)
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
