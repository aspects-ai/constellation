/**
 * List of command patterns that are considered dangerous
 * These patterns will be blocked when preventDangerous is true
 */
const DANGEROUS_PATTERNS = [
  // System-wide destructive operations
  /^rm\s+.*-rf?\s+\/($|\s)/,
  /^rm\s+.*-rf?\s+~($|\s)/,
  /^rm\s+.*-rf?\s+\*($|\s)/,
  
  // Privilege escalation
  /^sudo\b/,
  /^su\b/,
  
  // System modification
  /^chmod\s+.*777/,
  /^chown\s+.*root/,
  
  // Dangerous network downloads and execution
  /curl\b.*\|\s*(sh|bash|zsh|fish)\b/,
  /wget\b.*\|\s*(sh|bash|zsh|fish)\b/,
  /\|\s*(sh|bash|zsh|fish)\s*$/,
  
  // Direct network tools (that could be used maliciously)
  /^wget\b/,
  /^curl\b/,
  /^nc\b/,
  /^ncat\b/,
  /^telnet\b/,
  /^ftp\b/,
  /^ssh\b/,
  /^scp\b/,
  /^rsync\b/,
  
  // Process/system control
  /^kill\s+-9/,
  /^killall\b/,
  /^pkill\b/,
  /^shutdown\b/,
  /^reboot\b/,
  /^halt\b/,
  /^init\s+[06]\b/,
  
  // File system manipulation outside workspace context
  /^mount\b/,
  /^umount\b/,
  /^fdisk\b/,
  /^mkfs\b/,
  /^fsck\b/,
  
  // Command substitution with dangerous commands
  /`(sudo|su|rm\s+-rf?\s*\/|shutdown|reboot)/,
  /\$\((sudo|su|rm\s+-rf?\s*\/|shutdown|reboot)/,
  
  // Path traversal attempts in sensitive operations
  /^(cp|mv|ln)\b.*\.\.\//,
  
  // Symbolic link creation that could escape
  /\bln\s+-s/,
]

/**
 * Additional patterns for commands that try to escape workspace
 */
const ESCAPE_PATTERNS = [
  // Change directory commands
  /\bcd\b/,
  /\bpushd\b/,
  /\bpopd\b/,
  
  // Environment manipulation that could affect paths
  /export\s+PATH=/,
  /export\s+HOME=/,
  /export\s+PWD=/,
  
  // Absolute paths (except when checking for URLs)
  // /(?<!https?:)(^|\s)\/[^\s]+/,  // Match absolute paths at word boundaries, not inside quotes
  
  // Shell expansion
  /~\//,         // Home directory
  /\$HOME/,      // HOME variable
  /\$\{HOME\}/,  // HOME variable with braces
  
  // Parent directory traversal
  /\.\.[/\\]/,
  
  // Command substitution (could be used to escape)
  /\$\([^)]+\)/,  // $() command substitution
  /`[^`]+`/,      // Backtick command substitution
]

/**
 * Check if a command contains dangerous operations
 * @param command - The command to check
 * @returns true if the command is considered dangerous
 */
export function isDangerous(command: string): boolean {
  const normalized = command.trim().toLowerCase()
  
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(normalized))
}

/**
 * Check if a command attempts to escape the workspace
 * @param command - The command to check
 * @returns true if the command attempts to access outside workspace
 */
export function isEscapingWorkspace(command: string): boolean {
  return ESCAPE_PATTERNS.some(pattern => pattern.test(command))
}

/**
 * Extract the base command from a command string for logging/reporting
 * @param command - The full command string
 * @returns The base command (first word)
 */
export function getBaseCommand(command: string): string {
  return command.trim().split(/\s+/)[0] || ''
}

/**
 * Comprehensive safety check for commands
 * Combines dangerous command checking and workspace escape detection
 * @param command - The command to check
 * @returns Object with safety status and optional reason
 */
export function isCommandSafe(command: string): { safe: boolean; reason?: string } {
  // Check for dangerous commands first
  if (isDangerous(command)) {
    const baseCmd = getBaseCommand(command)
    return { safe: false, reason: `Dangerous command '${baseCmd}' is not allowed` }
  }
  
  // Check for workspace escape attempts
  if (isEscapingWorkspace(command)) {
    // More specific messages for different escape types
    if (/\bcd\b/.test(command)) {
      return { safe: false, reason: 'Directory change commands are not allowed' }
    }
    // if (/(?<!https?:)(^|\s)\/[^\s]+/.test(command)) {
    //   return { safe: false, reason: 'Command contains absolute paths' }
    // }
    if (/~\//.test(command) || /\$HOME/.test(command)) {
      return { safe: false, reason: 'Home directory references are not allowed' }
    }
    if (/\.\.[/\\]/.test(command)) {
      return { safe: false, reason: 'Parent directory traversal is not allowed' }
    }
    return { safe: false, reason: 'Command attempts to escape workspace' }
  }
  
  return { safe: true }
}

/**
 * Parse a command to extract basic structure
 * @param command - The command to parse
 * @returns Parsed command info
 */
export interface ParsedCommand {
  command: string
  args: string[]
  hasAbsolutePath: boolean
  hasEscapePattern: boolean
}

export function parseCommand(command: string): ParsedCommand {
  const parts = command.trim().split(/\s+/)
  const baseCommand = parts[0] || ''
  const args = parts.slice(1)
  
  return {
    command: baseCommand,
    args,
    hasAbsolutePath: /(?<!https?:)(^|\s)\/[^\s]+/.test(command),
    hasEscapePattern: isEscapingWorkspace(command),
  }
}
