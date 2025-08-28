import { isAbsolute, join, normalize, relative, resolve } from 'path'
import { lstatSync, readlinkSync } from 'fs'

/**
 * Path validation utilities for ensuring file operations stay within workspace boundaries
 */

/**
 * Check if a path is attempting to escape the workspace
 */
export function isPathEscaping(workspacePath: string, targetPath: string): boolean {
  // Normalize both paths to handle . and ..
  const normalizedWorkspace = normalize(workspacePath)
  const resolvedTarget = resolve(workspacePath, targetPath)
  
  // Check if the resolved path is outside the workspace
  const relativePath = relative(normalizedWorkspace, resolvedTarget)
  
  // If relative path starts with .. or is absolute, it's escaping
  return relativePath.startsWith('..') || isAbsolute(relativePath)
}

/**
 * Resolve a path safely within workspace boundaries
 * Throws if the path would escape the workspace
 */
export function resolvePathSafely(workspacePath: string, targetPath: string): string {
  // Don't allow absolute paths at all
  if (isAbsolute(targetPath)) {
    throw new Error(`Absolute paths are not allowed: ${targetPath}`)
  }
  
  // Resolve the full path
  const fullPath = resolve(workspacePath, targetPath)
  
  // Check if it escapes
  if (isPathEscaping(workspacePath, targetPath)) {
    throw new Error(`Path escapes workspace boundary: ${targetPath}`)
  }
  
  return fullPath
}

/**
 * Check if a path contains a symlink that could escape the workspace
 */
export function checkSymlinkSafety(workspacePath: string, targetPath: string): { safe: boolean; reason?: string } {
  try {
    const segments = targetPath.split('/')
    let currentPath = workspacePath
    
    // Check each segment of the path
    for (const segment of segments) {
      if (!segment || segment === '.') continue
      
      currentPath = join(currentPath, segment)
      
      try {
        const stats = lstatSync(currentPath)
        if (stats.isSymbolicLink()) {
          // Resolve the symlink
          const linkTarget = readlinkSync(currentPath)
          const resolvedLink = isAbsolute(linkTarget) 
            ? linkTarget 
            : resolve(currentPath, '..', linkTarget)
          
          // Check if the symlink target escapes workspace
          const relativePath = relative(workspacePath, resolvedLink)
          if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
            return { 
              safe: false, 
              reason: `Symlink at ${currentPath} points outside workspace to ${linkTarget}` 
            }
          }
        }
      } catch (err) {
        // Path doesn't exist yet, which is fine for write operations
        break
      }
    }
    
    return { safe: true }
  } catch (err) {
    // Error checking symlink, err on the side of caution
    return { safe: false, reason: `Error checking symlink: ${err instanceof Error ? err.message : 'Unknown error'}` }
  }
}

/**
 * Validate multiple paths at once
 */
export function validatePaths(workspacePath: string, paths: string[]): { 
  valid: boolean
  invalidPaths: Array<{ path: string; reason: string }>
} {
  const invalidPaths: Array<{ path: string; reason: string }> = []
  
  for (const path of paths) {
    // Check for absolute paths
    if (isAbsolute(path)) {
      invalidPaths.push({ path, reason: 'Absolute path not allowed' })
      continue
    }
    
    // Check for escape attempts
    if (isPathEscaping(workspacePath, path)) {
      invalidPaths.push({ path, reason: 'Path escapes workspace' })
      continue
    }
    
    // Check for dangerous patterns
    if (path.includes('../')) {
      invalidPaths.push({ path, reason: 'Parent directory traversal not allowed' })
      continue
    }
    
    // Check symlink safety
    const symlinkCheck = checkSymlinkSafety(workspacePath, path)
    if (!symlinkCheck.safe) {
      invalidPaths.push({ path, reason: symlinkCheck.reason || 'Unsafe symlink' })
    }
  }
  
  return {
    valid: invalidPaths.length === 0,
    invalidPaths
  }
}