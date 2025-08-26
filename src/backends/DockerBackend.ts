import { 
  DockerBackendConfig, 
  FileInfo,
  FileSystemBackend, 
  FileSystemError
} from '../types.js'
import { ERROR_CODES } from '../constants.js'

/**
 * Stub implementation for Docker-based filesystem backend  
 * Will provide containerized execution for enhanced security and isolation in a future release
 */
export class DockerBackend implements FileSystemBackend {
  public readonly workspace: string
  public readonly options: DockerBackendConfig

  /**
   * Create a new DockerBackend instance
   * @param options - Configuration for Docker backend
   * @throws {FileSystemError} Always throws as this backend is not yet implemented
   */
  constructor(options: DockerBackendConfig) {
    this.options = options
    this.workspace = options.workspace

    throw new FileSystemError(
      'Docker backend is not yet implemented. ' +
      'Please use the local backend for development. ' +
      'Docker backend support is planned for a future release and will provide ' +
      'containerized execution for enhanced security and isolation.',
      ERROR_CODES.BACKEND_NOT_IMPLEMENTED
    )
  }

  async exec(_command: string): Promise<string> {
    throw new FileSystemError('Docker backend not implemented', ERROR_CODES.BACKEND_NOT_IMPLEMENTED)
  }

  async read(_path: string): Promise<string> {
    throw new FileSystemError('Docker backend not implemented', ERROR_CODES.BACKEND_NOT_IMPLEMENTED)
  }

  async write(_path: string, _content: string): Promise<void> {
    throw new FileSystemError('Docker backend not implemented', ERROR_CODES.BACKEND_NOT_IMPLEMENTED)
  }

  // eslint-disable-next-line no-dupe-class-members
  async ls(_patternOrOptions?: string | { details: true }): Promise<string[] | FileInfo[]>
  // eslint-disable-next-line no-dupe-class-members
  async ls(_pattern: string, _options: { details: true }): Promise<FileInfo[]>
  // eslint-disable-next-line no-dupe-class-members
  async ls(): Promise<string[] | FileInfo[]> {
    throw new FileSystemError('Docker backend not implemented', ERROR_CODES.BACKEND_NOT_IMPLEMENTED)
  }
}