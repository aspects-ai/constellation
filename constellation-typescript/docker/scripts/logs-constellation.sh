#!/bin/bash
set -e

# Change to docker directory
cd "$(dirname "$0")/.."

SERVICE="${1:-}"

if [ -z "$SERVICE" ]; then
    echo "📊 ConstellationFS Docker Logs"
    echo ""
    echo "Usage: $0 [service-name]"
    echo ""
    echo "Available services:"
    echo "   backend  - SSH filesystem backend logs"
    echo "   devenv   - Development environment logs (web demo)"
    echo "   all      - All services logs"
    echo ""
    echo "Special logs:"
    echo "   debug    - LD_PRELOAD debug logs from devenv"
    echo "   ssh      - SSH authentication logs from backend"
    echo ""
    echo "Examples:"
    echo "   $0 devenv           # Web demo logs"
    echo "   $0 backend          # Backend SSH server logs"
    echo "   $0 debug            # LD_PRELOAD interception logs"
    echo "   $0 all              # All container logs"
    exit 0
fi

case "$SERVICE" in
    "backend")
        echo "📊 Backend SSH Server Logs (constellation-fs-backend)"
        echo "Press Ctrl+C to exit"
        echo ""
        docker-compose logs -f constellation-fs-backend
        ;;
    "devenv")
        echo "📊 Development Environment Logs (constellation-fs-devenv)"
        echo "Press Ctrl+C to exit"
        echo ""
        docker-compose logs -f constellation-fs-devenv
        ;;
    "all")
        echo "📊 All ConstellationFS Logs"
        echo "Press Ctrl+C to exit"
        echo ""
        docker-compose logs -f
        ;;
    "debug")
        echo "🐛 LD_PRELOAD Debug Logs"
        echo "Press Ctrl+C to exit"
        echo ""
        if docker exec constellation-fs-devenv test -f /tmp/constellation-fs-debug.log; then
            docker exec constellation-fs-devenv tail -f /tmp/constellation-fs-debug.log
        else
            echo "⚠️  Debug log file not found. LD_PRELOAD may not be active yet."
            echo "Try running a command in the web demo first, then check again."
        fi
        ;;
    "ssh")
        echo "🔐 SSH Authentication Logs"
        echo "Press Ctrl+C to exit"
        echo ""
        docker exec constellation-fs-backend tail -f /var/log/auth.log
        ;;
    *)
        echo "❌ Unknown service: $SERVICE"
        echo "Run '$0' without arguments to see available options."
        exit 1
        ;;
esac