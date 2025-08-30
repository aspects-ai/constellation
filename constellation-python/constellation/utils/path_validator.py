"""Path validation utilities for ConstellationFS."""

import os
import re
from pathlib import Path
from typing import Dict, List, Set, Optional
from ..types import SafetyCheckResult


class PathValidator:
    """Validates file paths for security and safety."""
    
    def __init__(self, workspace: str, strict_mode: bool = True):
        """Initialize path validator.
        
        Args:
            workspace: Absolute path to the workspace directory
            strict_mode: Enable strict validation mode
        """
        self.workspace = Path(workspace).resolve()
        self.strict_mode = strict_mode
        
        # Dangerous path patterns
        self.dangerous_patterns: Set[str] = {
            # System directories
            '/etc/', '/sys/', '/proc/', '/dev/', '/boot/', '/root/',
            # Windows system paths
            'C:\\Windows\\', 'C:\\System32\\', 'C:\\Program Files\\',
            # SSH and security
            '/.ssh/', '/.gnupg/', '/etc/shadow', '/etc/passwd',
            # Critical config files
            '.bashrc', '.bash_profile', '.zshrc', '.profile',
            # Package managers
            '/usr/bin/', '/usr/sbin/', '/sbin/', '/bin/',
        }
        
        # Dangerous file extensions
        self.dangerous_extensions: Set[str] = {
            '.exe', '.bat', '.cmd', '.com', '.scr', '.pif',
            '.msi', '.vbs', '.js', '.jar', '.app', '.dmg',
            '.deb', '.rpm', '.pkg'
        }
        
        # Suspicious filename patterns
        self.suspicious_patterns: List[re.Pattern] = [
            re.compile(r'^\.{3,}'),  # Multiple dots
            re.compile(r'[\x00-\x1f\x7f-\x9f]'),  # Control characters
            re.compile(r'^(con|prn|aux|nul|com[1-9]|lpt[1-9])$', re.IGNORECASE),  # Windows reserved
            re.compile(r'[<>:"|?*]'),  # Windows invalid chars
            re.compile(r'\.{2,}'),  # Multiple consecutive dots
        ]
    
    def validate_path(self, path: str) -> SafetyCheckResult:
        """Comprehensive path validation.
        
        Args:
            path: Path to validate
            
        Returns:
            SafetyCheckResult with validation outcome
        """
        # Check for null bytes or control characters
        if '\x00' in path or any(ord(c) < 32 for c in path if c not in '\t\n\r'):
            return {
                "safe": False,
                "reason": "Path contains null bytes or control characters"
            }
        
        # Check path length (prevent DoS)
        if len(path) > 4096:
            return {
                "safe": False,
                "reason": "Path too long (potential DoS)"
            }
        
        # Check for dangerous patterns
        path_lower = path.lower()
        for pattern in self.dangerous_patterns:
            if pattern.lower() in path_lower:
                return {
                    "safe": False,
                    "reason": f"Path contains dangerous pattern: {pattern}"
                }
        
        # Validate path structure
        structure_result = self._validate_path_structure(path)
        if not structure_result["safe"]:
            return structure_result
        
        # Check file extension
        ext_result = self._check_file_extension(path)
        if not ext_result["safe"]:
            return ext_result
        
        # Check workspace containment
        containment_result = self._check_workspace_containment(path)
        if not containment_result["safe"]:
            return containment_result
        
        # Check for symlink attacks (if path exists)
        if os.path.exists(path):
            symlink_result = self._check_symlink_safety(path)
            if not symlink_result["safe"]:
                return symlink_result
        
        return {"safe": True, "reason": None}
    
    def _validate_path_structure(self, path: str) -> SafetyCheckResult:
        """Validate basic path structure."""
        # Check for path traversal attempts
        if '..' in path:
            return {
                "safe": False,
                "reason": "Path traversal attempt detected (..)"
            }
        
        # Check path depth
        path_depth = path.count('/') + path.count('\\')
        if path_depth > 32:  # Reasonable depth limit
            return {
                "safe": False,
                "reason": "Path depth too deep (potential DoS)"
            }
        
        # Check for multiple consecutive separators
        if '//' in path or '\\\\' in path:
            return {
                "safe": False,
                "reason": "Multiple consecutive path separators detected"
            }
        
        # Check for suspicious filename patterns
        filename = os.path.basename(path)
        if filename:
            # Check for hidden files in strict mode
            if self.strict_mode and filename.startswith('.') and filename not in {'.', '..'}:
                return {
                    "safe": False,
                    "reason": "Hidden files not allowed in strict mode"
                }
            
            # Check suspicious patterns
            for pattern in self.suspicious_patterns:
                if pattern.search(filename):
                    return {
                        "safe": False,
                        "reason": f"Suspicious filename pattern: {filename}"
                    }
        
        return {"safe": True, "reason": None}
    
    def _check_file_extension(self, path: str) -> SafetyCheckResult:
        """Check file extension for dangerous types."""
        if not path:
            return {"safe": True, "reason": None}
        
        # Get file extension
        _, ext = os.path.splitext(path.lower())
        
        if ext in self.dangerous_extensions:
            return {
                "safe": False,
                "reason": f"Dangerous file extension: {ext}"
            }
        
        return {"safe": True, "reason": None}
    
    def _check_workspace_containment(self, path: str) -> SafetyCheckResult:
        """Ensure path is within workspace boundaries."""
        try:
            # Convert to absolute path and resolve
            abs_path = Path(path).resolve()
            
            # Check if path is within workspace
            try:
                abs_path.relative_to(self.workspace)
                return {"safe": True, "reason": None}
            except ValueError:
                return {
                    "safe": False,
                    "reason": "Path is outside workspace boundaries"
                }
        except (OSError, ValueError) as e:
            return {
                "safe": False,
                "reason": f"Invalid path: {str(e)}"
            }
    
    def _check_symlink_safety(self, path: str) -> SafetyCheckResult:
        """Check for symlink-based attacks."""
        try:
            path_obj = Path(path)
            
            # Check each component in the path
            current = path_obj
            while current != current.parent:
                if current.is_symlink():
                    # Resolve symlink target
                    target = current.resolve()
                    
                    # Ensure symlink target is within workspace
                    try:
                        target.relative_to(self.workspace)
                    except ValueError:
                        return {
                            "safe": False,
                            "reason": "Symlink points outside workspace"
                        }
                
                current = current.parent
            
            return {"safe": True, "reason": None}
        except (OSError, ValueError) as e:
            return {
                "safe": False,
                "reason": f"Symlink check failed: {str(e)}"
            }
    
    def is_safe_filename(self, filename: str) -> bool:
        """Check if filename is safe."""
        result = self.validate_path(filename)
        return result["safe"]
    
    def sanitize_filename(self, filename: str) -> str:
        """Sanitize filename by removing dangerous characters."""
        # Remove control characters
        sanitized = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', filename)
        
        # Replace dangerous characters with underscore
        sanitized = re.sub(r'[<>:"|?*\\]', '_', sanitized)
        
        # Remove path separators
        sanitized = sanitized.replace('/', '_').replace('\\', '_')
        
        # Limit length
        if len(sanitized) > 255:
            name, ext = os.path.splitext(sanitized)
            max_name_len = 255 - len(ext)
            sanitized = name[:max_name_len] + ext
        
        # Ensure not empty
        if not sanitized:
            sanitized = 'unnamed_file'
        
        return sanitized


def validate_path_safety(path: str, workspace: str, strict_mode: bool = True) -> SafetyCheckResult:
    """Convenience function for path validation.
    
    Args:
        path: Path to validate
        workspace: Workspace root directory
        strict_mode: Enable strict validation
        
    Returns:
        SafetyCheckResult with validation outcome
    """
    validator = PathValidator(workspace, strict_mode)
    return validator.validate_path(path)


def check_symlink_safety(path: str, workspace: str) -> SafetyCheckResult:
    """Check if symlinks in path are safe.
    
    Args:
        path: Path to check
        workspace: Workspace root directory
        
    Returns:
        SafetyCheckResult with symlink safety status
    """
    validator = PathValidator(workspace)
    return validator._check_symlink_safety(path)