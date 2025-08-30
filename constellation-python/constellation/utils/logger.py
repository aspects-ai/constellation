"""Structured logging utilities for ConstellationFS."""

import json
import logging
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, Union
from enum import Enum


class LogLevel(Enum):
    """Log levels for ConstellationFS."""
    
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class ConstellationFormatter(logging.Formatter):
    """Custom formatter for structured logging."""
    
    def __init__(self, include_extra: bool = True, json_format: bool = False):
        """Initialize formatter.
        
        Args:
            include_extra: Include extra fields in log records
            json_format: Output logs in JSON format
        """
        self.include_extra = include_extra
        self.json_format = json_format
        super().__init__()
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record.
        
        Args:
            record: Log record to format
            
        Returns:
            Formatted log string
        """
        # Create base log data
        log_data: Dict[str, Any] = {
            'timestamp': datetime.fromtimestamp(record.created).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
        }
        
        # Add location info for debug/error levels
        if record.levelno <= logging.DEBUG or record.levelno >= logging.ERROR:
            log_data['filename'] = record.filename
            log_data['function'] = record.funcName
            log_data['line_number'] = record.lineno
        
        # Add extra fields if enabled
        if self.include_extra:
            extra_fields = {
                key: value for key, value in record.__dict__.items()
                if key not in {
                    'name', 'msg', 'args', 'levelname', 'levelno', 'pathname',
                    'filename', 'module', 'lineno', 'funcName', 'created',
                    'msecs', 'relativeCreated', 'thread', 'threadName',
                    'processName', 'process', 'message', 'exc_info',
                    'exc_text', 'stack_info'
                }
            }
            if extra_fields:
                log_data['extra'] = extra_fields
        
        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        
        # Format output
        if self.json_format:
            return json.dumps(log_data, default=str, separators=(',', ':'))
        else:
            return self._format_human_readable(log_data)
    
    def _format_human_readable(self, log_data: Dict[str, Any]) -> str:
        """Format log data in human-readable format.
        
        Args:
            log_data: Log data dictionary
            
        Returns:
            Human-readable log string
        """
        timestamp = log_data['timestamp'].split('T')[1].split('.')[0]  # HH:MM:SS
        level = log_data['level']
        logger = log_data['logger'].split('.')[-1]  # Just the last component
        message = log_data['message']
        
        base_format = f"{timestamp} [{level:<7}] {logger}: {message}"
        
        # Add location for debug/error
        if 'filename' in log_data:
            location = f" ({log_data['filename']}:{log_data['line_number']})"
            base_format += location
        
        # Add extra fields
        if 'extra' in log_data and log_data['extra']:
            extra_str = ' '.join([f"{k}={v}" for k, v in log_data['extra'].items()])
            base_format += f" | {extra_str}"
        
        # Add exception
        if 'exception' in log_data:
            base_format += f"\n{log_data['exception']}"
        
        return base_format


class ConstellationLogger:
    """Enhanced logger for ConstellationFS operations."""
    
    def __init__(
        self,
        name: str,
        level: Union[str, LogLevel] = LogLevel.INFO,
        json_format: bool = False,
        log_file: Optional[Union[str, Path]] = None,
        include_extra: bool = True
    ):
        """Initialize logger.
        
        Args:
            name: Logger name
            level: Log level
            json_format: Use JSON formatting
            log_file: Optional log file path
            include_extra: Include extra fields in logs
        """
        self.name = name
        self.logger = logging.getLogger(name)
        
        # Convert level if needed
        if isinstance(level, LogLevel):
            level = level.value
        
        self.logger.setLevel(getattr(logging, level.upper()))
        
        # Clear existing handlers to avoid duplicates
        self.logger.handlers.clear()
        
        # Create formatter
        formatter = ConstellationFormatter(include_extra, json_format)
        
        # Add console handler
        console_handler = logging.StreamHandler(sys.stderr)
        console_handler.setFormatter(formatter)
        self.logger.addHandler(console_handler)
        
        # Add file handler if specified
        if log_file:
            log_path = Path(log_file)
            log_path.parent.mkdir(parents=True, exist_ok=True)
            
            file_handler = logging.FileHandler(log_path)
            file_handler.setFormatter(formatter)
            self.logger.addHandler(file_handler)
    
    def debug(self, message: str, **kwargs: Any) -> None:
        """Log debug message."""
        self.logger.debug(message, extra=kwargs)
    
    def info(self, message: str, **kwargs: Any) -> None:
        """Log info message."""
        self.logger.info(message, extra=kwargs)
    
    def warning(self, message: str, **kwargs: Any) -> None:
        """Log warning message."""
        self.logger.warning(message, extra=kwargs)
    
    def error(self, message: str, **kwargs: Any) -> None:
        """Log error message."""
        self.logger.error(message, extra=kwargs)
    
    def critical(self, message: str, **kwargs: Any) -> None:
        """Log critical message."""
        self.logger.critical(message, extra=kwargs)
    
    def exception(self, message: str, **kwargs: Any) -> None:
        """Log exception with traceback."""
        self.logger.exception(message, extra=kwargs)
    
    def command_execution(self, command: str, user_id: str, workspace: str, 
                         duration_ms: Optional[float] = None, success: bool = True, 
                         output_length: Optional[int] = None, **kwargs: Any) -> None:
        """Log command execution event.
        
        Args:
            command: Command that was executed
            user_id: User who executed the command
            workspace: Workspace path
            duration_ms: Execution duration in milliseconds
            success: Whether command succeeded
            output_length: Length of command output
            **kwargs: Additional context
        """
        extra = {
            'event_type': 'command_execution',
            'command': command,
            'user_id': user_id,
            'workspace': workspace,
            'success': success,
            **kwargs
        }
        
        if duration_ms is not None:
            extra['duration_ms'] = duration_ms
        
        if output_length is not None:
            extra['output_length'] = output_length
        
        level_method = self.info if success else self.error
        status = "succeeded" if success else "failed"
        level_method(f"Command {status}: {command[:100]}...", **extra)
    
    def security_event(self, event_type: str, command: str, user_id: str, 
                      reason: str, severity: str = "warning", **kwargs: Any) -> None:
        """Log security event.
        
        Args:
            event_type: Type of security event
            command: Command that triggered the event
            user_id: User involved
            reason: Reason for security trigger
            severity: Severity level (info, warning, error, critical)
            **kwargs: Additional context
        """
        extra = {
            'event_type': 'security_event',
            'security_event_type': event_type,
            'command': command,
            'user_id': user_id,
            'reason': reason,
            **kwargs
        }
        
        message = f"Security event [{event_type}]: {reason}"
        
        # Log at appropriate level based on severity
        if severity == "critical":
            self.critical(message, **extra)
        elif severity == "error":
            self.error(message, **extra)
        elif severity == "warning":
            self.warning(message, **extra)
        else:
            self.info(message, **extra)
    
    def file_operation(self, operation: str, path: str, user_id: str, 
                      workspace: str, success: bool = True, 
                      file_size: Optional[int] = None, **kwargs: Any) -> None:
        """Log file operation event.
        
        Args:
            operation: Type of operation (read, write, delete, etc.)
            path: File path
            user_id: User performing operation
            workspace: Workspace path
            success: Whether operation succeeded
            file_size: File size in bytes
            **kwargs: Additional context
        """
        extra = {
            'event_type': 'file_operation',
            'operation': operation,
            'path': path,
            'user_id': user_id,
            'workspace': workspace,
            'success': success,
            **kwargs
        }
        
        if file_size is not None:
            extra['file_size'] = file_size
        
        level_method = self.info if success else self.error
        status = "succeeded" if success else "failed"
        level_method(f"File {operation} {status}: {path}", **extra)
    
    def workspace_event(self, event_type: str, user_id: str, workspace: str, 
                       **kwargs: Any) -> None:
        """Log workspace-related event.
        
        Args:
            event_type: Type of workspace event (created, cleaned, accessed, etc.)
            user_id: User ID
            workspace: Workspace path
            **kwargs: Additional context
        """
        extra = {
            'event_type': 'workspace_event',
            'workspace_event_type': event_type,
            'user_id': user_id,
            'workspace': workspace,
            **kwargs
        }
        
        self.info(f"Workspace {event_type}: {user_id}", **extra)
    
    def performance_metric(self, metric_name: str, value: Union[int, float], 
                          unit: str, **kwargs: Any) -> None:
        """Log performance metric.
        
        Args:
            metric_name: Name of the metric
            value: Metric value
            unit: Metric unit (ms, bytes, count, etc.)
            **kwargs: Additional context
        """
        extra = {
            'event_type': 'performance_metric',
            'metric_name': metric_name,
            'value': value,
            'unit': unit,
            **kwargs
        }
        
        self.debug(f"Metric {metric_name}: {value} {unit}", **extra)


# Global logger instance
_default_logger: Optional[ConstellationLogger] = None


def get_logger(
    name: Optional[str] = None,
    level: Union[str, LogLevel] = LogLevel.INFO,
    json_format: bool = False,
    log_file: Optional[Union[str, Path]] = None
) -> ConstellationLogger:
    """Get or create a ConstellationFS logger.
    
    Args:
        name: Logger name (defaults to 'constellation')
        level: Log level
        json_format: Use JSON formatting
        log_file: Optional log file path
        
    Returns:
        ConstellationLogger instance
    """
    global _default_logger
    
    if name is None:
        name = 'constellation'
    
    # Return cached default logger if parameters match
    if (name == 'constellation' and _default_logger is not None and 
        not json_format and log_file is None):
        return _default_logger
    
    logger = ConstellationLogger(name, level, json_format, log_file)
    
    # Cache as default if it's the main logger
    if name == 'constellation' and _default_logger is None:
        _default_logger = logger
    
    return logger


def configure_logging(
    level: Union[str, LogLevel] = LogLevel.INFO,
    json_format: bool = False,
    log_file: Optional[Union[str, Path]] = None,
    include_extra: bool = True
) -> None:
    """Configure default logging for ConstellationFS.
    
    Args:
        level: Log level
        json_format: Use JSON formatting
        log_file: Optional log file path
        include_extra: Include extra fields in logs
    """
    global _default_logger
    _default_logger = ConstellationLogger(
        'constellation',
        level,
        json_format,
        log_file,
        include_extra
    )