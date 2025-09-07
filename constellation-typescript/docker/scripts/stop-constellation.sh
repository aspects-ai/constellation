#!/bin/bash
set -e

echo "🛑 Stopping ConstellationFS Docker Environment"
echo ""

# Change to docker directory
cd "$(dirname "$0")/.."

# Stop containers
docker-compose down

echo ""
echo "🧹 Cleaning up..."

# Show what was stopped
echo "📊 Stopped containers:"
docker ps -a --filter "name=constellation-fs" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "💾 Preserving volumes (workspace data):"
echo "   - constellation-workspace (shared workspace data)"
echo ""
echo "🔧 To completely reset (including workspace data):"
echo "   docker-compose down -v"
echo "   docker system prune -f"
echo ""
echo "✅ ConstellationFS Docker Environment Stopped"