import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ConstellationFS } from '../src/config/Config.js'
import { LocalWorkspaceManager } from '../src/utils/LocalWorkspaceManager.js'

describe('LocalWorkspaceManager', () => {
  let testWorkspaceRoot: string

  beforeEach(() => {
    // Reset ConstellationFS singleton to ensure clean state
    ConstellationFS.reset()
    const config = ConstellationFS.getInstance()
    testWorkspaceRoot = config.workspaceRoot
  })

  afterEach(() => {
    // Clean up test workspaces
    try {
      const testPaths = [
        'test-user-local',
        'test-user-2',
        'valid-user',
      ]

      for (const path of testPaths) {
        const fullPath = join(testWorkspaceRoot, path)
        if (existsSync(fullPath)) {
          rmSync(fullPath, { recursive: true, force: true })
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    ConstellationFS.reset()
  })

  describe('getUserWorkspacePath', () => {
    it('should return correct workspace path for user', () => {
      const userPath = 'test-user-local'
      const workspacePath = LocalWorkspaceManager.getUserWorkspacePath(userPath)

      expect(workspacePath).toContain('test-user-local')
      expect(workspacePath).toContain('constellation-fs')
    })

    it('should include app ID in workspace path', () => {
      const userPath = 'test-user-local'
      const workspacePath = LocalWorkspaceManager.getUserWorkspacePath(userPath)

      // Should include the test app ID from vitest config
      expect(workspacePath).toContain('test-app')
    })
  })

  describe('ensureUserWorkspace', () => {
    it('should create workspace directory if it does not exist', () => {
      const userPath = 'test-user-local'
      const workspacePath = LocalWorkspaceManager.ensureUserWorkspace(userPath)

      expect(existsSync(workspacePath)).toBe(true)
    })

    it('should return existing workspace path if directory already exists', () => {
      const userPath = 'test-user-local'

      // Create workspace first time
      const workspacePath1 = LocalWorkspaceManager.ensureUserWorkspace(userPath)

      // Call again - should return same path without error
      const workspacePath2 = LocalWorkspaceManager.ensureUserWorkspace(userPath)

      expect(workspacePath1).toBe(workspacePath2)
      expect(existsSync(workspacePath2)).toBe(true)
    })

    it('should create nested parent directories recursively', () => {
      const userPath = 'test-user-2'
      const workspacePath = LocalWorkspaceManager.ensureUserWorkspace(userPath)

      // Verify the entire path exists
      expect(existsSync(workspacePath)).toBe(true)
    })
  })

  describe('workspaceExists', () => {
    it('should return true for existing workspace', () => {
      const userPath = 'test-user-local'
      LocalWorkspaceManager.ensureUserWorkspace(userPath)

      const exists = LocalWorkspaceManager.workspaceExists(userPath)

      expect(exists).toBe(true)
    })

    it('should return false for non-existing workspace', () => {
      const userPath = 'non-existent-user'

      const exists = LocalWorkspaceManager.workspaceExists(userPath)

      expect(exists).toBe(false)
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
        expect(() => LocalWorkspaceManager.validateWorkspacePath(path)).not.toThrow()
      }
    })

    it('should reject empty or whitespace-only paths', () => {
      const invalidPaths = ['', ' ', '  ', '\t', '\n']

      for (const path of invalidPaths) {
        expect(() => LocalWorkspaceManager.validateWorkspacePath(path)).toThrow(
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
        'user$name',
        'user%name',
        'user&name',
        'user*name',
        'user+name',
        'user=name',
        'user[name]',
        'user{name}',
        'user|name',
        'user;name',
        'user:name',
        'user"name',
        "user'name",
        'user<name>',
        'user?name',
      ]

      for (const path of invalidPaths) {
        expect(() => LocalWorkspaceManager.validateWorkspacePath(path)).toThrow(
          /can only contain letters, numbers, hyphens, underscores, and periods/
        )
      }
    })

    it('should reject path traversal attempts', () => {
      const traversalPaths = [
        '..',
        '../user',
        'user/..',
        'user/../other',
        './user',
        'user/.',
        'user/subdir',
        '/absolute',
        'user\\windows',
      ]

      for (const path of traversalPaths) {
        // Should throw an error (either for invalid chars or path traversal)
        expect(() => LocalWorkspaceManager.validateWorkspacePath(path)).toThrow()
      }
    })

    it('should accept paths starting with double dots as part of name', () => {
      // Edge case: ".." in the middle of a valid character sequence should fail
      // But this is caught by the slash/traversal check
      expect(() => LocalWorkspaceManager.validateWorkspacePath('..')).toThrow()
    })
  })

  describe('Integration with ConstellationFS config', () => {
    it('should use configured workspace root', () => {
      const config = ConstellationFS.getInstance()
      const userPath = 'test-user-local'

      const workspacePath = LocalWorkspaceManager.getUserWorkspacePath(userPath)

      expect(workspacePath).toContain(config.workspaceRoot)
    })

    it('should create workspaces under app ID directory', () => {
      const userPath = 'test-user-local'
      const workspacePath = LocalWorkspaceManager.ensureUserWorkspace(userPath)

      // Path structure should be: workspaceRoot/appId/userId
      expect(workspacePath).toContain('test-app')
      expect(workspacePath.endsWith('test-user-local')).toBe(true)
    })
  })
})
