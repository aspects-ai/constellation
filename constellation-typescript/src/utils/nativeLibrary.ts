/**
 * Native Library Detection and Management
 * 
 * Handles detection and loading of platform-specific native libraries,
 * particularly the LD_PRELOAD intercept library for Linux remote backends.
 */

import { existsSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
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
  /** Whether the current platform supports remote backend */
  remoteBackend: boolean
  /** Whether native LD_PRELOAD library is available (optional enhancement) */
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
  const useNativeIntercept = process.env.USE_LD_PRELOAD === 'true'
  
  logger.debug(`Detecting platform capabilities for ${platform} (${arch})`)
  
  // All platforms support both local and remote backends now
  const capabilities: PlatformCapabilities = {
    localBackend: true,
    remoteBackend: true,  // Remote backend works on all platforms now
    nativeLibraryAvailable: false,
    nativeLibraryPath: null,
    notes: []
  }
  
  // Check if LD_PRELOAD is requested and available (Linux only)
  if (useNativeIntercept && platform === 'linux') {
    const nativeLibPath = findNativeLibrary()
    
    if (nativeLibPath) {
      capabilities.nativeLibraryAvailable = true
      capabilities.nativeLibraryPath = nativeLibPath
      capabilities.notes.push('LD_PRELOAD intercept library available for enhanced performance')
    } else {
      capabilities.notes.push('LD_PRELOAD requested but native library not found')
      capabilities.notes.push('Run: npm run build:native')
    }
  } else if (useNativeIntercept && platform !== 'linux') {
    capabilities.notes.push(`LD_PRELOAD only available on Linux (current: ${platform})`)
  } else {
    capabilities.notes.push('Remote backend using standard approach (LD_PRELOAD disabled)')
  }
  
  return capabilities
}

/**
 * Searches for the native LD_PRELOAD library in common locations
 */
export function findNativeLibrary(): string | null {
  // Check Docker/container paths first as they're most reliable
  const dockerPaths = [
    '/app/dist-native/libintercept.so',
    '/app/native/libintercept.so',
    '/container-native/libintercept.so'
  ]
  
  // Then check package-relative paths (for development/non-Docker environments)
  const packagePaths = [
    join(PACKAGE_ROOT, 'dist-native', 'libintercept.so'),
    join(PACKAGE_ROOT, 'native', 'libintercept.so'),
    join(PACKAGE_ROOT, '..', 'dist-native', 'libintercept.so')
  ]
  
  const allPaths = [...dockerPaths, ...packagePaths]
  
  for (const path of allPaths) {
    const exists = existsSync(path)
    if (exists) {
      logger.info(`Found native library at: ${path}`)
      return path
    }
  }
  
  logger.warn('Native library not found in any expected location')
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
 * Gets the appropriate LD_PRELOAD library path if enabled and available
 * @returns Library path if LD_PRELOAD is enabled and available, null otherwise
 */
export function getRemoteBackendLibrary(): string | null {
  const capabilities = detectPlatformCapabilities()
  
  // LD_PRELOAD is now optional - only use if explicitly enabled
  if (process.env.USE_LD_PRELOAD !== 'true') {
    logger.debug('LD_PRELOAD not enabled (set USE_LD_PRELOAD=true to enable)')
    return null
  }
  
  if (!capabilities.nativeLibraryAvailable) {
    logger.debug('LD_PRELOAD enabled but native library not available')
    return null
  }
  
  const libraryPath = capabilities.nativeLibraryPath
  if (!libraryPath || !validateNativeLibrary(libraryPath)) {
    logger.error('Native library validation failed')
    return null
  }
  
  logger.info('Using LD_PRELOAD intercept library for enhanced performance')
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
    // Remote backend is now supported on all platforms
    const suggestions = []
    
    // Add suggestions about optional LD_PRELOAD enhancement
    if (process.platform === 'linux' && !capabilities.nativeLibraryAvailable) {
      suggestions.push('Optional: Enable LD_PRELOAD for enhanced performance:')
      suggestions.push('  1. Build native library: npm run build:native')
      suggestions.push('  2. Set environment: USE_LD_PRELOAD=true')
    } else if (process.platform !== 'linux' && process.env.USE_LD_PRELOAD === 'true') {
      suggestions.push('Note: LD_PRELOAD is only available on Linux platforms')
    }
    
    return {
      supported: true,
      message: capabilities.notes.length > 0 ? capabilities.notes.join(', ') : undefined,
      suggestions
    }
  }
  
  return {
    supported: false,
    message: 'Unknown backend type',
    suggestions: ['Use "local" or "remote" backend']
  }
}
