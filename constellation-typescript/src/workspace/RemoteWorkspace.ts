import type { RemoteBackend } from '../backends/RemoteBackend.js'
import { ERROR_CODES } from '../constants.js'
import { FileSystemError } from '../types.js'
import { BaseWorkspace } from './Workspace.js'

/**
 * Remote filesystem workspace implementation
 * Executes operations on a remote machine via SSH
 */
export class RemoteWorkspace extends BaseWorkspace {
  declare readonly backend: RemoteBackend

  constructor(
    backend: RemoteBackend,
    userId: string,
    workspaceName: string,
    workspacePath: string
  ) {
    super(backend, userId, workspaceName, workspacePath)
  }

  async exec(command: string): Promise<string> {
    if (!command.trim()) {
      throw new FileSystemError('Command cannot be empty', ERROR_CODES.EMPTY_COMMAND)
    }

    // Delegate to backend with this workspace's path
    return this.backend.execInWorkspace(this.workspacePath, command)
  }

  async read(path: string): Promise<string> {
    this.validatePath(path)

    // Validate path for security
    this.validateRemotePath(path)

    const remotePath = this.resolveRemotePath(path)

    // Use SFTP to read file
    return this.backend.readFile(remotePath)
  }

  async write(path: string, content: string): Promise<void> {
    this.validatePath(path)

    // Validate path for security
    this.validateRemotePath(path)

    const remotePath = this.resolveRemotePath(path)

    // Use SFTP to write file
    return this.backend.writeFile(remotePath, content)
  }

  async mkdir(path: string, recursive = true): Promise<void> {
    this.validatePath(path)

    // Validate path for security
    this.validateRemotePath(path)

    const remotePath = this.resolveRemotePath(path)

    // Use SSH exec to create directory
    return this.backend.createDirectory(remotePath, recursive)
  }

  async touch(path: string): Promise<void> {
    this.validatePath(path)

    // Validate path for security
    this.validateRemotePath(path)

    const remotePath = this.resolveRemotePath(path)

    // Use SSH exec to touch file
    return this.backend.touchFile(remotePath)
  }

  async exists(): Promise<boolean> {
    return this.backend.directoryExists(this.workspacePath)
  }

  async delete(): Promise<void> {
    // Delete the entire workspace directory
    return this.backend.deleteDirectory(this.workspacePath)
  }

  async list(): Promise<string[]> {
    return this.backend.listDirectory(this.workspacePath)
  }

  /**
   * Validate remote path for security
   */
  private validateRemotePath(path: string): void {
    if (!path || typeof path !== 'string') {
      throw new FileSystemError('Path cannot be empty', ERROR_CODES.EMPTY_PATH, path)
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

    // Validate that resolved path is within workspace
    const resolvedPath = this.resolveRemotePath(path)
    if (!resolvedPath.startsWith(this.workspacePath)) {
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
    if (this.workspacePath.endsWith('/')) {
      return `${this.workspacePath}${path}`
    } else {
      return `${this.workspacePath}/${path}`
    }
  }
}
