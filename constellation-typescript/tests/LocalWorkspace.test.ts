import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { LocalBackend } from '../src/backends/LocalBackend.js'
import { FileSystemError } from '../src/types.js'
import type { LocalWorkspace } from '../src/workspace/LocalWorkspace.js'

describe('LocalWorkspace', () => {
  let backend: LocalBackend
  let workspace: LocalWorkspace
  const testUserId = 'test-workspace-user'

  beforeEach(async () => {
    backend = new LocalBackend({
      userId: testUserId,
      type: 'local',
      shell: 'bash',
      validateUtils: false,
      preventDangerous: true
    })

    workspace = (await backend.getWorkspace('test-workspace')) as LocalWorkspace
  })

  afterEach(async () => {
    await backend.destroy()
  })

  describe('properties', () => {
    it('should have correct workspaceName', () => {
      expect(workspace.workspaceName).toBe('test-workspace')
    })

    it('should have correct userId', () => {
      expect(workspace.userId).toBe(testUserId)
    })

    it('should have valid workspacePath', () => {
      expect(workspace.workspacePath).toBeDefined()
      expect(workspace.workspacePath).toContain(testUserId)
      expect(workspace.workspacePath).toContain('test-workspace')
    })

    it('should reference backend', () => {
      expect(workspace.backend).toBe(backend)
    })
  })

  describe('exec', () => {
    it('should execute simple commands', async () => {
      const result = await workspace.exec('echo "hello"')
      expect(result).toBe('hello')
    })

    it('should execute commands in workspace directory', async () => {
      const pwd = await workspace.exec('pwd')
      expect(pwd).toBe(workspace.workspacePath)
    })

    it('should reject empty commands', async () => {
      await expect(workspace.exec('')).rejects.toThrow('Command cannot be empty')
      await expect(workspace.exec('   ')).rejects.toThrow('Command cannot be empty')
    })

    it('should handle command failures', async () => {
      await expect(workspace.exec('exit 1')).rejects.toThrow(FileSystemError)
    })

    it('should support piping and shell features', async () => {
      await workspace.write('test1.txt', 'line1\nline2\nline3')
      const result = await workspace.exec('cat test1.txt | grep line2')
      expect(result).toBe('line2')
    })
  })

  describe('read', () => {
    it('should read file content', async () => {
      await workspace.write('read-test.txt', 'test content')
      const content = await workspace.read('read-test.txt')

      expect(content).toBe('test content')
    })

    it('should reject absolute paths', async () => {
      await expect(workspace.read('/etc/passwd')).rejects.toThrow('Absolute paths are not allowed')
    })

    it('should reject parent traversal', async () => {
      await expect(workspace.read('../../../etc/passwd')).rejects.toThrow('Path escapes workspace')
    })

    it('should throw when file does not exist', async () => {
      await expect(workspace.read('nonexistent.txt')).rejects.toThrow()
    })

    it('should read files in subdirectories', async () => {
      await workspace.mkdir('subdir')
      await workspace.write('subdir/nested.txt', 'nested content')

      const content = await workspace.read('subdir/nested.txt')
      expect(content).toBe('nested content')
    })

    it('should handle empty files', async () => {
      await workspace.write('empty.txt', '')
      const content = await workspace.read('empty.txt')

      expect(content).toBe('')
    })
  })

  describe('write', () => {
    it('should write file content', async () => {
      await workspace.write('write-test.txt', 'new content')
      const content = await workspace.read('write-test.txt')

      expect(content).toBe('new content')
    })

    it('should overwrite existing files', async () => {
      await workspace.write('overwrite.txt', 'original')
      await workspace.write('overwrite.txt', 'updated')

      const content = await workspace.read('overwrite.txt')
      expect(content).toBe('updated')
    })

    it('should reject absolute paths', async () => {
      await expect(workspace.write('/tmp/bad.txt', 'content')).rejects.toThrow('Absolute paths are not allowed')
    })

    it('should reject parent traversal', async () => {
      await expect(workspace.write('../escape.txt', 'content')).rejects.toThrow('Path escapes workspace')
    })

    it('should create parent directories if they exist', async () => {
      await workspace.mkdir('parent')
      await workspace.write('parent/child.txt', 'nested write')

      const content = await workspace.read('parent/child.txt')
      expect(content).toBe('nested write')
    })

    it('should handle unicode content', async () => {
      const unicodeContent = 'Hello World'
      await workspace.write('unicode.txt', unicodeContent)

      const content = await workspace.read('unicode.txt')
      expect(content).toBe(unicodeContent)
    })

    it('should handle multiline content', async () => {
      const multiline = 'line1\nline2\nline3'
      await workspace.write('multiline.txt', multiline)

      const content = await workspace.read('multiline.txt')
      expect(content).toBe(multiline)
    })
  })

  describe('mkdir', () => {
    it('should create directory', async () => {
      await workspace.mkdir('new-dir')
      const result = await workspace.exec('test -d new-dir && echo "exists"')

      expect(result).toBe('exists')
    })

    it('should create nested directories recursively by default', async () => {
      await workspace.mkdir('parent/child/grandchild')
      const result = await workspace.exec('test -d parent/child/grandchild && echo "exists"')

      expect(result).toBe('exists')
    })

    it('should not fail if directory already exists', async () => {
      await workspace.mkdir('existing')
      await expect(workspace.mkdir('existing')).resolves.not.toThrow()
    })

    it('should reject absolute paths', async () => {
      await expect(workspace.mkdir('/tmp/bad')).rejects.toThrow('Absolute paths are not allowed')
    })

    it('should reject parent traversal', async () => {
      await expect(workspace.mkdir('../escape')).rejects.toThrow('Path escapes workspace')
    })
  })

  describe('touch', () => {
    it('should create empty file', async () => {
      await workspace.touch('touched.txt')
      const content = await workspace.read('touched.txt')

      expect(content).toBe('')
    })

    it('should create file in subdirectory', async () => {
      await workspace.mkdir('subdir')
      await workspace.touch('subdir/file.txt')

      const content = await workspace.read('subdir/file.txt')
      expect(content).toBe('')
    })

    it('should not overwrite existing file content', async () => {
      await workspace.write('existing.txt', 'original content')
      await workspace.touch('existing.txt')

      const content = await workspace.read('existing.txt')
      expect(content).toBe('original content')
    })

    it('should reject absolute paths', async () => {
      await expect(workspace.touch('/tmp/bad.txt')).rejects.toThrow('Absolute paths are not allowed')
    })

    it('should reject parent traversal', async () => {
      await expect(workspace.touch('../escape.txt')).rejects.toThrow('Path escapes workspace')
    })
  })

  describe('exists', () => {
    it('should return true for existing workspace', async () => {
      const exists = await workspace.exists()
      expect(exists).toBe(true)
    })

    it('should return false after deletion', async () => {
      await workspace.delete()
      const exists = await workspace.exists()

      expect(exists).toBe(false)
    })
  })

  describe('delete', () => {
    it('should delete workspace directory', async () => {
      const tempWorkspace = (await backend.getWorkspace('temp-delete')) as LocalWorkspace
      await tempWorkspace.write('test.txt', 'content')

      expect(await tempWorkspace.exists()).toBe(true)

      await tempWorkspace.delete()

      expect(await tempWorkspace.exists()).toBe(false)
    })

    it('should delete workspace with nested content', async () => {
      const tempWorkspace = (await backend.getWorkspace('temp-nested')) as LocalWorkspace

      await tempWorkspace.mkdir('dir1/dir2/dir3')
      await tempWorkspace.write('dir1/file1.txt', 'content1')
      await tempWorkspace.write('dir1/dir2/file2.txt', 'content2')
      await tempWorkspace.write('dir1/dir2/dir3/file3.txt', 'content3')

      await tempWorkspace.delete()

      expect(await tempWorkspace.exists()).toBe(false)
    })
  })

  describe('list', () => {
    it('should list files and directories', async () => {
      await workspace.write('file1.txt', 'content1')
      await workspace.write('file2.txt', 'content2')
      await workspace.mkdir('dir1')

      const items = await workspace.list()

      expect(items).toContain('file1.txt')
      expect(items).toContain('file2.txt')
      expect(items).toContain('dir1')
    })

    it('should return empty array for empty workspace', async () => {
      const emptyWorkspace = (await backend.getWorkspace('empty-list')) as LocalWorkspace

      const items = await emptyWorkspace.list()

      expect(items).toEqual([])
    })

    it('should not list items from parent directories', async () => {
      await workspace.write('workspace-file.txt', 'content')

      const items = await workspace.list()

      // Should only contain items in this workspace
      expect(items).toContain('workspace-file.txt')
      expect(items.every(item => !item.includes('..'))).toBe(true)
    })
  })

  describe('security and isolation', () => {
    it('should prevent symlink escape attempts', async () => {
      // Try to create symlink to parent directory
      await expect(
        workspace.exec('ln -s ../../ escape-link')
      ).resolves.toBeDefined() // Command succeeds

      // But reading through the symlink should be blocked
      await expect(workspace.read('escape-link/etc/passwd')).rejects.toThrow()
    })

    it('should validate all paths before operations', async () => {
      const dangerousPaths = [
        '/etc/passwd',
        '../../../etc/passwd',
        '~/secrets',
      ]

      for (const path of dangerousPaths) {
        await expect(workspace.read(path)).rejects.toThrow()
        await expect(workspace.write(path, 'bad')).rejects.toThrow()
      }
    })

    it('should maintain workspace isolation across operations', async () => {
      const ws1 = (await backend.getWorkspace('isolated-1')) as LocalWorkspace
      const ws2 = (await backend.getWorkspace('isolated-2')) as LocalWorkspace

      await ws1.write('secret.txt', 'ws1 secret')
      await ws2.write('secret.txt', 'ws2 secret')

      const ws1Content = await ws1.read('secret.txt')
      const ws2Content = await ws2.read('secret.txt')

      expect(ws1Content).toBe('ws1 secret')
      expect(ws2Content).toBe('ws2 secret')
    })
  })

  describe('error handling', () => {
    it('should wrap errors with FileSystemError', async () => {
      try {
        await workspace.read('nonexistent.txt')
      } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError)
        expect((error as FileSystemError).errorCode).toBe('READ_FAILED')
      }
    })

    it('should not double-wrap FileSystemError', async () => {
      try {
        await workspace.read('/etc/passwd')
      } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError)
        // Should be the original FileSystemError, not wrapped again
      }
    })

    it('should include operation context in errors', async () => {
      try {
        await workspace.read('missing.txt')
      } catch (error) {
        expect(error).toBeInstanceOf(FileSystemError)
        const fsError = error as FileSystemError
        expect(fsError.message).toContain('Read file failed')
      }
    })
  })

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      await workspace.write('exists-test.txt', 'content')
      const exists = await workspace.fileExists('exists-test.txt')
      expect(exists).toBe(true)
    })

    it('should return false for non-existent file', async () => {
      const exists = await workspace.fileExists('nonexistent.txt')
      expect(exists).toBe(false)
    })

    it('should return true for existing directory', async () => {
      await workspace.mkdir('test-dir')
      const exists = await workspace.fileExists('test-dir')
      expect(exists).toBe(true)
    })

    it('should return true for nested files', async () => {
      await workspace.mkdir('parent')
      await workspace.write('parent/child.txt', 'nested')
      const exists = await workspace.fileExists('parent/child.txt')
      expect(exists).toBe(true)
    })

    it('should return false for path escape attempts', async () => {
      const exists = await workspace.fileExists('../../../etc/passwd')
      expect(exists).toBe(false)
    })

    it('should validate empty paths', async () => {
      await expect(workspace.fileExists('')).rejects.toThrow('Path cannot be empty')
    })
  })

  describe('readdir', () => {
    it('should read directory contents', async () => {
      await workspace.mkdir('dir-test')
      await workspace.write('dir-test/file1.txt', 'content1')
      await workspace.write('dir-test/file2.txt', 'content2')

      const files = await workspace.readdir('dir-test')
      expect(files).toHaveLength(2)
      expect(files).toContain('file1.txt')
      expect(files).toContain('file2.txt')
    })

    it('should read directory with withFileTypes option', async () => {
      await workspace.mkdir('types-test')
      await workspace.write('types-test/file.txt', 'content')
      await workspace.mkdir('types-test/subdir')

      const entries = await workspace.readdir('types-test', { withFileTypes: true })
      expect(entries).toHaveLength(2)

      const dirents = entries as import('fs').Dirent[]
      const file = dirents.find(e => e.name === 'file.txt')
      const dir = dirents.find(e => e.name === 'subdir')

      expect(file?.isFile()).toBe(true)
      expect(dir?.isDirectory()).toBe(true)
    })

    it('should read nested directory', async () => {
      await workspace.mkdir('parent/child')
      await workspace.write('parent/child/nested.txt', 'nested')

      const files = await workspace.readdir('parent/child')
      expect(files).toContain('nested.txt')
    })

    it('should throw for non-existent directory', async () => {
      await expect(workspace.readdir('nonexistent')).rejects.toThrow(FileSystemError)
    })

    it('should reject absolute paths', async () => {
      await expect(workspace.readdir('/etc')).rejects.toThrow('Path escapes workspace')
    })

    it('should validate empty paths', async () => {
      await expect(workspace.readdir('')).rejects.toThrow('Path cannot be empty')
    })
  })

  describe('readFile', () => {
    it('should read file contents', async () => {
      await workspace.write('readfile-test.txt', 'test content')
      const content = await workspace.readFile('readfile-test.txt')
      expect(content).toBe('test content')
    })

    it('should read file with encoding', async () => {
      await workspace.write('encoding-test.txt', 'encoded content')
      const content = await workspace.readFile('encoding-test.txt', 'utf-8')
      expect(content).toBe('encoded content')
    })

    it('should read nested files', async () => {
      await workspace.mkdir('nested')
      await workspace.write('nested/file.txt', 'nested content')
      const content = await workspace.readFile('nested/file.txt')
      expect(content).toBe('nested content')
    })

    it('should throw for non-existent file', async () => {
      await expect(workspace.readFile('nonexistent.txt')).rejects.toThrow(FileSystemError)
    })

    it('should reject absolute paths', async () => {
      await expect(workspace.readFile('/etc/passwd')).rejects.toThrow('Path escapes workspace')
    })

    it('should validate empty paths', async () => {
      await expect(workspace.readFile('')).rejects.toThrow('Path cannot be empty')
    })
  })

  describe('writeFile', () => {
    it('should write file contents', async () => {
      await workspace.writeFile('writefile-test.txt', 'new content')
      const content = await workspace.read('writefile-test.txt')
      expect(content).toBe('new content')
    })

    it('should write file with encoding', async () => {
      await workspace.writeFile('encoding-write.txt', 'encoded write', 'utf-8')
      const content = await workspace.read('encoding-write.txt')
      expect(content).toBe('encoded write')
    })

    it('should create parent directories automatically', async () => {
      await workspace.writeFile('auto-dir/file.txt', 'auto content')
      const content = await workspace.read('auto-dir/file.txt')
      expect(content).toBe('auto content')
    })

    it('should overwrite existing files', async () => {
      await workspace.writeFile('overwrite.txt', 'original')
      await workspace.writeFile('overwrite.txt', 'updated')
      const content = await workspace.read('overwrite.txt')
      expect(content).toBe('updated')
    })

    it('should reject absolute paths', async () => {
      await expect(workspace.writeFile('/tmp/test.txt', 'content')).rejects.toThrow('Path escapes workspace')
    })

    it('should validate empty paths', async () => {
      await expect(workspace.writeFile('', 'content')).rejects.toThrow('Path cannot be empty')
    })
  })

  describe('stat', () => {
    it('should return stats for file', async () => {
      await workspace.write('stat-file.txt', 'test content')
      const stats = await workspace.stat('stat-file.txt')

      expect(stats.isFile()).toBe(true)
      expect(stats.isDirectory()).toBe(false)
      expect(stats.size).toBeGreaterThan(0)
    })

    it('should return stats for directory', async () => {
      await workspace.mkdir('stat-dir')
      const stats = await workspace.stat('stat-dir')

      expect(stats.isDirectory()).toBe(true)
      expect(stats.isFile()).toBe(false)
    })

    it('should return stats for nested files', async () => {
      await workspace.mkdir('nested')
      await workspace.write('nested/file.txt', 'nested content')
      const stats = await workspace.stat('nested/file.txt')

      expect(stats.isFile()).toBe(true)
      expect(stats.size).toBe(14) // "nested content" is 14 bytes
    })

    it('should throw for non-existent file', async () => {
      await expect(workspace.stat('nonexistent.txt')).rejects.toThrow(FileSystemError)
    })

    it('should reject absolute paths', async () => {
      await expect(workspace.stat('/etc/passwd')).rejects.toThrow('Absolute paths are not allowed')
    })

    it('should reject parent traversal', async () => {
      await expect(workspace.stat('../../../etc/passwd')).rejects.toThrow('Path escapes workspace')
    })

    it('should validate empty paths', async () => {
      await expect(workspace.stat('')).rejects.toThrow('Path cannot be empty')
    })

    it('should include modification time', async () => {
      await workspace.write('mtime-test.txt', 'content')
      const stats = await workspace.stat('mtime-test.txt')

      expect(stats.mtime).toBeInstanceOf(Date)
      expect(stats.mtime.getTime()).toBeLessThanOrEqual(Date.now())
    })

    it('should work with fileExists for checking file type', async () => {
      await workspace.write('type-test.txt', 'file')
      await workspace.mkdir('type-dir')

      const fileExists = await workspace.fileExists('type-test.txt')
      const dirExists = await workspace.fileExists('type-dir')

      expect(fileExists).toBe(true)
      expect(dirExists).toBe(true)

      const fileStats = await workspace.stat('type-test.txt')
      const dirStats = await workspace.stat('type-dir')

      expect(fileStats.isFile()).toBe(true)
      expect(dirStats.isDirectory()).toBe(true)
    })
  })

  describe('integration tests', () => {
    it('should support complete workflow', async () => {
      // Create directory structure
      await workspace.mkdir('src/utils')

      // Create files
      await workspace.write('src/index.ts', 'export * from "./utils"')
      await workspace.write('src/utils/helper.ts', 'export const help = true')

      // Read files
      const indexContent = await workspace.read('src/index.ts')
      expect(indexContent).toBe('export * from "./utils"')

      // List files
      const srcItems = await workspace.exec('find src -type f')
      expect(srcItems).toContain('src/index.ts')
      expect(srcItems).toContain('src/utils/helper.ts')

      // Execute commands
      const fileCount = await workspace.exec('find src -type f | wc -l')
      expect(parseInt(fileCount.trim())).toBe(2)
    })

    it('should handle concurrent operations', async () => {
      const operations = []

      for (let i = 0; i < 10; i++) {
        operations.push(workspace.write(`file-${i}.txt`, `content ${i}`))
      }

      await Promise.all(operations)

      const items = await workspace.list()
      expect(items.length).toBeGreaterThanOrEqual(10)

      for (let i = 0; i < 10; i++) {
        const content = await workspace.read(`file-${i}.txt`)
        expect(content).toBe(`content ${i}`)
      }
    })
  })
})
