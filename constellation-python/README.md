# ConstellationFS Python 🌟

A filesystem abstraction for AI agents that provides familiar bash commands instead of custom APIs.

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![Type Checked](https://img.shields.io/badge/Type%20Checked-mypy-blue.svg)](https://mypy.readthedocs.io/)

## Why ConstellationFS?

AI models are already trained on millions of filesystem operations. Instead of teaching agents custom APIs like `create_frame_tool()` and `modify_frame_tool()`, ConstellationFS lets them use the bash commands they already know: `ls`, `grep`, `sed`, `cat`, and more.

**The filesystem IS the API.**

## Quick Start

```bash
pip install constellationfs
```

```python
import asyncio
from constellationfs import FileSystem

async def main():
    # Simple usage - just provide a user ID
    fs = FileSystem("my-user-123")
    
    # Execute any bash command
    await fs.exec("echo 'Hello World' > greeting.txt")
    await fs.exec("grep -r 'TODO' . | head -5")
    
    # Direct file operations
    await fs.write("config.json", '{"version": "1.0"}')
    content = await fs.read("config.json")
    files = await fs.ls("*.txt")

# Run the example
asyncio.run(main())
```

## Core Features

### ✅ Familiar Interface
Use the bash commands AI models already know:
```python
fs = FileSystem("user-123")

await fs.exec("find . -name '*.py' | xargs wc -l")
await fs.exec("sed -i 's/old/new/g' *.txt")
await fs.exec("sort data.csv | uniq > unique.csv")
```

### 🔒 Safety First
Dangerous operations are blocked by default:
```python
# This will raise DangerousOperationError
await fs.exec("rm -rf /")

# Or provide a callback to handle them
fs = FileSystem({
    "user_id": "safe-user",
    "prevent_dangerous": True,
    "on_dangerous_operation": lambda cmd: print(f"Blocked: {cmd}")
})
```

### 🏗️ Workspace Isolation
All operations are sandboxed to your specified user workspace:
```python
fs = FileSystem("project-user")

# This works - relative to workspace
await fs.read("src/main.py")

# This fails - absolute paths rejected
await fs.read("/etc/passwd")  # ❌ Error

# This fails - directory traversal blocked  
await fs.read("../../../secrets.txt")  # ❌ Error
```

## API Reference

### Constructor

```python
# Simple user ID
fs = FileSystem("my-user")

# Full configuration
fs = FileSystem({
    "user_id": "my-user",
    "type": "local",                     # Only 'local' supported for now
    "shell": "bash",                     # 'bash', 'sh', or 'auto'
    "prevent_dangerous": True,           # Block dangerous commands (default: True)
    "on_dangerous_operation": callback,  # Handle blocked commands
    "max_output_length": 10000           # Truncate long outputs (optional)
})
```

### Methods

#### `await exec(command: str) -> str`
Execute a shell command in the workspace.

```python
output = await fs.exec("ls -la")
word_count = await fs.exec("wc -l *.txt")
```

#### `await read(path: str) -> str`
Read file contents (UTF-8).

```python
content = await fs.read("data.json")
```

#### `await write(path: str, content: str) -> None`
Write content to a file (UTF-8).

```python
await fs.write("output.txt", "Hello World")
```

#### `await ls(pattern: str = None, *, details: bool = False)`
List files and directories, optionally with glob pattern.

```python
# Simple listing
files = await fs.ls()

# With pattern
text_files = await fs.ls("*.txt")

# With details
detailed = await fs.ls(details=True)
for file in detailed:
    print(f"{file['name']}: {file['type']}, {file['size']} bytes")
```

### Synchronous API

For non-async code, use the sync methods:

```python
fs = FileSystem("user-123")

# Synchronous versions
output = fs.exec_sync("echo 'hello'")
content = fs.read_sync("file.txt")
fs.write_sync("output.txt", "data")
files = fs.ls_sync("*.py")
```

### Properties

- `fs.workspace` - Get the absolute workspace path
- `fs.backend_config` - Get the current configuration

## Error Handling

ConstellationFS provides structured error handling:

```python
from constellationfs import FileSystemError, DangerousOperationError

try:
    await fs.exec("some-command")
except DangerousOperationError as e:
    print(f"Dangerous operation blocked: {e.command}")
except FileSystemError as e:
    print(f"Operation failed: {e} (code: {e.code})")
```

## Safety Features

### Dangerous Command Detection

ConstellationFS blocks these types of operations by default:

- **System destruction**: `rm -rf /`, `rm -r ~`
- **Privilege escalation**: `sudo`, `su`
- **Network access**: `curl ... | sh`, `wget ... | sh`
- **Process control**: `kill -9`, `shutdown`, `reboot`
- **System modification**: `mount`, `chmod 777`

### Workspace Boundaries

All file operations are restricted to the user workspace:

- Absolute paths are rejected
- Directory traversal (`../`) is blocked
- Commands are executed with the workspace as `cwd`

## Context Manager Support

Use ConstellationFS with context managers for automatic cleanup:

```python
# Async context manager
async with FileSystem("user-123") as fs:
    await fs.exec("echo 'hello'")
    # Cleanup happens automatically

# Sync context manager
with FileSystem("user-123") as fs:
    fs.exec_sync("echo 'hello'")
    # Cleanup happens automatically
```

## Development

### Installation from Source

```bash
# Clone the repository
git clone https://github.com/constellation-fs/constellation-python.git
cd constellation-python

# Install with Poetry
poetry install

# Or with pip
pip install -e .
```

### Running Tests

```bash
# With Poetry
poetry run pytest

# Or with pip
pytest

# With coverage
pytest --cov=constellation
```

### Type Checking

```bash
# Run mypy
poetry run mypy constellation

# Run with strict mode
poetry run mypy --strict constellation
```

### Code Formatting

```bash
# Format with black
poetry run black constellation

# Lint with ruff
poetry run ruff check constellation
```

## Examples

See the `examples/` directory for more usage patterns:

- `basic_usage.py` - Core functionality demonstration
- `async_patterns.py` - Async/await usage patterns
- `error_handling.py` - Error handling examples

## Roadmap 🚀

ConstellationFS Python is just getting started. Here's what's coming:

### 🐳 Docker Backend
Container isolation for multi-user environments:
```python
fs = FileSystem({
    "user_id": "user123",
    "type": "docker",
    "image": "python:3.11-alpine"
})
```

### 🏢 Multi-Tenant Architecture
Production-ready user isolation:
```python
fs = FileSystem({
    "user_id": "user123", 
    "type": "cloud",
    "storage": "s3://bucket/workspaces/"
})
```

### 🔧 Framework Integrations
Ready-to-use integrations with popular AI frameworks:

**LangChain Tools**:
```python
from constellationfs.integrations.langchain import ConstellationTool

tool = ConstellationTool(user_id="agent-123")
```

**OpenAI Function Calling**:
```python
from constellationfs.integrations.openai import get_function_schema

schema = get_function_schema(user_id="agent-123")
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

- Report bugs using our [issue template](https://github.com/constellation-fs/constellation-python/issues)
- Submit PRs following our [PR template](https://github.com/constellation-fs/constellation-python/pulls)
- Improve documentation and examples

## License

MIT - see [LICENSE](LICENSE) file for details.

---

**ConstellationFS**: Where AI agents feel at home. 🏠