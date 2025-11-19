import { join } from 'path'
import type { ConnectConfig } from 'ssh2'
import { Client } from 'ssh2'
import { ERROR_CODES } from '../constants.js'
import { isCommandSafe, isDangerous } from '../safety.js'
import { DangerousOperationError, FileSystemError } from '../types.js'
import { getLogger } from '../utils/logger.js'
import { getPlatformGuidance, getRemoteBackendLibrary } from '../utils/nativeLibrary.js'
import { RemoteWorkspaceUtils } from '../utils/RemoteWorkspaceUtils.js'
import { RemoteWorkspace } from '../workspace/RemoteWorkspace.js'
import type { Workspace, WorkspaceConfig } from '../workspace/Workspace.js'
import type { FileSystemBackend, RemoteBackendConfig } from './types.js'

/**
 * Remote filesystem backend implementation using SSH
 * Provides remote command execution via SSH connection
 *
 * Manages multiple workspaces for a single user
 */
export class RemoteBackend implements FileSystemBackend {
  public readonly type = 'remote' as const
  public readonly userId: string
  public readonly options: RemoteBackendConfig
  public connected: boolean
  private sshClient: Client | null = null
  private interceptLibPath: string | null = null
  private isConnected = false
  private connectionPromise: Promise<void> | null = null
  private workspaceCache = new Map<string, RemoteWorkspace>()

  /**
   * Create a new RemoteBackend instance
   * @param options - Configuration for remote backend
   * @throws {FileSystemError} When platform is not supported
   */
  constructor(options: RemoteBackendConfig) {
    this.options = options
    this.userId = options.userId

    // Validate userId for security
    RemoteWorkspaceUtils.validateUserId(options.userId)

    // Check platform support and locate native library
    const guidance = getPlatformGuidance('remote')
    if (!guidance.supported) {
      const suggestions = guidance.suggestions.join('\n  ')
      throw new FileSystemError(
        guidance.message || 'Remote backend not supported on this platform',
        ERROR_CODES.BACKEND_NOT_IMPLEMENTED,
        `Suggestions:\n  ${suggestions}`
      )
    }

    // Locate the LD_PRELOAD intercept library using platform detection
    if (process.env.USE_LD_PRELOAD === 'true') {
      this.interceptLibPath = getRemoteBackendLibrary()
      if (!this.interceptLibPath) {
        const suggestions = guidance.suggestions.join('\n  ')
        throw new FileSystemError(
          'Native library required for remote backend but not found',
          ERROR_CODES.BACKEND_NOT_IMPLEMENTED,
          `Suggestions:\n  ${suggestions}`
        )
      }
    }

    // Initialize SSH client
    this.initSSHClient()

    // Connection will be established on first use
    this.connected = false
  }
  
  /**
   * Initialize SSH client
   */
  private initSSHClient(): void {
    try {
      this.sshClient = new Client()
    } catch (error) {
      getLogger().warn('SSH2 module not available, remote operations may be limited', error)
    }
  }
  
  /**
   * Extract username from auth configuration
   */
  private getUserFromAuth(): string {
    const auth = this.options.auth
    if (auth.type === 'password' && auth.credentials.username) {
      return auth.credentials.username as string
    } else if (auth.type === 'key' && auth.credentials.username) {
      return auth.credentials.username as string
    }
    // Default to current user
    return process.env.USER || 'root'
  }
  
  /**
   * Parse host:port format into separate host and port
   */
  private parseHostPort(hostString: string): { host: string; port: number } {
    const parts = hostString.split(':')
    if (parts.length === 2) {
      const host = parts[0]
      const port = parseInt(parts[1], 10)
      if (!isNaN(port)) {
        return { host, port }
      }
    }
    // Default to port 22 if no port specified or invalid
    return { host: hostString, port: 22 }
  }

  /**
   * Get host and port from options or environment variable
   */
  private getHostAndPortFromEnv(): { host: string; port: number } {
    // Fall back to environment variable
    const remoteHost = process.env.REMOTE_VM_HOST
    if (!remoteHost) {
      throw new FileSystemError(
        'REMOTE_VM_HOST environment variable is required for remote backend',
        ERROR_CODES.BACKEND_NOT_IMPLEMENTED,
        'Set REMOTE_VM_HOST=user@hostname:port before running'
      )
    }
    
    // Parse user@host:port format
    const parts = remoteHost.split('@')
    if (parts.length !== 2) {
      throw new FileSystemError(
        'REMOTE_VM_HOST must be in format user@hostname:port',
        ERROR_CODES.BACKEND_NOT_IMPLEMENTED,
        `Invalid format: ${remoteHost}`
      )
    }
    
    const hostPart = parts[1] // hostname:port
    return this.parseHostPort(hostPart)
  }

  /**
   * Validate custom environment variables for security
   * @param customEnv - Custom environment variables to validate
   * @returns Validated environment variables
   */
  private validateCustomEnv(customEnv: Record<string, string>): Record<string, string> {
    const BLOCKED_VARS = [
      'LD_PRELOAD',
      'LD_LIBRARY_PATH',
      'DYLD_INSERT_LIBRARIES',
      'DYLD_LIBRARY_PATH',
      'IFS',
      'BASH_ENV',
      'ENV',
    ]

    const PROTECTED_VARS = ['PATH', 'HOME', 'PWD', 'TMPDIR', 'TMP', 'SHELL', 'USER']

    const validated: Record<string, string> = {}

    for (const [key, value] of Object.entries(customEnv)) {
      // Block dangerous variables
      if (BLOCKED_VARS.includes(key)) {
        getLogger().warn(`Blocked dangerous environment variable: ${key}`)
        continue
      }

      // Warn about protected variables (allow but log)
      if (PROTECTED_VARS.includes(key)) {
        getLogger().warn(`Overriding protected environment variable: ${key}`)
      }

      // Validate value doesn't contain null bytes or shell injection attempts
      if (value.includes('\0') || value.includes('\n') || value.includes(';')) {
        throw new FileSystemError(
          `Environment variable ${key} contains dangerous characters`,
          ERROR_CODES.INVALID_CONFIGURATION
        )
      }

      validated[key] = value
    }

    return validated
  }

  /**
   * Build environment variable prefix for SSH commands
   * @param customEnv - Optional custom environment variables
   * @returns Shell command prefix with environment variables
   */
  private buildEnvPrefix(customEnv?: Record<string, string>): string {
    if (!customEnv || Object.keys(customEnv).length === 0) {
      return ''
    }

    const validatedEnv = this.validateCustomEnv(customEnv)
    const envPairs: string[] = []

    for (const [key, value] of Object.entries(validatedEnv)) {
      // Escape single quotes in values and wrap in single quotes
      const escapedValue = value.replace(/'/g, "'\\''")
      envPairs.push(`${key}='${escapedValue}'`)
    }

    return envPairs.length > 0 ? `${envPairs.join(' ')} ` : ''
  }

  /**
   * Execute command in a specific workspace path (internal use by Workspace)
   * @param workspacePath - Absolute path to workspace directory
   * @param command - Command to execute
   * @param encoding - Output encoding (currently only 'utf8' supported for remote)
   * @param customEnv - Optional custom environment variables
   * @returns Promise resolving to command output
   */
  async execInWorkspace(
    workspacePath: string,
    command: string,
    _encoding: 'utf8' | 'buffer' = 'utf8',
    customEnv?: Record<string, string>
  ): Promise<string | Buffer> {
    // Safety check
    const safetyCheck = isCommandSafe(command)
    if (!safetyCheck.safe) {
      if (this.options.preventDangerous && isDangerous(command)) {
        if (this.options.onDangerousOperation) {
          this.options.onDangerousOperation(command)
          return ''
        } else {
          throw new DangerousOperationError(command)
        }
      }

      throw new FileSystemError(
        safetyCheck.reason || 'Command failed safety check',
        ERROR_CODES.DANGEROUS_OPERATION,
        command
      )
    }

    if (!this.sshClient) {
      throw new FileSystemError('SSH client not initialized', ERROR_CODES.EXEC_FAILED)
    }

    // Ensure SSH connection is established
    await this.ensureSSHConnection()

    return new Promise((resolve, reject) => {
      if (!this.sshClient) {
        throw new FileSystemError('SSH client not initialized', ERROR_CODES.EXEC_FAILED)
      }

      // Build environment variable prefix
      const envPrefix = this.buildEnvPrefix(customEnv)

      // Build full command with environment variables and workspace change
      const fullCommand =
        workspacePath && workspacePath !== '/'
          ? `${envPrefix}cd "${workspacePath}" && ${command}`
          : `${envPrefix}${command}`

      getLogger().debug(`[SSH exec] Executing command: ${fullCommand}`)

      this.sshClient.exec(fullCommand, (err, stream) => {
        if (err) {
          getLogger().error(`[SSH exec] Command failed in workspace: ${workspacePath}, cwd: ${workspacePath}`, err)
          reject(
            new FileSystemError(`SSH command failed: ${err.message}`, ERROR_CODES.EXEC_FAILED, command)
          )
          return
        }

        let stdout = ''
        let stderr = ''

        stream.on('data', (data: Buffer) => {
          const chunk = data.toString()
          getLogger().debug(`[SSH stdout] ${chunk.trim()}`)
          stdout += chunk
        })

        stream.stderr.on('data', (data: Buffer) => {
          const chunk = data.toString()
          getLogger().debug(`[SSH stderr] ${chunk.trim()}`)
          stderr += chunk
        })

        stream.on('close', (code: number) => {
          if (code === 0) {
            let output = stdout.trim()

            // Apply output length limit if configured
            if (this.options.maxOutputLength && output.length > this.options.maxOutputLength) {
              const truncatedLength = this.options.maxOutputLength - 50
              output = `${output.substring(0, truncatedLength)}\n\n... [Output truncated. Full output was ${output.length} characters, showing first ${truncatedLength}]`
            }

            resolve(output)
          } else {
            getLogger().error(`Command failed in workspace: ${workspacePath}, cwd: ${workspacePath}, exit code: ${code}`)
            reject(
              new FileSystemError(
                `Command failed with exit code ${code}: ${stderr.trim() || stdout.trim()}`,
                ERROR_CODES.EXEC_FAILED,
                command
              )
            )
          }
        })
      })
    })
  }
  
  /**
   * Ensure SSH connection is established
   */
  private async ensureSSHConnection(): Promise<void> {
    if (!this.sshClient) {
      throw new FileSystemError('SSH client not initialized', ERROR_CODES.EXEC_FAILED)
    }
    
    // If already connected, return immediately
    if (this.isConnected) {
      return Promise.resolve()
    }
    
    // If connection is in progress, wait for it
    if (this.connectionPromise) {
      return this.connectionPromise
    }
    
    // Start new connection
    this.connectionPromise = this.connectSSH()
    return this.connectionPromise
  }
  
  /**
   * Connect to SSH server
   */
  private async connectSSH(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.sshClient) {
        throw new FileSystemError('SSH client not initialized', ERROR_CODES.EXEC_FAILED)
      }
      const auth = this.options.auth
      const { host, port } = this.getHostAndPortFromEnv()
      const connectOptions: ConnectConfig = {
        host,
        port,
        username: this.getUserFromAuth(),
        debug: (message) => getLogger().debug(`[ConstellationFS] ${message}`)
      }
      
      if (auth.type === 'password') {
        connectOptions.password = auth.credentials.password as string
      } else if (auth.type === 'key') {
        connectOptions.privateKey = auth.credentials.privateKey as string
        if (auth.credentials.passphrase) {
          connectOptions.passphrase = auth.credentials.passphrase as string
        }
      }
      
      this.sshClient.on('ready', () => {
        this.isConnected = true
        this.connectionPromise = null
        getLogger().debug('[ConstellationFS] SSH connection ready')
        resolve()
      })
      
      this.sshClient.on('close', () => {
        this.isConnected = false
        this.connectionPromise = null
        getLogger().debug('SSH connection closed')
      })
      
      this.sshClient.on('error', (err) => {
        this.isConnected = false
        this.connectionPromise = null
        reject(err)
      })
      
      this.sshClient.connect(connectOptions)
    })
  }

  /**
   * Get or create a workspace for this user
   * @param workspaceName - Workspace name (defaults to 'default')
   * @param config - Optional workspace configuration including custom environment variables
   * @returns Promise resolving to Workspace instance
   */
  async getWorkspace(workspaceName = 'default', config?: WorkspaceConfig): Promise<Workspace> {
    // Ensure SSH connection
    await this.ensureSSHConnection()

    // Generate cache key that includes env config
    const cacheKey = config?.env ? `${workspaceName}:${JSON.stringify(config.env)}` : workspaceName

    if (this.workspaceCache.has(cacheKey)) {
      return this.workspaceCache.get(cacheKey)!
    }

    if (!this.sshClient) {
      throw new FileSystemError('SSH client not initialized', ERROR_CODES.EXEC_FAILED)
    }

    // Create workspace directory for this user on remote system using static utility
    const fullPath = await RemoteWorkspaceUtils.ensureUserWorkspace(
      this.sshClient,
      join(this.userId, workspaceName)
    )

    const workspace = new RemoteWorkspace(this, this.userId, workspaceName, fullPath, config)
    this.workspaceCache.set(cacheKey, workspace)

    getLogger().debug(
      `Created remote workspace for user ${this.userId}: ${workspaceName}`,
      config?.env ? 'with custom env' : ''
    )

    return workspace
  }

  /**
   * List all workspaces for this user
   * @returns Promise resolving to array of workspace paths
   */
  async listWorkspaces(): Promise<string[]> {
    await this.ensureSSHConnection()

    const userRoot = RemoteWorkspaceUtils.getUserWorkspacePath(this.userId)

    // List directories via SSH
    return this.listDirectory(userRoot)
  }

  /**
   * Public helper methods for RemoteWorkspace
   */

  async readFile(remotePath: string): Promise<Buffer>
  async readFile(remotePath: string, encoding: BufferEncoding): Promise<string>
  async readFile(remotePath: string, encoding?: BufferEncoding): Promise<string | Buffer> {
    await this.ensureSSHConnection()

    if (!this.sshClient) {
      throw new FileSystemError('SSH client not initialized', ERROR_CODES.READ_FAILED)
    }

    return new Promise((resolve, reject) => {
      if (!this.sshClient) {
        throw new FileSystemError('SSH client not initialized', ERROR_CODES.READ_FAILED)
      }
      this.sshClient.sftp((err, sftp) => {
        if (err) {
          reject(this.wrapError(err, 'SFTP session', ERROR_CODES.READ_FAILED, `read ${remotePath}`, remotePath))
          return
        }

        if (encoding) {
          // Read as string with specified encoding
          sftp.readFile(remotePath, encoding, (err, data) => {
            if (err) {
              reject(this.wrapError(err, 'Read file', ERROR_CODES.READ_FAILED, `read ${remotePath}`, remotePath))
            } else {
              resolve(Buffer.isBuffer(data) ? data.toString(encoding) : data)
            }
          })
        } else {
          // Read as Buffer (no encoding)
          sftp.readFile(remotePath, (err, data) => {
            if (err) {
              reject(this.wrapError(err, 'Read file', ERROR_CODES.READ_FAILED, `read ${remotePath}`, remotePath))
            } else {
              resolve(data)
            }
          })
        }
      })
    })
  }

  async writeFile(remotePath: string, content: string | Buffer): Promise<void> {
    await this.ensureSSHConnection()

    if (!this.sshClient) {
      throw new FileSystemError('SSH client not initialized', ERROR_CODES.WRITE_FAILED)
    }

    return new Promise((resolve, reject) => {
      if (!this.sshClient) {
        throw new FileSystemError('SSH client not initialized', ERROR_CODES.WRITE_FAILED)
      }
      this.sshClient.sftp((err, sftp) => {
        if (err) {
          reject(this.wrapError(err, 'SFTP session', ERROR_CODES.WRITE_FAILED, `write ${remotePath}`, remotePath))
          return
        }

        // Handle Buffer or string content differently
        if (Buffer.isBuffer(content)) {
          sftp.writeFile(remotePath, content, (err) => {
            if (err) {
              reject(this.wrapError(err, 'Write file', ERROR_CODES.WRITE_FAILED, `write ${remotePath}`, remotePath))
            } else {
              resolve()
            }
          })
        } else {
          sftp.writeFile(remotePath, content, 'utf8', (err) => {
            if (err) {
              reject(this.wrapError(err, 'Write file', ERROR_CODES.WRITE_FAILED, `write ${remotePath}`, remotePath))
            } else {
              resolve()
            }
          })
        }
      })
    })
  }

  async createDirectory(remotePath: string, recursive: boolean): Promise<void> {
    await this.ensureSSHConnection()

    if (!this.sshClient) {
      throw new FileSystemError('SSH client not initialized', ERROR_CODES.WRITE_FAILED)
    }

    if (recursive) {
      // Use mkdir -p for recursive directory creation
      return new Promise((resolve, reject) => {
        if (!this.sshClient) {
          throw new FileSystemError('SSH client not initialized', ERROR_CODES.WRITE_FAILED)
        }
        this.sshClient.exec(`mkdir -p "${remotePath}"`, (err, stream) => {
          if (err) {
            reject(this.wrapError(err, 'Create directory', ERROR_CODES.WRITE_FAILED, `mkdir ${remotePath}`, remotePath))
            return
          }

          stream
            .on('close', (code: number) => {
              if (code === 0) {
                resolve()
              } else {
                getLogger().error(`Failed to create directory for path: ${remotePath}`)
                reject(
                  new FileSystemError(
                    `Failed to create directory: ${remotePath}`,
                    ERROR_CODES.WRITE_FAILED,
                    `mkdir ${remotePath}`
                  )
                )
              }
            })
            .on('data', () => {
              // Consume stdout
            })
            .stderr.on('data', () => {
              // Consume stderr
            })
        })
      })
    } else {
      return new Promise((resolve, reject) => {
        if (!this.sshClient) {
          throw new FileSystemError('SSH client not initialized', ERROR_CODES.WRITE_FAILED)
        }
        this.sshClient.sftp((err, sftp) => {
          if (err) {
            reject(this.wrapError(err, 'SFTP session', ERROR_CODES.WRITE_FAILED, `mkdir ${remotePath}`, remotePath))
            return
          }

          sftp.mkdir(remotePath, (err) => {
            if (err) {
              reject(this.wrapError(err, 'Create directory', ERROR_CODES.WRITE_FAILED, `mkdir ${remotePath}`, remotePath))
            } else {
              resolve()
            }
          })
        })
      })
    }
  }

  async touchFile(remotePath: string): Promise<void> {
    await this.ensureSSHConnection()

    if (!this.sshClient) {
      throw new FileSystemError('SSH client not initialized', ERROR_CODES.WRITE_FAILED)
    }

    return new Promise((resolve, reject) => {
      if (!this.sshClient) {
        throw new FileSystemError('SSH client not initialized', ERROR_CODES.WRITE_FAILED)
      }

      // Use touch command for creating empty files
      this.sshClient.exec(`touch "${remotePath}"`, (err, stream) => {
        if (err) {
          reject(this.wrapError(err, 'Create file', ERROR_CODES.WRITE_FAILED, `touch ${remotePath}`, remotePath))
          return
        }

        stream
          .on('close', (code: number) => {
            if (code === 0) {
              resolve()
            } else {
              getLogger().error(`Failed to create file for path: ${remotePath}`)
              reject(
                new FileSystemError(
                  `Failed to create file: ${remotePath}`,
                  ERROR_CODES.WRITE_FAILED,
                  `touch ${remotePath}`
                )
              )
            }
          })
          .on('data', () => {
            // Consume stdout
          })
          .stderr.on('data', () => {
            // Consume stderr
          })
      })
    })
  }

  async directoryExists(remotePath: string): Promise<boolean> {
    await this.ensureSSHConnection()

    if (!this.sshClient) {
      return false
    }

    return new Promise((resolve) => {
      if (!this.sshClient) {
        resolve(false)
        return
      }
      this.sshClient.exec(`test -d "${remotePath}"`, (err, stream) => {
        if (err) {
          resolve(false)
          return
        }

        stream.on('close', (code: number) => {
          // test command returns 0 if directory exists, 1 if it doesn't
          resolve(code === 0)
        })
      })
    })
  }

  async pathExists(remotePath: string): Promise<boolean> {
    await this.ensureSSHConnection()

    if (!this.sshClient) {
      return false
    }

    return new Promise((resolve) => {
      if (!this.sshClient) {
        resolve(false)
        return
      }
      this.sshClient.exec(`test -e "${remotePath}"`, (err, stream) => {
        if (err) {
          resolve(false)
          return
        }

        stream.on('close', (code: number) => {
          // test command returns 0 if file/directory exists, 1 if it doesn't
          resolve(code === 0)
        })
      })
    })
  }

  async pathStat(remotePath: string): Promise<import('fs').Stats> {
    await this.ensureSSHConnection()

    if (!this.sshClient) {
      throw new FileSystemError('SSH client not initialized', ERROR_CODES.READ_FAILED)
    }

    return new Promise((resolve, reject) => {
      if (!this.sshClient) {
        throw new FileSystemError('SSH client not initialized', ERROR_CODES.READ_FAILED)
      }

      this.sshClient.sftp((err, sftp) => {
        if (err) {
          reject(this.wrapError(err, 'SFTP session', ERROR_CODES.READ_FAILED, `stat ${remotePath}`, remotePath))
          return
        }

        sftp.stat(remotePath, (err, stats) => {
          if (err) {
            reject(this.wrapError(err, 'Stat file', ERROR_CODES.READ_FAILED, `stat ${remotePath}`, remotePath))
          } else {
            // SSH2 Stats type is compatible with fs.Stats for most use cases
            // Cast through unknown to handle type incompatibility
            resolve(stats as unknown as import('fs').Stats)
          }
        })
      })
    })
  }

  async deleteDirectory(remotePath: string): Promise<void> {
    await this.ensureSSHConnection()

    if (!this.sshClient) {
      throw new FileSystemError('SSH client not initialized', ERROR_CODES.WRITE_FAILED)
    }

    return new Promise((resolve, reject) => {
      if (!this.sshClient) {
        throw new FileSystemError('SSH client not initialized', ERROR_CODES.WRITE_FAILED)
      }

      this.sshClient.exec(`rm -rf "${remotePath}"`, (err, stream) => {
        if (err) {
          reject(this.wrapError(err, 'Delete directory', ERROR_CODES.WRITE_FAILED, `rm -rf ${remotePath}`, remotePath))
          return
        }

        stream.on('close', (code: number) => {
          if (code === 0) {
            resolve()
          } else {
            getLogger().error(`Failed to delete directory for path: ${remotePath}`)
            reject(
              new FileSystemError(
                `Failed to delete directory: ${remotePath}`,
                ERROR_CODES.WRITE_FAILED,
                `rm -rf ${remotePath}`
              )
            )
          }
        })
      })
    })
  }

  async listDirectory(remotePath: string): Promise<string[]> {
    await this.ensureSSHConnection()

    if (!this.sshClient) {
      return []
    }

    return new Promise((resolve, reject) => {
      if (!this.sshClient) {
        resolve([])
        return
      }
      this.sshClient.exec(`ls -1 "${remotePath}"`, (err, stream) => {
        if (err) {
          reject(this.wrapError(err, 'List directory', ERROR_CODES.READ_FAILED, `ls ${remotePath}`, remotePath))
          return
        }

        let stdout = ''
        stream.on('data', (data: Buffer) => {
          stdout += data.toString()
        })

        stream.on('close', (code: number) => {
          if (code === 0) {
            resolve(stdout.trim().split('\n').filter(Boolean))
          } else {
            // Directory doesn't exist or is empty
            resolve([])
          }
        })
      })
    })
  }
  
  /**
   * Wrap errors consistently
   */
  private wrapError(
    error: unknown,
    operation: string,
    errorCode: string,
    command?: string,
    remotePath?: string,
  ): FileSystemError {
    if (error instanceof FileSystemError) {
      return error
    }

    const message = error instanceof Error
      ? error.message
      : 'Unknown error occurred'

    // Log the error with path context
    if (remotePath) {
      getLogger().error(`${operation} failed for path: ${remotePath}${command ? `, command: ${command}` : ''}`, error)
    } else if (command) {
      getLogger().error(`${operation} failed, command: ${command}`, error)
    } else {
      getLogger().error(`${operation} failed`, error)
    }

    return new FileSystemError(
      `${operation} failed: ${message}`,
      errorCode,
      command,
    )
  }
  
  /**
   * Clean up resources on destruction
   */
  async destroy(): Promise<void> {
    // Clear workspace cache
    this.workspaceCache.clear()

    // Close SSH connection
    if (this.sshClient) {
      this.sshClient.end()
      this.sshClient = null
      this.isConnected = false
      this.connectionPromise = null
    }

    getLogger().debug(`RemoteBackend destroyed for user: ${this.userId}`)
  }
}
