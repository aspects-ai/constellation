import { execSync, spawn } from 'child_process'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { getLogger } from '../utils/logger.js'

/**
 * Internal FUSE mount configuration
 */
interface FUSEMountConfig {
  /** Mount point path */
  mountPoint: string
  /** Type of FUSE mount */
  type: 'passthrough' | 'sshfs' | 'bindfs'
  /** Backend-specific options */
  options?: Record<string, string>
}

/**
 * Internal FUSE manager for handling filesystem mounts
 * This is an implementation detail not exposed to library consumers
 */
export class FUSEManager {
  private static activeMounts = new Map<string, FUSEMountConfig>()
  private static cleanupRegistered = false
  
  /**
   * Check if FUSE is available on the system
   */
  static isAvailable(): boolean {
    try {
      // Check for FUSE support based on platform
      if (process.platform === 'darwin') {
        // macOS - check for macFUSE
        execSync('which mount_macfuse', { stdio: 'ignore' })
        return true
      } else if (process.platform === 'linux') {
        // Linux - check for fusermount
        execSync('which fusermount', { stdio: 'ignore' })
        return true
      } else if (process.platform === 'win32') {
        // Windows - check for WinFsp
        execSync('where winfsp-x64.dll', { stdio: 'ignore' })
        return true
      }
      return false
    } catch {
      return false
    }
  }
  
  /**
   * Check if SSHFS is available for remote mounts
   */
  static isSSHFSAvailable(): boolean {
    try {
      execSync('which sshfs', { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }
  
  /**
   * Mount a FUSE filesystem
   * @param config - Mount configuration
   * @returns True if mount succeeded
   */
  static async mount(config: FUSEMountConfig): Promise<boolean> {
    const logger = getLogger()
    
    // Register cleanup on first mount
    if (!this.cleanupRegistered) {
      this.registerCleanupHandlers()
      this.cleanupRegistered = true
    }
    
    // Check if already mounted
    if (this.isMounted(config.mountPoint)) {
      logger.debug(`Mount point ${config.mountPoint} already mounted`)
      return true
    }
    
    // Create mount point if it doesn't exist
    if (!existsSync(config.mountPoint)) {
      mkdirSync(config.mountPoint, { recursive: true })
    }
    
    try {
      switch (config.type) {
        case 'sshfs':
          return await this.mountSSHFS(config)
        case 'bindfs':
          return await this.mountBindFS(config)
        case 'passthrough':
          return await this.mountPassthrough(config)
        default:
          logger.warn(`Unknown FUSE mount type: ${config.type}`)
          return false
      }
    } catch (error) {
      logger.error(`Failed to mount ${config.mountPoint}:`, error)
      return false
    }
  }
  
  /**
   * Mount an SSHFS filesystem for remote backends
   */
  private static async mountSSHFS(config: FUSEMountConfig): Promise<boolean> {
    const { host, user, remotePath } = config.options || {}
    
    if (!host || !user) {
      throw new Error('SSHFS mount requires host and user options')
    }
    
    const sshfsCommand = [
      'sshfs',
      `${user}@${host}:${remotePath || '/'}`,
      config.mountPoint,
      '-o', 'reconnect',
      '-o', 'ServerAliveInterval=15',
      '-o', 'ServerAliveCountMax=3'
    ]
    
    // Add allow_other if running as root
    if (process.getuid && process.getuid() === 0) {
      sshfsCommand.push('-o', 'allow_other')
    }
    
    return new Promise((resolve) => {
      const child = spawn(sshfsCommand[0], sshfsCommand.slice(1))
      
      child.on('exit', (code) => {
        if (code === 0) {
          this.activeMounts.set(config.mountPoint, config)
          getLogger().info(`Mounted SSHFS at ${config.mountPoint}`)
          resolve(true)
        } else {
          getLogger().error(`SSHFS mount failed with code ${code}`)
          resolve(false)
        }
      })
      
      child.on('error', (err) => {
        getLogger().error('SSHFS mount error:', err)
        resolve(false)
      })
    })
  }
  
  /**
   * Mount a bindfs filesystem for local pass-through with logging
   */
  private static async mountBindFS(config: FUSEMountConfig): Promise<boolean> {
    const { sourcePath } = config.options || {}
    
    if (!sourcePath) {
      throw new Error('BindFS mount requires sourcePath option')
    }
    
    // Use bindfs for advanced features like permission mapping
    const bindfsCommand = [
      'bindfs',
      sourcePath,
      config.mountPoint
    ]
    
    return new Promise((resolve) => {
      const child = spawn(bindfsCommand[0], bindfsCommand.slice(1))
      
      child.on('exit', (code) => {
        if (code === 0) {
          this.activeMounts.set(config.mountPoint, config)
          getLogger().info(`Mounted BindFS at ${config.mountPoint}`)
          resolve(true)
        } else {
          resolve(false)
        }
      })
      
      child.on('error', () => {
        resolve(false)
      })
    })
  }
  
  /**
   * Mount a simple passthrough filesystem (symlink-based fallback)
   * This is used when FUSE is not available
   */
  private static async mountPassthrough(config: FUSEMountConfig): Promise<boolean> {
    const { sourcePath } = config.options || {}
    
    if (!sourcePath) {
      throw new Error('Passthrough mount requires sourcePath option')
    }
    
    try {
      // For passthrough without FUSE, we just use a symlink as fallback
      // This maintains the abstraction even without FUSE
      if (!this.isAvailable()) {
        getLogger().debug('FUSE not available, using symlink fallback')
        execSync(`ln -sfn "${sourcePath}" "${config.mountPoint}"`)
      } else {
        // If FUSE is available, try to use bindfs
        return await this.mountBindFS(config)
      }
      
      this.activeMounts.set(config.mountPoint, config)
      return true
    } catch (error) {
      getLogger().error('Passthrough mount failed:', error)
      return false
    }
  }
  
  /**
   * Unmount a FUSE filesystem
   * @param mountPoint - Path to unmount
   */
  static async unmount(mountPoint: string): Promise<void> {
    const logger = getLogger()
    
    if (!this.isMounted(mountPoint)) {
      logger.debug(`${mountPoint} is not mounted`)
      return
    }
    
    try {
      if (process.platform === 'darwin') {
        execSync(`umount "${mountPoint}"`)
      } else if (process.platform === 'linux') {
        execSync(`fusermount -u "${mountPoint}"`)
      } else if (process.platform === 'win32') {
        // Windows unmount command would go here
        execSync(`umount "${mountPoint}"`)
      }
      
      this.activeMounts.delete(mountPoint)
      logger.info(`Unmounted ${mountPoint}`)
      
      // Try to remove the mount point directory
      try {
        rmSync(mountPoint, { recursive: true, force: true })
      } catch {
        // Ignore errors removing mount point
      }
    } catch (error) {
      logger.error(`Failed to unmount ${mountPoint}:`, error)
      
      // Force unmount as last resort
      try {
        execSync(`umount -f "${mountPoint}"`, { stdio: 'ignore' })
        this.activeMounts.delete(mountPoint)
      } catch {
        // Ignore force unmount errors
      }
    }
  }
  
  /**
   * Check if a path is currently mounted
   */
  static isMounted(mountPoint: string): boolean {
    // First check our internal tracking
    if (this.activeMounts.has(mountPoint)) {
      return true
    }
    
    // Also check system mount table
    try {
      const mounts = execSync('mount').toString()
      return mounts.includes(mountPoint)
    } catch {
      return false
    }
  }
  
  /**
   * Get all active mounts
   */
  static getActiveMounts(): string[] {
    return Array.from(this.activeMounts.keys())
  }
  
  /**
   * Unmount all active FUSE filesystems
   */
  static async unmountAll(): Promise<void> {
    const logger = getLogger()
    logger.info('Unmounting all FUSE filesystems')
    
    const mounts = Array.from(this.activeMounts.keys())
    for (const mountPoint of mounts) {
      await this.unmount(mountPoint)
    }
  }
  
  /**
   * Register cleanup handlers for process exit
   */
  private static registerCleanupHandlers(): void {
    const cleanup = () => {
      // Synchronous cleanup on exit
      const mounts = Array.from(this.activeMounts.keys())
      for (const mountPoint of mounts) {
        try {
          if (process.platform === 'linux') {
            execSync(`fusermount -u "${mountPoint}"`, { stdio: 'ignore' })
          } else {
            execSync(`umount "${mountPoint}"`, { stdio: 'ignore' })
          }
        } catch {
          // Ignore errors during cleanup
        }
      }
    }
    
    // Register cleanup for various exit scenarios
    process.on('exit', cleanup)
    process.on('SIGINT', () => {
      cleanup()
      process.exit(0)
    })
    process.on('SIGTERM', () => {
      cleanup()
      process.exit(0)
    })
    process.on('uncaughtException', (error) => {
      getLogger().error('Uncaught exception:', error)
      cleanup()
      process.exit(1)
    })
  }
  
  /**
   * Get the appropriate mount base path for the current platform
   */
  static getMountBasePath(): string {
    // Use appropriate base path based on platform and permissions
    if (process.platform === 'win32') {
      return 'C:\\mnt\\constellationfs'
    } else if (process.getuid && process.getuid() !== 0) {
      // Non-root on Unix - use home directory
      return join(process.env.HOME || '/tmp', '.constellationfs', 'mnt')
    } else {
      // Root or system service - use /mnt
      return '/mnt/constellationfs'
    }
  }
  
  /**
   * Create a unique mount point for a backend and user
   * @param backendType - Type of backend (local, remote, docker)
   * @param userId - User identifier
   * @param host - Optional host for remote backends
   */
  static getMountPoint(backendType: string, userId: string, host?: string): string {
    const basePath = this.getMountBasePath()
    
    if (backendType === 'remote' && host) {
      return join(basePath, 'remote', host.replace(/[^a-zA-Z0-9-]/g, '_'), userId)
    } else {
      return join(basePath, backendType, userId)
    }
  }
}
