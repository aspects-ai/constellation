# ConstellationFS - Development Guide

Secure, isolated filesystem abstraction for AI agents. Version 0.6.3.

## Quick Reference

### Development Commands

```bash
npm run dev          # Watch mode build
npm run build        # Production build
npm test             # Run tests (watch mode)
npm run test:run     # Run tests once
npm run typecheck    # TypeScript validation
npm run lint         # ESLint check
npm run lint:fix     # Auto-fix lint issues
npm run format       # Prettier formatting
```

### Publishing (from repo root)

```bash
./publish.sh         # Interactive: bump version, build, publish to npm, tag & push
```

### Remote Backend Deployment

```bash
./deploy-tool.sh     # Start web UI at http://localhost:3456 for Azure/GCP VM deployment
```

## Project Structure

```
src/
├── backends/           # LocalBackend, RemoteBackend (SSH)
├── workspace/          # LocalWorkspace, RemoteWorkspace
├── mcp/                # Model Context Protocol server/client/tools
├── config/             # Configuration with Zod validation
├── logging/            # Operations logging (Array/Console loggers)
├── utils/              # Path validation, workspace utils, logger
├── FileSystem.ts       # Main API class
├── FileSystemPoolManager.ts  # Connection pooling
├── safety.ts           # Command/path security validation
└── index.ts            # Package exports
```

## Architecture

**Three-layer design:**
1. **Backend** - Execution environment (LocalBackend for local fs, RemoteBackend for SSH)
2. **Workspace** - Isolated user workspace with file/exec operations
3. **FileSystem** - Frontend API managing backends and workspaces

**Key patterns:**
- Factory pattern for backend creation
- User-based workspace isolation (`/tmp/constellation-fs/users/{userId}/`)
- Multi-layered security (command validation, path escape prevention)
- Connection pooling via FileSystemPoolManager

## Configuration

Always call `ConstellationFS.setConfig()` before creating backends:

```typescript
import { ConstellationFS, FileSystem } from 'constellationfs'

ConstellationFS.setConfig({ workspaceRoot: '/tmp/my-workspace-root' })
const fs = new FileSystem({ userId: 'user-123' })
```

## Testing

Tests are in `tests/` and `src/__tests__/`. Run with `npm test`.

When writing tests that create backends/workspaces:
```typescript
beforeEach(() => {
  ConstellationFS.setConfig({ workspaceRoot: '/tmp/constellation-fs-test' })
})
afterEach(() => {
  ConstellationFS.reset()
})
```

## Code Style

- No semicolons, single quotes (ESLint enforced)
- Strict TypeScript
- Zod for config validation
- Custom error classes (FileSystemError, DangerousOperationError)

## Remote Backend

The `remote/` directory contains Docker setup for deploying a remote backend:
- `Dockerfile.runtime` - Docker image with SSH + MCP server
- `docker-compose.yml` - Full deployment config
- `deploy-tool/` - Web UI for cloud deployment
- `azure-vm-startup.sh` / `gcp-vm-startup.sh` - Cloud init scripts

## CLI

```bash
constellationfs mcp-server    # Start MCP server (stdio or HTTP mode)
constellationfs start-remote  # Start Docker remote backend
constellationfs stop-remote   # Stop Docker remote backend
```
