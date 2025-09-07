#!/bin/bash
set -e

echo "🚀 Starting ConstellationFS Development Environment"
echo ""

# Display environment info
echo "Environment Configuration:"
echo "  Node.js: $(node --version)"
echo "  npm: $(npm --version)"
echo "  REMOTE_VM_HOST: $REMOTE_VM_HOST"
echo "  CONSTELLATION_CWD: $CONSTELLATION_CWD"
echo "  CONSTELLATION_DEBUG: $CONSTELLATION_DEBUG"
echo ""

# Verify the LD_PRELOAD library was built correctly during Docker build
if [ -f "/container-native/libintercept.so" ]; then
    echo "✅ LD_PRELOAD library ready at: /container-native/libintercept.so"
else
    echo "❌ LD_PRELOAD library not found in container-native location"
    echo "❌ Library should have been built during Docker build process"
    exit 1
fi


# Install ConstellationFS from mounted source
echo "📦 Installing ConstellationFS dependency..."
if [ -f "/constellation-fs/package.json" ]; then
    # Copy ConstellationFS to a writable location
    cp -r /constellation-fs /tmp/constellation-fs-build
    cd /tmp/constellation-fs-build
    # Build ConstellationFS
    npm install && npm run build
    # Link it globally
    npm link
    # Link it in the app
    cd /app && npm link constellationfs
    echo "✅ ConstellationFS linked from mounted source"
else
    echo "⚠️  ConstellationFS source not found, will try to use existing installation"
fi

echo ""
echo "🌐 Starting web application..."
echo "📡 Backend connection: $REMOTE_VM_HOST"
echo "📁 Workspace: $CONSTELLATION_CWD"
echo ""

# Wait for backend to be ready
echo "⏳ Waiting for backend container to be ready..."
for i in {1..30}; do
    if ssh -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=2 -p 2222 root@constellation-fs-backend exit 2>/dev/null; then
        echo "✅ Backend container is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Backend container not responding after 30 attempts"
        echo "Please ensure constellation-fs-backend container is running"
        exit 1
    fi
    echo "   Attempt $i/30..."
    sleep 2
done

echo ""
echo "🎉 Development environment ready!"
echo "🔗 Access the application at: http://localhost:3000"
echo "📊 Debug logs: docker exec constellation-fs-devenv tail -f /tmp/constellation-fs-debug.log"
echo ""

# Activate LD_PRELOAD for command interception
echo "🔧 Activating LD_PRELOAD for command interception..."
export LD_PRELOAD=/container-native/libintercept.so
echo "  LD_PRELOAD: $LD_PRELOAD"
echo ""

# Execute the main command with LD_PRELOAD active
exec "$@"