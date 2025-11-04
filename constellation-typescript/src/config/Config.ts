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
 * Loads from .constellationfs.json by default, but allows injection of overrides.
 */
export class ConstellationFS {
  private static instance: ConstellationFS | null = null
  private config: LibraryConfig
  private appId: string

  private constructor(appId: string, injectedConfig?: Partial<LibraryConfig>) {
    this.appId = appId

    // Default configuration
    let baseConfig: LibraryConfig = {
      workspaceRoot: join(tmpdir(), 'constellation-fs'),
    }

    // Try to load from .constellationfs.json
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

    // Apply injected overrides last
    if (injectedConfig) {
      baseConfig = {
        ...baseConfig,
        ...injectedConfig,
      }
    }

    this.config = baseConfig

    getLogger().info('ConstellationFS initialized with config:', this.config)
  }

  /**
   * Get or initialize the singleton instance.
   * Allows injecting overrides for testing or custom configurations.
   * If already initialized, injectedConfig is ignored.
   * @param injectedConfig Optional overrides for LibraryConfig
   */
  static getInstance(injectedConfig?: Partial<LibraryConfig>): ConstellationFS {
    if (!ConstellationFS.instance) {
      const appId = process.env.CONSTELLATIONFS_APP_ID
      if (!appId) {
        throw new Error('CONSTELLATIONFS_APP_ID is not set')
      }
      ConstellationFS.instance = new ConstellationFS(appId, injectedConfig)
    }
    return ConstellationFS.instance
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
   */
  static reset(): void {
    ConstellationFS.instance = null
  }
}
