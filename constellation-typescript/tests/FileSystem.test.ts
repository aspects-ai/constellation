import { existsSync } from 'fs'
import { mkdir, rmdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DangerousOperationError, FileSystem } from '../src/index.js'

describe('FileSystem', () => {
  const testWorkspace = join(process.cwd(), 'test-workspace')

  beforeEach(async () => {
    // Create test workspace
    if (!existsSync(testWorkspace)) {
      await mkdir(testWorkspace, { recursive: true })
    }
  })

  afterEach(async () => {
    // Clean up test workspace
    if (existsSync(testWorkspace)) {
      await rmdir(testWorkspace, { recursive: true })
    }
  })

  describe('Basic Operations', () => {
    it('should create FileSystem with userId', () => {
      const fs = new FileSystem({ userId: 'test-user' })
      expect(fs.userId).toBe('test-user')
      expect(fs.config.preventDangerous).toBe(true)
    })

    it('should execute simple commands', async () => {
      const fs = new FileSystem({ userId: 'testuser' })
      const workspace = await fs.getWorkspace()
      const result = await workspace.exec('echo "hello world"')
      expect(result).toBe('hello world')
    })

    it('should read and write files', async () => {
      const fs = new FileSystem({ userId: 'testuser' })
      const workspace = await fs.getWorkspace()
      const testContent = 'Hello, ConstellationFS!'

      await workspace.write('test.txt', testContent)
      const content = await workspace.read('test.txt')

      expect(content).toBe(testContent)
    })

    it('should list files', async () => {
      const fs = new FileSystem({ userId: 'testuser' })
      const workspace = await fs.getWorkspace()

      // Create some test files using the workspace API
      await workspace.write('file1.txt', 'content1')
      await workspace.write('file2.txt', 'content2')

      const result = await workspace.exec('ls')
      const files = result.split('\n').filter(Boolean)
      expect(files).toContain('file1.txt')
      expect(files).toContain('file2.txt')
    })
  })

  describe('Safety Features', () => {
    it('should block dangerous operations by default', async () => {
      const fs = new FileSystem({ userId: 'testuser' })
      const workspace = await fs.getWorkspace()

      await expect(workspace.exec('rm -rf /')).rejects.toThrow(DangerousOperationError)
    })

    it('should call onDangerousOperation callback when provided', async () => {
      let calledWith: string | undefined

      const fs = new FileSystem({
        userId: 'testuser',
        type: 'local',
        shell: 'bash',
        validateUtils: false,
        preventDangerous: true,
        onDangerousOperation: (command: string) => {
          calledWith = command
        }
      })

      const workspace = await fs.getWorkspace()
      const result = await workspace.exec('sudo something')
      expect(result).toBe('')
      expect(calledWith).toBe('sudo something')
    })
  })

  describe('Workspace Management', () => {
    it('should get workspace with custom name', async () => {
      const fs = new FileSystem({ userId: 'testuser' })
      const workspace = await fs.getWorkspace('custom-subdir')

      // Workspace should contain both userId and workspacePath
      expect(workspace.userId).toBe('testuser')
      expect(workspace.workspacePath).toBe('custom-subdir')
      expect(workspace.path).toContain('testuser')
      expect(workspace.path).toContain('custom-subdir')
    })

    it('should allow read/write operations in custom workspace', async () => {
      const fs = new FileSystem({ userId: 'testuser' })
      const workspace = await fs.getWorkspace('project-a')

      const testContent = 'Test content in custom workspace'
      await workspace.write('custom-test.txt', testContent)
      const content = await workspace.read('custom-test.txt')

      expect(content).toBe(testContent)
    })

    it('should isolate workspaces with different names', async () => {
      const fs = new FileSystem({ userId: 'testuser' })
      const ws1 = await fs.getWorkspace('workspace-1')
      const ws2 = await fs.getWorkspace('workspace-2')

      // Write to first workspace
      await ws1.write('isolated-file.txt', 'Content in workspace 1')

      // Verify workspaces are different
      expect(ws1.path).not.toBe(ws2.path)

      // Second workspace should not have the file
      await expect(ws2.read('isolated-file.txt')).rejects.toThrow()
    })

    it('should support nested directory paths in workspace name', async () => {
      const fs = new FileSystem({ userId: 'testuser' })
      const workspace = await fs.getWorkspace('projects/2024/my-app')

      expect(workspace.path).toContain('projects/2024/my-app')

      // Should be able to perform operations
      await workspace.write('nested-test.txt', 'Nested workspace test')
      const content = await workspace.read('nested-test.txt')
      expect(content).toBe('Nested workspace test')
    })

    it('should work with default workspace', async () => {
      const fs = new FileSystem({ userId: 'testuser' })
      const workspace = await fs.getWorkspace()

      // Should use default workspace name
      expect(workspace.workspacePath).toBe('default')

      // Should still work normally
      await workspace.write('default-workspace.txt', 'Default workspace test')
      const content = await workspace.read('default-workspace.txt')
      expect(content).toBe('Default workspace test')
    })

    it('should allow mkdir and touch in workspace', async () => {
      const fs = new FileSystem({ userId: 'testuser' })
      const workspace = await fs.getWorkspace('project-b')

      // Create directory structure
      await workspace.mkdir('src/utils')
      await workspace.touch('src/utils/helper.ts')

      // Verify directory and file exist
      const lsResult = await workspace.exec('find . -type f')
      expect(lsResult).toContain('src/utils/helper.ts')
    })

    it('should execute commands in the workspace directory', async () => {
      const fs = new FileSystem({ userId: 'testuser' })
      const workspace = await fs.getWorkspace('execution-test')

      // Get the current working directory from the command
      const pwd = await workspace.exec('pwd')

      // Should contain the workspace path
      expect(pwd).toContain('testuser')
      expect(pwd).toContain('execution-test')
    })
  })
})