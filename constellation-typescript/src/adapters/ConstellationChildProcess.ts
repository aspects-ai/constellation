import type { ChildProcess, Serializable } from 'child_process'
import { EventEmitter } from 'events'
import { Readable, PassThrough } from 'stream'
import type { BaseSDKAdapter } from './BaseAdapter.js'

export interface ConstellationChildProcessOptions {
  adapter: BaseSDKAdapter
  command: string
  args?: readonly string[]
  shell?: boolean | string
  isExec?: boolean
}

/**
 * A robust ChildProcess implementation that can handle both local and remote execution
 * through ConstellationFS adapters. This class provides full compatibility with Node.js
 * ChildProcess interface while enabling command execution through various backends.
 */
export class ConstellationChildProcess extends EventEmitter implements ChildProcess {
  stdin = null
  stdout: Readable | null
  stderr: Readable | null
  readonly stdio: [null, Readable | null, Readable | null, null, null]
  readonly pid: number
  readonly connected = false
  readonly signalCode = null
  readonly spawnargs: string[]
  readonly spawnfile: string
  
  exitCode: number | null = null
  killed = false
  
  private _stdoutStream: PassThrough
  private _stderrStream: PassThrough
  private _adapter: BaseSDKAdapter
  private _fullCommand: string
  private _isExec: boolean
  private _outputBuffer: string = ''
  private _errorBuffer: string = ''

  constructor(options: ConstellationChildProcessOptions) {
    super()
    
    this._adapter = options.adapter
    this._isExec = options.isExec || false
    this.spawnfile = options.command
    this.spawnargs = options.args ? [...options.args] : []
    this.pid = Math.floor(Math.random() * 100000) + 1000
    
    // Create PassThrough streams for stdout and stderr
    this._stdoutStream = new PassThrough()
    this._stderrStream = new PassThrough()
    
    this.stdout = this._stdoutStream
    this.stderr = this._stderrStream
    this.stdio = [null, this.stdout, this.stderr, null, null]
    
    // Build the full command
    this._fullCommand = this._buildCommand(options.command, options.args, options.shell)
    
    // Start execution
    this._execute()
  }
  
  private _buildCommand(command: string, args?: readonly string[], shell?: boolean | string): string {
    if (shell) {
      // If shell is true or a string, we're likely running through sh -c
      if (command === 'sh' || command === 'bash' || command === '/bin/sh' || command === '/bin/bash') {
        if (args && args[0] === '-c' && args[1]) {
          return args[1]
        }
      }
    }
    
    // Build command with arguments
    if (args && args.length > 0) {
      // Properly escape arguments that contain spaces
      const escapedArgs = args.map(arg => 
        arg.includes(' ') ? `"${arg.replace(/"/g, '\\"')}"` : arg
      )
      return `${command} ${escapedArgs.join(' ')}`
    }
    
    return command
  }
  
  private async _execute(): Promise<void> {
    // Emit spawn event on next tick
    process.nextTick(() => {
      this.emit('spawn')
    })
    
    try {
      console.log(`🚀 [ConstellationChildProcess] Executing command: "${this._fullCommand}"`)
      console.log(`📍 [ConstellationChildProcess] Workspace: ${(this._adapter as any).fs.workspace}`)
      
      // Execute command through adapter
      const output = await (this._adapter as any).exec(this._fullCommand)
      
      // Handle output
      if (this._isExec) {
        // For exec, buffer the output
        this._outputBuffer = output
      }
      
      // Write output to stdout stream
      if (output && this._stdoutStream) {
        this._stdoutStream.write(output)
      }
      
      // Success - emit exit and close events
      this.exitCode = 0
      this._stdoutStream.end()
      this._stderrStream.end()
      
      process.nextTick(() => {
        this.emit('exit', 0, null)
        this.emit('close', 0, null)
      })
      
    } catch (error) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      if (this._isExec) {
        // For exec, buffer the error
        this._errorBuffer = errorMessage
      }
      
      // Write error to stderr stream
      if (this._stderrStream) {
        this._stderrStream.write(errorMessage)
      }
      
      // Error - emit exit and close events
      this.exitCode = 1
      this._stdoutStream.end()
      this._stderrStream.end()
      
      process.nextTick(() => {
        this.emit('error', error instanceof Error ? error : new Error(errorMessage))
        this.emit('exit', 1, null)
        this.emit('close', 1, null)
      })
    }
  }
  
  kill(signal?: NodeJS.Signals | number): boolean {
    if (this.killed) {
      return false
    }
    
    this.killed = true
    
    // Emit exit and close events on next tick
    process.nextTick(() => {
      const sig = typeof signal === 'string' ? signal : 'SIGTERM'
      this.emit('exit', null, sig)
      this.emit('close', null, sig)
    })
    
    return true
  }
  
  send(_message: Serializable, _sendHandle?: any, _options?: any, callback?: (error: Error | null) => void): boolean {
    // Remote processes don't support IPC
    if (callback) {
      process.nextTick(() => callback(new Error('IPC not supported for remote processes')))
    }
    return false
  }
  
  disconnect(): void {
    // No-op for remote processes
  }
  
  unref(): void {
    // No-op for remote processes
  }
  
  ref(): void {
    // No-op for remote processes
  }
  
  [Symbol.dispose](): void {
    this.kill()
  }
  
  /**
   * Get buffered output (for exec compatibility)
   */
  getBufferedOutput(): { stdout: string; stderr: string } {
    return {
      stdout: this._outputBuffer,
      stderr: this._errorBuffer
    }
  }
}