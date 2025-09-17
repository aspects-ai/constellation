/**
 * ConstellationFS Native Library Path Discovery
 * 
 * Finds the location of the built native library
 */

import { existsSync } from 'fs'
import { resolve } from 'path'
import { getLDPreloadPath } from './native-path.js'

/**
 * Find the path to the built native library
 * @returns {string} Path to libintercept.so
 * @throws {Error} If library not found
 */
export function getNativeLibraryPath() {
  // First try to get from the npm package
  try {
    return getLDPreloadPath()
  } catch {
    // Fall back to checking other locations for development/building
    const possiblePaths = [
      // Common output locations
      './build/libintercept.so',
      './dist-native/libintercept.so',
      './lib/libintercept.so',
      
      // Node modules locations (when installed as dependency)
      './node_modules/constellationfs/native/libintercept.so',
      
      // Development locations
      './native/libintercept.so',
      '../native/libintercept.so',
      
      // Absolute paths for CI/CD environments
      resolve(process.cwd(), 'libintercept.so')
    ]
    
    for (const path of possiblePaths) {
      try {
        const resolvedPath = resolve(path)
        if (existsSync(resolvedPath)) {
          return resolvedPath
        }
      } catch (error) {
        // Continue checking other paths
        continue
      }
    }
    
    throw new Error(
      'Native library not found. Run: npx constellationfs build-native --output ./build/'
    )
  }
}

/**
 * Check if native library exists at common locations
 * @returns {boolean} True if library is found
 */
export function hasNativeLibrary() {
  try {
    getNativeLibraryPath()
    return true
  } catch {
    return false
  }
}

/**
 * Get all possible paths where the library might be located
 * (useful for debugging)
 * @returns {string[]} Array of possible paths
 */
export function getAllPossiblePaths() {
  return [
    './build/libintercept.so',
    './dist-native/libintercept.so',
    './lib/libintercept.so',
    './node_modules/constellationfs/dist-native/libintercept.so',
    './node_modules/constellationfs/build/libintercept.so',
    './node_modules/constellationfs/native/libintercept.so',
    './native/libintercept.so',
    '../native/libintercept.so',
    resolve(process.cwd(), 'libintercept.so')
  ].map(path => resolve(path))
}