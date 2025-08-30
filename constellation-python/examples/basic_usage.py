"""Basic usage example for ConstellationFS Python."""

import asyncio
from constellation import FileSystem, FileSystemError, DangerousOperationError


async def main() -> None:
    """Demonstrate basic ConstellationFS usage."""
    print("ConstellationFS Python - Basic Usage Example")
    print("=" * 50)
    
    # Create filesystem with user isolation
    fs = FileSystem("demo-user")
    print(f"Created filesystem with workspace: {fs.workspace}")
    
    try:
        # Execute shell commands
        print("\n1. Executing shell commands:")
        output = await fs.exec("echo 'Hello from ConstellationFS'")
        print(f"   Output: {output}")
        
        # Create a directory
        await fs.exec("mkdir -p test_dir")
        print("   Created test_dir/")
        
        # File operations
        print("\n2. File operations:")
        await fs.write("data.json", '{"name": "test", "version": "1.0"}')
        print("   Wrote data.json")
        
        content = await fs.read("data.json")
        print(f"   Read data.json: {content}")
        
        await fs.write("test_dir/nested_file.txt", "This is a nested file")
        print("   Wrote test_dir/nested_file.txt")
        
        # List files
        print("\n3. Directory listing:")
        files = await fs.ls()
        print(f"   Files: {files}")
        
        # List with details
        detailed_files = await fs.ls(details=True)
        print("   Detailed listing:")
        for file_info in detailed_files:
            print(f"     {file_info['name']}: {file_info['type']}, {file_info['size']} bytes")
        
        # Pattern matching
        txt_files = await fs.ls("*.txt")
        print(f"   TXT files: {txt_files}")
        
        # Command with output
        print("\n4. Complex commands:")
        word_count = await fs.exec("find . -name '*.json' | xargs wc -l")
        print(f"   Line count in JSON files: {word_count}")
        
        # Security demonstration
        print("\n5. Security features:")
        try:
            await fs.exec("rm -rf /")
            print("   ERROR: Dangerous command was allowed!")
        except DangerousOperationError as e:
            print(f"   ✓ Dangerous command blocked: {e}")
        
        try:
            await fs.read("/etc/passwd")
            print("   ERROR: Absolute path was allowed!")
        except FileSystemError as e:
            print(f"   ✓ Absolute path blocked: {e}")
        
        try:
            await fs.read("../../../etc/passwd")
            print("   ERROR: Path traversal was allowed!")
        except FileSystemError as e:
            print(f"   ✓ Path traversal blocked: {e}")
        
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n" + "=" * 50)
    print("Example completed successfully!")


if __name__ == "__main__":
    asyncio.run(main())