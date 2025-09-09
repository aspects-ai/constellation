# ConstellationFS Remote Backend

This directory contains the Docker configuration for the ConstellationFS remote backend service - a deployable POSIX filesystem accessible via SSH.

## Quick Start

### Using Docker Compose (Recommended)

```bash
cd remote/
docker-compose up -d
```

### Using Docker Run

```bash
# Build the image
docker build -f remote/Dockerfile.runtime -t constellationfs/remote-backend .

# Run the container
docker run -d \
  -p 2222:22 \
  -v $(pwd)/workspace:/workspace \
  --name constellation-remote-backend \
  constellationfs/remote-backend
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SSH_USERS` | Comma-separated list of `username:password` pairs | `root:constellation` |
| `SSH_PUBLIC_KEY` | SSH public key for key-based authentication | None |
| `WORKSPACE_ROOT` | Root directory for workspaces | `/workspace` |
| `ENABLE_LOGGING` | Enable verbose SSH logging | `false` |

### Example Configurations

#### Multi-user Setup
```yaml
environment:
  - SSH_USERS=alice:password123,bob:password456
```

#### SSH Key Authentication
```yaml
environment:
  - SSH_PUBLIC_KEY=ssh-rsa AAAAB3NzaC1yc2E...your-key-here
volumes:
  - ~/.ssh/id_rsa.pub:/keys/id_rsa.pub:ro
```

## Usage with ConstellationFS

### Development Setup

1. Start the remote backend:
   ```bash
   cd remote/
   docker-compose up -d
   ```

2. In your application:
   ```bash
   # Build native library
   npx constellationfs build-native --output ./build/
   
   # Run with environment variable
   REMOTE_VM_HOST=root@localhost:2222 \
   LD_PRELOAD=./build/libintercept.so \
   npm run dev
   ```

3. Use in your code:
   ```javascript
   import { FileSystem } from 'constellationfs'
   
   const fs = new FileSystem({
     type: 'remote',
     workspace: '/workspace/projects',
     auth: {
       type: 'password',
       credentials: {
         username: 'root',
         password: 'constellation'
       }
     }
   })
   
   await fs.exec('ls -la')  // Executes on remote backend
   ```

### Production Deployment

1. Deploy the service on your server:
   ```bash
   # On your production server
   docker run -d \
     -p 22:22 \
     -v /data/workspaces:/workspace \
     -e SSH_USERS=app:secure-password \
     constellationfs/remote-backend
   ```

2. Configure your application:
   ```bash
   REMOTE_VM_HOST=app@your-server.com:22 \
   LD_PRELOAD=./build/libintercept.so \
   npm start
   ```

## Security Considerations

### For Development
- Default credentials are `root:constellation`
- Use only in isolated development environments
- Consider using SSH keys instead of passwords

### For Production
- **Always change default passwords**
- Use SSH key authentication when possible
- Configure proper firewall rules
- Use secure networks and VPNs
- Regularly update the container image

### Recommended Production Setup
```yaml
services:
  remote-backend:
    image: constellationfs/remote-backend:latest
    ports:
      - "127.0.0.1:22:22"  # Bind to localhost only
    volumes:
      - /data/secure-workspace:/workspace
      - /etc/ssh/constellation_key.pub:/keys/id_rsa.pub:ro
    environment:
      - SSH_USERS=constellationfs:very-secure-password-here
      - ENABLE_LOGGING=true
    restart: unless-stopped
```

## Troubleshooting

### Connection Issues
```bash
# Check if container is running
docker ps | grep constellation

# Check container logs
docker logs constellation-remote-backend

# Test SSH connection
ssh root@localhost -p 2222
```

### Permission Issues
```bash
# Check workspace permissions
docker exec constellation-remote-backend ls -la /workspace

# Fix permissions if needed
docker exec constellation-remote-backend chown -R root:root /workspace
```

### Log Analysis
```bash
# Follow logs in real-time
docker logs -f constellation-remote-backend

# Check SSH daemon status
docker exec constellation-remote-backend service ssh status
```

## Building and Publishing

### Build Image
```bash
docker build -f remote/Dockerfile.runtime -t constellationfs/remote-backend:latest .
```

### Tag and Push
```bash
docker tag constellationfs/remote-backend:latest constellationfs/remote-backend:v1.0.0
docker push constellationfs/remote-backend:latest
docker push constellationfs/remote-backend:v1.0.0
```