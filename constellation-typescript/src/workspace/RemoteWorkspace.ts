import type { Dirent, Stats } from 'fs'
import type { RemoteBackend } from '../backends/RemoteBackend.js'
import { ERROR_CODES } from '../constants.js'
import { FileSystemError } from '../types.js'
import { BaseWorkspace, type WorkspaceConfig } from './Workspace.js'

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
    workspacePath: string,
    config?: WorkspaceConfig
  ) {
    super(backend, userId, workspaceName, workspacePath, config)
  }

  async exec(command: string, encoding: 'utf8' | 'buffer' = 'utf8'): Promise<string | Buffer> {
    if (!command.trim()) {
      throw new FileSystemError('Command cannot be empty', ERROR_CODES.EMPTY_COMMAND)
    }

    // Use RemoteBackend's SSH execution method
    // (This is a RemoteBackend-specific method, not part of the FileSystemBackend interface)
    return this.backend.execInWorkspace(this.workspacePath, command, encoding, this.customEnv)
  }

  async read(path: string): Promise<string> {
    this.validatePath(path)
    const remotePath = this.resolvePath(path)

    // Use SFTP to read file
    return this.backend.readFile(remotePath)
  }

  async write(path: string, content: string): Promise<void> {
    this.validatePath(path)
    const remotePath = this.resolvePath(path)

    // Use SFTP to write file
    return this.backend.writeFile(remotePath, content)
  }

  async mkdir(path: string, recursive = true): Promise<void> {
    this.validatePath(path)
    const remotePath = this.resolvePath(path)

    // Use SSH exec to create directory
    return this.backend.createDirectory(remotePath, recursive)
  }

  async touch(path: string): Promise<void> {
    this.validatePath(path)
    const remotePath = this.resolvePath(path)

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

  // Synchronous methods are not supported for remote workspaces
  // These are required by the Workspace interface for Codebuff compatibility
  // but remote operations are inherently asynchronous
  existsSync(_path: string): boolean {
    throw new FileSystemError(
      'Synchronous operations are not supported for remote workspaces',
      ERROR_CODES.INVALID_CONFIGURATION
    )
  }

  mkdirSync(_path: string, _options?: { recursive?: boolean }): void {
    throw new FileSystemError(
      'Synchronous operations are not supported for remote workspaces',
      ERROR_CODES.INVALID_CONFIGURATION
    )
  }

  readdirSync(_path: string, _options?: { withFileTypes?: boolean }): string[] | Dirent[] {
    throw new FileSystemError(
      'Synchronous operations are not supported for remote workspaces',
      ERROR_CODES.INVALID_CONFIGURATION
    )
  }

  readFileSync(_path: string, _encoding?: NodeJS.BufferEncoding): string {
    throw new FileSystemError(
      'Synchronous operations are not supported for remote workspaces',
      ERROR_CODES.INVALID_CONFIGURATION
    )
  }

  statSync(_path: string): Stats {
    throw new FileSystemError(
      'Synchronous operations are not supported for remote workspaces',
      ERROR_CODES.INVALID_CONFIGURATION
    )
  }

  writeFileSync(_path: string, _content: string, _encoding?: NodeJS.BufferEncoding): void {
    throw new FileSystemError(
      'Synchronous operations are not supported for remote workspaces',
      ERROR_CODES.INVALID_CONFIGURATION
    )
  }

  // Promises API for Codebuff compatibility
  promises = {
    readdir: async (path: string, options?: { withFileTypes?: boolean }): Promise<string[] | Dirent[]> => {
      this.validatePath(path)
      const remotePath = this.resolvePath(path)

      if (options?.withFileTypes) {
        // Remote backend doesn't support withFileTypes, so we need to throw
        throw new FileSystemError(
          'withFileTypes option is not supported for remote workspaces',
          ERROR_CODES.INVALID_CONFIGURATION
        )
      }

      return this.backend.listDirectory(remotePath)
    }
  }
}
