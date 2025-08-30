"""Safe POSIX command generators for ConstellationFS."""

import shlex
from typing import Optional


class POSIXCommands:
    """Utility class for generating safe POSIX commands."""
    
    @staticmethod
    def ls(
        path: Optional[str] = None,
        long_format: bool = False,
        all_files: bool = False,
        pattern: Optional[str] = None
    ) -> str:
        """Generate ls command with safe arguments.
        
        Args:
            path: Directory path to list
            long_format: Use long format (-l)
            all_files: Show hidden files (-a)
            pattern: File pattern to match
            
        Returns:
            Safe ls command string
        """
        cmd_parts = ['ls']
        
        # Add flags
        flags = ''
        if long_format:
            flags += 'l'
        if all_files:
            flags += 'a'
        
        if flags:
            cmd_parts.append(f'-{flags}')
        
        # Add path if provided
        if path:
            cmd_parts.append(shlex.quote(path))
        
        # Add pattern if provided
        if pattern:
            # Escape the pattern for shell safety
            escaped_pattern = shlex.quote(pattern)
            cmd_parts.append(escaped_pattern)
        
        return ' '.join(cmd_parts)
    
    @staticmethod
    def find(
        path: str = '.',
        name_pattern: Optional[str] = None,
        file_type: Optional[str] = None,
        max_depth: Optional[int] = None,
        executable_only: bool = False
    ) -> str:
        """Generate find command with safe arguments.
        
        Args:
            path: Starting path for search
            name_pattern: File name pattern (-name)
            file_type: File type (f=file, d=directory)
            max_depth: Maximum search depth
            executable_only: Only find executable files
            
        Returns:
            Safe find command string
        """
        cmd_parts = ['find', shlex.quote(path)]
        
        # Add max depth first (must come before other conditions)
        if max_depth is not None:
            cmd_parts.extend(['-maxdepth', str(max_depth)])
        
        # Add type filter
        if file_type in ('f', 'd', 'l'):  # file, directory, link
            cmd_parts.extend(['-type', file_type])
        
        # Add name pattern
        if name_pattern:
            cmd_parts.extend(['-name', shlex.quote(name_pattern)])
        
        # Add executable filter
        if executable_only:
            cmd_parts.extend(['-executable'])
        
        return ' '.join(cmd_parts)
    
    @staticmethod
    def cat(*files: str, number_lines: bool = False, show_ends: bool = False) -> str:
        """Generate cat command with safe file arguments.
        
        Args:
            files: Files to concatenate
            number_lines: Number output lines (-n)
            show_ends: Show line endings (-E)
            
        Returns:
            Safe cat command string
        """
        if not files:
            return 'cat'
        
        cmd_parts = ['cat']
        
        # Add flags
        flags = ''
        if number_lines:
            flags += 'n'
        if show_ends:
            flags += 'E'
        
        if flags:
            cmd_parts.append(f'-{flags}')
        
        # Add files with proper escaping
        for file in files:
            cmd_parts.append(shlex.quote(file))
        
        return ' '.join(cmd_parts)
    
    @staticmethod
    def head(file: Optional[str] = None, lines: int = 10, bytes_count: Optional[int] = None) -> str:
        """Generate head command with safe arguments.
        
        Args:
            file: File to read from (None for stdin)
            lines: Number of lines to show (-n)
            bytes_count: Number of bytes to show (-c)
            
        Returns:
            Safe head command string
        """
        cmd_parts = ['head']
        
        # Add count specification
        if bytes_count is not None:
            cmd_parts.extend(['-c', str(bytes_count)])
        else:
            cmd_parts.extend(['-n', str(lines)])
        
        # Add file if specified
        if file:
            cmd_parts.append(shlex.quote(file))
        
        return ' '.join(cmd_parts)
    
    @staticmethod
    def tail(
        file: Optional[str] = None, 
        lines: int = 10, 
        bytes_count: Optional[int] = None,
        follow: bool = False
    ) -> str:
        """Generate tail command with safe arguments.
        
        Args:
            file: File to read from (None for stdin)
            lines: Number of lines to show (-n)
            bytes_count: Number of bytes to show (-c)
            follow: Follow file changes (-f)
            
        Returns:
            Safe tail command string
        """
        cmd_parts = ['tail']
        
        # Add follow flag
        if follow:
            cmd_parts.append('-f')
        
        # Add count specification
        if bytes_count is not None:
            cmd_parts.extend(['-c', str(bytes_count)])
        else:
            cmd_parts.extend(['-n', str(lines)])
        
        # Add file if specified
        if file:
            cmd_parts.append(shlex.quote(file))
        
        return ' '.join(cmd_parts)
    
    @staticmethod
    def wc(
        *files: str,
        lines: bool = False,
        words: bool = False,
        chars: bool = False,
        bytes_count: bool = False
    ) -> str:
        """Generate wc command with safe arguments.
        
        Args:
            files: Files to count
            lines: Count lines (-l)
            words: Count words (-w)
            chars: Count characters (-m)
            bytes_count: Count bytes (-c)
            
        Returns:
            Safe wc command string
        """
        cmd_parts = ['wc']
        
        # Add flags
        flags = ''
        if lines:
            flags += 'l'
        if words:
            flags += 'w'
        if chars:
            flags += 'm'
        if bytes_count:
            flags += 'c'
        
        # If no specific flags, default to all
        if not flags:
            flags = 'lwc'
        
        cmd_parts.append(f'-{flags}')
        
        # Add files with proper escaping
        for file in files:
            cmd_parts.append(shlex.quote(file))
        
        return ' '.join(cmd_parts)
    
    @classmethod
    def safe_pipeline(cls, *commands: str) -> str:
        """Create a safe command pipeline.
        
        Args:
            commands: Individual commands to pipe together
            
        Returns:
            Safe pipeline command string
        """
        if not commands:
            return ''
        
        # Each command should already be properly escaped by the individual methods
        return ' | '.join(commands)
    
    @classmethod
    def safe_redirect(cls, command: str, output_file: str, append: bool = False) -> str:
        """Create a safe output redirection.
        
        Args:
            command: Command to redirect
            output_file: Output file path
            append: Use append mode (>>)
            
        Returns:
            Safe command with redirection
        """
        redirect_op = '>>' if append else '>'
        escaped_file = shlex.quote(output_file)
        return f'{command} {redirect_op} {escaped_file}'