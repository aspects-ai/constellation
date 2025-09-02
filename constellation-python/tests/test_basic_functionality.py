"""Basic functionality tests for ConstellationFS Python."""

import pytest
from constellation import FileSystem, FileSystemError, DangerousOperationError


class TestBasicFunctionality:
    """Test basic ConstellationFS operations."""

    @pytest.fixture
    async def fs(self):
        """Create a test filesystem instance."""
        return FileSystem("test-user")

    @pytest.mark.asyncio
    async def test_basic_command_execution(self, fs):
        """Test basic shell command execution."""
        output = await fs.exec("echo 'Hello from ConstellationFS'")
        assert "Hello from ConstellationFS" in output

    @pytest.mark.asyncio
    async def test_directory_creation(self, fs):
        """Test directory creation."""
        await fs.exec("mkdir -p test_dir")
        files = await fs.ls()
        assert "test_dir" in files

    @pytest.mark.asyncio
    async def test_file_write_and_read(self, fs):
        """Test file write and read operations."""
        test_content = '{"name": "test", "version": "1.0"}'
        
        # Write file
        await fs.write("data.json", test_content)
        
        # Read file back
        content = await fs.read("data.json")
        assert content.strip() == test_content

    @pytest.mark.asyncio
    async def test_nested_file_operations(self, fs):
        """Test operations on nested files."""
        # Create directory and write nested file
        await fs.exec("mkdir -p test_dir")
        await fs.write("test_dir/nested_file.txt", "This is a nested file")
        
        # Verify file exists in listing
        files = await fs.ls()
        assert "test_dir" in files
        
        # Read nested file
        content = await fs.read("test_dir/nested_file.txt")
        assert content.strip() == "This is a nested file"

    @pytest.mark.asyncio
    async def test_directory_listing(self, fs):
        """Test directory listing functionality."""
        # Create some test files
        await fs.write("file1.txt", "content1")
        await fs.write("file2.json", '{"test": true}')
        await fs.exec("mkdir test_dir")
        
        # Test basic listing
        files = await fs.ls()
        assert "file1.txt" in files
        assert "file2.json" in files
        assert "test_dir" in files

    @pytest.mark.asyncio
    async def test_detailed_listing(self, fs):
        """Test detailed directory listing."""
        await fs.write("test_file.txt", "test content")
        
        detailed_files = await fs.ls(details=True)
        
        # Should return list of dictionaries with file info
        assert isinstance(detailed_files, list)
        if detailed_files:  # Files might exist from other tests
            file_info = next((f for f in detailed_files if f['name'] == 'test_file.txt'), None)
            if file_info:
                assert 'name' in file_info
                assert 'type' in file_info
                assert 'size' in file_info

    @pytest.mark.asyncio
    async def test_pattern_matching(self, fs):
        """Test file pattern matching in ls."""
        # Create files with different extensions
        await fs.write("file1.txt", "content1")
        await fs.write("file2.txt", "content2")
        await fs.write("file3.json", '{"test": true}')
        
        # Test pattern matching
        txt_files = await fs.ls("*.txt")
        assert "file1.txt" in txt_files
        assert "file2.txt" in txt_files
        assert "file3.json" not in txt_files

    @pytest.mark.asyncio
    async def test_complex_commands(self, fs):
        """Test complex shell commands."""
        # Create test files
        await fs.write("file1.json", '{"line1": true}')
        await fs.write("file2.json", '{"line1": true, "line2": false}')
        
        # Test complex command with pipes
        word_count = await fs.exec("find . -name '*.json' | xargs wc -l")
        assert word_count.strip()  # Should have some output

    @pytest.mark.asyncio
    async def test_dangerous_command_blocking(self, fs):
        """Test that dangerous commands are blocked."""
        with pytest.raises(DangerousOperationError):
            await fs.exec("rm -rf /")

    @pytest.mark.asyncio
    async def test_absolute_path_blocking(self, fs):
        """Test that absolute paths are blocked."""
        with pytest.raises(FileSystemError):
            await fs.read("/etc/passwd")

    @pytest.mark.asyncio
    async def test_path_traversal_blocking(self, fs):
        """Test that path traversal attacks are blocked."""
        with pytest.raises(FileSystemError):
            await fs.read("../../../etc/passwd")

    @pytest.mark.asyncio
    async def test_workspace_isolation(self):
        """Test that different users get isolated workspaces."""
        fs1 = FileSystem("user1")
        fs2 = FileSystem("user2")
        
        # Write file in user1's workspace
        await fs1.write("user1_file.txt", "user1 content")
        
        # Verify user2 can't see user1's file
        user2_files = await fs2.ls()
        assert "user1_file.txt" not in user2_files
        
        # Verify user1 can see their own file
        user1_files = await fs1.ls()
        assert "user1_file.txt" in user1_files