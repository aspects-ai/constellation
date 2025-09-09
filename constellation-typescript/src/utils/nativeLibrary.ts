/**
 * Native Library Detection and Management
 * 
 * Handles detection and loading of platform-specific native libraries,
 * particularly the LD_PRELOAD intercept library for Linux remote backends.
 */

import { existsSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { getLogger } from './logger.js'

const logger = getLogger()

// Get the package root directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PACKAGE_ROOT = resolve(__dirname, '..', '..')

/**
 * Platform support matrix for ConstellationFS features
 */
export interface PlatformCapabilities {
  /** Whether the current platform supports local filesystem backend */
  localBackend: boolean
  /** Whether the current platform supports remote backend with LD_PRELOAD */
  remoteBackend: boolean
  /** Whether native LD_PRELOAD library is available */
  nativeLibraryAvailable: boolean
  /** Path to native library if available */
  nativeLibraryPath: string | null
  /** Platform-specific notes or limitations */
  notes: string[]
}

/**
 * Detects the current platform's ConstellationFS capabilities
 */
export function detectPlatformCapabilities(): PlatformCapabilities {
  const platform = process.platform
  const arch = process.arch
  
  logger.debug(`Detecting platform capabilities for ${platform} (${arch})`)
  
  // All platforms support local backend
  const capabilities: PlatformCapabilities = {
    localBackend: true,
    remoteBackend: false,
    nativeLibraryAvailable: false,
    nativeLibraryPath: null,
    notes: []
  }
  
  if (platform === 'linux') {
    // Linux platforms may support remote backend if native library is available
    const nativeLibPath = findNativeLibrary()
    
    if (nativeLibPath) {
      capabilities.remoteBackend = true
      capabilities.nativeLibraryAvailable = true
      capabilities.nativeLibraryPath = nativeLibPath
      capabilities.notes.push('Full remote backend support with LD_PRELOAD available')
    } else {
      capabilities.notes.push('Remote backend requires native library build')
      capabilities.notes.push('Run: npm run build:native')
    }
  } else {
    // Non-Linux platforms don't support LD_PRELOAD
    capabilities.notes.push(`Remote backend not supported on ${platform}`)
    capabilities.notes.push('For remote backend development, use: @constellationfs/docker-dev')
  }
  
  return capabilities
}

/**
 * Searches for the native LD_PRELOAD library in common locations
 */
export function findNativeLibrary(): string | null {
  const possiblePaths = [
    // Distributed with package
    join(PACKAGE_ROOT, 'dist-native', 'libintercept.so'),
    // Built in native directory
    join(PACKAGE_ROOT, 'native', 'libintercept.so'),
    // Development location
    join(PACKAGE_ROOT, '..', 'dist-native', 'libintercept.so'),
    // Container location (Docker development)
    '/container-native/libintercept.so'
  ]
  
  logger.debug('Searching for native library in:', possiblePaths)
  
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      logger.info(`Found native library at: ${path}`)
      return path
    }
  }
  
  logger.debug('Native library not found in any expected location')
  return null
}

/**
 * Validates that a native library path is usable
 */
export function validateNativeLibrary(libraryPath: string): boolean {
  if (!existsSync(libraryPath)) {
    logger.warn(`Native library not found at: ${libraryPath}`)
    return false
  }
  
  // Additional validation could be added here:
  // - Check file permissions
  // - Verify it's a valid shared library
  // - Check architecture compatibility
  
  return true
}

/**
 * Gets the appropriate LD_PRELOAD library path for remote backend
 * @returns Library path if available, null otherwise
 */
export function getRemoteBackendLibrary(): string | null {
  const capabilities = detectPlatformCapabilities()
  
  if (!capabilities.remoteBackend) {
    logger.debug('Remote backend not supported on current platform')
    return null
  }
  
  if (!capabilities.nativeLibraryAvailable) {
    logger.warn('Remote backend requires native library, but none found')
    return null
  }
  
  const libraryPath = capabilities.nativeLibraryPath
  if (!libraryPath || !validateNativeLibrary(libraryPath)) {
    logger.error('Native library validation failed')
    return null
  }
  
  return libraryPath
}

/**
 * Provides user-friendly error messages and guidance for platform limitations
 */
export function getPlatformGuidance(requestedBackend: 'local' | 'remote'): {
  supported: boolean
  message?: string
  suggestions: string[]
} {
  const capabilities = detectPlatformCapabilities()
  
  if (requestedBackend === 'local') {
    return {
      supported: capabilities.localBackend,
      suggestions: capabilities.localBackend ? [] : ['Local backend should work on all platforms']
    }
  }
  
  if (requestedBackend === 'remote') {
    if (capabilities.remoteBackend) {
      return {
        supported: true,
        suggestions: []
      }
    }
    
    const suggestions = []
    
    if (process.platform !== 'linux') {
      suggestions.push('Remote backend requires Linux platform')
      suggestions.push('For development on non-Linux:')
      suggestions.push('  npm install --save-dev @constellationfs/docker-dev')
      suggestions.push('  npx @constellationfs/docker-dev start')
    } else {
      suggestions.push('Native library not found or invalid')
      suggestions.push('Build the native library:')
      suggestions.push('  npm run build:native')
    }
    
    return {
      supported: false,
      message: `Remote backend not available: ${capabilities.notes.join(', ')}`,
      suggestions
    }
  }
  
  return {
    supported: false,
    message: 'Unknown backend type',
    suggestions: ['Use "local" or "remote" backend']
  }
}