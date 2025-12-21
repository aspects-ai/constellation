# ConstellationFS 🌟

A filesystem abstraction for AI agents that provides familiar bash commands instead of custom APIs.

[![npm version](https://badge.fury.io/js/constellationfs.svg)](https://badge.fury.io/js/constellationfs)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](https://choosealicense.com/licenses/mit/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

## Why ConstellationFS?

AI models are already trained on millions of filesystem operations. Instead of teaching agents custom APIs like `create_frame_tool()` and `modify_frame_tool()`, ConstellationFS lets them use the bash commands they already know: `ls`, `grep`, `sed`, `cat`, and more.

**The filesystem IS the API.**

## Quick Start

```bash
npm install constellationfs
```

### Local Backend (Default)

```typescript
import { FileSystem } from 'constellationfs'

// Simple usage - just provide a workspace directory
const fs = new FileSystem('./my-workspace')

// Execute any bash command
await fs.exec('echo "Hello World" > greeting.txt')
await fs.exec('grep -r "TODO" . | head -5')

// Direct file operations
await fs.write('config.json', JSON.stringify({ version: '1.0' }))
const content = await fs.read('config.json')
const files = await fs.ls('*.txt')
```

### Remote Backend (SSH)

Remote backend allows execution on a separate machine or container via SSH.

**1. Start the remote container (optional for testing):**
```bash
npx constellationfs start-remote
```

**2. Set environment variables:**
```bash
export REMOTE_VM_HOST=root@localhost:2222    # SSH connection string
export REMOTE_VM_PASSWORD=constellation       # Or use SSH keys
```

**3. Use remote backend in your code:**
```typescript
import { FileSystem } from 'constellationfs'

const fs = new FileSystem({
  workspace: './my-workspace',
  backend: 'remote',
  userId: 'user-123'  // Isolates workspaces per user
})

// Commands execute on remote machine
await fs.exec('uname -a')
await fs.write('remote-file.txt', 'This runs remotely!')
```

### MCP Server Mode

ConstellationFS can run as an MCP (Model Context Protocol) server, allowing AI applications to connect via HTTP+SSE.

**Start MCP server locally:**
```bash
npx constellationfs mcp-server \
  --workspaceRoot /constellationfs \
  --http \
  --port 3001 \
  --authToken your-secret-token
```

**Connect from a host application:**
```typescript
import { createConstellationMCPClient } from 'constellationfs'

const mcpClient = await createConstellationMCPClient({
  url: 'http://your-server:3001',
  authToken: 'your-secret-token',
  userId: 'user-123',
  workspace: 'default',
})

// List available tools
const { tools } = await mcpClient.listTools()

// Call tools directly
const result = await mcpClient.callTool({
  name: 'read_text_file',
  arguments: { path: 'package.json' }
})

// Clean up when done
await mcpClient.close()
```

**With Vercel AI SDK:**
```typescript
import { experimental_createMCPClient as createMCPClient } from '@ai-sdk/mcp'
import { createConstellationMCPTransport } from 'constellationfs'

const transport = createConstellationMCPTransport({
  url: 'http://your-server:3001',
  authToken: 'your-secret-token',
  userId: 'user-123',
  workspace: 'default',
})

const mcpClient = await createMCPClient({ transport })
const tools = await mcpClient.tools()

// Use tools with streamText/generateText
await mcpClient.close()
```

**Available MCP tools:**
- `read_text_file`, `read_multiple_files` - Read files
- `write_file`, `edit_file` - Write/edit files
- `list_directory`, `directory_tree` - Browse filesystem
- `create_directory`, `move_file` - Manage files
- `search_files`, `get_file_info` - Search and inspect
- `exec` - Execute shell commands

## 🚀 Interactive Demo

Try ConstellationFS in your browser with our live AI coding assistant:

**[→ Launch Web Demo](https://constellation-fs-demo.vercel.app)**

Chat with an AI agent that uses ConstellationFS to build projects, edit files, and run commands. Watch the filesystem update in real-time as the AI works.

[![Web Demo Screenshot](https://via.placeholder.com/600x300/0a0a0a/ffffff?text=ConstellationFS+Web+Demo)](https://constellation-fs-demo.vercel.app)

## Core Features

### ✅ Familiar Interface
Use the bash commands AI models already know:
```typescript
const fs = new FileSystem('./workspace')

await fs.exec('find . -name "*.js" | xargs wc -l')
await fs.exec('sed -i "s/old/new/g" *.txt')
await fs.exec('sort data.csv | uniq > unique.csv')
```

### 🔒 Safety First
Dangerous operations are blocked by default:
```typescript
// This will throw a DangerousOperationError
await fs.exec('rm -rf /')

// Or provide a callback to handle them
const fs = new FileSystem({
  workspace: './safe-zone',
  onDangerousOperation: (command) => {
    console.log(`Blocked dangerous command: ${command}`)
  }
})
```

### 🏗️ Workspace Isolation
All operations are sandboxed to your specified workspace:
```typescript
const fs = new FileSystem('./project')

// This works - relative to workspace
await fs.read('src/index.ts')

// This fails - absolute paths rejected
await fs.read('/etc/passwd') // ❌ Error

// This fails - directory traversal blocked  
await fs.read('../../../secrets.txt') // ❌ Error
```

## API Reference

### Constructor

```typescript
// Simple string workspace
const fs = new FileSystem('./workspace')

// Full configuration
const fs = new FileSystem({
  workspace: './workspace',
  backend: 'local',                    // Use 'remote' for production
  preventDangerous: true,              // Block dangerous commands (default: true)
  onDangerousOperation: (cmd) => {     // Handle blocked commands
    console.log(`Blocked: ${cmd}`)
  },
  maxOutputLength: 10000               // Truncate long outputs (optional)
})
```

### Methods

#### `exec(command: string, encoding?: 'utf8' | 'buffer'): Promise<string | Buffer>`
Execute a shell command in the workspace.

```typescript
// Default: returns string (UTF-8 encoded)
const output = await fs.exec('ls -la')
const wordCount = await fs.exec('wc -l *.txt')

// Binary mode: returns Buffer for binary data
const tarball = await fs.exec('tar -czf - .', 'buffer')
await fs.write('archive.tar.gz', tarball)

// Use buffer encoding to preserve binary data integrity
const gzipData = await fs.exec('gzip -c file.txt', 'buffer')
```

#### `read(path: string): Promise<string>`
Read file contents (UTF-8).

```typescript
const content = await fs.read('data.json')
```

#### `write(path: string, content: string): Promise<void>`
Write content to a file (UTF-8).

```typescript
await fs.write('output.txt', 'Hello World')
```

#### `ls(pattern?: string): Promise<string[]>`
List files and directories, optionally with glob pattern.

```typescript
const allFiles = await fs.ls()
const textFiles = await fs.ls('*.txt')
```

### Properties

- `fs.workspace` - Get the absolute workspace path
- `fs.options` - Get the current configuration

## Error Handling

ConstellationFS provides structured error handling:

```typescript
import { FileSystemError, DangerousOperationError } from 'constellationfs'

try {
  await fs.exec('some-command')
} catch (error) {
  if (error instanceof DangerousOperationError) {
    console.log('Dangerous operation blocked:', error.command)
  } else if (error instanceof FileSystemError) {
    console.log('Operation failed:', error.message, error.code)
  }
}
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

All file operations are restricted to the workspace:

- Absolute paths are rejected
- Directory traversal (`../`) is blocked
- Commands are executed with the workspace as `cwd`

## TypeScript Support

ConstellationFS is written in TypeScript and provides full type safety:

```typescript
import type { FileSystemOptions, FileSystemInterface } from 'constellationfs'

const options: FileSystemOptions = {
  workspace: './data',
}

const fs: FileSystemInterface = new FileSystem(options)
```

## SDK Adapters

ConstellationFS provides SDK-specific adapters that map to familiar agent toolsets while maintaining the same underlying filesystem operations.

### Claude Code Adapter

The Claude Code adapter maps ConstellationFS operations to match Claude's built-in tools:

```typescript
import { FileSystem, ClaudeCodeAdapter } from 'constellationfs'

// Create filesystem and adapter
const fs = new FileSystem('./workspace')
const claude = new ClaudeCodeAdapter(fs)

// Use Claude-style tool methods
await claude.Bash('echo "Hello World" > greeting.txt')
const files = await claude.LS()
const matches = await claude.Glob('*.txt')
const content = await claude.Read('greeting.txt')
await claude.Write('output.txt', 'New content')
await claude.Edit('greeting.txt', 'Hello World', 'Hello Claude')

// Advanced grep with options
const results = await claude.Grep('TODO', {
  files: '*.ts',
  ignoreCase: true,
  lineNumbers: true,
  context: 2
})
```

### Creating Custom Adapters

You can create adapters for other AI SDKs by extending the base adapter:

```typescript
import { BaseSDKAdapter, FileSystem } from 'constellationfs'

class CustomSDKAdapter extends BaseSDKAdapter {
  constructor(fs: FileSystem) {
    super(fs)
  }

  // Map your SDK's tool names to filesystem operations
  async customTool(args: any) {
    return this.exec(`your-command ${args}`)
  }

  // Access inherited methods: this.read(), this.write(), this.ls(), this.exec()
}

// Use your custom adapter
const fs = new FileSystem('./workspace')
const adapter = new CustomSDKAdapter(fs)
```

## Advanced Configuration

### Token-Aware Output Limiting

Prevent AI context overflow by limiting command output length:

```typescript
const fs = new FileSystem({
  workspace: './project',
  maxOutputLength: 10000,  // Truncate output longer than 10k characters
  preventDangerous: true
})

// Long outputs will be automatically truncated with a helpful message
const result = await fs.exec('find . -type f -exec cat {} \\;')
```

### Detailed File Listings

Get structured file information instead of just names:

```typescript
import type { FileInfo } from 'constellationfs'

// Get detailed file metadata
const files = await fs.ls({ details: true }) as FileInfo[]
files.forEach(file => {
  console.log(`${file.name}: ${file.type}, ${file.size} bytes, modified ${file.modified}`)
})

// Works with patterns too
const textFiles = await fs.ls('*.txt', { details: true }) as FileInfo[]
```

## Development

### Running from Cloned Repository

To work with ConstellationFS from source:

```bash
# Clone the repository
git clone https://github.com/constellation-fs/constellation-fs.git
cd constellation-fs

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Type checking
npm run typecheck

# Linting and formatting
npm run lint
npm run format
```

For development with automatic rebuilding:

```bash
# Watch mode for continuous development
npm run dev

# Run tests in watch mode
npm test -- --watch
```

### Using the Cloned Version in Your Project

To use your local development version of ConstellationFS in another project:

```bash
# In the ConstellationFS directory
npm link

# In your project directory
npm link constellationfs
```

Or directly reference the local path in your project's `package.json`:

```json
{
  "dependencies": {
    "constellationfs": "file:../path/to/constellation-fs"
  }
}
```

## Roadmap 🚀

ConstellationFS is just getting started. Here's what's coming:

### 🐳 Docker Backend
Container isolation for multi-user environments:
```typescript
const fs = new FileSystem({
  workspace: './project',
  backend: 'docker',
  containerImage: 'node:18-alpine'
})
```
- Process isolation per user
- Resource limits (CPU, memory, disk)
- Container pooling for performance
- Custom Docker images support

### 🏢 Multi-Tenant Architecture
Production-ready user isolation:
```typescript
const fs = new FileSystem({
  workspace: 's3://bucket/tenants/user123/workspace',
  backend: 'cloud',
  auth: { jwt: 'eyJ...' }
})
```
- JWT-based authentication
- Per-tenant workspace isolation
- Rate limiting and quotas
- Comprehensive audit logging

### ☁️ Cloud Backends
Scalable storage backends:
- **S3 Backend**: Direct integration with AWS S3
- **Azure Files**: Azure cloud storage support
- **Google Cloud**: GCS backend implementation
- **Multi-cloud**: Abstract interface for any provider

### 🔧 Framework Integrations
Ready-to-use integrations with popular AI frameworks:

**LangChain Tools**:
```typescript
import { createConstellationTool } from 'constellationfs/langchain'

const tool = createConstellationTool('./workspace')
```

**Vercel AI SDK**:
```typescript
import { constellationFunction } from 'constellationfs/vercel'

const fn = constellationFunction('./workspace')
```

**OpenAI Function Calling**:
```typescript
import { getOpenAISchema } from 'constellationfs/openai'

const schema = getOpenAISchema('./workspace')
```

### 📊 Advanced Features
Production monitoring and controls:
- **Resource Monitoring**: CPU, memory, disk usage tracking
- **Command Analytics**: Usage patterns and optimization insights
- **Token-Aware Output**: Automatic truncation for AI context limits
- **Streaming Support**: Real-time output for long-running commands
- **Plugin Architecture**: Custom backends and middleware

### 🔍 Developer Experience
Enhanced tooling and debugging:
- **Debug Mode**: Detailed logging and command tracing
- **Interactive Playground**: Web-based testing environment
- **Command History**: Built-in audit trail
- **Performance Profiling**: Command execution metrics

## Contributing

We welcome contributions! ConstellationFS aims to be the standard filesystem abstraction for AI agents.

- **[Contributing Guide](CONTRIBUTING.md)**: Development setup, guidelines, and best practices
- **[Code of Conduct](CODE_OF_CONDUCT.md)**: Our community standards
- **[Security Policy](SECURITY.md)**: Report security vulnerabilities
- **[Issue Templates](.github/ISSUE_TEMPLATE/)**: Bug reports, feature requests, and questions

### Ways to Contribute

- **Report Bugs**: Use our [bug report template](.github/ISSUE_TEMPLATE/bug_report.md)
- **Request Features**: Share ideas using the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md)
- **Submit PRs**: Check our [contributing guide](CONTRIBUTING.md) and [PR template](.github/PULL_REQUEST_TEMPLATE.md)
- **Improve Docs**: Help make our documentation clearer and more comprehensive
- **Share Feedback**: Let us know how you're using ConstellationFS

## Philosophy

The best AI tools feel invisible. By leveraging the filesystem metaphor that every developer and AI model already understands, ConstellationFS eliminates the learning curve and lets agents work with tools they already know.

Just like Docker standardized containers, ConstellationFS aims to standardize filesystem access for AI agents.

## License

MIT - see [LICENSE](LICENSE) file for details.

---

**ConstellationFS**: Where AI agents feel at home. 🏠

[![Star on GitHub](https://img.shields.io/github/stars/constellation-fs/constellation-fs?style=social)](https://github.com/constellation-fs/constellation-fs)