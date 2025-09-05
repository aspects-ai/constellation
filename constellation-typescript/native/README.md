# ConstellationFS LD_PRELOAD Intercept Library

This directory contains the native C library that intercepts system calls to redirect shell execution to remote backends via SSH.

## How It Works

The `libintercept.so` library uses LD_PRELOAD to intercept `execve()` and `execvp()` system calls. When any process (including Node.js child_process calls) attempts to execute a shell command, the library:

1. Captures the command and arguments
2. Forwards the command to a remote host via SSH
3. Returns the exit code from the remote execution

## Building

```bash
# Build the shared library
make

# Build with debug symbols
make debug

# Test the build
make test

# Clean build artifacts
make clean
```

## Usage

The library is controlled by environment variables:

- `REMOTE_VM_HOST`: SSH target host (e.g., "user@remote.com" or "localhost:2222")
- `CONSTELLATION_CWD`: Working directory to use on remote host (optional)

### Example Usage

```bash
# Build the library
cd native
make

# Set up environment
export REMOTE_VM_HOST="user@remote-server.com"
export CONSTELLATION_CWD="/workspace/user123"

# Run Node.js with interception
LD_PRELOAD="$(pwd)/libintercept.so" node your-app.js
```

### With Docker Container

```bash
# Start a Docker container with SSH server
docker run -d -p 2222:22 --name remote-env ubuntu-ssh-server

# Configure to use the container
export REMOTE_VM_HOST="root@localhost:2222"
export CONSTELLATION_CWD="/workspace"

# Run with interception
LD_PRELOAD="$(pwd)/native/libintercept.so" npm run dev
```

## Integration with ConstellationFS

The RemoteBackend class automatically:
1. Builds the library if needed
2. Sets the appropriate environment variables
3. Configures LD_PRELOAD when starting Node.js processes
4. Manages SSH connections and authentication

## Platform Support

Currently supports Linux systems with:
- GCC compiler
- SSH client
- Standard C library with dlsym support

## Security

The library uses SSH with the following security features:
- BatchMode=yes (no password prompts)
- StrictHostKeyChecking=no (for development)
- Proper shell escaping to prevent command injection
- Falls back to original execve if REMOTE_VM_HOST is not set