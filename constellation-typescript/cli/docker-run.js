/**
 * ConstellationFS Docker Execution Helper
 * 
 * Provides Docker-based execution for cross-platform development
 */

import { execSync, spawn } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { getNativeLibraryPath } from './path.js'

/**
 * Run a command using Docker with ConstellationFS setup
 * @param {string} command - Command to run inside Docker
 * @param {Object} options - Docker run options
 */
export async function dockerRun(command, options = {}) {
  console.log('🐳 Running command with ConstellationFS Docker setup...')
  console.log(`   Command: ${command}`)
  
  // Check if Docker is available
  try {
    execSync('docker --version', { stdio: 'ignore' })
  } catch {
    throw new Error(
      'Docker is required for cross-platform execution\\n' +
      'Please install Docker Desktop: https://www.docker.com/products/docker-desktop/'
    )
  }
  
  // Find native library path
  let nativeLibPath
  try {
    nativeLibPath = getNativeLibraryPath()
  } catch (error) {
    throw new Error(
      'Native library not found. Run: npx constellationfs build-native --output ./build/'
    )
  }
  
  // Get relative path for Docker mounting
  const currentDir = process.cwd()
  const relativePath = getRelativePath(nativeLibPath, currentDir)
  
  console.log(`   Native library: ${relativePath}`)
  
  // Build Docker command
  const dockerCmd = [
    'docker', 'run', '--rm', '-i',
    '-v', `${currentDir}:/app`,
    '-w', '/app',
    '-e', `LD_PRELOAD=/app/${relativePath}`,
    '-p', '3000:3000', // Common development port
    ...getEnvironmentVariables(),
    options.image || 'node:18',
    '/bin/bash', '-c', command
  ]
  
  console.log('   Starting Docker container...')
  
  // Run the Docker command
  return runInteractiveCommand(dockerCmd)
}

/**
 * Get environment variables to pass to Docker
 */
function getEnvironmentVariables() {
  const envVars = []
  
  // Pass through common development environment variables
  const passThrough = [
    'NODE_ENV',
    'REMOTE_VM_HOST',
    'CONSTELLATION_CWD',
    'CONSTELLATION_DEBUG'
  ]
  
  for (const key of passThrough) {
    if (process.env[key]) {
      envVars.push('-e', `${key}=${process.env[key]}`)
    }
  }
  
  return envVars
}

/**
 * Get relative path from current directory
 */
function getRelativePath(absolutePath, basePath) {
  const path = require('path')
  let relativePath = path.relative(basePath, absolutePath)
  
  // Ensure forward slashes for Docker compatibility
  relativePath = relativePath.replace(/\\\\/g, '/')
  
  // If path goes up directories, use absolute path in container
  if (relativePath.startsWith('..')) {
    return absolutePath
  }
  
  return relativePath
}

/**
 * Run an interactive command with proper stdio handling
 */
function runInteractiveCommand(command) {
  return new Promise((resolve, reject) => {
    console.log(`   Running: ${command.join(' ')}`)
    
    const child = spawn(command[0], command.slice(1), {
      stdio: 'inherit' // Pass through stdin/stdout/stderr
    })
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Docker command completed successfully')
        resolve()
      } else {
        reject(new Error(`Docker command failed with exit code ${code}`))
      }
    })
    
    child.on('error', (error) => {
      reject(new Error(`Failed to start Docker command: ${error.message}`))
    })
    
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      console.log('\\n⚠️  Stopping Docker container...')
      child.kill('SIGTERM')
    })
  })
}