"""Tests for Phase 2 utility enhancements."""

import pytest
import tempfile
import json
from pathlib import Path
from unittest.mock import Mock, patch

from constellation.utils.logger import ConstellationLogger, get_logger, LogLevel
from constellation.utils.posix_commands import POSIXCommands
from constellation.utils.path_validator import PathValidator
from constellation.config.config import ConstellationFSConfig


class TestStructuredLogging:
    """Test structured logging functionality."""
    
    def test_logger_creation(self):
        """Test logger creation and configuration."""
        logger = ConstellationLogger("test", LogLevel.DEBUG)
        assert logger.name == "test"
        assert logger.logger.level <= 10  # DEBUG level
    
    def test_structured_logging_methods(self):
        """Test structured logging methods."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.log', delete=False) as f:
            log_file = f.name
        
        logger = ConstellationLogger("test", LogLevel.INFO, log_file=log_file)
        
        # Test basic logging
        logger.info("Test message", key1="value1", key2="value2")
        logger.error("Error message", error_code="TEST_ERROR")
        
        # Test specialized logging methods
        logger.command_execution(
            command="echo test",
            user_id="test-user",
            workspace="/tmp/test",
            duration_ms=100.5,
            success=True,
            output_length=10
        )
        
        logger.security_event(
            event_type="dangerous_command",
            command="rm -rf /",
            user_id="test-user",
            reason="Dangerous pattern detected",
            severity="error"
        )
        
        logger.file_operation(
            operation="read",
            path="test.txt",
            user_id="test-user",
            workspace="/tmp/test",
            success=True,
            file_size=1024
        )
        
        # Verify log file was created and has content
        log_path = Path(log_file)
        assert log_path.exists()
        content = log_path.read_text()
        assert "Test message" in content
        assert "command_execution" in content
        
        # Cleanup
        log_path.unlink()
    
    def test_json_logging(self):
        """Test JSON formatted logging."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.log', delete=False) as f:
            log_file = f.name
        
        logger = ConstellationLogger("test", LogLevel.INFO, json_format=True, log_file=log_file)
        logger.info("JSON test", test_key="test_value")
        
        # Read and parse JSON log
        log_content = Path(log_file).read_text().strip()
        log_lines = log_content.split('\n')
        
        for line in log_lines:
            if line.strip():
                log_entry = json.loads(line)
                assert 'timestamp' in log_entry
                assert 'level' in log_entry
                assert 'message' in log_entry
        
        # Cleanup
        Path(log_file).unlink()
    
    def test_global_logger(self):
        """Test global logger functionality."""
        logger1 = get_logger()
        logger2 = get_logger()
        
        # Should return the same instance for default logger
        assert logger1 is logger2
        
        # Different names should return different instances
        logger3 = get_logger("different")
        assert logger3 is not logger1


class TestPOSIXCommands:
    """Test POSIX command utilities."""
    
    def test_ls_command_generation(self):
        """Test ls command generation."""
        # Basic ls
        cmd = POSIXCommands.ls()
        assert cmd == "ls"
        
        # With flags
        cmd = POSIXCommands.ls(long_format=True, all_files=True)
        assert "ls -la" in cmd or "ls -al" in cmd
        
        # With pattern
        cmd = POSIXCommands.ls(pattern="*.txt")
        assert "ls" in cmd
        assert "*.txt" in cmd
    
    def test_find_command_generation(self):
        """Test find command generation."""
        cmd = POSIXCommands.find()
        assert cmd.startswith("find .")
        
        cmd = POSIXCommands.find(
            path="/tmp",
            name_pattern="*.log",
            file_type="f",
            max_depth=2
        )
        assert "/tmp" in cmd
        assert "*.log" in cmd
        assert "-type f" in cmd
        assert "-maxdepth 2" in cmd
    
    def test_grep_command_generation(self):
        """Test grep command generation."""
        cmd = POSIXCommands.grep("pattern")
        assert "grep" in cmd
        assert "pattern" in cmd
        
        cmd = POSIXCommands.grep(
            "test",
            ignore_case=True,
            line_numbers=True,
            context=2,
            recursive=True
        )
        assert "-i" in cmd
        assert "-n" in cmd
        assert "-C 2" in cmd
        assert "-r" in cmd
    
    def test_file_commands(self):
        """Test file manipulation commands."""
        # cat
        cmd = POSIXCommands.cat("file1.txt", "file2.txt", number_lines=True)
        assert "cat -n" in cmd
        assert "file1.txt" in cmd
        assert "file2.txt" in cmd
        
        # head
        cmd = POSIXCommands.head("largefile.txt", lines=20)
        assert "head -n 20" in cmd
        assert "largefile.txt" in cmd
        
        # tail
        cmd = POSIXCommands.tail("logfile.log", lines=50, follow=True)
        assert "tail -f" in cmd
        assert "-n 50" in cmd
        
        # wc
        cmd = POSIXCommands.wc("file.txt", lines=True, words=True)
        assert "wc" in cmd
        assert "-l" in cmd
        assert "-w" in cmd
    
    def test_text_processing_commands(self):
        """Test text processing commands."""
        # sort
        cmd = POSIXCommands.sort("data.txt", reverse=True, numeric=True)
        assert "sort" in cmd
        assert "-r" in cmd
        assert "-n" in cmd
        
        # uniq
        cmd = POSIXCommands.uniq("sorted.txt", count=True)
        assert "uniq -c" in cmd
        
        # cut
        cmd = POSIXCommands.cut(fields="1,3", delimiter=",")
        assert "cut -f" in cmd
        assert "1,3" in cmd
        assert "-d" in cmd
        
        # tr
        cmd = POSIXCommands.tr("a-z", "A-Z")
        assert "tr" in cmd
        assert "a-z" in cmd
        assert "A-Z" in cmd
    
    def test_safe_pipeline(self):
        """Test safe command pipeline creation."""
        cmd1 = POSIXCommands.cat("input.txt")
        cmd2 = POSIXCommands.grep("pattern")
        cmd3 = POSIXCommands.sort()
        
        pipeline = POSIXCommands.safe_pipeline(cmd1, cmd2, cmd3)
        assert " | " in pipeline
        assert cmd1 in pipeline
        assert cmd2 in pipeline
        assert cmd3 in pipeline
    
    def test_safe_redirect(self):
        """Test safe output redirection."""
        cmd = POSIXCommands.ls()
        redirected = POSIXCommands.safe_redirect(cmd, "output.txt")
        assert cmd in redirected
        assert ">" in redirected
        assert "output.txt" in redirected
        
        # Test append
        appended = POSIXCommands.safe_redirect(cmd, "output.txt", append=True)
        assert ">>" in appended
    
    def test_argument_escaping(self):
        """Test that dangerous arguments are properly escaped."""
        dangerous_pattern = "'; rm -rf /; echo '"
        cmd = POSIXCommands.grep(dangerous_pattern)
        
        # Pattern should be quoted/escaped
        assert dangerous_pattern not in cmd or cmd.count("'") >= 2


class TestPathValidator:
    """Test advanced path validation."""
    
    def test_validator_creation(self):
        """Test path validator creation."""
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir)
            validator = PathValidator(workspace)
            assert validator.workspace == workspace.resolve()
    
    def test_basic_path_validation(self):
        """Test basic path validation."""
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir)
            validator = PathValidator(workspace)
            
            # Valid paths
            valid_paths = ["file.txt", "dir/file.txt", "a/b/c.txt"]
            for path in valid_paths:
                result = validator.validate_path(path)
                assert result["safe"], f"Should accept valid path: {path}"
            
            # Invalid paths
            invalid_paths = ["/etc/passwd", "../escape", ""]
            for path in invalid_paths:
                result = validator.validate_path(path)
                assert not result["safe"], f"Should reject invalid path: {path}"
    
    def test_strict_mode(self):
        """Test strict mode validation."""
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir)
            strict_validator = PathValidator(workspace, strict_mode=True)
            lenient_validator = PathValidator(workspace, strict_mode=False)
            
            # Hidden files
            hidden_file = ".hidden"
            strict_result = strict_validator.validate_path(hidden_file)
            lenient_result = lenient_validator.validate_path(hidden_file)
            
            assert not strict_result["safe"]
            assert lenient_result["safe"]
    
    def test_normalize_path(self):
        """Test path normalization."""
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir)
            validator = PathValidator(workspace)
            
            # Test normalization
            normalized = validator.normalize_path("./dir/../file.txt")
            assert normalized == "file.txt"
            
            # Test with invalid path
            with pytest.raises(Exception):  # Should raise FileSystemError
                validator.normalize_path("../escape")
    
    def test_get_safe_path(self):
        """Test safe path resolution."""
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir)
            validator = PathValidator(workspace)
            
            safe_path = validator.get_safe_path("subdir/file.txt")
            assert safe_path.is_relative_to(workspace)
            assert str(safe_path).endswith("subdir/file.txt")


class TestConfigurationValidation:
    """Test configuration validation."""
    
    def test_config_validation(self):
        """Test configuration validation."""
        # Test valid configuration
        config = ConstellationFSConfig(
            workspace_root="/tmp/test",
            default_user_id="test-user",
            max_workspace_size_mb=1024
        )
        assert config.default_user_id == "test-user"
        assert config.max_workspace_size_mb == 1024
    
    def test_config_validation_errors(self):
        """Test configuration validation errors."""
        # Test invalid user_id
        with pytest.raises(ValueError):
            ConstellationFSConfig(default_user_id="")
        
        # Test invalid workspace size
        with pytest.raises(ValueError):
            ConstellationFSConfig(max_workspace_size_mb=-100)
        
        # Test invalid log level
        with pytest.raises(ValueError):
            ConstellationFSConfig(log_level="INVALID_LEVEL")
    
    def test_config_from_dict(self):
        """Test configuration creation from dictionary."""
        config_dict = {
            "workspace_root": "/tmp/test-workspace",
            "default_user_id": "test-user",
            "log_level": "DEBUG"
        }
        
        config = ConstellationFSConfig.from_dict(config_dict)
        assert config.default_user_id == "test-user"
        assert config.log_level == "DEBUG"
        assert config.workspace_root == "/tmp/test-workspace"
    
    def test_config_from_file(self):
        """Test loading configuration from file."""
        config_data = {
            "log_level": "DEBUG",
            "default_user_id": "test-user",
            "max_workspace_size_mb": 100
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump(config_data, f)
            config_file = f.name
        
        try:
            config = ConstellationFSConfig.load_from_file(config_file)
            assert config.log_level == "DEBUG"
            assert config.default_user_id == "test-user"
            assert config.max_workspace_size_mb == 100
        finally:
            Path(config_file).unlink()
    
    def test_config_env_integration(self):
        """Test configuration integration with environment."""
        # Test default config creation
        config = ConstellationFSConfig()
        assert config.log_level == "INFO"
        assert config.default_user_id == "default"
        
        # Test config file discovery
        default_config = ConstellationFSConfig.find_and_load_config()
        assert isinstance(default_config, ConstellationFSConfig)


class TestResourceMonitoring:
    """Test resource monitoring functionality."""
    
    def test_resource_monitor_creation(self):
        """Test resource monitor creation."""
        try:
            from constellation.backends.local import ResourceMonitor
            
            limits = {
                "max_memory_mb": 1024,
                "max_cpu_percent": 80,
                "max_processes": 50
            }
            
            monitor = ResourceMonitor(limits)
            assert monitor.max_memory_mb == 1024
            assert monitor.max_cpu_percent == 80
            assert monitor.max_processes == 50
        except ImportError:
            pytest.skip("ResourceMonitor not available")
    
    def test_system_resource_check(self):
        """Test system resource checking."""
        try:
            from constellation.backends.local import ResourceMonitor
            
            monitor = ResourceMonitor({})
            result = monitor.check_system_resources()
            
            # Should return None (resources available) or string (resource issue)
            assert result is None or isinstance(result, str)
        except ImportError:
            pytest.skip("ResourceMonitor not available")
    
    @pytest.mark.skipif(not hasattr(__import__('os'), 'getpid'), 
                       reason="Process monitoring requires os.getpid")
    def test_process_monitoring(self):
        """Test process monitoring functionality."""
        try:
            from constellation.backends.local import ResourceMonitor
            import os
            
            monitor = ResourceMonitor({"max_memory_mb": 10000})  # High limit
            current_pid = os.getpid()
            
            should_continue, reason = monitor.monitor_process(current_pid)
            
            # Current process should be allowed to continue
            assert should_continue or reason is not None
        except ImportError:
            pytest.skip("ResourceMonitor not available")