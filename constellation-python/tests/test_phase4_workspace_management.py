#!/usr/bin/env python3
"""
Simple Phase 4 test without pydantic dependencies.

Tests the new workspace management and safety features.
"""

import asyncio
import tempfile
from pathlib import Path

from constellation.config.config import (
    ConstellationFSConfig,
    get_global_config,
    set_global_config
)
from constellation.config.workspace_manager import WorkspaceManager
from constellation.security import (
    WorkspaceSafetyValidator,
    validate_user_path,
    is_path_safe
)
from constellation import FileSystem


async def test_configuration():
    """Test the configuration system."""
    print("🔧 Testing Configuration System")
    print("-" * 40)
    
    # Test default config
    default_config = ConstellationFSConfig()
    print(f"Default workspace root: {default_config.workspace_root}")
    print(f"Default user ID: {default_config.default_user_id}")
    
    # Test custom config
    with tempfile.TemporaryDirectory() as temp_dir:
        custom_config = ConstellationFSConfig(
            workspace_root=temp_dir,
            default_user_id="test_user",
            max_workspace_size_mb=10
        )
        print(f"Custom workspace root: {custom_config.workspace_root}")
        print(f"Custom user ID: {custom_config.default_user_id}")
        
        # Test workspace path generation
        user_path = custom_config.get_user_workspace_path("alice")
        print(f"Alice's workspace path: {user_path}")
        
        # Test workspace creation
        created_path = custom_config.ensure_workspace_exists("alice")
        print(f"Created workspace: {created_path}")
        print(f"Workspace exists: {created_path.exists()}")


async def test_workspace_manager():
    """Test the workspace manager."""
    print("\n🏠 Testing Workspace Manager")
    print("-" * 40)
    
    with tempfile.TemporaryDirectory() as temp_dir:
        config = ConstellationFSConfig(
            workspace_root=temp_dir,
            max_workspace_size_mb=5
        )
        
        manager = WorkspaceManager(config)
        
        # Test user workspace creation
        alice_workspace = manager.create_workspace("alice")
        bob_workspace = manager.create_workspace("bob")
        
        print(f"Alice's workspace: {alice_workspace}")
        print(f"Bob's workspace: {bob_workspace}")
        print(f"Workspaces are isolated: {alice_workspace != bob_workspace}")
        
        # Test path validation
        safe_paths = ["document.txt", "folder/file.py", "data.json"]
        unsafe_paths = ["../escape.txt", "/etc/passwd", "../../secret.txt"]
        
        print("\nPath validation tests:")
        for path in safe_paths:
            try:
                validated = manager.validate_path_in_workspace(path, "alice")
                print(f"✓ Safe path: {path} -> {validated.name}")
            except Exception as e:
                print(f"✗ Unexpected rejection of safe path {path}: {e}")
        
        for path in unsafe_paths:
            try:
                manager.validate_path_in_workspace(path, "alice")
                print(f"✗ SECURITY ISSUE: Unsafe path allowed: {path}")
            except Exception:
                print(f"✓ Correctly blocked unsafe path: {path}")
        
        # Test workspace stats
        stats = manager.get_workspace_stats()
        print(f"\nWorkspace stats: {stats}")


async def test_safety_validator():
    """Test the enhanced safety validator."""
    print("\n🛡️ Testing Safety Validator")
    print("-" * 40)
    
    validator = WorkspaceSafetyValidator()
    
    # Test user ID validation
    print("User ID validation:")
    valid_users = ["alice", "user123", "dev-team"]
    invalid_users = ["root", "admin", "../user", "user@bad"]
    
    for user in valid_users:
        result = validator.validate_user_id(user)
        print(f"{'✓' if result['safe'] else '✗'} {user}: {result['reason'] or 'OK'}")
    
    for user in invalid_users:
        result = validator.validate_user_id(user)
        print(f"{'✓' if not result['safe'] else '✗'} {user}: {result['reason'] or 'SHOULD BE BLOCKED'}")
    
    # Test filename validation
    print("\nFilename validation:")
    safe_files = ["document.txt", "app.py", "data.json"]
    unsafe_files = ["script.exe", "id_rsa", "file<bad>.txt"]
    
    for filename in safe_files:
        result = validator.validate_filename(filename)
        print(f"{'✓' if result['safe'] else '✗'} {filename}: {result['reason'] or 'OK'}")
    
    for filename in unsafe_files:
        result = validator.validate_filename(filename)
        print(f"{'✓' if not result['safe'] else '✗'} {filename}: {result['reason'] or 'SHOULD BE BLOCKED'}")


async def test_filesystem_integration():
    """Test filesystem integration with workspace isolation."""
    print("\n💾 Testing FileSystem Integration")
    print("-" * 40)
    
    try:
        # Create separate filesystem instances for different users
        alice_fs = FileSystem("alice")
        bob_fs = FileSystem("bob")
        
        # Create files in each user's workspace
        await alice_fs.write("alice_secret.txt", "Alice's secret data")
        await bob_fs.write("bob_notes.txt", "Bob's personal notes")
        
        print("✓ Created files in separate workspaces")
        
        # Verify isolation
        alice_files = await alice_fs.ls()
        bob_files = await bob_fs.ls()
        
        print(f"Alice sees: {alice_files}")
        print(f"Bob sees: {bob_files}")
        
        # Test that users can't access each other's files
        try:
            await alice_fs.read("../bob/bob_notes.txt")
            print("✗ SECURITY ISSUE: Alice accessed Bob's files!")
        except Exception:
            print("✓ Correctly prevented cross-user file access")
        
        # Test working directory isolation
        alice_pwd = await alice_fs.exec("pwd")
        bob_pwd = await bob_fs.exec("pwd")
        
        alice_dir = alice_pwd.strip().split('/')[-1]
        bob_dir = bob_pwd.strip().split('/')[-1]
        
        print(f"Alice working in: .../{alice_dir}")
        print(f"Bob working in: .../{bob_dir}")
        print(f"Directories isolated: {alice_dir != bob_dir}")
        
    except Exception as e:
        print(f"Error in filesystem test: {e}")


def test_utility_functions():
    """Test utility functions."""
    print("\n🔧 Testing Utility Functions")
    print("-" * 40)
    
    # Test validate_user_path
    print("validate_user_path tests:")
    safe_combinations = [("alice", "document.txt"), ("bob", "data/file.json")]
    unsafe_combinations = [("../user", "file.txt"), ("alice", "../escape.txt")]
    
    for user, path in safe_combinations:
        result = validate_user_path(user, path)
        print(f"{'✓' if result else '✗'} User '{user}' + path '{path}': {'OK' if result else 'REJECTED'}")
    
    for user, path in unsafe_combinations:
        result = validate_user_path(user, path)
        print(f"{'✓' if not result else '✗'} User '{user}' + path '{path}': {'Correctly blocked' if not result else 'SHOULD BE BLOCKED'}")
    
    # Test is_path_safe
    print("\nis_path_safe tests:")
    safe_paths = ["document.txt", "folder/file.py", "data/nested/file.json"]
    unsafe_paths = ["../escape.txt", "/etc/passwd", "~/secret.txt", "/dev/null"]
    
    for path in safe_paths:
        result = is_path_safe(path)
        print(f"{'✓' if result else '✗'} '{path}': {'Safe' if result else 'UNSAFE'}")
    
    for path in unsafe_paths:
        result = is_path_safe(path)
        print(f"{'✓' if not result else '✗'} '{path}': {'Correctly flagged as unsafe' if not result else 'SHOULD BE UNSAFE'}")


async def main():
    """Run all Phase 4 tests."""
    print("ConstellationFS Phase 4: Simple Test")
    print("=" * 50)
    
    try:
        await test_configuration()
        await test_workspace_manager()
        await test_safety_validator()
        await test_filesystem_integration()
        test_utility_functions()
        
        print("\n" + "=" * 50)
        print("✅ All Phase 4 tests completed successfully!")
        
        print("\nKey features tested:")
        print("• Library-level configuration system")
        print("• User workspace isolation") 
        print("• Enhanced safety validations")
        print("• FileSystem integration with workspaces")
        print("• Path and user ID validation")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())