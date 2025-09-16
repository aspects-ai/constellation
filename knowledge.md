# ConstellationFS Project

## Overview
ConstellationFS is a secure filesystem abstraction library available in TypeScript and Python. Provides sandboxed file operations with multiple backend support (local, remote SSH, Docker).

## Project Structure
- `constellation-typescript/` - TypeScript implementation
- `constellation-python/` - Python implementation  
- `examples/` - Demo applications
  - `web-demo/` - Next.js web app showcasing ConstellationFS capabilities
  - `codebuff-demo/` - Integration example with Codebuff
- `.agents/` - Custom AI agent definitions

## Key Features
- Secure sandboxed filesystem operations
- Multiple backend support (local, SSH, Docker)
- Path traversal protection
- Resource monitoring
- FUSE mounting capabilities
- Native library interceptor for command execution

## Development
- TypeScript version uses native C library for process interception
- Python version implements similar security features
- Web demo built with Next.js, Mantine UI, and CodeSandbox

## Testing
Run tests with:
- TypeScript: `npm test` in constellation-typescript/
- Python: `pytest` in constellation-python/

## Important Notes
- Always ensure native library is built for TypeScript version
- SSH backend requires proper key configuration
- Docker backend needs Docker daemon running