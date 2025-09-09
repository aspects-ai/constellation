#!/bin/bash

# ConstellationFS Remote Backend Entrypoint
# Configures and starts SSH server for filesystem access

echo "🌟 Starting ConstellationFS Remote Backend..."

# Configure SSH users from environment
if [ -n "$SSH_USERS" ]; then
  echo "👤 Configuring SSH users..."
  IFS=',' read -ra USERS <<< "$SSH_USERS"
  for user_config in "${USERS[@]}"; do
    IFS=':' read -ra USER <<< "$user_config"
    username="${USER[0]}"
    password="${USER[1]}"
    
    echo "   Creating user: $username"
    useradd -m -s /bin/bash "$username" 2>/dev/null || echo "   User $username already exists"
    echo "$username:$password" | chpasswd
    
    # Create user workspace
    mkdir -p "/workspace/$username"
    chown "$username:$username" "/workspace/$username"
    chmod 755 "/workspace/$username"
  done
fi

# Add SSH keys if provided
if [ -n "$SSH_PUBLIC_KEY" ]; then
  echo "🔑 Adding SSH public key..."
  echo "$SSH_PUBLIC_KEY" >> /root/.ssh/authorized_keys
  chmod 600 /root/.ssh/authorized_keys
fi

# Mount SSH keys from volume if available
if [ -f /keys/id_rsa.pub ]; then
  echo "🔑 Adding mounted SSH key..."
  cat /keys/id_rsa.pub >> /root/.ssh/authorized_keys
  chmod 600 /root/.ssh/authorized_keys
fi

# Set workspace root from environment
if [ -n "$WORKSPACE_ROOT" ]; then
  echo "📁 Setting workspace root to: $WORKSPACE_ROOT"
  mkdir -p "$WORKSPACE_ROOT"
  chown -R root:root "$WORKSPACE_ROOT"
  chmod 755 "$WORKSPACE_ROOT"
else
  echo "📁 Using default workspace: /workspace"
fi

# Create default workspace structure
mkdir -p /workspace/projects /workspace/temp /workspace/shared
chown -R root:root /workspace
chmod -R 755 /workspace

# Enable logging if requested
if [ "$ENABLE_LOGGING" = "true" ]; then
  echo "📝 Enabling SSH logging..."
  sed -i 's/#LogLevel INFO/LogLevel VERBOSE/' /etc/ssh/sshd_config
fi

echo ""
echo "✅ ConstellationFS Remote Backend is ready!"
echo "📡 Connection details:"
echo "   Protocol: SSH"
echo "   Port: 22"
echo "   Default user: root"
echo "   Default password: constellation"
echo "   Workspace: /workspace"
echo ""
echo "🔧 Test connection:"
echo "   ssh root@localhost -p <mapped-port>"
echo ""
echo "🚀 Starting SSH daemon..."
echo ""

# Execute the main command (SSH daemon)
exec "$@"