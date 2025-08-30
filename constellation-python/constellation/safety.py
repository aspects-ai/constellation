"""Security validation and dangerous operation detection."""

import re
import shlex
from typing import List, Set
from pathlib import Path
from .types import SafetyCheckResult, FileSystemError
from .constants import ERROR_CODES


# Dangerous command patterns that should be blocked
DANGEROUS_PATTERNS: List[str] = [
    # System destruction
    r'rm\s+-rf\s+/',
    r'rm\s+-rf\s+~',
    r'rm\s+--recursive\s+--force\s+/',
    r'rm\s+-rf\s+/[a-z]',  # Catch variations like /usr, /var
    r'rm\s+-rf\s+\$HOME',
    r'rm\s+-rf\s+\*',  # rm -rf *
    r'\bdd\b.*of=/dev/',  # Disk wipe attempts
    
    # Fork bombs and resource exhaustion
    r':\(\)\{.*\|.*&\};',  # Classic fork bomb
    r'.*\|.*&.*\|.*&',  # Pipe spam
    r'while\s+true.*do',  # Infinite loops
    r'for\s+\(\(;;\)\)',  # C-style infinite loop
    r'yes\s+.*\|',  # Resource exhaustion with yes
    r'\.\*/dev/(zero|null|random).*>',  # Disk filling
    
    # Remote code execution
    r'curl.*\|.*sh',
    r'wget.*\|.*sh',
    r'curl.*\|.*bash',
    r'wget.*\|.*bash',
    r'curl.*\|.*zsh',
    r'wget.*\|.*zsh',
    r'curl.*\|.*python[0-9]*',
    r'wget.*\|.*python[0-9]*',
    r'curl.*-s.*\|.*sh',  # Silent downloads
    r'fetch.*\|.*sh',  # BSD fetch
    r'lynx.*-dump.*\|.*sh',  # Text browser downloads
    
    # Privilege escalation
    r'sudo\s+',
    r'su\s+',
    r'su\s*$',
    
    # Dangerous permissions
    r'chmod\s+777',
    r'chmod\s+-R\s+777',
    r'chmod\s+a\+rwx',
    
    # Process control
    r'kill\s+-9\s+-1',
    r'killall\s+-9',
    r'pkill\s+-9\s+-f',
    
    # System control
    r'shutdown',
    r'reboot',
    r'halt',
    r'poweroff',
    r'init\s+[06]',
    r'systemctl\s+(poweroff|reboot|halt)',
    r'service\s+.*\s+(stop|restart)',
    r'/sbin/(shutdown|reboot|halt)',
    r'telinit\s+[06]',
    
    # Disk operations
    r'dd\s+if=/dev/(zero|random|urandom)',
    r'mkfs\.',
    r'fdisk',
    r'parted',
    
    # Network access that could be dangerous
    r'nc\s+.*-e',  # Netcat with command execution
    r'netcat\s+.*-e',
    r'ncat\s+.*-e',
    r'telnet\s+.*\|',
    r'socat.*exec',  # Socat command execution
    r'ssh\s+.*".*[;&]',  # SSH command injection
    r'rsync\s+.*--rsh',  # Rsync with custom shell
    r'scp\s+.*`',  # SCP with command substitution
    
    # File system manipulation
    r'mount\s+',
    r'umount\s+',
    r'fsck\s+',
    
    # Environment manipulation
    r'export\s+PATH\s*=',
    r'export\s+LD_',
    r'export\s+DYLD_',
    r'export\s+PYTHONPATH\s*=',
    r'unset\s+PATH',
    r'setenv\s+PATH',  # C shell
    r'alias\s+(ls|rm|cp|mv)\s*=',  # Alias dangerous commands
    r'hash\s+-r',  # Reset command hash table
]

# Path escape patterns that indicate directory traversal attempts
PATH_ESCAPE_PATTERNS: List[str] = [
    r'^/',                    # Absolute paths
    r'\.\./',                 # Directory traversal
    r'/\.\.',                 # Directory traversal variant
    r'~/',                    # Home directory access
    r'\$HOME',                # Home directory via env var
    r'\$\{HOME\}',            # Home directory via env var expansion
]

# Privileged/system commands that should be blocked
PRIVILEGED_COMMANDS: Set[str] = {
    # Privilege escalation
    'sudo', 'su', 'doas', 'runuser',
    
    # File system permissions
    'chown', 'chmod', 'chgrp', 'chattr', 'setfacl',
    
    # Mount/filesystem operations
    'mount', 'umount', 'fsck', 'mkfs', 'fdisk', 'parted', 'lsblk',
    
    # Firewall/network security
    'iptables', 'ip6tables', 'ufw', 'firewall-cmd', 'pfctl',
    
    # System services
    'systemctl', 'service', 'init', 'systemd', 'launchctl',
    
    # Scheduled tasks
    'crontab', 'at', 'batch', 'anacron',
    
    # User management
    'passwd', 'usermod', 'useradd', 'userdel', 'chpasswd',
    'groupmod', 'groupadd', 'groupdel', 'newusers',
    
    # Package management
    'apt', 'apt-get', 'yum', 'dnf', 'pacman', 'zypper', 'brew',
    'pip', 'npm', 'gem', 'cargo',  # Language package managers
    
    # System monitoring/control
    'htop', 'iotop', 'nethogs', 'tcpdump', 'wireshark', 'strace',
    'dtrace', 'sysctl', 'dmesg',
    
    # Hardware/kernel
    'modprobe', 'insmod', 'rmmod', 'lsmod', 'depmod',
    
    # Security/crypto
    'gpg', 'ssh-keygen', 'openssl', 'certbot',
}

# Commands that can be dangerous with certain flags
DANGEROUS_COMMAND_FLAGS: dict[str, List[str]] = {
    'rm': ['-rf', '--recursive --force', '-r', '--recursive', '-f', '--force'],
    'chmod': ['777', 'a+rwx', '+x', '4777', '2777', '1777'],  # SUID/SGID/sticky
    'find': ['-exec', '-delete', '-execdir'],
    'xargs': ['-I', '--replace', '-0'],
    'tar': ['--absolute-names', '--no-same-owner'],
    'crontab': ['-r', '-e'],  # Remove/edit crontab
    'at': ['-f'],  # Execute file
    'mail': ['-s'],  # Send mail (potential for spam)
    'wall': [],  # Broadcast message
    'write': [],  # Write to user terminal
    'talk': [],  # Talk to user
}


def validate_command_structure(command: str) -> SafetyCheckResult:
    """Validate command structure for common attack patterns.
    
    Args:
        command: Command to validate
        
    Returns:
        SafetyCheckResult indicating if structure is safe
    """
    # Check for excessive command chaining
    chain_count = command.count(';') + command.count('&&') + command.count('||')
    if chain_count > 10:
        return {
            "safe": False,
            "reason": "Excessive command chaining detected (potential DoS)"
        }
    
    # Check for excessive pipe usage
    pipe_count = command.count('|')
    if pipe_count > 20:
        return {
            "safe": False,
            "reason": "Excessive pipe usage detected (potential resource exhaustion)"
        }
    
    # Check for deeply nested command substitution
    nested_depth = 0
    max_depth = 0
    for char in command:
        if char == '(':
            nested_depth += 1
            max_depth = max(max_depth, nested_depth)
        elif char == ')':
            nested_depth = max(0, nested_depth - 1)
    
    if max_depth > 10:
        return {
            "safe": False,
            "reason": "Excessive command nesting detected"
        }
    
    # Check for suspicious repeating patterns (potential obfuscation)
    import re
    if re.search(r'(.)\1{50,}', command):  # 50+ repeated characters
        return {
            "safe": False,
            "reason": "Suspicious character repetition detected"
        }
    
    return {"safe": True, "reason": None}


def detect_obfuscation(command: str) -> SafetyCheckResult:
    """Detect command obfuscation techniques.
    
    Args:
        command: Command to check for obfuscation
        
    Returns:
        SafetyCheckResult indicating if obfuscation is detected
    """
    # Base64 decoding patterns
    if re.search(r'base64\s+(-d|--decode)', command, re.IGNORECASE):
        return {
            "safe": False,
            "reason": "Base64 decoding detected (potential obfuscated command)"
        }
    
    # Hex decoding
    if re.search(r'xxd\s+-r', command) or re.search(r'hex(dump|2bin)', command):
        return {
            "safe": False,
            "reason": "Hex decoding detected (potential obfuscated command)"
        }
    
    # Excessive escaping
    escape_count = command.count('\\') + command.count('\"') + command.count("\'") 
    if escape_count > 20:
        return {
            "safe": False,
            "reason": "Excessive character escaping detected (potential obfuscation)"
        }
    
    # Unicode/encoding manipulation
    if re.search(r'iconv|recode|uconv', command):
        return {
            "safe": False,
            "reason": "Character encoding manipulation detected"
        }
    
    return {"safe": True, "reason": None}


def check_resource_limits(command: str) -> SafetyCheckResult:
    """Check for commands that could exhaust system resources.
    
    Args:
        command: Command to check
        
    Returns:
        SafetyCheckResult indicating if resource limits could be exceeded
    """
    # Large file operations without limits
    if re.search(r'dd\s+.*bs=.*count=(?!\d{1,6}\b)\d+', command):
        return {
            "safe": False,
            "reason": "Large dd operation without reasonable limits"
        }
    
    # Memory-intensive operations
    memory_intensive = ['stress', 'stress-ng', 'memtester', 'yes']
    for cmd in memory_intensive:
        if re.search(rf'\b{cmd}\b', command):
            return {
                "safe": False,
                "reason": f"Memory-intensive command '{cmd}' not allowed"
            }
    
    # Network operations without limits
    if re.search(r'(wget|curl)\s+.*--max-redirect=(?!\d{1,2}\b)\d+', command):
        return {
            "safe": False,
            "reason": "Network operation with excessive redirects"
        }
    
    return {"safe": True, "reason": None}


def is_command_safe(command: str) -> SafetyCheckResult:
    """Check if a command is safe to execute.
    
    Performs multiple layers of security validation:
    1. Pattern matching for known dangerous operations
    2. Command parsing and validation
    3. Path escape detection
    4. Privileged command detection
    
    Args:
        command: Shell command to validate
        
    Returns:
        SafetyCheckResult with safe flag and reason if unsafe
    """
    if not command or not command.strip():
        return {"safe": True, "reason": None}
    
    command = command.strip()
    
    # Check for dangerous patterns
    for pattern in DANGEROUS_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE | re.MULTILINE):
            return {
                "safe": False,
                "reason": f"Dangerous command pattern detected: {pattern}"
            }
    
    # Check for path escape attempts in the raw command
    for pattern in PATH_ESCAPE_PATTERNS:
        if re.search(pattern, command):
            return {
                "safe": False,
                "reason": f"Path escape attempt detected: {pattern}"
            }
    
    # Parse command safely
    try:
        # Use shlex to properly parse shell command
        parts = shlex.split(command)
    except ValueError as e:
        return {
            "safe": False,
            "reason": f"Command parsing failed (possibly malformed quotes): {e}"
        }
    
    if not parts:
        return {"safe": True, "reason": None}
    
    # Check first command/binary
    base_command = parts[0]
    
    # Remove path prefix to get just command name
    if '/' in base_command:
        base_command = base_command.split('/')[-1]
    
    # Check if it's a privileged command
    if base_command in PRIVILEGED_COMMANDS:
        return {
            "safe": False,
            "reason": f"Privileged command not allowed: {base_command}"
        }
    
    # Check for dangerous command + flag combinations
    if base_command in DANGEROUS_COMMAND_FLAGS:
        dangerous_flags = DANGEROUS_COMMAND_FLAGS[base_command]
        command_args = ' '.join(parts[1:])
        
        for flag in dangerous_flags:
            if flag in command_args:
                return {
                    "safe": False,
                    "reason": f"Dangerous flag '{flag}' not allowed with command '{base_command}'"
                }
    
    # Check all arguments for path escapes
    for part in parts[1:]:
        for pattern in PATH_ESCAPE_PATTERNS:
            if re.match(pattern, part):
                return {
                    "safe": False,
                    "reason": f"Path escape attempt in argument: {part}"
                }
    
    # Additional comprehensive checks
    full_args = ' '.join(parts)
    
    # Check command structure
    structure_check = validate_command_structure(command)
    if not structure_check["safe"]:
        return structure_check
    
    # Check for obfuscation
    obfuscation_check = detect_obfuscation(command) 
    if not obfuscation_check["safe"]:
        return obfuscation_check
    
    # Check resource limits
    resource_check = check_resource_limits(command)
    if not resource_check["safe"]:
        return resource_check
    
    # Check for pipe to shell execution
    if '|' in full_args and any(shell in full_args for shell in ['sh', 'bash', 'zsh', 'fish']):
        # Allow simple pipes to safe commands, but not to shells
        if re.search(r'\|\s*(sh|bash|zsh|fish)\b', full_args):
            return {
                "safe": False,
                "reason": "Piping to shell interpreter not allowed"
            }
    
    # Enhanced command substitution check
    if re.search(r'`[^`]*`', command) or re.search(r'\$\([^)]*\)', command):
        # Check for dangerous commands in substitutions
        dangerous_in_substitution = [
            'rm', 'dd', 'mkfs', 'sudo', 'su', 'curl', 'wget', 
            'nc', 'netcat', 'ssh', 'scp', 'rsync'
        ]
        if any(dangerous in command for dangerous in dangerous_in_substitution):
            return {
                "safe": False,
                "reason": "Dangerous command substitution detected"
            }
    
    # Check for input/output redirection to sensitive files
    sensitive_paths = ['/dev/', '/proc/', '/sys/', '/boot/', '/etc/']
    for direction in ['>', '>>', '<']:
        if direction in command:
            redirect_targets = re.findall(rf'{re.escape(direction)}\s*([^\s;&|]+)', command)
            for target in redirect_targets:
                if any(target.startswith(path) for path in sensitive_paths):
                    return {
                        "safe": False,
                        "reason": f"Redirection to sensitive path: {target}"
                    }
    
    return {"safe": True, "reason": None}


def validate_path_safety(workspace: Path, target_path: str) -> None:
    """Validate that a path is safe and stays within workspace.
    
    Args:
        workspace: Workspace root directory
        target_path: Path to validate (relative to workspace)
        
    Raises:
        FileSystemError: When path is unsafe or escapes workspace
    """
    if not target_path:
        raise FileSystemError("Path cannot be empty", ERROR_CODES.EMPTY_PATH)
    
    # Convert to Path for safer handling
    path_obj = Path(target_path)
    
    # Reject absolute paths
    if path_obj.is_absolute():
        raise FileSystemError(
            "Absolute paths are not allowed",
            ERROR_CODES.ABSOLUTE_PATH_REJECTED,
            target_path
        )
    
    # Resolve path relative to workspace
    try:
        full_path = (workspace / target_path).resolve()
        workspace_resolved = workspace.resolve()
        
        # Ensure the resolved path is still within workspace
        full_path.relative_to(workspace_resolved)
        
    except ValueError as e:
        # relative_to() raises ValueError if path is not relative to workspace
        raise FileSystemError(
            "Path escapes workspace boundary",
            ERROR_CODES.PATH_ESCAPE_ATTEMPT,
            target_path
        ) from e
    except Exception as e:
        raise FileSystemError(
            f"Path validation failed: {str(e)}",
            ERROR_CODES.PATH_ESCAPE_ATTEMPT,
            target_path
        ) from e


def is_dangerous_operation(command: str) -> bool:
    """Check if command contains dangerous operations (legacy compatibility).
    
    This is a simplified version of is_command_safe() that returns just a boolean.
    Use is_command_safe() for more detailed safety information.
    
    Args:
        command: Command to check
        
    Returns:
        True if command is dangerous, False if safe
    """
    result = is_command_safe(command)
    return not result["safe"]