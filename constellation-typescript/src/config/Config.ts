import { getLogger } from '@/utils/logger'
import { existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Library-level configuration interface for ConstellationFS
 */
interface LibraryConfig {
  /** Base directory for all user workspaces */
  workspaceRoot: string
  /** Enable FUSE filesystem mounting (internal) */
  fuseEnabled?: boolean
  /** Base path for FUSE mount points (internal) */
  fuseMountPoint?: string
  /** Backend-specific FUSE options (internal) */
  backends?: {
    local?: {
      /** Actual root directory when using FUSE pass-through */
      actualRoot?: string
    }
    remote?: {
      /** Whether FUSE is required for this backend */
      requiresFUSE?: boolean
    }
  }
}

/**
 * Singleton configuration manager for ConstellationFS library
 * Automatically loads from .constellationfs.json if present
 */
export class ConstellationFS {
  private static instance: ConstellationFS | null = null
  private config: LibraryConfig
  private appId: string

  private constructor(appId: string) {
    this.appId = appId
    // Default configuration
    this.config = {
      workspaceRoot: join(tmpdir(), 'constellation-fs'),
      fuseMountPoint: undefined,
      backends: {}
    }

    // Always try to load from .constellationfs.json in current directory
    this.loadConfigFile()

    getLogger().info('ConstellationFS initialized with config:', this.config)
  }

  /**
   * Load configuration from .constellationfs.json if it exists
   */
  private loadConfigFile(): void {
    const configPath = '.constellationfs.json'
    
    if (existsSync(configPath)) {
      try {
        const fileContent = readFileSync(configPath, 'utf-8')
        const loadedConfig = JSON.parse(fileContent) as Partial<LibraryConfig>
        
        // Merge with defaults
        this.config = {
          ...this.config,
          ...loadedConfig,
        }
      } catch (error) {
        console.warn(`Failed to load config from ${configPath}:`, error)
        // Continue with defaults
      }
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
   * Get the workspace root directory. Always has APP ID appended.
   */
  get workspaceRoot(): string {
    return join(this.config.workspaceRoot, this.appId)
  }

  /**
   * Check if FUSE is enabled
   */
  get fuseEnabled(): boolean {
    return this.config.fuseEnabled ?? true
  }

  /**
   * Get FUSE mount point base path
   */
  get fuseMountPoint(): string | undefined {
    return this.config.fuseMountPoint
  }

  /**
   * Get backend-specific configuration
   */
  get backends(): LibraryConfig['backends'] {
    return this.config.backends || {}
  }

  /**
   * Get the full configuration object
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
