import { EventEmitter } from 'events'
import type { Client, ClientChannel } from 'ssh2'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConstellationFS } from '../src/config/Config.js'
import { RemoteWorkspaceManager } from '../src/utils/RemoteWorkspaceManager.js'

// Mock SSH stream that extends EventEmitter
class MockSSHStream extends EventEmitter {
  stderr = new EventEmitter()
  stdout = new EventEmitter()

  // Simulate successful command completion
  simulateSuccess() {
    setTimeout(() => {
      this.emit('close', 0)
    }, 10)
  }

  // Simulate failed command completion
  simulateFailure(stderr = 'Command failed') {
    setTimeout(() => {
      this.stderr.emit('data', Buffer.from(stderr))
      this.emit('close', 1)
    }, 10)
  }
}

// Mock SSH Client
class MockSSHClient extends EventEmitter {
  private execCallback: ((command: string) => MockSSHStream) | null = null

  exec(
    command: string,
    callback: (err: Error | null, stream: ClientChannel) => void
  ): void {
    if (this.execCallback) {
      const stream = this.execCallback(command)
      callback(null, stream as unknown as ClientChannel)
    } else {
      // Default: simulate success
      const stream = new MockSSHStream()
      callback(null, stream as unknown as ClientChannel)
      stream.simulateSuccess()
    }
  }

  // Test helper to control exec behavior
  mockExec(callback: (command: string) => MockSSHStream) {
    this.execCallback = callback
  }

  // Test helper to simulate exec errors
  mockExecError(error: Error) {
    this.exec = (
      _command: string,
      callback: (err: Error | null, stream: ClientChannel) => void
    ) => {
      callback(error, null as unknown as ClientChannel)
    }
  }
}

describe('RemoteWorkspaceManager', () => {
  let mockClient: MockSSHClient
  let manager: RemoteWorkspaceManager

  beforeEach(() => {
    // Reset ConstellationFS singleton
    ConstellationFS.reset()

    // Create mock SSH client
    mockClient = new MockSSHClient()
    manager = new RemoteWorkspaceManager(mockClient as unknown as Client)
  })

  afterEach(() => {
    ConstellationFS.reset()
    vi.clearAllMocks()
  })

  describe('getUserWorkspacePath', () => {
    it('should return correct workspace path for user', () => {
      const userPath = 'test-remote-user'
      const workspacePath = RemoteWorkspaceManager.getUserWorkspacePath(userPath)

      expect(workspacePath).toContain('test-remote-user')
      expect(workspacePath).toContain('constellation-fs')
    })

    it('should use POSIX path separator for remote paths', () => {
      const userPath = 'test-remote-user'
      const workspacePath = RemoteWorkspaceManager.getUserWorkspacePath(userPath)

      // Should use forward slashes for remote POSIX paths
      expect(workspacePath).toMatch(/\//)
    })

    it('should include app ID in workspace path', () => {
      const userPath = 'test-remote-user'
      const workspacePath = RemoteWorkspaceManager.getUserWorkspacePath(userPath)

      // Should include the test app ID from vitest config
      expect(workspacePath).toContain('test-app')
    })
  })

  describe('ensureUserWorkspace', () => {
    it('should execute mkdir command on remote system', async () => {
      let executedCommand = ''

      mockClient.mockExec((command) => {
        executedCommand = command
        const stream = new MockSSHStream()
        stream.simulateSuccess()
        return stream
      })

      const userPath = 'test-remote-user'
      await manager.ensureUserWorkspace(userPath)

      expect(executedCommand).toContain('mkdir -p')
      expect(executedCommand).toContain('test-remote-user')
    })

    it('should return workspace path on successful creation', async () => {
      mockClient.mockExec(() => {
        const stream = new MockSSHStream()
        stream.simulateSuccess()
        return stream
      })

      const userPath = 'test-remote-user'
      const workspacePath = await manager.ensureUserWorkspace(userPath)

      expect(workspacePath).toContain('test-remote-user')
      expect(workspacePath).toContain('constellation-fs')
    })

    it('should reject if SSH exec fails', async () => {
      mockClient.mockExecError(new Error('SSH connection failed'))

      const userPath = 'test-remote-user'

      await expect(manager.ensureUserWorkspace(userPath)).rejects.toThrow(
        'Failed to create remote workspace: SSH connection failed'
      )
    })

    it('should reject if remote command fails with non-zero exit code', async () => {
      mockClient.mockExec(() => {
        const stream = new MockSSHStream()
        stream.simulateFailure('Permission denied')
        return stream
      })

      const userPath = 'test-remote-user'

      await expect(manager.ensureUserWorkspace(userPath)).rejects.toThrow(
        /Failed to create remote workspace.*exit code 1/
      )
    })

    it('should handle timeout for hanging commands', async () => {
      mockClient.mockExec(() => {
        // Return stream but never emit close/exit events
        const stream = new MockSSHStream()
        // Don't call simulateSuccess or simulateFailure
        return stream
      })

      const userPath = 'test-remote-user'

      // Should resolve due to timeout fallback
      const workspacePath = await manager.ensureUserWorkspace(userPath)
      expect(workspacePath).toBeDefined()
    }, 10000) // Increase test timeout
  })

  describe('workspaceExists', () => {
    it('should execute test command on remote system', async () => {
      let executedCommand = ''

      mockClient.mockExec((command) => {
        executedCommand = command
        const stream = new MockSSHStream()
        stream.simulateSuccess()
        return stream
      })

      const userPath = 'test-remote-user'
      await manager.workspaceExists(userPath)

      expect(executedCommand).toContain('test -d')
      expect(executedCommand).toContain('test-remote-user')
    })

    it('should return true if directory exists (exit code 0)', async () => {
      mockClient.mockExec(() => {
        const stream = new MockSSHStream()
        stream.simulateSuccess() // Exit code 0
        return stream
      })

      const userPath = 'test-remote-user'
      const exists = await manager.workspaceExists(userPath)

      expect(exists).toBe(true)
    })

    it('should return false if directory does not exist (exit code 1)', async () => {
      mockClient.mockExec(() => {
        const stream = new MockSSHStream()
        stream.simulateFailure() // Exit code 1
        return stream
      })

      const userPath = 'test-remote-user'
      const exists = await manager.workspaceExists(userPath)

      expect(exists).toBe(false)
    })

    it('should reject if SSH exec fails', async () => {
      mockClient.mockExecError(new Error('SSH connection lost'))

      const userPath = 'test-remote-user'

      await expect(manager.workspaceExists(userPath)).rejects.toThrow(
        'Failed to check remote workspace: SSH connection lost'
      )
    })
  })

  describe('validateWorkspacePath', () => {
    it('should accept valid workspace paths', () => {
      const validPaths = [
        'valid-user',
        'user123',
        'user_name',
        'user-name',
        'user.name',
        'User123',
        'a',
        '123',
      ]

      for (const path of validPaths) {
        expect(() => RemoteWorkspaceManager.validateWorkspacePath(path)).not.toThrow()
      }
    })

    it('should reject empty or whitespace-only paths', () => {
      const invalidPaths = ['', ' ', '  ', '\t', '\n']

      for (const path of invalidPaths) {
        expect(() => RemoteWorkspaceManager.validateWorkspacePath(path)).toThrow(
          'Workspace path cannot be empty'
        )
      }
    })

    it('should reject paths with invalid characters', () => {
      const invalidPaths = [
        'user@name',
        'user#name',
        'user name', // space
        'user!name',
      ]

      for (const path of invalidPaths) {
        expect(() => RemoteWorkspaceManager.validateWorkspacePath(path)).toThrow(
          /can only contain letters, numbers, hyphens, underscores, and periods/
        )
      }
    })

    it('should reject path traversal attempts', () => {
      const traversalPaths = [
        '..',
        '../user',
        'user/..',
        './user',
        'user/subdir',
        '/absolute',
        'user\\windows',
      ]

      for (const path of traversalPaths) {
        // Should throw an error (either for invalid chars or path traversal)
        expect(() => RemoteWorkspaceManager.validateWorkspacePath(path)).toThrow()
      }
    })
  })

  describe('validateUserId', () => {
    it('should accept valid user IDs', () => {
      const validIds = [
        'valid-user',
        'user123',
        'user_name',
        'user-name',
        'user.name',
        'User123',
      ]

      for (const userId of validIds) {
        expect(() => RemoteWorkspaceManager.validateUserId(userId)).not.toThrow()
      }
    })

    it('should reject empty or whitespace-only user IDs', () => {
      const invalidIds = ['', ' ', '  ', '\t']

      for (const userId of invalidIds) {
        expect(() => RemoteWorkspaceManager.validateUserId(userId)).toThrow(
          'User ID cannot be empty'
        )
      }
    })

    it('should reject user IDs with invalid characters', () => {
      const invalidIds = [
        'user@domain',
        'user#123',
        'user name',
        'user!',
      ]

      for (const userId of invalidIds) {
        expect(() => RemoteWorkspaceManager.validateUserId(userId)).toThrow(
          /can only contain letters, numbers, hyphens, underscores, and periods/
        )
      }
    })

    it('should reject user IDs with path traversal', () => {
      const traversalIds = [
        '..',
        '../admin',
        'user/../admin',
        './user',
        'user/admin',
        '/root',
        'user\\admin',
      ]

      for (const userId of traversalIds) {
        // Should throw an error (either for invalid chars or path traversal)
        expect(() => RemoteWorkspaceManager.validateUserId(userId)).toThrow()
      }
    })
  })

  describe('Integration with ConstellationFS config', () => {
    it('should use configured workspace root', () => {
      const config = ConstellationFS.getInstance()
      const userPath = 'test-remote-user'

      const workspacePath = RemoteWorkspaceManager.getUserWorkspacePath(userPath)

      expect(workspacePath).toContain(config.workspaceRoot)
    })

    it('should create workspaces under app ID directory', async () => {
      let executedCommand = ''

      mockClient.mockExec((command) => {
        executedCommand = command
        const stream = new MockSSHStream()
        stream.simulateSuccess()
        return stream
      })

      const userPath = 'test-remote-user'
      await manager.ensureUserWorkspace(userPath)

      // Path structure should be: workspaceRoot/appId/userId
      expect(executedCommand).toContain('test-app')
      expect(executedCommand).toContain('test-remote-user')
    })
  })
})
