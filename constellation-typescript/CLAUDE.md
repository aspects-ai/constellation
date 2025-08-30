# ConstellationFS - Claude Development Guide

This document provides coding best practices and architectural guidance for working with the ConstellationFS codebase.

## Project Structure

ConstellationFS is a secure, isolated filesystem abstraction for AI agents with the following architecture:

```
src/
├── FileSystem.ts              # Main API class - primary entry point
├── adapters/                  # SDK-specific adapters for AI frameworks
│   ├── ClaudeCodeAdapter.ts   # Claude Code SDK integration with monkey-patching
│   ├── ConstellationChildProcess.ts # Custom ChildProcess implementation
│   └── BaseAdapter.ts         # Common adapter functionality
├── backends/                  # Execution environment implementations
│   ├── LocalBackend.ts        # Local filesystem operations
│   ├── RemoteBackend.ts       # SSH remote execution (future)
│   └── DockerBackend.ts       # Docker container execution (future)
├── config/                    # Configuration management
│   └── Config.ts              # Centralized configuration with Zod validation
├── utils/                     # Shared utilities
│   ├── workspaceManager.ts    # User workspace isolation
│   ├── pathValidator.ts       # Path security validation
│   ├── POSIXCommands.ts       # Cross-platform command abstraction
│   └── logger.ts              # Structured logging
├── safety.ts                  # Security validation and dangerous operation detection
├── types.ts                   # Core type definitions and error classes
└── constants.ts               # Application constants and error codes
```

## Key Architectural Decisions

### 1. Backend Abstraction Layer
- **Strategy Pattern**: Multiple backend implementations (Local, Remote, Docker) behind unified interface
- **Factory Pattern**: `BackendFactory` handles instantiation based on configuration
- **Isolation**: Each backend manages its own workspace and security model

### 2. Workspace Management
- **User-based Isolation**: Automatic workspace creation per `userId` in system temp directory
- **Path Structure**: `/tmp/constellation-fs/users/{userId}/`
- **Security Boundaries**: Strict workspace escape prevention at multiple layers

### 3. SDK Adapter Pattern
- **Framework Agnostic**: Designed to support multiple AI frameworks
- **Tool Mapping**: Each adapter maps its framework's tools to ConstellationFS operations
- **Monkey-patching**: Claude Code adapter intercepts Node.js `child_process` for remote execution

### 4. Security-First Design
- **Multi-layered Validation**: Command, path, and environment-level security
- **Default Denial**: Dangerous operations blocked by default
- **Escape Prevention**: Multiple mechanisms to prevent workspace escape

## Coding Best Practices

### TypeScript Standards

```typescript
// ✅ Good: Explicit interface definitions
interface BackendConfig {
  readonly type: 'local' | 'remote' | 'docker'
  readonly preventDangerous?: boolean
}

// ✅ Good: Proper error typing with custom classes
throw new FileSystemError(
  'Path escapes workspace boundary',
  ERROR_CODES.PATH_ESCAPE_ATTEMPT,
  path
)

// ✅ Good: Discriminated unions for configuration
type BackendConfig = LocalBackendConfig | RemoteBackendConfig | DockerBackendConfig

// ❌ Avoid: Using 'any' type
const result: any = someFunction()
```

### Code Style (ESLint enforced)

```typescript
// ✅ Good: No semicolons, single quotes
const message = 'Hello world'
const config = { type: 'local' as const }

// ✅ Good: Unused parameters with underscore prefix
async function processFile(_path: string, content: string): Promise<void>

// ✅ Good: Consistent imports
import type { FileSystem } from '../FileSystem.js'
import { validatePath } from '../utils/pathValidator.js'

// ✅ Good: Descriptive error codes
ERROR_CODES.ABSOLUTE_PATH_REJECTED
ERROR_CODES.DANGEROUS_OPERATION
```

### Error Handling

```typescript
// ✅ Good: Structured error handling with context
try {
  await fs.exec(command)
} catch (error) {
  throw this.wrapError(error, 'Execute command', ERROR_CODES.EXEC_FAILED, command)
}

// ✅ Good: Error wrapping preserves original context
private wrapError(error: unknown, operation: string, errorCode: string, command?: string): FileSystemError {
  if (error instanceof FileSystemError) {
    return error // Don't double-wrap
  }
  return new FileSystemError(`${operation} failed: ${message}`, errorCode, command)
}
```

### Security Patterns

```typescript
// ✅ Good: Multi-layered security validation
async exec(command: string): Promise<string> {
  // 1. Command safety check
  const safetyCheck = isCommandSafe(command)
  if (!safetyCheck.safe) {
    throw new FileSystemError(safetyCheck.reason, ERROR_CODES.DANGEROUS_OPERATION)
  }
  
  // 2. Path validation (handled by spawn with cwd)
  // 3. Environment isolation (handled by spawn with controlled env)
}

// ✅ Good: Path escape prevention
private resolvePath(path: string): string {
  if (isAbsolute(path)) {
    throw new FileSystemError('Absolute paths not allowed', ERROR_CODES.ABSOLUTE_PATH_REJECTED)
  }
  
  const fullPath = resolve(join(this.workspace, path))
  const relativePath = relative(this.workspace, fullPath)
  
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new FileSystemError('Path escapes workspace', ERROR_CODES.PATH_ESCAPE_ATTEMPT)
  }
  
  return fullPath
}
```

### Configuration Management

```typescript
// ✅ Good: Zod validation with defaults
const LocalBackendConfigSchema = z.object({
  type: z.literal('local'),
  shell: z.enum(['bash', 'sh', 'auto']).default('auto'),
  preventDangerous: z.boolean().default(true),
  validateUtils: z.boolean().default(false),
  maxOutputLength: z.number().positive().optional(),
})

// ✅ Good: Factory pattern with validation
export function createBackend(config: BackendConfig): FileSystemBackend {
  validateBackendConfig(config)
  
  switch (config.type) {
    case 'local':
      return new LocalBackend(config)
    // ... other cases
  }
}
```

### Async/Await Patterns

```typescript
// ✅ Good: Proper Promise handling with specific error types
async exec(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(this.shell, ['-c', command], options)
    
    child.on('close', code => {
      if (code === 0) {
        resolve(output.trim())
      } else {
        reject(new FileSystemError(`Command failed with exit code ${code}`, ERROR_CODES.EXEC_FAILED))
      }
    })
  })
}
```

## Testing Guidelines

### Test Environment Setup

⚠️ **Important**: During development, there is usually a development server already running. **Do not start additional servers** unless specifically requested. Check for existing processes first:

```bash
# Check if servers are running
lsof -i :3000,3001
# or
ps aux | grep -E "(next|node.*dev)"
```

### Testing Patterns

```typescript
// ✅ Good: Comprehensive test suites with setup/teardown
describe('FileSystem Security', () => {
  let fs: FileSystem
  
  beforeEach(async () => {
    fs = new FileSystem({ userId: 'test-user' })
  })
  
  afterEach(async () => {
    // Cleanup handled automatically by workspace isolation
  })
})

// ✅ Good: Security attack vector testing
const securityTests = [
  { attack: 'cat /etc/passwd', description: 'absolute path access' },
  { attack: 'cd ../.. && ls', description: 'directory traversal' },
  { attack: 'rm -rf /', description: 'destructive operation' }
]

it.each(securityTests)('blocks $description', async ({ attack }) => {
  await expect(fs.exec(attack)).rejects.toThrow(DangerousOperationError)
})
```

### Build and Development Commands

```bash
# Development
npm run dev          # Watch mode development
npm run build        # Production build
npm run typecheck    # TypeScript validation
npm run lint         # ESLint validation
npm run test         # Run test suite
npm run test:watch   # Watch mode testing

# Examples
cd examples/web-demo
npm run dev          # Start demo (usually already running)
```

## Key Implementation Patterns

### 1. Adapter Pattern Usage

```typescript
// ✅ Good: Implement full SDK adapter
export class MySDKAdapter extends BaseSDKAdapter {
  async MyTool(param: string): Promise<string> {
    // Map to appropriate backend operation
    return this.exec(`my-command ${param}`)
  }
}

// ✅ Good: Tool method naming matches SDK expectations
async Bash(command: string): Promise<string> {
  return this.exec(command) // Maps to Claude's Bash tool
}
```

### 2. Backend Implementation

```typescript
// ✅ Good: Implement FileSystemBackend interface
export class MyBackend implements FileSystemBackend {
  constructor(config: MyBackendConfig) {
    validateMyBackendConfig(config)
    // Initialize backend
  }
  
  async exec(command: string): Promise<string> {
    // Implement command execution for this backend
  }
  
  // ... other required methods
}
```

### 3. Configuration Extensions

```typescript
// ✅ Good: Extend configuration with Zod validation
const MyBackendConfigSchema = z.object({
  type: z.literal('mybackend'),
  myOption: z.string(),
  // ... other options
})

export type MyBackendConfig = z.infer<typeof MyBackendConfigSchema>

export function validateMyBackendConfig(config: unknown): MyBackendConfig {
  return MyBackendConfigSchema.parse(config)
}
```

## Integration Guidelines

### Claude Code SDK Integration

The `ClaudeCodeAdapter` uses advanced monkey-patching to intercept Node.js `child_process` calls:

```typescript
// ✅ Usage: Enable before SDK import
import { ClaudeCodeAdapter } from 'constellationfs'
ClaudeCodeAdapter.enableMonkeyPatching()

import { query } from '@anthropic-ai/claude-code'

// Create filesystem and adapter
const fs = new FileSystem({ userId: sessionId })
const adapter = new ClaudeCodeAdapter(fs)

// SDK now uses ConstellationFS for all shell operations
```

**How it works:**
- Intercepts `require('child_process')` calls using Module.prototype.require proxy
- Returns `ConstellationChildProcess` instances that execute via ConstellationFS
- Maintains full API compatibility with Node.js ChildProcess interface
- Supports both `exec` (buffered) and `spawn` (streaming) patterns

### Error Recovery

```typescript
// ✅ Good: Graceful degradation
try {
  return await remoteBackend.exec(command)
} catch (error) {
  if (fallbackToLocal) {
    return await localBackend.exec(command)
  }
  throw error
}
```

## Development Notes

- **Memory Management**: ConstellationFS automatically handles workspace cleanup
- **Security Testing**: Always test with attack vectors when modifying security code
- **Backend Extensions**: Use factory pattern registration for new backends
- **Configuration**: Validate all configuration with Zod schemas
- **Documentation**: Update JSDoc when changing public APIs

## Common Commands

```bash
# Quick development cycle
npm run dev &           # Start watch mode
npm run test:watch &    # Start test watch mode
# Make changes...
npm run typecheck       # Validate types
npm run lint            # Check style

# Before committing
npm run build           # Ensure clean build
npm test               # Run full test suite
```

## Security Considerations

Always consider these security aspects when making changes:

1. **Path Validation**: Can this change allow workspace escape?
2. **Command Safety**: Does this introduce new command execution paths?
3. **Input Validation**: Are all inputs properly validated?
4. **Environment Isolation**: Could this leak environment variables or process information?
5. **Error Information**: Do error messages leak sensitive information?

**Remember**: Security is enforced at multiple layers. When in doubt, add validation rather than remove it.