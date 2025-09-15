# Docker Remote Backend Setup

This guide explains how to set up and test the RemoteBackend using Docker containers locally.

## Overview

The Docker setup creates an SSH-enabled container that acts as a "remote" server for testing ConstellationFS RemoteBackend functionality. This allows you to:

- Test remote backend functionality without actual remote servers
- Validate LD_PRELOAD command interception locally  
- Develop and debug RemoteBackend features safely

## Quick Start

1. **Start the Docker SSH container:**
   ```bash
   ./setup-docker.sh
   ```

2. **Open the web demo and configure backend:**
   ```bash
   cd examples/web-demo
   npm run dev
   ```

3. **Switch to Remote Backend:**
   - Go to "Backend Config" tab in web demo
   - Select "Remote (Docker)" option
   - Verify default settings:
     - Host: `localhost:2222`
     - Username: `root`
     - Workspace: `/workspace`
   - Click "Test Connection" to verify

4. **Test functionality:**
   - Use the Chat interface to run commands
   - Commands will be executed in the Docker container via SSH
   - Files are stored in the container's `/workspace` directory

5. **Clean up when done:**
   ```bash
   ./cleanup-docker.sh
   ```

## Architecture

```
Web Demo (Next.js)
        ↓
ConstellationFS RemoteBackend
        ↓
SSH Connection (localhost:2222)
        ↓
Docker Container (Ubuntu + SSH Server)
        ↓
Command execution in /workspace
```

### LD_PRELOAD Interception

When using RemoteBackend, ConstellationFS:

1. **Builds `libintercept.so`** - C library that intercepts `execve()` calls
2. **Sets environment variables:**
   - `LD_PRELOAD=/path/to/libintercept.so`
   - `REMOTE_VM_HOST=root@localhost:2222`
3. **Intercepts commands**: When AI SDK runs `child_process.exec('ls')`, it gets forwarded as `ssh root@localhost:2222 'ls'`

## Docker Container Details

### Container Configuration
- **Base Image**: Ubuntu 22.04
- **SSH Server**: OpenSSH with password authentication
- **Development Tools**: Node.js, Python, git, build tools
- **Default Credentials**:
  - Username: `root`
  - Password: `constellation`
- **SSH Port**: Container port 22 → Host port 2222
- **Workspace**: `/workspace` directory for file operations

### Directory Structure
```
/workspace/
├── projects/     # Mounted from host docker/workspace/
├── shared/       # Mounted from host docker/shared/ 
└── temp/         # Container-only temporary space
```

## Scripts Reference

### setup-docker.sh
Comprehensive setup script that:
- ✅ Checks Docker installation and status
- 🔑 Generates SSH keys for passwordless authentication
- 📁 Creates necessary directories
- 🐳 Builds and starts Docker container
- ⏳ Waits for SSH service to be ready
- 🧪 Tests SSH connection
- 📝 Creates SSH config file for easy access

**Usage:**
```bash
./setup-docker.sh
```

### cleanup-docker.sh
Cleanup script with multiple options:
- `./cleanup-docker.sh` - Stop containers only
- `./cleanup-docker.sh --all` - Complete cleanup (containers, images, volumes, keys)
- `./cleanup-docker.sh --images` - Also remove Docker images
- `./cleanup-docker.sh --volumes` - Also remove Docker volumes
- `./cleanup-docker.sh --status` - Show current Docker status

## Manual SSH Access

For debugging and testing:

### Using generated SSH keys:
```bash
ssh -F docker/ssh_config constellation-docker
```

### Using password authentication:
```bash
ssh root@localhost -p 2222
# Password: constellation
```

### Direct Docker access:
```bash
docker exec -it constellation-ssh-server bash
```

## Web Demo Integration

The web demo includes a **Backend Configuration** interface:

### Local Backend
- Uses local filesystem with session-based isolation
- Files stored in system temp directory
- No network required

### Remote Backend (Docker)  
- Connects to Docker container via SSH
- Real SSH authentication and command execution
- Files stored in container's `/workspace`
- LD_PRELOAD interception for command forwarding

### Configuration Options
- **Host**: SSH connection target (default: `localhost:2222`)
- **Username**: SSH username (default: `root`)
- **Workspace**: Remote working directory (default: `/workspace`)
- **Connection Test**: Verifies SSH connectivity

## Development Workflow

### 1. Start Development Environment
```bash
./setup-docker.sh
cd examples/web-demo
npm run dev
```

### 2. Test Backend Switching
- Start with Local backend (default)
- Switch to Remote backend in web demo
- Verify commands execute in Docker container
- Check file operations work correctly

### 3. Debug Issues
```bash
# Check container logs
cd docker && docker-compose logs -f

# SSH into container manually  
ssh root@localhost -p 2222

# Check SSH connection
nc -z localhost 2222 && echo "SSH port open"

# View Docker status
./cleanup-docker.sh --status
```

### 4. Clean Environment
```bash
# Stop containers but keep data
./cleanup-docker.sh

# Complete cleanup
./cleanup-docker.sh --all
```

## Troubleshooting

### Docker Issues
- **"Docker not running"**: Start Docker Desktop or Docker daemon
- **"Port 2222 in use"**: Stop other SSH services or change port in docker-compose.yml
- **"Permission denied"**: Run `chmod +x setup-docker.sh cleanup-docker.sh`

### SSH Connection Issues  
- **"Connection refused"**: Wait for container to fully start (30-60 seconds)
- **"Authentication failed"**: Use password `constellation` or regenerate keys
- **"Host key verification"**: SSH config disables this check automatically

### Web Demo Issues
- **"Backend connection failed"**: Ensure Docker container is running and SSH is ready
- **"Files not loading"**: Check Docker container has started and workspace is accessible
- **"Commands not executing"**: Verify LD_PRELOAD library builds successfully

### Container Health
```bash
# Check container status
docker ps | grep constellation-ssh-server

# Check SSH service in container
docker exec constellation-ssh-server service ssh status

# Check port accessibility
nc -z localhost 2222 && echo "Port 2222 accessible"
```

## Security Notes

⚠️ **For Development Only**: This setup uses default passwords and permissive SSH settings. Do not expose port 2222 to external networks.

**Default Security Settings:**
- Password authentication enabled
- Root login allowed  
- Default password: `constellation`
- SSH keys accepted without verification

For production remote backends, use:
- SSH key authentication only
- Non-root users with limited permissions
- Proper firewall and network security
- Strong authentication credentials

## Next Steps

Once you've verified the Docker setup works:

1. **Test with Real Remote Servers**: Use the same RemoteBackend configuration with actual remote hosts
2. **Customize Container**: Modify Dockerfile to add specific tools or configurations
3. **Scale Testing**: Run multiple containers for multi-user testing
4. **Integration Testing**: Add automated tests using the Docker setup

The Docker setup provides a complete, isolated environment for developing and testing ConstellationFS remote backend functionality!