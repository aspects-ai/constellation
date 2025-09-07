#!/bin/bash

# ConstellationFS Docker Environment Setup Script
# Sets up both backend and development environment containers

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$SCRIPT_DIR/docker"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[ConstellationFS]${NC} $1"
}

success() {
    echo -e "${GREEN}✅${NC} $1"
}

warn() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

error() {
    echo -e "${RED}❌${NC} $1"
}

# Check if Docker is installed and running
check_docker() {
    log "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    
    success "Docker is installed and running"
}

# Check if docker-compose is available
check_compose() {
    log "Checking Docker Compose..."
    
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    else
        error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
    
    success "Docker Compose is available ($COMPOSE_CMD)"
}

# Create necessary directories
create_directories() {
    log "Creating directories..."
    
    mkdir -p "$KEYS_DIR"
    mkdir -p "$WORKSPACE_DIR"
    mkdir -p "$SHARED_DIR"
    
    success "Directories created"
}

# Generate SSH keys for passwordless authentication
generate_ssh_keys() {
    log "Setting up SSH keys..."
    
    local key_file="$KEYS_DIR/id_rsa"
    
    if [[ -f "$key_file" ]]; then
        warn "SSH keys already exist. Skipping generation."
        return
    fi
    
    ssh-keygen -t rsa -b 4096 -f "$key_file" -N "" -C "constellationfs-docker-test"
    
    if [[ -f "$key_file" && -f "$key_file.pub" ]]; then
        success "SSH keys generated successfully"
    else
        error "Failed to generate SSH keys"
        exit 1
    fi
}

# Build and start Docker container
start_container() {
    log "Building and starting Docker container..."
    
    cd "$DOCKER_DIR"
    
    # Build the image
    $COMPOSE_CMD build --no-cache
    
    # Start the container
    $COMPOSE_CMD up -d
    
    success "Container started"
}

# Wait for SSH service to be ready
wait_for_ssh() {
    log "Waiting for SSH service to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if nc -z localhost 2222 2>/dev/null; then
            success "SSH service is ready"
            return
        fi
        
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    echo ""
    error "SSH service failed to start after $max_attempts attempts"
    exit 1
}

# Test SSH connection
test_ssh_connection() {
    log "Testing SSH connections..."
    
    local key_file="$KEYS_DIR/id_rsa"
    
    # Test key-based authentication
    if ssh -i "$key_file" -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=10 -p 2222 root@localhost "echo 'SSH key auth successful'" 2>/dev/null; then
        success "SSH key authentication works"
    else
        warn "SSH key authentication failed, but password auth should work"
    fi
    
    # Test basic connection (with password)
    echo ""
    log "Testing basic SSH connection (password: constellation)"
    log "Run this command to test manually:"
    echo "  ssh root@localhost -p 2222"
    echo ""
}

# Create SSH config for easy connection
create_ssh_config() {
    log "Creating local SSH config..."
    
    local ssh_config="$DOCKER_DIR/ssh_config"
    local key_file="$KEYS_DIR/id_rsa"
    
    cat > "$ssh_config" << EOF
# ConstellationFS Docker SSH Configuration
# Use with: ssh -F docker/ssh_config constellation-docker

Host constellation-docker
    HostName localhost
    Port 2222
    User root
    IdentityFile $(realpath "$key_file")
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    LogLevel QUIET

# Alternative host entry for password auth
Host constellation-docker-pwd
    HostName localhost
    Port 2222
    User root
    PreferredAuthentications password
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
    LogLevel QUIET
EOF
    
    success "SSH config created at $ssh_config"
}

# Display usage information
show_usage_info() {
    echo ""
    echo -e "${GREEN}🎉 ConstellationFS Docker SSH Server Setup Complete!${NC}"
    echo ""
    echo "📡 Connection Information:"
    echo "   Host: localhost"
    echo "   Port: 2222"
    echo "   User: root"
    echo "   Password: constellation"
    echo "   Workspace: /workspace"
    echo ""
    echo "🔑 Connection Methods:"
    echo "   SSH with key:      ssh -F docker/ssh_config constellation-docker"
    echo "   SSH with password: ssh root@localhost -p 2222"
    echo ""
    echo "💻 RemoteBackend Configuration:"
    echo "   Host: localhost:2222"
    echo "   User: root"
    echo "   Auth: password (constellation) or key"
    echo "   Workspace: /workspace"
    echo ""
    echo "📁 Local directories:"
    echo "   Workspace: $WORKSPACE_DIR"
    echo "   Shared:    $SHARED_DIR"
    echo "   SSH Keys:  $KEYS_DIR"
    echo ""
    echo "🔧 Useful commands:"
    echo "   View logs:    cd docker && $COMPOSE_CMD logs -f"
    echo "   Stop:         ./cleanup-docker.sh"
    echo "   Shell access: docker exec -it constellation-ssh-server bash"
    echo ""
}

# Main execution
main() {
    echo -e "${BLUE}"
    echo "🐳 ConstellationFS Docker Environment Setup"
    echo "==========================================="
    echo -e "${NC}"
    
    check_docker
    
    log "Starting ConstellationFS Docker environment..."
    exec "$DOCKER_DIR/scripts/start-constellation.sh"
}

# Handle script interruption
cleanup_on_error() {
    error "Setup interrupted. Cleaning up..."
    cd "$DOCKER_DIR" 2>/dev/null && $COMPOSE_CMD down 2>/dev/null || true
    exit 1
}

trap cleanup_on_error INT TERM

# Check if running from correct directory
if [[ ! -f "$SCRIPT_DIR/package.json" ]]; then
    error "Please run this script from the ConstellationFS project root directory"
    exit 1
fi

# Run main function
main "$@"