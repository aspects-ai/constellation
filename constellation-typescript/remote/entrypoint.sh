#!/bin/bash

# ConstellationFS Remote Backend Entrypoint
# Configures and starts SSH server for filesystem access

set -e

echo "🌟 Starting ConstellationFS Remote Backend..."

# Storage configuration
STORAGE_TYPE="${STORAGE_TYPE:-local}"
ARCHIL_MOUNT_PATH="${ARCHIL_MOUNT_PATH:-/workspace}"

echo "📦 Storage type: $STORAGE_TYPE"

if [ "$STORAGE_TYPE" = "archil" ]; then
  echo "🔗 Configuring Archil storage..."

  # Validate required environment variables
  if [ -z "$ARCHIL_API_KEY" ]; then
    echo "❌ ERROR: ARCHIL_API_KEY is required when STORAGE_TYPE=archil"
    exit 1
  fi

  if [ -z "$ARCHIL_BUCKET" ]; then
    echo "❌ ERROR: ARCHIL_BUCKET is required when STORAGE_TYPE=archil"
    exit 1
  fi

  # Build mount command
  MOUNT_CMD="archil mount --force $ARCHIL_BUCKET $ARCHIL_MOUNT_PATH --auth-token $ARCHIL_API_KEY"

  if [ -n "$ARCHIL_REGION" ]; then
    MOUNT_CMD="$MOUNT_CMD --region $ARCHIL_REGION"
  fi

  echo "📁 Mounting Archil bucket '$ARCHIL_BUCKET' at $ARCHIL_MOUNT_PATH..."

  if $MOUNT_CMD; then
    echo "✅ Archil filesystem mounted successfully"
  else
    echo "❌ ERROR: Failed to mount Archil filesystem"
    exit 1
  fi
elif [ "$STORAGE_TYPE" = "local" ]; then
  echo "📁 Using local storage at $ARCHIL_MOUNT_PATH"
  mkdir -p "$ARCHIL_MOUNT_PATH"
else
  echo "❌ ERROR: Invalid STORAGE_TYPE '$STORAGE_TYPE'. Must be 'archil' or 'local'"
  exit 1
fi

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

    # Set up SSH directory for user (for optional pubkey auth)
    mkdir -p "/home/$username/.ssh"
    touch "/home/$username/.ssh/authorized_keys"
    chown -R "$username:$username" "/home/$username/.ssh"
    chmod 700 "/home/$username/.ssh"
    chmod 600 "/home/$username/.ssh/authorized_keys"
  done
fi

# Ensure password authentication is enabled (fix for some base images)
sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/^#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/^ChallengeResponseAuthentication no/ChallengeResponseAuthentication yes/' /etc/ssh/sshd_config
echo "PasswordAuthentication yes" >> /etc/ssh/sshd_config.d/password.conf 2>/dev/null || true

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