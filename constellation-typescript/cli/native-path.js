/**
 * ConstellationFS Native Library Path Utility
 * 
 * Finds the native library within the installed npm package
 */

import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PACKAGE_ROOT = join(__dirname, '..')

/**
 * Get the path to the native library within the npm package
 * @returns {string} Path to libintercept.so
 */
export function getNativeLibraryPath() {
  const nativeLibPath = join(PACKAGE_ROOT, 'native', 'libintercept.so')
  
  if (!existsSync(nativeLibPath)) {
    throw new Error(
      `Native library not found at ${nativeLibPath}\n` +
      'This usually means the ConstellationFS package was not built properly.\n' +
      'Try reinstalling: npm install constellationfs'
    )
  }
  
  return nativeLibPath
}

/**
 * Get the path for use with LD_PRELOAD environment variable
 * @returns {string} Absolute path suitable for LD_PRELOAD
 */
export function getLDPreloadPath() {
  return getNativeLibraryPath()
}