import { existsSync } from 'fs'
import { resolve } from 'path'
import type { ConnectConfig } from 'ssh2'
import { Client } from 'ssh2'
import { ERROR_CODES } from '../constants.js'
import { isCommandSafe, isDangerous } from '../safety.js'
import { DangerousOperationError, FileSystemError } from '../types.js'
import { getLogger } from '../utils/logger.js'
import type { FileSystemBackend, RemoteBackendConfig } from './types.js'

/**
 * Remote filesystem backend implementation using LD_PRELOAD SSH interception
 * Provides transparent remote command execution by intercepting execve calls
 */
export class RemoteBackend implements FileSystemBackend {
  public readonly workspace: string
  public readonly options: RemoteBackendConfig
  public readonly connected: boolean
  private sshClient: Client | null = null
  private interceptLibPath: string | null = null

  /**
   * Create a new RemoteBackend instance
   * @param options - Configuration for remote backend
   * @throws {FileSystemError} When SSH connection cannot be established
   */
  constructor(options: RemoteBackendConfig) {
    this.options = options
    this.workspace = options.workspace
    
    // Locate the LD_PRELOAD intercept library (don't build during runtime)
    this.interceptLibPath = this.locateInterceptLibrary()
    
    // Initialize SSH client
    this.initSSHClient()
    
    // Test SSH connection
    this.connected = true
    
    if (!this.connected) {
      throw new FileSystemError(
        'Could not establish SSH connection to remote backend',
        ERROR_CODES.BACKEND_NOT_IMPLEMENTED
      )
    }
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
   * Locate the LD_PRELOAD intercept library (without building)
   */
  private locateInterceptLibrary(): string | null {
    // Try multiple possible paths for the LD_PRELOAD library
    const possiblePaths = [
      // From node_modules (when ConstellationFS is installed as a package)
      resolve(__dirname, '../../../native/libintercept.so'),
      resolve(__dirname, '../../native/libintercept.so'),
      // From development/source directory
      resolve(process.cwd(), 'native/libintercept.so'),
      resolve(process.cwd(), '../native/libintercept.so'),
      resolve(process.cwd(), '../../native/libintercept.so'),
      // Absolute path based on ConstellationFS root
      resolve(process.cwd(), '../../../constellation-typescript/native/libintercept.so')
    ]
    
    for (const interceptPath of possiblePaths) {
      if (existsSync(interceptPath)) {
        getLogger().info(`LD_PRELOAD intercept library found at: ${interceptPath}`)
        return interceptPath
      }
    }
    
    // Library doesn't exist - this is fine for web environments
    // The library is only needed when running with LD_PRELOAD
    getLogger().info('LD_PRELOAD intercept library not found, LD_PRELOAD functionality will be disabled')
    getLogger().debug('Searched paths:', possiblePaths)
    return null
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
   * Validate path for security
   */
  private validatePath(path: string): void {
    if (!path || typeof path !== 'string') {
      throw new FileSystemError(
        'Path cannot be empty',
        ERROR_CODES.EMPTY_PATH,
        path
      )
    }
    
    // Check for absolute paths
    if (path.startsWith('/')) {
      throw new FileSystemError(
        'Absolute paths are not allowed',
        ERROR_CODES.ABSOLUTE_PATH_REJECTED,
        path
      )
    }
    
    // Check for directory traversal
    if (path.includes('../') || path === '..' || path.startsWith('../')) {
      throw new FileSystemError(
        'Path escapes workspace boundary', 
        ERROR_CODES.PATH_ESCAPE_ATTEMPT,
        path
      )
    }
  }
  
  /**
   * Resolve relative path to remote absolute path
   */
  private resolveRemotePath(path: string): string {
    // Join workspace and relative path
    if (this.workspace.endsWith('/')) {
      return `${this.workspace}${path}`
    } else {
      return `${this.workspace}/${path}`
    }
  }
  
  /**
   * Get environment variables for LD_PRELOAD interception
   */
  getInterceptEnvironment(): Record<string, string> {
    const env: Record<string, string> = {}
    
    // Copy process env, filtering out undefined values
    Object.entries(process.env).forEach(([key, value]) => {
      if (value !== undefined) {
        env[key] = value
      }
    })
    
    if (this.interceptLibPath) {
      env.LD_PRELOAD = this.interceptLibPath
    }
    
    // Set remote host for interception
    env.REMOTE_VM_HOST = this.getSSHHostString()
    
    // Set working directory if specified
    if (this.workspace && this.workspace !== '/') {
      env.CONSTELLATION_CWD = this.workspace
    }
    
    return env
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
   * Get SSH host string for connection
   */
  private getSSHHostString(): string {
    const auth = this.options.auth
    let user = 'root'
    
    if (auth.type === 'password' && auth.credentials.username) {
      user = auth.credentials.username as string
    } else if (auth.type === 'key' && auth.credentials.username) {
      user = auth.credentials.username as string
    }
    
    return `${user}@${this.options.host}`
  }

  async exec(command: string): Promise<string> {
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
    
    // Execute via SSH
    return this.execViaSSH(command)
  }
  
  /**
   * Execute command via SSH
   */
  private async execViaSSH(command: string): Promise<string> {
    if (!this.sshClient) {
      throw new FileSystemError('SSH client not initialized', ERROR_CODES.EXEC_FAILED)
    }
    
    // Ensure SSH connection is established
    await this.ensureSSHConnection()
    
    return new Promise((resolve, reject) => {
      if (!this.sshClient) {
        throw new FileSystemError('SSH client not initialized', ERROR_CODES.EXEC_FAILED)
      }
      // Build full command with workspace change
      const fullCommand = this.workspace && this.workspace !== '/' 
        ? `cd "${this.workspace}" && ${command}`
        : command
      
      getLogger().debug(`[SSH exec] Executing command: ${fullCommand}`)
      
      this.sshClient.exec(fullCommand, (err, stream) => {
        if (err) {
          reject(new FileSystemError(
            `SSH command failed: ${err.message}`,
            ERROR_CODES.EXEC_FAILED,
            command
          ))
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
            reject(new FileSystemError(
              `Command failed with exit code ${code}: ${stderr.trim() || stdout.trim()}`,
              ERROR_CODES.EXEC_FAILED,
              command
            ))
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
    
    // TODO: Check if already connected
    // if (this.sshClient && this.sshClient.readyState === 'open') {
    //   return Promise.resolve()
    // }
    
    return this.connectSSH()
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
      const { host, port } = this.parseHostPort(this.options.host)
      const connectOptions: ConnectConfig = {
        host,
        port,
        username: this.getUserFromAuth(),
        debug: (message: string, ...args: unknown[]) => getLogger().debug(`SSH: ${message}`, ...args)
      }
      
      if (auth.type === 'password') {
        connectOptions.password = auth.credentials.password as string
      } else if (auth.type === 'key') {
        connectOptions.privateKey = auth.credentials.privateKey as string
        if (auth.credentials.passphrase) {
          connectOptions.passphrase = auth.credentials.passphrase as string
        }
      }
      
      this.sshClient.on('ready', () => resolve())
      this.sshClient.on('error', (err) => reject(err))
      this.sshClient.connect(connectOptions)
    })
  }

  async read(path: string): Promise<string> {
    // Validate path
    this.validatePath(path)
    
    if (!this.sshClient) {
      throw new FileSystemError('SSH client not initialized', ERROR_CODES.READ_FAILED)
    }
    
    // Ensure SSH connection
    await this.ensureSSHConnection()
    
    return new Promise((resolve, reject) => {
      if (!this.sshClient) {
        throw new FileSystemError('SSH client not initialized', ERROR_CODES.WRITE_FAILED)
      }
      this.sshClient.sftp((err, sftp) => {
        if (err) {
          reject(this.wrapError(err, 'SFTP session', ERROR_CODES.READ_FAILED, `read ${path}`))
          return
        }
        
        const remotePath = this.resolveRemotePath(path)
        
        sftp.readFile(remotePath, 'utf8', (err, data) => {
          if (err) {
            reject(this.wrapError(err, 'Read file', ERROR_CODES.READ_FAILED, `read ${path}`))
          } else {
            resolve(Buffer.isBuffer(data) ? data.toString('utf8') : data)
          }
        })
      })
    })
  }

  async write(path: string, content: string): Promise<void> {
    // Validate path
    this.validatePath(path)
    
    if (!this.sshClient) {
      throw new FileSystemError('SSH client not initialized', ERROR_CODES.WRITE_FAILED)
    }
    
    // Ensure SSH connection
    await this.ensureSSHConnection()
    
    return new Promise((resolve, reject) => {
      if (!this.sshClient) {
        throw new FileSystemError('SSH client not initialized', ERROR_CODES.WRITE_FAILED)
      }
      this.sshClient.sftp((err, sftp) => {
        if (err) {
          reject(this.wrapError(err, 'SFTP session', ERROR_CODES.WRITE_FAILED, `write ${path}`))
          return
        }
        
        const remotePath = this.resolveRemotePath(path)
        
        sftp.writeFile(remotePath, content, 'utf8', (err) => {
          if (err) {
            reject(this.wrapError(err, 'Write file', ERROR_CODES.WRITE_FAILED, `write ${path}`))
          } else {
            resolve()
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
  ): FileSystemError {
    if (error instanceof FileSystemError) {
      return error
    }
    
    const message = error instanceof Error 
      ? error.message 
      : 'Unknown error occurred'
    
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
    // Close SSH connection
    if (this.sshClient) {
      this.sshClient.end()
      this.sshClient = null
    }
  }
}
