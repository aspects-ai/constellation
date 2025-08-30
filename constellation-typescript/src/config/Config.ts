import { existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Library-level configuration interface for ConstellationFS
 */
interface LibraryConfig {
  /** Base directory for all user workspaces */
  workspaceRoot: string
}

/**
 * Singleton configuration manager for ConstellationFS library
 * Automatically loads from .constellationfs.json if present
 */
export class ConstellationFS {
  private static instance: ConstellationFS | null = null
  private config: LibraryConfig

  private constructor() {
    // Default configuration
    this.config = {
      workspaceRoot: join(tmpdir(), 'constellation-fs', 'users'),
    }

    // Always try to load from .constellationfs.json in current directory
    this.loadConfigFile()
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
      ConstellationFS.instance = new ConstellationFS()
    }
    return ConstellationFS.instance
  }

  /**
   * Get the workspace root directory
   */
  get workspaceRoot(): string {
    return this.config.workspaceRoot
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
