import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { ConstellationFS } from '../config/Config.js'

/**
 * Manages user workspace directories for multi-tenant support
 */
export class WorkspaceManager {
  /**
   * Get the workspace path for a specific user
   * @param userId - The user identifier
   * @returns Absolute path to the user's workspace
   */
  static getUserWorkspacePath(userId: string): string {
    const libraryConfig = ConstellationFS.getInstance()
    return join(libraryConfig.workspaceRoot, userId)
  }

  /**
   * Ensure a user's workspace directory exists
   * @param userId - The user identifier
   * @returns Absolute path to the created/existing workspace
   */
  static ensureUserWorkspace(userId: string): string {
    const workspacePath = this.getUserWorkspacePath(userId)
    
    if (!existsSync(workspacePath)) {
      mkdirSync(workspacePath, { recursive: true })
    }
    
    return workspacePath
  }

  /**
   * Check if a user workspace exists
   * @param userId - The user identifier
   * @returns True if the workspace exists
   */
  static workspaceExists(userId: string): boolean {
    const workspacePath = this.getUserWorkspacePath(userId)
    return existsSync(workspacePath)
  }

  /**
   * Validate a user ID for safe directory naming
   * @param userId - The user identifier to validate
   * @throws Error if userId is invalid
   */
  static validateUserId(userId: string): void {
    if (!userId || userId.trim().length === 0) {
      throw new Error('User ID cannot be empty')
    }
    
    // Ensure userId is safe for directory naming
    const invalidChars = /[<>:"|?*\x00-\x1f]/g
    if (invalidChars.test(userId)) {
      throw new Error('User ID contains invalid characters for directory naming')
    }
    
    // Prevent directory traversal
    if (userId.includes('..') || userId.includes('./') || userId.includes('/') || userId.includes('\\')) {
      throw new Error('User ID cannot contain path traversal sequences')
    }
  }
}