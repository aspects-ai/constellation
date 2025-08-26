import { 
  FileInfo, 
  FileSystemBackend,
  FileSystemError, 
  RemoteBackendConfig
} from '../types.js'
import { ERROR_CODES } from '../constants.js'

/**
 * Stub implementation for remote filesystem backend
 * Will provide SSH-based remote command execution and file operations in a future release
 */
export class RemoteBackend implements FileSystemBackend {
  public readonly workspace: string
  public readonly options: RemoteBackendConfig

  /**
   * Create a new RemoteBackend instance
   * @param options - Configuration for remote backend
   * @throws {FileSystemError} Always throws as this backend is not yet implemented
   */
  constructor(options: RemoteBackendConfig) {
    this.options = options
    this.workspace = options.workspace

    throw new FileSystemError(
      'Remote backend is not yet implemented. ' +
      'Please use the local backend for development or the Docker backend for isolation. ' +
      'Remote backend support is planned for a future release.',
      ERROR_CODES.BACKEND_NOT_IMPLEMENTED
    )
  }

  async exec(_command: string): Promise<string> {
    throw new FileSystemError('Remote backend not implemented', ERROR_CODES.BACKEND_NOT_IMPLEMENTED)
  }

  async read(_path: string): Promise<string> {
    throw new FileSystemError('Remote backend not implemented', ERROR_CODES.BACKEND_NOT_IMPLEMENTED)
  }

  async write(_path: string, _content: string): Promise<void> {
    throw new FileSystemError('Remote backend not implemented', ERROR_CODES.BACKEND_NOT_IMPLEMENTED)
  }

  // eslint-disable-next-line no-dupe-class-members
  async ls(_patternOrOptions?: string | { details: true }): Promise<string[] | FileInfo[]>
  // eslint-disable-next-line no-dupe-class-members
  async ls(_pattern: string, _options: { details: true }): Promise<FileInfo[]>
  // eslint-disable-next-line no-dupe-class-members
  async ls(): Promise<string[] | FileInfo[]> {
    throw new FileSystemError('Remote backend not implemented', ERROR_CODES.BACKEND_NOT_IMPLEMENTED)
  }
}