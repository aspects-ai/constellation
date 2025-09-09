#!/usr/bin/env node

/**
 * ConstellationFS Native Library Build Script
 * 
 * Builds the LD_PRELOAD native library for Linux platforms.
 * On non-Linux platforms, provides clear guidance about Docker development options.
 */

import { execSync, spawn } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import os from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Configuration
const NATIVE_DIR = join(__dirname, '..', 'native')
const DIST_NATIVE_DIR = join(__dirname, '..', 'dist-native')
const MAKEFILE_PATH = join(NATIVE_DIR, 'Makefile')
const TARGET_LIB = 'libintercept.so'

/**
 * Logs a message with timestamp and context
 */
function log(level, message) {
  const timestamp = new Date().toISOString()
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️'
  console.log(`${prefix} [${timestamp}] ${message}`)
}

/**
 * Checks if required build tools are available
 */
function checkBuildTools() {
  const requiredTools = ['gcc', 'make']
  const missing = []

  for (const tool of requiredTools) {
    try {
      execSync(`which ${tool}`, { stdio: 'ignore' })
    } catch (error) {
      missing.push(tool)
    }
  }

  return missing
}

/**
 * Builds the native library on Linux using system tools
 */
function buildNativeLinux() {
  log('info', 'Building native LD_PRELOAD library for Linux...')
  
  // Check if Makefile exists
  if (!existsSync(MAKEFILE_PATH)) {
    log('error', `Makefile not found at ${MAKEFILE_PATH}`)
    process.exit(1)
  }

  // Check build tools
  const missingTools = checkBuildTools()
  if (missingTools.length > 0) {
    log('error', `Missing required build tools: ${missingTools.join(', ')}`)
    log('info', 'On Ubuntu/Debian: sudo apt-get install build-essential')
    log('info', 'On CentOS/RHEL: sudo yum groupinstall "Development Tools"')
    process.exit(1)
  }

  try {
    // Clean previous build
    log('info', 'Cleaning previous build...')
    execSync('make clean', { 
      cwd: NATIVE_DIR, 
      stdio: ['ignore', 'pipe', 'pipe'] 
    })

    // Build the library
    log('info', 'Compiling native library...')
    const output = execSync('make', { 
      cwd: NATIVE_DIR, 
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8' 
    })
    
    // Verify the library was built
    const libraryPath = join(NATIVE_DIR, TARGET_LIB)
    if (!existsSync(libraryPath)) {
      log('error', `Failed to build ${TARGET_LIB}`)
      process.exit(1)
    }

    // Create dist-native directory and copy library
    if (!existsSync(DIST_NATIVE_DIR)) {
      mkdirSync(DIST_NATIVE_DIR, { recursive: true })
    }
    
    execSync(`cp "${libraryPath}" "${join(DIST_NATIVE_DIR, TARGET_LIB)}"`)
    
    // Test the library
    log('info', 'Testing native library dependencies...')
    try {
      const lddOutput = execSync(`ldd "${libraryPath}"`, { encoding: 'utf8' })
      log('info', 'Library dependencies:')
      console.log(lddOutput)
    } catch (error) {
      log('warn', 'Could not check library dependencies (ldd not available)')
    }

    log('success', `Native library built successfully: ${libraryPath}`)
    log('info', `Library copied to: ${join(DIST_NATIVE_DIR, TARGET_LIB)}`)
    
    return true
  } catch (error) {
    log('error', `Build failed: ${error.message}`)
    if (error.stdout) {
      console.log('Build output:', error.stdout)
    }
    if (error.stderr) {
      console.error('Build errors:', error.stderr)
    }
    process.exit(1)
  }
}

/**
 * Provides guidance for non-Linux platforms
 */
function handleNonLinuxPlatform(platform) {
  log('info', `ConstellationFS detected platform: ${platform}`)
  log('info', 'LD_PRELOAD native library is only supported on Linux platforms')
  log('info', 'ConstellationFS will run in local-backend-only mode on this platform')
  log('info', '')
  log('info', 'For remote backend development on non-Linux platforms:')
  log('info', '1. Install the Docker development package:')
  log('info', '   npm install --save-dev @constellationfs/docker-dev')
  log('info', '2. Build native library using Docker:')
  log('info', '   npx @constellationfs/docker-dev build-native')
  log('info', '3. Start Docker development environment:')
  log('info', '   npx @constellationfs/docker-dev start')
  log('info', '')
  log('info', 'For more information, see: https://github.com/constellation-fs/constellation-fs#development')
  
  return false
}

/**
 * Main build function
 */
function main() {
  const platform = os.platform()
  const arch = os.arch()
  
  log('info', `Starting ConstellationFS native build process`)
  log('info', `Platform: ${platform} (${arch})`)
  log('info', `Node.js version: ${process.version}`)
  
  // Check for force flag
  const forceFlag = process.argv.includes('--force')
  
  if (platform === 'linux') {
    return buildNativeLinux()
  } else {
    return handleNonLinuxPlatform(platform)
  }
}

// Handle CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const success = main()
    process.exit(success ? 0 : 0) // Non-Linux is not a failure, just different mode
  } catch (error) {
    log('error', `Unexpected error: ${error.message}`)
    process.exit(1)
  }
}

export { main, buildNativeLinux, handleNonLinuxPlatform }