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
    echo "🔍 DEBUG: Found ConstellationFS source at /constellation-fs/"
    echo "🔍 DEBUG: Source size: $(du -sh /constellation-fs | cut -f1)"
    echo "🔍 DEBUG: Starting copy operation..."
    
    # Copy ConstellationFS to a writable location, excluding heavy directories
    echo "🔍 DEBUG: Creating build directory..."
    mkdir -p /tmp/constellation-fs-build
    echo "🔍 DEBUG: Copying source files using tar (excluding node_modules and heavy dirs)..."
    cd /constellation-fs && tar --exclude='node_modules' --exclude='examples/*/node_modules' --exclude='.DS_Store' -cf - . | (cd /tmp/constellation-fs-build && tar -xf -)
    echo "🔍 DEBUG: Copy completed. Target size: $(du -sh /tmp/constellation-fs-build | cut -f1)"
    
    cd /tmp/constellation-fs-build
    echo "🔍 DEBUG: Changed to build directory: $(pwd)"
    echo "🔍 DEBUG: Contents: $(ls -la | wc -l) items"
    
    # Build ConstellationFS
    echo "🔍 DEBUG: Starting npm install..."
    npm install
    echo "🔍 DEBUG: npm install completed, starting build..."
    npm run build
    echo "🔍 DEBUG: Build completed"
    
    # Install it directly in the app instead of using npm link
    echo "🔍 DEBUG: Installing in app directory..."
    cd /app && rm -f package-lock.json && rm -rf node_modules && npm install /tmp/constellation-fs-build
    echo "✅ ConstellationFS installed from mounted source"
else
    echo "⚠️  ConstellationFS source not found at /constellation-fs/package.json"
    echo "🔍 DEBUG: Checking what's at /constellation-fs/:"
    ls -la /constellation-fs/ || echo "Directory does not exist"
fi

echo ""
echo "🌐 Starting web application..."
echo "📡 Backend connection: $REMOTE_VM_HOST"
echo "📁 Workspace: $CONSTELLATION_CWD"
echo ""

# Wait for backend to be ready
echo "⏳ Waiting for backend container to be ready..."
for i in {1..30}; do
    if sshpass -p "constellation" ssh -o BatchMode=no -o StrictHostKeyChecking=no -o ConnectTimeout=2 root@constellation-fs-backend exit 2>/dev/null; then
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