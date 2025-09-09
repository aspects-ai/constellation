# ConstellationFS Simplified Architecture Plan

## Overview

This document outlines the comprehensive plan to restructure ConstellationFS into a simplified, consumer-focused architecture. The goal is to provide a single unified package that handles cross-platform native compilation and provides simple Docker-based remote filesystem backends while maintaining a clean consumer experience.

## Current State Analysis

### Existing Structure (Messy)
```
constellation-fs/constellation-typescript/
├── docker/                           # Old Docker infrastructure (needs cleanup)
│   ├── backend/                      # Various Docker configs
│   ├── devenv/                       # Development environment
│   ├── docker-compose.yml           # Complex composition setup
│   └── scripts/                      # Legacy scripts
├── docker-dev/                       # New Docker tooling (misplaced)
│   ├── src/                          # TypeScript CLI implementation
│   ├── bin/                          # CLI binaries (not working via npx)
│   └── docker/                       # Duplicated Docker configs
├── examples/web-demo/                # Should be external consumer
├── src/                              # Core library (working)
├── native/                           # Native library source (working)
├── scripts/                          # Build scripts (partially working)
└── setup-remote-dev.sh              # Development setup script
```

### Current Issues
1. **Duplicated Docker Infrastructure**: Both `docker/` and `docker-dev/` exist with overlapping purposes
2. **Complex Package Structure**: Multiple Docker directories causing confusion
3. **CLI Tools Not Working**: `npx @constellationfs/docker-dev` fails because package isn't published
4. **Consumer Confusion**: Unclear how external consumers should actually use the system
5. **Mixed Internal/External**: web-demo treated as internal rather than external consumer

### What's Working
1. ✅ Core TypeScript library and FileSystem API
2. ✅ Cross-platform native compilation with postinstall hooks (partially)
3. ✅ Platform detection and graceful degradation
4. ✅ Local backend functionality
5. ✅ Basic LD_PRELOAD interception concept

## Target Architecture: Unified Simplicity

### Single Package Structure
```
constellation-fs/constellation-typescript/    # Single unified package
├── src/                                      # TypeScript library
│   ├── backends/                             # Backend implementations  
│   ├── adapters/                             # SDK adapters
│   ├── utils/                                # Utilities & platform detection
│   └── index.ts                              # Public API
├── native/                                   # Native library source
│   ├── intercept.c                           # LD_PRELOAD implementation
│   ├── Makefile                              # Build configuration
│   └── Dockerfile.builder                    # Cross-platform build container
├── remote/                                   # Remote backend Docker images
│   ├── Dockerfile.runtime                    # Remote filesystem backend service
│   ├── docker-compose.yml                   # Service orchestration
│   └── entrypoint.sh                         # Service startup script
├── cli/                                      # CLI tools (new)
│   ├── build-native.js                       # Cross-platform native building
│   ├── path.js                              # Path discovery utility
│   └── docker-run.js                        # Docker execution wrapper
├── bin/                                      # CLI entry points
│   └── constellationfs                       # Main CLI binary
├── scripts/                                  # Build scripts (cleaned up)
└── package.json                              # Single package config
```

### Separate Consumer Examples
```
constellation-fs/examples/                    # External to main package
├── web-demo/                                 # Next.js example
```

## Consumer Experience Design

### Simple Installation
```bash
npm install constellationfs
```

### Cross-Platform Native Building
```bash
# Build native library (works on all platforms)
npx constellationfs build-native --output ./build/

# What this does:
# - Linux: Compiles natively using system build tools
# - macOS/Windows: Uses Docker to build in Linux environment  
# - Outputs libintercept.so to specified directory
# - Handles Docker image building and cleanup automatically
```

### Path Discovery
```bash
# Find where the native library was built
npx constellationfs path
# Output: ./build/libintercept.so
```

### Running with Remote Backend

#### Option 1: Docker Execution (Cross-Platform)
```bash
# Start remote backend service (if needed)
docker run -d -p 2222:22 constellationfs/remote-backend

# Run consumer app with LD_PRELOAD
docker run \
  -v $(pwd):/app \
  -e LD_PRELOAD=/app/build/libintercept.so \
  -e REMOTE_VM_HOST=root@host.docker.internal:2222 \
  -p 3000:3000 \
  node:18 \
  npm run dev
```

#### Option 2: Native Linux Execution
```bash
# On Linux systems only
LD_PRELOAD=./build/libintercept.so \
REMOTE_VM_HOST=root@remote-server:22 \
npm run dev
```

### Consumer Code (No Changes Required)
```javascript
import { FileSystem } from 'constellationfs'

// Note FileSystem no longer specifies the host - we need to specify host in environment variable for LD_PRELOAD to work. We'll want to remove the host from the Remote backend config as well.
const fs = new FileSystem({
  type: 'remote',
  userId: 'user123',
  workspace: '/home/user/workspace',
  auth: {
    type: 'password',
    credentials: { username: 'user', password: 'secret' }
  }
})

// This works transparently due to LD_PRELOAD interception
await fs.exec('ls -la')
await fs.read('file.txt')
await fs.write('output.txt', 'content')
```

## Docker Images Strategy

### Primary Image: `constellationfs/remote-backend`

**Purpose**: Deployable remote filesystem backend service
- Provides a POSIX filesystem accessible via SSH
- Can be used for local development testing
- Can be deployed in production as a filesystem service
- Thin wrapper around standard Linux filesystem

**Features**:
- SSH server with password/key authentication
- Configurable user workspace isolation
- Volume mounting for persistent storage
- Security boundaries and access controls
- Logging and monitoring hooks

**Usage Scenarios**:
1. **Local Development**: Test remote backend functionality
2. **Production Deployment**: Deploy on VMs as filesystem service
3. **CI/CD**: Provide isolated filesystem environments for testing
4. **Multi-tenant**: Support multiple user workspaces

**Configuration**:
```yaml
# docker-compose.yml
services:
  remote-backend:
    image: constellationfs/remote-backend
    ports:
      - "2222:22"
    volumes:
      - ./workspace:/workspace
    environment:
      - SSH_USERS=user1:password1,user2:password2
      - WORKSPACE_ROOT=/workspace
      - ENABLE_LOGGING=true
```

### Builder Image: `constellationfs/builder` (Internal)

**Purpose**: Cross-platform native library compilation
- Used internally by `npx constellationfs build-native`
- Contains build tools (gcc, make, etc.)
- Produces libintercept.so for Linux

## Implementation Plan

### Phase 1: Directory Cleanup and Consolidation

#### Step 1: Clean Up Docker Directories
```bash
# Remove duplicated/confused Docker setups
rm -rf docker-dev/                    # Remove misplaced CLI tools
mv docker/ docker-old/                # Backup existing setup
mkdir docker/                         # Create clean Docker directory

# Create clean Docker structure
native/
remote/
```

#### Step 2: Extract CLI Tools
```bash
# Create CLI directory with proper tools
cli/
├── build-native.js                  # Cross-platform native building
├── path.js                          # Path discovery
├── docker-run.js                    # Docker execution wrapper
└── index.js                         # CLI entry point
```

#### Step 3: Update Package Configuration
```json
{
  "name": "constellationfs",
  "bin": {
    "constellationfs": "./bin/constellationfs"
  },
  "scripts": {
    "build": "vite build",
    "build:native": "node scripts/build-native.js",
    "postinstall": "node scripts/build-native.js"
  }
}
```

### Phase 2: Implement CLI Tools

#### `build-native` Command Implementation
```javascript
// cli/build-native.js
export async function buildNative(options = {}) {
  const outputDir = options.output || './dist-native'
  const platform = process.platform
  
  if (platform === 'linux') {
    // Build natively on Linux
    return buildNativeLinux(outputDir)
  } else {
    // Use Docker on non-Linux platforms
    return buildNativeDocker(outputDir)
  }
}

async function buildNativeDocker(outputDir) {
  // 1. Build/pull builder Docker image
  // 2. Mount native source into container
  // 3. Run build process inside container
  // 4. Copy libintercept.so to host output directory  
  // 5. Clean up container
}
```

#### `path` Command Implementation
```javascript
// cli/path.js
export function getNativeLibraryPath() {
  const possiblePaths = [
    './build/libintercept.so',
    './dist-native/libintercept.so',
    './node_modules/constellationfs/dist-native/libintercept.so'
  ]
  
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path
    }
  }
  
  throw new Error('Native library not found. Run: npx constellationfs build-native')
}
```

### Phase 3: Docker Images Implementation

#### Remote Backend Service Image

refer to the existing Dockerfile in old-docker/backend

#### Service Entrypoint
```bash
#!/bin/bash
# remote/entrypoint.sh

Refer to the existing script in old-docker/backend
```

### Phase 4: Consumer Experience Testing

#### Test Scenarios
1. **Fresh Installation**: `npm install constellationfs` in new project
2. **Native Building**: `npx constellationfs build-native --output ./build/`
3. **Local Development**: Running Next.js with LD_PRELOAD on Linux
4. **Docker Development**: Running Next.js with Docker on macOS/Windows
5. **Production Deployment**: Deploying remote backend service

#### Integration Tests
```javascript
// Test cross-platform building
test('build-native creates library in specified output', async () => {
  await buildNative({ output: './test-build' })
  expect(existsSync('./test-build/libintercept.so')).toBe(true)
})

// Test path discovery
test('path command finds built library', () => {
  const path = getNativeLibraryPath()
  expect(existsSync(path)).toBe(true)
  expect(path.endsWith('libintercept.so')).toBe(true)
})
```

## Consumer Documentation

### Installation Guide
```markdown
# ConstellationFS Installation

## Basic Installation
```bash
npm install constellationfs
```

## Build Native Library
```bash
# Cross-platform: works on Linux, macOS, Windows
npx constellationfs build-native --output ./build/
```

## Usage

### Local Backend (Works Everywhere)
```javascript
import { FileSystem } from 'constellationfs'
const fs = new FileSystem({ userId: 'user123' })
await fs.exec('echo "Hello World"')
```

### Remote Backend

#### Linux Development
```bash
LD_PRELOAD=./build/libintercept.so npm run dev
```

#### macOS/Windows Development
```bash
# Start remote backend service
docker run -d -p 2222:22 constellationfs/remote-backend

# Run your app with LD_PRELOAD in container
docker run \
  -v $(pwd):/app \
  -e LD_PRELOAD=/app/build/libintercept.so \
  -p 3000:3000 \
  node:18 \
  npm run dev
```

#### Production Deployment
```bash
# Deploy remote backend service on VM
docker run -d \
  -p 22:22 \
  -v /data:/workspace \
  -e SSH_USERS=app:secretpassword \
  constellationfs/remote-backend

# Your app connects to this service
const fs = new FileSystem({
  type: 'remote',
  host: 'your-server.com:22',
  auth: { type: 'password', credentials: { username: 'app', password: 'secretpassword' }}
})
```
```

### Examples Repository
Move examples to constellation-fs examples folder and update references accordingly