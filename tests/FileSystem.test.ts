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
      
      const files = await fs.ls()
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
})