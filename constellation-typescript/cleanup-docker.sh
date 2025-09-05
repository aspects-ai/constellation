#!/bin/bash

# ConstellationFS Docker Cleanup Script
# Stops and cleans up Docker SSH container and related resources

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="$SCRIPT_DIR/docker"
KEYS_DIR="$DOCKER_DIR/keys"
WORKSPACE_DIR="$DOCKER_DIR/workspace"
SHARED_DIR="$DOCKER_DIR/shared"

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

# Check if docker-compose is available
check_compose() {
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    elif docker compose version &> /dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        warn "Docker Compose not found, will try to clean up manually"
        COMPOSE_CMD=""
    fi
}

# Stop and remove containers
stop_containers() {
    log "Stopping Docker containers..."
    
    if [[ -n "$COMPOSE_CMD" && -f "$DOCKER_DIR/docker-compose.yml" ]]; then
        cd "$DOCKER_DIR"
        $COMPOSE_CMD down --remove-orphans 2>/dev/null || warn "Failed to stop containers with compose"
    fi
    
    # Fallback: manually stop container by name
    if docker ps -a --format "table {{.Names}}" | grep -q "constellation-ssh-server"; then
        log "Manually stopping constellation-ssh-server container..."
        docker stop constellation-ssh-server 2>/dev/null || warn "Failed to stop container"
        docker rm constellation-ssh-server 2>/dev/null || warn "Failed to remove container"
    fi
    
    success "Containers stopped"
}

# Clean up Docker images (optional)
cleanup_images() {
    local remove_images="$1"
    
    if [[ "$remove_images" == "true" ]]; then
        log "Removing Docker images..."
        
        # Remove the specific image
        local image_name="docker_constellation-ssh"
        if docker images --format "table {{.Repository}}" | grep -q "$image_name"; then
            docker rmi "$image_name" 2>/dev/null || warn "Failed to remove image $image_name"
        fi
        
        # Remove dangling images
        if [[ $(docker images -f "dangling=true" -q | wc -l) -gt 0 ]]; then
            docker rmi $(docker images -f "dangling=true" -q) 2>/dev/null || warn "Failed to remove dangling images"
        fi
        
        success "Images cleaned up"
    fi
}

# Clean up Docker networks
cleanup_networks() {
    log "Cleaning up Docker networks..."
    
    # Remove constellation network if it exists
    if docker network ls --format "table {{.Name}}" | grep -q "constellation-fs-network"; then
        docker network rm constellation-fs-network 2>/dev/null || warn "Failed to remove constellation network"
    fi
    
    success "Networks cleaned up"
}

# Clean up Docker volumes (optional)
cleanup_volumes() {
    local remove_volumes="$1"
    
    if [[ "$remove_volumes" == "true" ]]; then
        log "Removing Docker volumes..."
        
        # Remove constellation workspace volume
        if docker volume ls --format "table {{.Name}}" | grep -q "constellation-fs-workspace"; then
            docker volume rm constellation-fs-workspace 2>/dev/null || warn "Failed to remove workspace volume"
        fi
        
        # Remove orphaned volumes
        if [[ $(docker volume ls -qf dangling=true | wc -l) -gt 0 ]]; then
            docker volume prune -f 2>/dev/null || warn "Failed to prune volumes"
        fi
        
        success "Volumes cleaned up"
    fi
}

# Clean up local directories (optional)
cleanup_directories() {
    local remove_dirs="$1"
    
    if [[ "$remove_dirs" == "true" ]]; then
        log "Cleaning up local directories..."
        
        # Remove SSH keys
        if [[ -d "$KEYS_DIR" ]]; then
            rm -rf "$KEYS_DIR"
            success "SSH keys removed"
        fi
        
        # Remove workspace (be careful here)
        if [[ -d "$WORKSPACE_DIR" ]]; then
            read -p "Remove workspace directory $WORKSPACE_DIR? [y/N] " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                rm -rf "$WORKSPACE_DIR"
                success "Workspace directory removed"
            else
                warn "Workspace directory preserved"
            fi
        fi
        
        # Remove shared directory
        if [[ -d "$SHARED_DIR" ]]; then
            rm -rf "$SHARED_DIR"
            success "Shared directory removed"
        fi
        
        # Remove SSH config
        if [[ -f "$DOCKER_DIR/ssh_config" ]]; then
            rm "$DOCKER_DIR/ssh_config"
            success "SSH config removed"
        fi
    fi
}

# Show current Docker status
show_status() {
    log "Current Docker status:"
    
    echo ""
    echo "📦 Containers:"
    if docker ps -a --format "table {{.Names}}\t{{.Status}}" | grep -q constellation; then
        docker ps -a --format "table {{.Names}}\t{{.Status}}" | grep constellation || echo "  None found"
    else
        echo "  No constellation containers found"
    fi
    
    echo ""
    echo "🖼️ Images:"
    if docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep -q constellation; then
        docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep constellation || echo "  None found"
    else
        echo "  No constellation images found"
    fi
    
    echo ""
    echo "🔗 Networks:"
    if docker network ls --format "table {{.Name}}\t{{.Driver}}" | grep -q constellation; then
        docker network ls --format "table {{.Name}}\t{{.Driver}}" | grep constellation || echo "  None found"
    else
        echo "  No constellation networks found"
    fi
    
    echo ""
    echo "💾 Volumes:"
    if docker volume ls --format "table {{.Name}}\t{{.Driver}}" | grep -q constellation; then
        docker volume ls --format "table {{.Name}}\t{{.Driver}}" | grep constellation || echo "  None found"
    else
        echo "  No constellation volumes found"
    fi
}

# Display help
show_help() {
    echo "ConstellationFS Docker Cleanup Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -a, --all        Clean up everything (containers, images, volumes, directories)"
    echo "  -i, --images     Also remove Docker images"
    echo "  -v, --volumes    Also remove Docker volumes"
    echo "  -d, --dirs       Also remove local directories (SSH keys, workspace)"
    echo "  -s, --status     Show current Docker status"
    echo "  -h, --help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Stop containers only"
    echo "  $0 --all              # Complete cleanup"
    echo "  $0 --images --volumes # Stop containers and clean images/volumes"
    echo "  $0 --status           # Show current status"
}

# Parse command line arguments
parse_args() {
    REMOVE_IMAGES=false
    REMOVE_VOLUMES=false
    REMOVE_DIRS=false
    SHOW_STATUS=false
    SHOW_HELP=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -a|--all)
                REMOVE_IMAGES=true
                REMOVE_VOLUMES=true
                REMOVE_DIRS=true
                shift
                ;;
            -i|--images)
                REMOVE_IMAGES=true
                shift
                ;;
            -v|--volumes)
                REMOVE_VOLUMES=true
                shift
                ;;
            -d|--dirs)
                REMOVE_DIRS=true
                shift
                ;;
            -s|--status)
                SHOW_STATUS=true
                shift
                ;;
            -h|--help)
                SHOW_HELP=true
                shift
                ;;
            *)
                error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Main execution
main() {
    echo -e "${BLUE}"
    echo "🧹 ConstellationFS Docker Cleanup"
    echo "=================================="
    echo -e "${NC}"
    
    if [[ "$SHOW_HELP" == "true" ]]; then
        show_help
        return
    fi
    
    if [[ "$SHOW_STATUS" == "true" ]]; then
        show_status
        return
    fi
    
    check_compose
    stop_containers
    cleanup_networks
    cleanup_images "$REMOVE_IMAGES"
    cleanup_volumes "$REMOVE_VOLUMES"
    cleanup_directories "$REMOVE_DIRS"
    
    echo ""
    success "Cleanup completed!"
    
    if [[ "$REMOVE_IMAGES" == "false" || "$REMOVE_VOLUMES" == "false" || "$REMOVE_DIRS" == "false" ]]; then
        echo ""
        log "For complete cleanup, run: $0 --all"
    fi
}

# Check if running from correct directory
if [[ ! -f "$SCRIPT_DIR/package.json" ]]; then
    error "Please run this script from the ConstellationFS project root directory"
    exit 1
fi

# Parse arguments and run main function
parse_args "$@"
main