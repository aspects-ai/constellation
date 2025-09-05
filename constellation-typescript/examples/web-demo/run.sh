#!/bin/bash

# ConstellationFS Web Demo Runner
# Automatically sets up LD_PRELOAD for Remote Backend support

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[WebDemo]${NC} $1"
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

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
NATIVE_DIR="$PROJECT_ROOT/native"
INTERCEPT_LIB="$NATIVE_DIR/libintercept.so"

# Check if we're in the right directory
check_directory() {
    if [[ ! -f "$SCRIPT_DIR/package.json" ]]; then
        error "This script must be run from the web-demo directory"
        exit 1
    fi
    
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        error "Cannot find ConstellationFS project root"
        exit 1
    fi
}

# Build LD_PRELOAD library if needed
build_intercept_library() {
    log "Checking LD_PRELOAD intercept library..."
    
    if [[ ! -f "$INTERCEPT_LIB" ]]; then
        log "Building LD_PRELOAD library..."
        
        if [[ ! -f "$NATIVE_DIR/Makefile" ]]; then
            error "Native intercept library not found. Please ensure the project is complete."
            exit 1
        fi
        
        cd "$NATIVE_DIR"
        make || {
            error "Failed to build LD_PRELOAD library"
            exit 1
        }
        cd "$SCRIPT_DIR"
        
        success "LD_PRELOAD library built successfully"
    else
        success "LD_PRELOAD library already exists"
    fi
}

# Check if main ConstellationFS library is built
check_main_library() {
    log "Checking main ConstellationFS library..."
    
    if [[ ! -d "$PROJECT_ROOT/dist" ]]; then
        log "Building ConstellationFS library..."
        cd "$PROJECT_ROOT"
        npm run build || {
            error "Failed to build ConstellationFS library"
            exit 1
        }
        cd "$SCRIPT_DIR"
        success "ConstellationFS library built successfully"
    else
        success "ConstellationFS library already built"
    fi
}

# Install dependencies if needed
install_dependencies() {
    log "Checking dependencies..."
    
    if [[ ! -d "$SCRIPT_DIR/node_modules" ]]; then
        log "Installing web-demo dependencies..."
        npm install || {
            error "Failed to install dependencies"
            exit 1
        }
        success "Dependencies installed successfully"
    else
        success "Dependencies already installed"
    fi
}

# Check Docker container status
check_docker_status() {
    log "Checking Docker container status..."
    
    if nc -z localhost 2222 2>/dev/null; then
        success "Docker SSH container is running (port 2222 accessible)"
        return 0
    else
        warn "Docker SSH container not detected"
        echo ""
        log "To start the Docker container for Remote Backend testing:"
        echo "  cd $PROJECT_ROOT"
        echo "  ./setup-docker.sh"
        echo ""
        return 1
    fi
}

# Show usage information
show_usage() {
    echo -e "${GREEN}🚀 ConstellationFS Web Demo${NC}"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --local-only    Start without LD_PRELOAD (Local Backend only)"
    echo "  --check-docker  Check Docker container status only"
    echo "  --help          Show this help message"
    echo ""
    echo "Environment Configuration:"
    echo "  The demo will start with LD_PRELOAD enabled for Remote Backend support:"
    echo "    LD_PRELOAD=$INTERCEPT_LIB"
    echo "    REMOTE_VM_HOST=root@localhost:2222"
    echo "    CONSTELLATION_CWD=/workspace"
    echo ""
    echo "Backend Options:"
    echo "  • Local Backend: Direct filesystem access (always available)"
    echo "  • Remote Backend: SSH to Docker container (requires Docker setup)"
    echo ""
}

# Parse command line arguments
LOCAL_ONLY=false
CHECK_DOCKER_ONLY=false
SHOW_HELP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --local-only)
            LOCAL_ONLY=true
            shift
            ;;
        --check-docker)
            CHECK_DOCKER_ONLY=true
            shift
            ;;
        --help)
            SHOW_HELP=true
            shift
            ;;
        *)
            error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    if [[ "$SHOW_HELP" == "true" ]]; then
        show_usage
        return 0
    fi
    
    if [[ "$CHECK_DOCKER_ONLY" == "true" ]]; then
        check_docker_status
        return 0
    fi
    
    echo -e "${BLUE}"
    echo "🌟 ConstellationFS Web Demo"
    echo "=========================="
    echo -e "${NC}"
    
    check_directory
    check_main_library
    install_dependencies
    
    if [[ "$LOCAL_ONLY" == "false" ]]; then
        build_intercept_library
        check_docker_status
        
        log "Starting web demo with Remote Backend support..."
        echo ""
        success "Environment configured for both Local and Remote backends"
        echo ""
        log "Backend options in web demo:"
        echo "  🏠 Local Backend: Direct filesystem access"
        echo "  🐳 Remote Backend: SSH to Docker container (localhost:2222)"
        echo ""
        log "Starting Next.js development server..."
        echo ""
        
        # Set environment and start with LD_PRELOAD
        export LD_PRELOAD="$INTERCEPT_LIB"
        export REMOTE_VM_HOST="root@localhost:2222"
        export CONSTELLATION_CWD="/workspace"
        
        npm run dev
        
    else
        log "Starting web demo with Local Backend only..."
        echo ""
        success "Local Backend configured (no LD_PRELOAD)"
        echo ""
        warn "Remote Backend will not work without LD_PRELOAD"
        echo ""
        log "Starting Next.js development server..."
        echo ""
        
        npm run dev
    fi
}

# Handle script interruption
cleanup_on_interrupt() {
    echo ""
    log "Shutting down web demo..."
    exit 0
}

trap cleanup_on_interrupt INT TERM

# Run main function
main "$@"