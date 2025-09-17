import { clearTimeout, setTimeout } from 'node:timers'
import type { Client } from 'ssh2'
import { ConstellationFS } from '../config/Config.js'
import { ERROR_CODES } from '../constants.js'
import { FileSystemError } from '../types.js'
import { getLogger } from './logger.js'

/**
 * Manages user workspace directories for remote filesystem operations via SSH
 */
export class RemoteWorkspaceManager {
  private readonly sshClient: Client

  constructor(sshClient: Client) {
    this.sshClient = sshClient
  }

  /**
   * Get the workspace path for a specific user on remote system
   * @param userId - The user identifier
   * @returns Absolute path to the user's workspace on remote system
   */
  static getUserWorkspacePath(userId: string): string {
    const libraryConfig = ConstellationFS.getInstance()
    // Use POSIX path joining for remote systems (same structure as local)
    return `${libraryConfig.workspaceRoot}/${userId}`
  }

  /**
   * Ensure a user's workspace directory exists on remote filesystem
   * @param userId - The user identifier
   * @returns Promise resolving to absolute path of the created/existing workspace
   */
  async ensureUserWorkspace(userId: string): Promise<string> {
    const workspacePath = RemoteWorkspaceManager.getUserWorkspacePath(userId)
    
    // Create directory via SSH if it doesn't exist
    const command = `mkdir -p "${workspacePath}"`
    
    return new Promise((resolve, reject) => {
      this.sshClient.exec(command, (err, stream) => {
        if (err) {
          reject(new FileSystemError(
            `Failed to create remote workspace: ${err.message}`,
            ERROR_CODES.EXEC_FAILED,
            command
          ))
          return
        }

        let stderr = ''
        let resolved = false
        
        // Add timeout as safety measure
        const timeout = setTimeout(() => {
          if (!resolved) {
            getLogger().debug('[RemoteWorkspaceManager] Timeout waiting for command completion, assuming success')
            resolved = true
            resolve(workspacePath) // Assume success if command was sent
          }
        }, 5000) // 5 second timeout
        
        const handleCompletion = (code: number, source: string) => {
          if (!resolved) {
            clearTimeout(timeout)
            resolved = true
            getLogger().debug(`[RemoteWorkspaceManager] Command completed via ${source} with code: ${code}`)
            if (code === 0) {
              getLogger().debug(`Remote workspace ensured: ${workspacePath}`)
              resolve(workspacePath)
            } else {
              reject(new FileSystemError(
                `Failed to create remote workspace (exit code ${code}): ${stderr || 'Unknown error'}`,
                ERROR_CODES.EXEC_FAILED,
                command
              ))
            }
          }
        }

        stream.on('close', (code: number) => handleCompletion(code, 'close'))
        stream.on('exit', (code: number) => handleCompletion(code, 'exit'))
        
        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString()
        })
      })
    })
  }

  /**
   * Check if a user workspace exists on remote filesystem
   * @param userId - The user identifier
   * @returns Promise resolving to true if the workspace exists
   */
  async workspaceExists(userId: string): Promise<boolean> {
    const workspacePath = RemoteWorkspaceManager.getUserWorkspacePath(userId)
    
    // Test if directory exists via SSH
    const command = `test -d "${workspacePath}"`
    
    return new Promise((resolve, reject) => {
      this.sshClient.exec(command, (err, stream) => {
        if (err) {
          reject(new FileSystemError(
            `Failed to check remote workspace: ${err.message}`,
            ERROR_CODES.EXEC_FAILED,
            command
          ))
          return
        }

        stream.on('close', (code: number) => {
          // test command returns 0 if directory exists, 1 if it doesn't
          resolve(code === 0)
        })
        .on('data', () => {
          // Consume stdout but ignore it for test command
        })
        .stderr.on('data', () => {
          // Consume stderr but ignore it for test command
        })
      })
    })
  }

  /**
   * Validate a user ID for safe directory naming
   * This is the same logic as LocalWorkspaceManager since it doesn't require SSH
   * @param userId - The user identifier to validate
   * @throws Error if userId is invalid
   */
  static validateUserId(userId: string): void {
    if (!userId || userId.trim().length === 0) {
      throw new Error('User ID cannot be empty')
    }
    
    // Only allow alphanumeric, hyphens, underscores, and periods
    const validChars = /^[a-zA-Z0-9._-]+$/
    if (!validChars.test(userId)) {
      throw new Error(`User ID '${userId}' can only contain letters, numbers, hyphens, underscores, and periods`)
    }
    
    // Prevent directory traversal
    if (userId.includes('..') || userId.includes('./') || userId.includes('/') || userId.includes('\\')) {
      throw new Error('User ID cannot contain path traversal sequences')
    }
  }

}
