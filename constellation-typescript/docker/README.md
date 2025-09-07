# ConstellationFS Docker Environment

This directory contains the Docker-in-Docker setup for ConstellationFS development and testing.

## Architecture

- **Backend Container** (`constellation-fs-backend`): SSH server providing remote filesystem access
- **DevEnv Container** (`constellation-fs-devenv`): Linux development environment with LD_PRELOAD support

## Quick Start

```bash
# From project root
./setup-docker.sh

# Access the web demo
open http://localhost:3000
```

## Directory Structure

```
docker/
├── backend/           # SSH filesystem server
│   ├── Dockerfile
│   └── entrypoint.sh
├── devenv/           # Development environment
│   ├── Dockerfile
│   └── entrypoint.sh
├── scripts/          # Management scripts
│   ├── start-constellation.sh
│   ├── stop-constellation.sh
│   └── logs-constellation.sh
└── docker-compose.yml
```

## Management Commands

```bash
# Start environment
./docker/scripts/start-constellation.sh

# View logs
./docker/scripts/logs-constellation.sh devenv   # Web demo logs
./docker/scripts/logs-constellation.sh backend  # SSH server logs
./docker/scripts/logs-constellation.sh debug    # LD_PRELOAD debug logs

# Stop environment
./docker/scripts/stop-constellation.sh

# Shell access
docker exec -it constellation-fs-devenv bash
docker exec -it constellation-fs-backend bash
```

## Environment Variables

The development container automatically sets:
- `LD_PRELOAD=/app/native/libintercept.so`
- `REMOTE_VM_HOST=constellation-fs-backend:2222`
- `CONSTELLATION_CWD=/workspace`
- `CONSTELLATION_DEBUG=1`

## Network Configuration

Both containers communicate on the `constellation-net` bridge network:
- Backend: `172.20.0.10:2222` (SSH)
- DevEnv: `172.20.0.20:3000` (Web app)

## Debugging

### LD_PRELOAD Debug Logs
```bash
docker exec constellation-fs-devenv tail -f /tmp/constellation-fs-debug.log
```

### SSH Authentication Logs
```bash
docker exec constellation-fs-backend tail -f /var/log/auth.log
```

## Troubleshooting

1. **LD_PRELOAD not working**: Check if library exists in container
2. **SSH connection fails**: Ensure backend container is healthy
3. **Port conflicts**: Make sure ports 2222 and 3000 are available
4. **Permission issues**: Both containers run as root for simplicity