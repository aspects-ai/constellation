#!/bin/bash

# ConstellationFS Docker SSH Container Entrypoint
echo "🐳 Starting ConstellationFS SSH Container..."

# Check if SSH keys are mounted and add them to authorized_keys
if [ -f /keys/id_rsa.pub ]; then
    echo "🔑 Adding mounted SSH key to authorized_keys..."
    cat /keys/id_rsa.pub >> /root/.ssh/authorized_keys
    chmod 600 /root/.ssh/authorized_keys
    echo "✅ SSH key added successfully"
fi

# Set proper permissions on workspace
chmod 755 /workspace
chown -R root:root /workspace

# Create some example directories
mkdir -p /workspace/projects
mkdir -p /workspace/temp
mkdir -p /workspace/shared

echo "📁 Workspace structure:"
tree /workspace -L 2 2>/dev/null || ls -la /workspace

# Display connection information
echo ""
echo "🚀 ConstellationFS SSH Server is ready!"
echo "📡 SSH connection details:"
echo "   Host: localhost"
echo "   Port: 2222 (if using default docker-compose port mapping)"
echo "   User: root"
echo "   Password: constellation (for development only)"
echo "   Workspace: /workspace"
echo ""
echo "🔧 Test connection with:"
echo "   ssh root@localhost -p 2222"
echo ""

# Start SSH daemon in foreground (this is what CMD does)
exec "$@"