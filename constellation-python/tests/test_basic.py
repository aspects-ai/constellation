"""Basic tests for ConstellationFS Python implementation."""

import pytest
import asyncio
import tempfile
from pathlib import Path

from constellation import FileSystem, FileSystemError, DangerousOperationError


class TestFileSystemBasic:
    """Basic functionality tests."""
    
    @pytest.mark.asyncio
    async def test_create_filesystem(self):
        """Test FileSystem creation with user ID."""
        fs = FileSystem("test-user-basic")
        assert fs.workspace
        assert Path(fs.workspace).exists()
        assert "test-user-basic" in fs.workspace
    
    @pytest.mark.asyncio
    async def test_exec_simple_command(self):
        """Test executing simple commands."""
        fs = FileSystem("test-user-exec")
        
        # Test echo command
        result = await fs.exec("echo 'hello world'")
        assert result == "hello world"
        
        # Test command with output
        result = await fs.exec("pwd")
        assert fs.workspace in result
    
    @pytest.mark.asyncio 
    async def test_file_operations(self):
        """Test basic file read/write operations."""
        fs = FileSystem("test-user-files")
        
        # Write a file
        test_content = "Hello ConstellationFS"
        await fs.write("test.txt", test_content)
        
        # Read it back
        content = await fs.read("test.txt")
        assert content == test_content
        
        # Test file exists via command
        result = await fs.exec("test -f test.txt && echo 'exists'")
        assert result == "exists"
    
    @pytest.mark.asyncio
    async def test_ls_operations(self):
        """Test directory listing operations."""
        fs = FileSystem("test-user-ls")
        
        # Create some test files
        await fs.write("file1.txt", "content1")
        await fs.write("file2.py", "print('hello')")
        await fs.exec("mkdir testdir")
        
        # Test basic ls
        files = await fs.ls()
        assert "file1.txt" in files
        assert "file2.py" in files
        assert "testdir" in files
        
        # Test pattern matching
        txt_files = await fs.ls("*.txt")
        assert "file1.txt" in txt_files
        assert "file2.py" not in txt_files
        
        # Test detailed listing
        detailed = await fs.ls(details=True)
        file_names = [f["name"] for f in detailed]
        assert "file1.txt" in file_names
        
        # Check file info structure
        txt_file_info = next(f for f in detailed if f["name"] == "file1.txt")
        assert txt_file_info["type"] == "file"
        assert txt_file_info["size"] > 0
        assert "modified" in txt_file_info


class TestSecurity:
    """Security and safety tests."""
    
    @pytest.mark.asyncio
    async def test_dangerous_commands_blocked(self):
        """Test that dangerous commands are blocked."""
        fs = FileSystem("test-user-security")
        
        dangerous_commands = [
            "rm -rf /",
            "sudo apt-get update", 
            "chmod 777 /",
            "kill -9 -1",
        ]
        
        for cmd in dangerous_commands:
            with pytest.raises(DangerousOperationError):
                await fs.exec(cmd)
    
    @pytest.mark.asyncio
    async def test_path_traversal_blocked(self):
        """Test that path traversal is blocked."""
        fs = FileSystem("test-user-paths")
        
        # Absolute paths should be blocked
        with pytest.raises(FileSystemError):
            await fs.read("/etc/passwd")
        
        # Directory traversal should be blocked  
        with pytest.raises(FileSystemError):
            await fs.read("../../etc/passwd")
        
        with pytest.raises(FileSystemError):
            await fs.write("/tmp/evil.txt", "bad content")
    
    @pytest.mark.asyncio
    async def test_workspace_isolation(self):
        """Test that users are isolated to their workspaces."""
        fs1 = FileSystem("user1")
        fs2 = FileSystem("user2")
        
        # Different users should have different workspaces
        assert fs1.workspace != fs2.workspace
        
        # Write to user1 workspace
        await fs1.write("private.txt", "user1 data")
        
        # user2 should not be able to see user1's files
        files = await fs2.ls()
        assert "private.txt" not in files
        
        # user2 should not be able to read user1's file by path manipulation
        with pytest.raises(FileSystemError):
            await fs2.read("../user1/private.txt")


class TestSyncAPI:
    """Test synchronous API methods."""
    
    def test_sync_operations(self):
        """Test synchronous wrapper methods."""
        fs = FileSystem("test-user-sync")
        
        # Test sync exec
        result = fs.exec_sync("echo 'sync test'")
        assert result == "sync test"
        
        # Test sync file operations
        fs.write_sync("sync.txt", "sync content")
        content = fs.read_sync("sync.txt")
        assert content == "sync content"
        
        # Test sync ls
        files = fs.ls_sync()
        assert "sync.txt" in files


class TestErrorHandling:
    """Test error handling scenarios."""
    
    @pytest.mark.asyncio
    async def test_empty_command(self):
        """Test that empty commands raise errors."""
        fs = FileSystem("test-user-errors")
        
        with pytest.raises(FileSystemError) as exc_info:
            await fs.exec("")
        
        assert "empty" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_empty_path(self):
        """Test that empty paths raise errors."""
        fs = FileSystem("test-user-errors")
        
        with pytest.raises(FileSystemError) as exc_info:
            await fs.read("")
        
        assert "empty" in str(exc_info.value).lower()
    
    @pytest.mark.asyncio
    async def test_nonexistent_file(self):
        """Test reading nonexistent files."""
        fs = FileSystem("test-user-errors")
        
        with pytest.raises(FileSystemError):
            await fs.read("nonexistent.txt")
    
    @pytest.mark.asyncio
    async def test_failed_command(self):
        """Test failed command execution."""
        fs = FileSystem("test-user-errors")
        
        with pytest.raises(FileSystemError) as exc_info:
            await fs.exec("false")  # Command that always fails
        
        assert "failed" in str(exc_info.value).lower()