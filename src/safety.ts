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
  
  // Direct network tools
  /^nc\b/,
  /^ncat\b/,
  /^telnet\b/,
  /^ftp\b/,
  /^ssh\b/,
  
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
  
  // Absolute paths
  /\s\/[^\s]+/,  // Space followed by /path
  /^\/[^\s]+/,   // Starting with /path
  
  // Shell expansion
  /~\//,         // Home directory
  /\$HOME/,      // HOME variable
  /\$\{[^}]+\}/, // Shell variable expansion
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