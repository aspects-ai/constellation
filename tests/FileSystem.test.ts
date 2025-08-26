import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, rmdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { FileSystem, FileSystemError, DangerousOperationError } from '../src/index.js'

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
    it('should create FileSystem with string workspace', () => {
      const fs = new FileSystem(testWorkspace)
      expect(fs.workspace).toBe(testWorkspace)
      expect(fs.options.preventDangerous).toBe(true)
    })

    it('should execute simple commands', async () => {
      const fs = new FileSystem(testWorkspace)
      const result = await fs.exec('echo "hello world"')
      expect(result).toBe('hello world')
    })

    it('should read and write files', async () => {
      const fs = new FileSystem(testWorkspace)
      const testContent = 'Hello, ConstellationFS!'
      
      await fs.write('test.txt', testContent)
      const content = await fs.read('test.txt')
      
      expect(content).toBe(testContent)
    })

    it('should list files', async () => {
      const fs = new FileSystem(testWorkspace)
      
      // Create some test files
      await writeFile(join(testWorkspace, 'file1.txt'), 'content1')
      await writeFile(join(testWorkspace, 'file2.txt'), 'content2')
      
      const files = await fs.ls()
      expect(files).toContain('file1.txt')
      expect(files).toContain('file2.txt')
    })
  })

  describe('Safety Features', () => {
    it('should block dangerous operations by default', async () => {
      const fs = new FileSystem(testWorkspace)
      
      await expect(fs.exec('rm -rf /')).rejects.toThrow(DangerousOperationError)
    })

    it('should call onDangerousOperation callback when provided', async () => {
      let calledWith: string | undefined
      
      const fs = new FileSystem({
        workspace: testWorkspace,
        onDangerousOperation: (command) => {
          calledWith = command
        }
      })
      
      const result = await fs.exec('sudo something')
      expect(result).toBe('')
      expect(calledWith).toBe('sudo something')
    })
  })
})