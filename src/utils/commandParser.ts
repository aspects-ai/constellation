/**
 * Command parser for extracting and analyzing file paths in shell commands
 */

interface ParsedCommand {
  command: string
  args: string[]
  filePaths: string[]
  hasAbsolutePath: boolean
  hasDangerousPattern: boolean
  issues: string[]
}

/**
 * Patterns that indicate potential security issues
 */
const DANGEROUS_PATTERNS = [
  // Directory navigation
  /\bcd\b/,
  /\bpushd\b/,
  /\bpopd\b/,
  
  // Shell expansion that could escape
  /~\//,           // Home directory expansion
  /\$HOME/,        // HOME variable
  /\$\{HOME\}/,    // HOME variable with braces
  
  // Command substitution that could be used to escape
  /\$\([^)]+\)/,   // $() command substitution
  /`[^`]+`/,       // Backtick command substitution
  
  // Glob patterns that could access parent directories
  /\.\.[\/\\]/,    // Parent directory traversal
  
  // Potential symlink creation to escape
  /\bln\s+-s/,     // Symbolic link creation
]

/**
 * Parse a shell command to extract file paths and identify security issues
 */
export function parseCommand(command: string): ParsedCommand {
  const issues: string[] = []
  const filePaths: string[] = []
  let hasAbsolutePath = false
  let hasDangerousPattern = false
  
  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      hasDangerousPattern = true
      issues.push(`Dangerous pattern detected: ${pattern}`)
    }
  }
  
  // Check for directory change commands
  if (/\b(cd|pushd|popd)\b/.test(command)) {
    issues.push('Directory change commands are not allowed')
    hasDangerousPattern = true
  }
  
  // Extract potential file paths
  // This regex looks for:
  // - Absolute paths starting with /
  // - Relative paths with ./ or ../
  // - Paths with common file extensions
  // - Quoted paths
  const pathPatterns = [
    // Absolute paths (but not URLs - check separately)
    /\s(\/[^\s;|&<>]*)/g,  // Space before /path
    /^(\/[^\s;|&<>]*)/g,   // Start of string /path
    
    // Relative paths with dots
    /\.\.\/[^\s;|&<>]*/g,
    /\.\/[^\s;|&<>]*/g,
    
    // Quoted paths
    /"([^"]*)"/g,
    /'([^']*)'/g,
    
    // Common file operations with paths
    /(?:cat|less|more|tail|head|grep|find|ls|rm|cp|mv|touch|mkdir)\s+([^\s;|&<>]+)/g,
  ]
  
  for (const pattern of pathPatterns) {
    const matches = command.matchAll(pattern)
    for (const match of matches) {
      const path = match[1] || match[0]
      
      // Skip flags that start with -
      if (path.startsWith('-')) continue
      
      // Skip URLs (http://, https://, ftp://, etc)
      if (path.match(/^[a-z]+:\/\//)) continue
      
      // Check if it's an absolute path
      if (path.startsWith('/')) {
        hasAbsolutePath = true
        issues.push(`Absolute path detected: ${path}`)
      }
      
      // Check for parent directory traversal
      if (path.includes('../')) {
        issues.push(`Parent directory traversal detected: ${path}`)
        hasDangerousPattern = true
      }
      
      // Check for home directory reference
      if (path.startsWith('~')) {
        issues.push(`Home directory reference detected: ${path}`)
        hasDangerousPattern = true
      }
      
      filePaths.push(path)
    }
  }
  
  // Parse basic command structure
  const parts = command.trim().split(/\s+/)
  const baseCommand = parts[0] || ''
  const args = parts.slice(1)
  
  return {
    command: baseCommand,
    args,
    filePaths: [...new Set(filePaths)], // Remove duplicates
    hasAbsolutePath,
    hasDangerousPattern,
    issues
  }
}

/**
 * Check if a command is safe to execute within a workspace
 */
export function isCommandSafe(command: string): { safe: boolean; reason?: string } {
  const parsed = parseCommand(command)
  
  // Check for dangerous commands first
  const dangerousCommands = ['wget', 'curl', 'nc', 'ncat', 'ssh', 'scp', 'rsync']
  if (dangerousCommands.includes(parsed.command)) {
    return { safe: false, reason: `Network command '${parsed.command}' is not allowed` }
  }
  
  if (parsed.hasDangerousPattern) {
    return { safe: false, reason: parsed.issues.join('; ') }
  }
  
  if (parsed.hasAbsolutePath) {
    return { safe: false, reason: 'Command contains absolute paths' }
  }
  
  return { safe: true }
}

/**
 * Sanitize a command by removing dangerous elements
 * Returns null if command cannot be safely sanitized
 */
export function sanitizeCommand(command: string): string | null {
  const parsed = parseCommand(command)
  
  // If there are structural issues, we can't safely sanitize
  if (parsed.hasDangerousPattern || parsed.hasAbsolutePath) {
    return null
  }
  
  // For now, return the original command if it's safe
  // In the future, we could implement actual sanitization
  return command
}