import type { Workspace } from '@/workspace/Workspace.js'
import type { ExecOptions, SpawnOptions } from 'child_process'
import type { FileSystem } from '../FileSystem.js'
import { BaseSDKAdapter } from './BaseAdapter.js'
import { ConstellationChildProcess } from './ConstellationChildProcess.js'

// Global state for monkey-patching
let isPatchingEnabled = false
let originalFunctions: any = null

/**
 * Adapter for Claude Code SDK that provides file system operations.
 * 
 * This adapter intercepts Node.js child_process calls to route them through
 * ConstellationFS backends, enabling remote execution while maintaining
 * full compatibility with the Claude Code SDK.
 */
export class ClaudeCodeAdapter extends BaseSDKAdapter {
  private static currentInstance: ClaudeCodeAdapter | null = null
  private static interceptedCalls = { exec: 0, spawn: 0, execSync: 0 }

  constructor(fs: FileSystem, workspace: Workspace) {
    super(fs, workspace)
    ClaudeCodeAdapter.currentInstance = this
  }

  /**
   * Get statistics about intercepted calls (for debugging/verification)
   */
  static getInterceptStats() {
    return { ...this.interceptedCalls }
  }

  /**
   * Reset intercept statistics
   */
  static resetInterceptStats() {
    this.interceptedCalls = { exec: 0, spawn: 0, execSync: 0 }
  }

  /**
   * Enable monkey-patching of child_process module to intercept commands
   * This must be called BEFORE importing the Claude Code SDK
   */
  static async enableMonkeyPatching(): Promise<void> {
    if (isPatchingEnabled) {
      console.warn('Monkey-patching already enabled')
      return
    }

    try {
      // Get the original child_process module
      const originalChildProcess = await import('child_process')
      
      // Store originals
      originalFunctions = {
        exec: originalChildProcess.exec,
        spawn: originalChildProcess.spawn,
        execSync: originalChildProcess.execSync
      }

      // Create our intercepted versions
      const interceptedExec = function(
        command: string,
        optionsOrCallback?: ExecOptions | ((error: Error | null, stdout: string, stderr: string) => void),
        callback?: (error: Error | null, stdout: string, stderr: string) => void
      ) {
        ClaudeCodeAdapter.interceptedCalls.exec++
        console.log(`🔍 Intercepted exec (#${ClaudeCodeAdapter.interceptedCalls.exec}):`, command)
        
        const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback
        
        if (!ClaudeCodeAdapter.currentInstance) {
          console.warn('No adapter instance, using original exec')
          return originalFunctions.exec(command, optionsOrCallback, callback)
        }

        const child = new ConstellationChildProcess({
          adapter: ClaudeCodeAdapter.currentInstance,
          command: 'sh',
          args: ['-c', command],
          shell: true,
          isExec: true
        })
        
        // Set up callback handling for exec-style buffered output
        if (cb) {
          let stdoutData = ''
          let stderrData = ''
          
          if (child.stdout) {
            child.stdout.on('data', (chunk) => {
              stdoutData += chunk.toString()
            })
          }
          
          if (child.stderr) {
            child.stderr.on('data', (chunk) => {
              stderrData += chunk.toString()
            })
          }
          
          child.on('close', (code) => {
            if (code === 0) {
              cb(null, stdoutData, stderrData)
            } else {
              const error = new Error(`Command failed: ${command}`)
              ;(error as any).code = code
              cb(error, stdoutData, stderrData)
            }
          })
          
          child.on('error', (err) => {
            cb(err, stdoutData, stderrData)
          })
        }

        return child
      }

      const interceptedSpawn = function(
        command: string,
        args?: readonly string[],
        options?: SpawnOptions
      ) {
        ClaudeCodeAdapter.interceptedCalls.spawn++
        console.log(`🔍 Intercepted spawn (#${ClaudeCodeAdapter.interceptedCalls.spawn}):`, command, args)
        
        if (!ClaudeCodeAdapter.currentInstance) {
          console.warn('No adapter instance, using original spawn')
          return originalFunctions.spawn(command, args, options)
        }

        return new ConstellationChildProcess({
          adapter: ClaudeCodeAdapter.currentInstance,
          command,
          args,
          shell: options?.shell,
          isExec: false
        })
      }

      const interceptedExecSync = function(command: string, options?: any) {
        ClaudeCodeAdapter.interceptedCalls.execSync++
        console.log(`🔍 Intercepted execSync (#${ClaudeCodeAdapter.interceptedCalls.execSync}):`, command)
        
        if (!ClaudeCodeAdapter.currentInstance) {
          console.warn('No adapter instance, using original execSync')
          return originalFunctions.execSync(command, options)
        }

        throw new Error('execSync is not supported when using ConstellationFS. Please use exec or spawn instead.')
      }

      // Try to override the entire module by replacing it in Node's module cache
      const Module = require('module')
      const originalResolveFilename = Module._resolveFilename
      
      Module._resolveFilename = function(request: string, parent: any, isMain: boolean, options?: any) {
        if (request === 'child_process') {
          // Return our custom module path - we'll intercept the require call
          return request
        }
        return originalResolveFilename.call(this, request, parent, isMain, options)
      }

      // Override the module cache entry for child_process
      const moduleCache = require.cache || Module._cache
      if (moduleCache) {
        // Create a new module that exports our intercepted functions
        const interceptedModule = {
          // Include other child_process exports that we don't intercept
          ...originalChildProcess,
          // Override with our intercepted functions (after spread)
          exec: interceptedExec,
          spawn: interceptedSpawn,
          execSync: interceptedExecSync
        }
        
        // Replace in cache - find the child_process module entry
        for (const [modulePath, moduleExports] of Object.entries(moduleCache)) {
          if (modulePath.includes('child_process')) {
            (moduleExports as any).exports = interceptedModule
          }
        }
      }

      isPatchingEnabled = true
      console.log('Child process module override enabled')
      
    } catch (error) {
      console.error('Failed to enable monkey-patching:', error)
      // Don't throw - just continue without patching
      isPatchingEnabled = true // Prevent repeated attempts
    }
  }

  /**
   * Disable monkey-patching and restore original functions
   */
  static async disableMonkeyPatching(): Promise<void> {
    if (!isPatchingEnabled || !originalFunctions) {
      return
    }

    try {
      // Restore original functions by direct assignment
      const childProcessModule = await import('child_process')
      
      // Try direct assignment first
      try {
        (childProcessModule as any).exec = originalFunctions.exec;
        (childProcessModule as any).spawn = originalFunctions.spawn;
        (childProcessModule as any).execSync = originalFunctions.execSync
      } catch {
        // If direct assignment fails, try defineProperty
        try {
          Object.defineProperty(childProcessModule, 'exec', {
            value: originalFunctions.exec,
            configurable: true,
            writable: true
          })
          
          Object.defineProperty(childProcessModule, 'spawn', {
            value: originalFunctions.spawn,
            configurable: true,
            writable: true
          })
          
          Object.defineProperty(childProcessModule, 'execSync', {
            value: originalFunctions.execSync,
            configurable: true,
            writable: true
          })
        } catch (_definePropertyError) {
          console.warn('Could not restore original child_process functions:', _definePropertyError)
        }
      }

      isPatchingEnabled = false
      originalFunctions = null
      console.log('Child process monkey-patching disabled')
      
    } catch (error) {
      console.error('Failed to disable monkey-patching:', error)
    }
  }

  /**
   * Execute shell commands - maps to Claude's Bash tool
   * @param command - The shell command to execute
   * @returns Promise resolving to command output
   */
  async Bash(command: string): Promise<string> {
    return this.workspace.exec(command)
  }

  /**
   * List files and directories - maps to Claude's LS tool
   * @param _path - Optional path to list (defaults to workspace root)
   * @returns Promise resolving to array of file/directory names
   */
  async LS(_path?: string): Promise<string[]> {
    // Claude Code SDK will handle this via bash commands with proper cwd
    throw new Error('LS operations should be handled via Bash tool with proper cwd set in Claude Code SDK')
  }

  /**
   * Find files using glob patterns - maps to Claude's Glob tool
   * @param _pattern - Glob pattern to match files
   * @param _path - Optional path to search in (defaults to current directory)
   * @returns Promise resolving to array of matching file paths
   */
  async Glob(_pattern: string, _path?: string): Promise<string[]> {
    // Claude Code SDK will handle this via bash commands with proper cwd
    throw new Error('Glob operations should be handled via Bash tool with proper cwd set in Claude Code SDK')
  }

  /**
   * Search for patterns in file contents - maps to Claude's Grep tool
   * @param _pattern - Pattern to search for
   * @param _options - Search options
   * @returns Promise resolving to search results
   */
  async Grep(
    _pattern: string, 
    _options: {
      files?: string
      ignoreCase?: boolean
      lineNumbers?: boolean
      context?: number
    } = {},
  ): Promise<string> {
    // Claude Code SDK will handle this via bash commands with proper cwd
    throw new Error('Grep operations should be handled via Bash tool with proper cwd set in Claude Code SDK')
  }

  /**
   * Read file contents - maps to Claude's Read tool
   * @param _path - Path to file to read
   * @returns Promise resolving to file contents
   */
  async Read(_path: string): Promise<string> {
    // Claude Code SDK will handle this via bash commands with proper cwd
    throw new Error('Read operations should be handled via Bash tool with proper cwd set in Claude Code SDK')
  }

  /**
   * Write content to file - maps to Claude's Write tool
   * @param _path - Path to file to write
   * @param _content - Content to write to file
   * @returns Promise that resolves when write is complete
   */
  async Write(_path: string, _content: string): Promise<void> {
    // Claude Code SDK will handle this via bash commands with proper cwd
    throw new Error('Write operations should be handled via Bash tool with proper cwd set in Claude Code SDK')
  }

  /**
   * Edit files by replacing specific text - maps to Claude's Edit tool
   * @param _path - Path to file to edit
   * @param _oldText - Text to replace
   * @param _newText - Replacement text
   * @returns Promise that resolves when edit is complete
   */
  async Edit(_path: string, _oldText: string, _newText: string): Promise<void> {
    // Claude Code SDK will handle this via bash commands with proper cwd
    throw new Error('Edit operations should be handled via Bash tool with proper cwd set in Claude Code SDK')
  }
}
