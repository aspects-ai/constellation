#!/bin/bash
set -e

echo "🚀 Starting ConstellationFS Docker Environment"
echo ""

# Change to docker directory
cd "$(dirname "$0")/.."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Build and start containers
echo "🔨 Building containers..."
docker-compose build --parallel

echo ""
echo "🚀 Starting containers..."
docker-compose up -d

echo ""
echo "📊 Container Status:"
docker-compose ps

echo ""
echo "⏳ Waiting for services to be ready..."

# Wait for backend to be healthy
echo "   Waiting for constellation-fs-backend..."
for i in {1..30}; do
    if docker-compose exec -T constellation-fs-backend pgrep sshd > /dev/null 2>&1; then
        echo "   ✅ Backend ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "   ❌ Backend failed to start"
        docker-compose logs constellation-fs-backend
        exit 1
    fi
    sleep 2
done

# Wait for devenv to be ready
echo "   Waiting for constellation-fs-devenv..."
for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo "   ✅ Development environment ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "   ⚠️  Development environment may still be starting"
        echo "   Check logs with: docker-compose logs constellation-fs-devenv"
        break
    fi
    sleep 3
done

echo ""
echo "🎉 ConstellationFS Docker Environment Started!"
echo ""
echo "🔗 Services:"
echo "   Web Demo: http://localhost:3000"
echo "   SSH Backend: localhost:2222"
echo ""
echo "📊 Management Commands:"
echo "   View logs: docker-compose logs -f [service-name]"
echo "   Stop all: ./scripts/stop-constellation.sh"
echo "   Shell into devenv: docker exec -it constellation-fs-devenv bash"
echo "   Shell into backend: docker exec -it constellation-fs-backend bash"
echo ""
echo "🐛 Debug Commands:"
echo "   LD_PRELOAD logs: docker exec constellation-fs-devenv tail -f /tmp/constellation-fs-debug.log"
echo "   Backend SSH logs: docker exec constellation-fs-backend tail -f /var/log/auth.log"
echo ""