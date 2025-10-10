import { ERROR_CODES } from '../constants.js'
import { FileSystemError } from '../types.js'
import { getLogger } from '../utils/logger.js'
import { BackendFactory } from './BackendFactory.js'
import type { BackendConfig, FileSystemBackend, RemoteBackendConfig } from './types.js'

/**
 * Backend pool for managing shared backend instances
 * Backends are keyed by userId for security isolation
 * Each user's backend can manage multiple workspaces
 */
export class BackendPool {
  private static backends = new Map<string, FileSystemBackend>()
  private static refCounts = new Map<string, number>()

  /**
   * Get or create a backend for a specific user
   * Backends are ALWAYS isolated per userId for security
   *
   * @param config - Backend configuration including userId
   * @returns FileSystemBackend instance
   * @throws {FileSystemError} When userId is missing or backend creation fails
   */
  static getBackend(config: BackendConfig): FileSystemBackend {
    // Validate userId is present
    if (!config.userId) {
      throw new FileSystemError(
        'userId is required for backend creation',
        ERROR_CODES.INVALID_CONFIGURATION
      )
    }

    const key = this.getBackendKey(config)

    if (!this.backends.has(key)) {
      getLogger().debug(`Creating new backend for key: ${key}`)
      this.backends.set(key, BackendFactory.create(config))
      this.refCounts.set(key, 0)
    }

    const refCount = this.refCounts.get(key)!
    this.refCounts.set(key, refCount + 1)
    getLogger().debug(`Backend ${key} ref count: ${refCount + 1}`)

    return this.backends.get(key)!
  }

  /**
   * Generate backend key - ALWAYS includes userId for isolation
   * Format: {userId}:{type}[:{additionalParams}]
   *
   * @param config - Backend configuration
   * @returns Unique key string for this backend
   */
  private static getBackendKey(config: BackendConfig): string {
    const parts = [config.userId, config.type]

    // For remote backends, include host info for proper pooling
    // But userId is ALWAYS first to ensure user isolation
    if (config.type === 'remote') {
      const remoteConfig = config as RemoteBackendConfig
      parts.push(remoteConfig.host || 'env')
      parts.push(String(remoteConfig.port || 22))
    }

    // For local backends, userId + type is sufficient
    // All local operations for a user share the same backend

    return parts.join(':')
  }

  /**
   * Release a backend reference
   * Backend is destroyed when ref count reaches 0
   *
   * @param backend - Backend instance to release
   */
  static async releaseBackend(backend: FileSystemBackend): Promise<void> {
    const key = Array.from(this.backends.entries()).find(([_, b]) => b === backend)?.[0]

    if (!key) {
      getLogger().warn('Attempted to release unknown backend')
      return
    }

    const refCount = this.refCounts.get(key) || 0

    if (refCount <= 1) {
      // Last reference - cleanup
      getLogger().debug(`Destroying backend ${key}`)
      await backend.destroy()
      this.backends.delete(key)
      this.refCounts.delete(key)
    } else {
      this.refCounts.set(key, refCount - 1)
      getLogger().debug(`Backend ${key} ref count: ${refCount - 1}`)
    }
  }

  /**
   * Get all backends for a specific user
   * Useful for admin operations and monitoring
   *
   * @param userId - User identifier
   * @returns Array of backend instances for this user
   */
  static getUserBackends(userId: string): FileSystemBackend[] {
    return Array.from(this.backends.entries())
      .filter(([key]) => key.startsWith(`${userId}:`))
      .map(([_, backend]) => backend)
  }

  /**
   * Cleanup all backends for a user
   * Useful when user session ends
   *
   * @param userId - User identifier
   */
  static async cleanupUser(userId: string): Promise<void> {
    const userBackends = this.getUserBackends(userId)

    getLogger().debug(`Cleaning up ${userBackends.length} backend(s) for user ${userId}`)

    await Promise.all(userBackends.map((backend) => backend.destroy()))

    // Remove from pool
    for (const [key] of this.backends.entries()) {
      if (key.startsWith(`${userId}:`)) {
        this.backends.delete(key)
        this.refCounts.delete(key)
      }
    }
  }

  /**
   * Get statistics for a specific user's backends
   * Useful for monitoring and debugging
   *
   * @param userId - User identifier
   * @returns Statistics object
   */
  static async getUserStats(userId: string): Promise<{
    backendCount: number
    workspaceCount: number
    connections: number
  }> {
    const backends = this.getUserBackends(userId)

    const workspaceCounts = await Promise.all(
      backends.map(async (b) => {
        try {
          const workspaces = await b.listWorkspaces()
          return workspaces.length
        } catch {
          return 0
        }
      })
    )

    return {
      backendCount: backends.length,
      workspaceCount: workspaceCounts.reduce((sum, count) => sum + count, 0),
      connections: backends.filter((b) => b.connected).length,
    }
  }

  /**
   * Clear all backends (for testing)
   * @internal
   */
  static async clearAll(): Promise<void> {
    const allBackends = Array.from(this.backends.values())
    await Promise.all(allBackends.map((b) => b.destroy()))
    this.backends.clear()
    this.refCounts.clear()
  }

  /**
   * Get current pool size (for monitoring/debugging)
   */
  static getPoolSize(): number {
    return this.backends.size
  }
}
