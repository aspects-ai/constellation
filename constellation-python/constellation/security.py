"""
ConstellationFS Security Module

Unified security validation system for commands, paths, user IDs, and filenames.
This module provides a single, consistent approach to all security validation.
"""

import re
import shlex
from pathlib import Path
from typing import List, Set, Dict, Optional, TypedDict
from dataclasses import dataclass, field

from .types import FileSystemError
from .constants import ERROR_CODES


class SecurityResult(TypedDict):
    """Result of a security validation check."""
    safe: bool
    reason: Optional[str]


@dataclass
class SecurityConfig:
    """Unified configuration for all security validations."""
    
    # Path validation
    max_path_length: int = 4096
    allow_absolute_paths: bool = False
    
    # File validation  
    max_file_size_mb: int = 100
    max_files_per_directory: int = 10000
    allow_symlinks: bool = False
    allow_hidden_files: bool = True
    
    # User validation
    max_user_id_length: int = 64
    
    # Configurable block lists
    blocked_extensions: Set[str] = field(default_factory=set)
    blocked_filenames: Set[str] = field(default_factory=set)
    blocked_commands: Set[str] = field(default_factory=set)
    reserved_user_names: Set[str] = field(default_factory=set)
    
    def __post_init__(self):
        """Initialize default block lists if not provided."""
        if not self.blocked_extensions:
            self.blocked_extensions = {
                '.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.js', '.jse',
                '.jar', '.app', '.deb', '.rpm', '.dmg', '.pkg', '.msi'
            }
        
        if not self.blocked_filenames:
            self.blocked_filenames = {
                '.htaccess', '.htpasswd', 'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519',
                'shadow', 'passwd', 'sudoers', 'authorized_keys', 'known_hosts',
                'CON', 'PRN', 'AUX', 'NUL',  # Windows reserved
                'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
                'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
            }
        
        if not self.blocked_commands:
            self.blocked_commands = {
                # Privilege escalation
                'sudo', 'su', 'doas', 'runuser',
                # File system operations  
                'chmod', 'chown', 'chgrp', 'mount', 'umount', 'fsck', 'mkfs',
                # System control
                'systemctl', 'service', 'init', 'shutdown', 'reboot', 'halt',
                # Package management
                'apt', 'apt-get', 'yum', 'dnf', 'pacman', 'brew', 'pip', 'npm',
                # Network tools that can be dangerous
                'nc', 'netcat', 'ncat', 'socat'
            }
        
        if not self.reserved_user_names:
            self.reserved_user_names = {
                'root', 'admin', 'system', 'daemon', 'bin', 'sys', 'tmp', 'temp',
                'null', 'undefined', 'default', 'guest', 'anonymous'
            }


class SecurityValidator:
    """Unified security validator for all ConstellationFS security checks."""
    
    # Dangerous patterns for commands
    DANGEROUS_COMMAND_PATTERNS = [
        # System destruction
        r'rm\s+-rf\s*/',
        r'rm\s+-rf\s*~',
        r'dd\s+if=/dev/(zero|random)',
        r'mkfs\.',
        
        # Remote code execution
        r'curl.*\|.*sh',
        r'wget.*\|.*sh',
        r'curl.*\|.*bash',
        r'wget.*\|.*bash',
        
        # Fork bombs
        r':\(\)\{.*\|.*&\};',
        r'while\s+true.*do',
        
        # Privilege escalation
        r'sudo\s+',
        r'su\s+',
    ]
    
    # Path patterns that indicate security issues
    DANGEROUS_PATH_PATTERNS = [
        # Absolute paths to sensitive areas
        r'^/etc/',
        r'^/proc/',
        r'^/sys/',
        r'^/dev/',
        r'^/root/',
        r'^/boot/',
        r'^/lib/',
        r'^/usr/',
        r'^/var/',
        
        # Directory traversal
        r'\.\./',
        r'/\.\.',
        r'^\.\.',
        
        # Home directory access
        r'^~/',
        r'\$HOME',
        r'\$\{HOME\}',
        
        # Absolute path indicators
        r'^/',
    ]
    
    def __init__(self, config: Optional[SecurityConfig] = None):
        self.config = config or SecurityConfig()
    
    def validate_command(self, command: str) -> SecurityResult:
        """Validate that a command is safe to execute."""
        if not command or not command.strip():
            return {"safe": True, "reason": None}
        
        command = command.strip()
        
        # Check dangerous patterns first
        for pattern in self.DANGEROUS_COMMAND_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                return {"safe": False, "reason": f"Dangerous command pattern detected"}
        
        # Parse command safely
        try:
            parts = shlex.split(command)
        except ValueError:
            return {"safe": False, "reason": "Command contains malformed quotes or syntax"}
        
        if not parts:
            return {"safe": True, "reason": None}
        
        # Check if base command is blocked
        base_command = Path(parts[0]).name  # Remove path prefix
        if base_command in self.config.blocked_commands:
            return {"safe": False, "reason": f"Command '{base_command}' is not allowed"}
        
        # Check for dangerous flag combinations
        if base_command == 'rm' and any('-rf' in arg or '-r' in command and '-f' in command for arg in parts[1:]):
            return {"safe": False, "reason": "rm -rf is not allowed"}
        
        # Check for pipe to shell
        if '|' in command and re.search(r'\|\s*(sh|bash|zsh|fish)\b', command):
            return {"safe": False, "reason": "Piping to shell interpreter not allowed"}
        
        # Check for command substitution with dangerous commands
        if re.search(r'`[^`]*`|\$\([^)]*\)', command):
            if any(dangerous in command for dangerous in ['rm', 'sudo', 'curl', 'wget']):
                return {"safe": False, "reason": "Dangerous command substitution detected"}
        
        return {"safe": True, "reason": None}
    
    def validate_path(self, path: str) -> SecurityResult:
        """Validate that a path is safe (pattern-based checking only)."""
        if not path:
            return {"safe": False, "reason": "Path cannot be empty"}
        
        if len(path) > self.config.max_path_length:
            return {"safe": False, "reason": f"Path too long (max {self.config.max_path_length} chars)"}
        
        # Check for dangerous path patterns
        for pattern in self.DANGEROUS_PATH_PATTERNS:
            if re.search(pattern, path):
                return {"safe": False, "reason": "Path contains dangerous pattern"}
        
        # Check for null bytes and control characters
        if '\0' in path or any(ord(char) < 32 for char in path if char not in '\t\n\r'):
            return {"safe": False, "reason": "Path contains null bytes or control characters"}
        
        return {"safe": True, "reason": None}
    
    def validate_workspace_path(self, path: str, workspace_root: Path) -> SecurityResult:
        """Validate path is safe AND stays within workspace boundaries."""
        # First do basic path validation
        basic_check = self.validate_path(path)
        if not basic_check["safe"]:
            return basic_check
        
        # Don't allow absolute paths for workspace operations
        path_obj = Path(path)
        if path_obj.is_absolute() and not self.config.allow_absolute_paths:
            return {"safe": False, "reason": "Absolute paths not allowed in workspace operations"}
        
        # Check workspace boundaries
        try:
            if path_obj.is_absolute():
                resolved_path = path_obj.resolve()
            else:
                resolved_path = (workspace_root / path).resolve()
            
            workspace_resolved = workspace_root.resolve()
            resolved_path.relative_to(workspace_resolved)
            
        except ValueError:
            return {"safe": False, "reason": "Path escapes workspace boundary"}
        except Exception:
            return {"safe": False, "reason": "Path resolution failed"}
        
        return {"safe": True, "reason": None}
    
    def validate_user_id(self, user_id: str) -> SecurityResult:
        """Validate that a user ID is safe."""
        if not user_id or not isinstance(user_id, str):
            return {"safe": False, "reason": "User ID must be a non-empty string"}
        
        user_id = user_id.strip()
        if not user_id:
            return {"safe": False, "reason": "User ID cannot be empty or whitespace"}
        
        if len(user_id) > self.config.max_user_id_length:
            return {"safe": False, "reason": f"User ID too long (max {self.config.max_user_id_length} chars)"}
        
        # Check for dangerous characters
        if re.search(r'[<>:"/\\|?*@\0]', user_id):
            return {"safe": False, "reason": "User ID contains dangerous characters"}
        
        # Check for path traversal
        if '..' in user_id or '/' in user_id or '\\' in user_id:
            return {"safe": False, "reason": "User ID contains path traversal characters"}
        
        # Check reserved names
        if user_id.lower() in self.config.reserved_user_names:
            return {"safe": False, "reason": f"User ID '{user_id}' is reserved"}
        
        # Check for control characters
        if any(ord(char) < 32 for char in user_id):
            return {"safe": False, "reason": "User ID contains control characters"}
        
        return {"safe": True, "reason": None}
    
    def validate_filename(self, filename: str) -> SecurityResult:
        """Validate that a filename is safe."""
        if not filename:
            return {"safe": False, "reason": "Filename cannot be empty"}
        
        # Check blocked filenames (case-insensitive)
        if filename.lower() in {f.lower() for f in self.config.blocked_filenames}:
            return {"safe": False, "reason": f"Filename '{filename}' is not allowed"}
        
        # Check file extension
        suffix = Path(filename).suffix.lower()
        if suffix in self.config.blocked_extensions:
            return {"safe": False, "reason": f"File extension '{suffix}' is not allowed"}
        
        # Check for dangerous characters
        if re.search(r'[<>:"|?*\0]', filename):
            return {"safe": False, "reason": "Filename contains dangerous characters"}
        
        # Check for hidden files if not allowed
        if not self.config.allow_hidden_files and filename.startswith('.'):
            return {"safe": False, "reason": "Hidden files are not allowed"}
        
        return {"safe": True, "reason": None}


# Global default validator instance
_default_validator = SecurityValidator()

# Convenience functions that use the default validator
def is_command_safe(command: str) -> SecurityResult:
    """Check if a command is safe using default security config."""
    return _default_validator.validate_command(command)

def is_path_safe(path: str) -> bool:
    """Check if a path is safe using default config (returns bool for compatibility)."""
    result = _default_validator.validate_path(path)
    return result["safe"]

def validate_user_path(user_id: str, path: str) -> bool:
    """Validate user ID and path combination (returns bool for compatibility)."""
    user_check = _default_validator.validate_user_id(user_id)
    if not user_check["safe"]:
        return False
    
    path_check = _default_validator.validate_path(path)
    return path_check["safe"]

def is_dangerous_operation(command: str) -> bool:
    """Check if command is dangerous (legacy compatibility)."""
    result = _default_validator.validate_command(command)
    return not result["safe"]

def validate_path_safety(workspace: Path, target_path: str) -> None:
    """Validate path safety and workspace boundaries (legacy compatibility)."""
    result = _default_validator.validate_workspace_path(target_path, workspace)
    if not result["safe"]:
        raise FileSystemError(
            result["reason"] or "Path validation failed",
            ERROR_CODES.UNSAFE_PATH,
            target_path
        )

# Additional exports for Phase 4 compatibility
def create_safe_workspace_validator(**kwargs) -> SecurityValidator:
    """Create a security validator with custom settings."""
    config = SecurityConfig(**kwargs)
    return SecurityValidator(config)

# Type aliases for backward compatibility
WorkspaceSafetyValidator = SecurityValidator
WorkspaceSafetyConfig = SecurityConfig
SafetyCheckResult = SecurityResult