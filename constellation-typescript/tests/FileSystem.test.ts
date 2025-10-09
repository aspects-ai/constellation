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
      expect(fs.workspace).toContain('test-user')
      expect(fs.backendConfig.preventDangerous).toBe(true)
    })

    it('should execute simple commands', async () => {
      const fs = new FileSystem({ userId: 'testuser' })
      const result = await fs.exec('echo "hello world"')
      expect(result).toBe('hello world')
    })

    it('should read and write files', async () => {
      const fs = new FileSystem({ userId: 'testuser' })
      const testContent = 'Hello, ConstellationFS!'
      
      await fs.write('test.txt', testContent)
      const content = await fs.read('test.txt')
      
      expect(content).toBe(testContent)
    })

    it('should list files', async () => {
      const fs = new FileSystem({ userId: 'testuser' })
      
      // Create some test files using the filesystem API
      await fs.write('file1.txt', 'content1')
      await fs.write('file2.txt', 'content2')
      
      const result = await fs.exec('ls')
      const files = result.split('\n').filter(Boolean)
      expect(files).toContain('file1.txt')
      expect(files).toContain('file2.txt')
    })
  })

  describe('Safety Features', () => {
    it('should block dangerous operations by default', async () => {
      const fs = new FileSystem({ userId: 'testuser' })

      await expect(fs.exec('rm -rf /')).rejects.toThrow(DangerousOperationError)
    })

    it('should call onDangerousOperation callback when provided', async () => {
      let calledWith: string | undefined

      const fs = new FileSystem({
        userId: 'testuser',
        onDangerousOperation: (command: string) => {
          calledWith = command
        }
      })

      const result = await fs.exec('sudo something')
      expect(result).toBe('')
      expect(calledWith).toBe('sudo something')
    })
  })

  describe('Custom Workspace Path', () => {
    it('should create workspace at custom path when workspacePath is provided', () => {
      const fs = new FileSystem({
        userId: 'testuser',
        workspacePath: 'custom/subdir'
      })

      // Workspace should contain both userId and workspacePath
      expect(fs.workspace).toContain('testuser')
      expect(fs.workspace).toContain('custom/subdir')
    })

    it('should allow read/write operations in custom workspace path', async () => {
      const fs = new FileSystem({
        userId: 'testuser',
        workspacePath: 'project-a'
      })

      const testContent = 'Test content in custom workspace'
      await fs.write('custom-test.txt', testContent)
      const content = await fs.read('custom-test.txt')

      expect(content).toBe(testContent)
    })

    it('should isolate workspaces with different workspacePath values', async () => {
      const fs1 = new FileSystem({
        userId: 'testuser',
        workspacePath: 'workspace-1'
      })
      const fs2 = new FileSystem({
        userId: 'testuser',
        workspacePath: 'workspace-2'
      })

      // Write to first workspace
      await fs1.write('isolated-file.txt', 'Content in workspace 1')

      // Verify workspaces are different
      expect(fs1.workspace).not.toBe(fs2.workspace)

      // Second workspace should not have the file
      await expect(fs2.read('isolated-file.txt')).rejects.toThrow()
    })

    it('should support nested directory paths in workspacePath', async () => {
      const fs = new FileSystem({
        userId: 'testuser',
        workspacePath: 'projects/2024/my-app'
      })

      expect(fs.workspace).toContain('projects/2024/my-app')

      // Should be able to perform operations
      await fs.write('nested-test.txt', 'Nested workspace test')
      const content = await fs.read('nested-test.txt')
      expect(content).toBe('Nested workspace test')
    })

    it('should work without workspacePath (default behavior)', async () => {
      const fs = new FileSystem({ userId: 'testuser' })

      // Workspace should only contain userId, not an extra subdirectory
      expect(fs.workspace).toContain('testuser')

      // Should still work normally
      await fs.write('default-workspace.txt', 'Default workspace test')
      const content = await fs.read('default-workspace.txt')
      expect(content).toBe('Default workspace test')
    })

    it('should allow mkdir and touch in custom workspace path', async () => {
      const fs = new FileSystem({
        userId: 'testuser',
        workspacePath: 'project-b'
      })

      // Create directory structure
      await fs.mkdir('src/utils')
      await fs.touch('src/utils/helper.ts')

      // Verify directory and file exist
      const lsResult = await fs.exec('find . -type f')
      expect(lsResult).toContain('src/utils/helper.ts')
    })

    it('should execute commands in the custom workspace directory', async () => {
      const fs = new FileSystem({
        userId: 'testuser',
        workspacePath: 'execution-test'
      })

      // Get the current working directory from the command
      const pwd = await fs.exec('pwd')

      // Should contain the custom workspace path
      expect(pwd).toContain('testuser')
      expect(pwd).toContain('execution-test')
    })
  })
})