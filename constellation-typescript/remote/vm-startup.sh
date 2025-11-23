#!/bin/bash
# ConstellationFS Remote Backend - VM Startup Script
# This script is passed to GCP VM as a startup script

set -e

echo "🌟 ConstellationFS VM Setup Starting..."

# These are replaced by the deploy tool with actual values
STORAGE_TYPE="__STORAGE_TYPE__"
ARCHIL_API_KEY="__ARCHIL_API_KEY__"
ARCHIL_BUCKET="__ARCHIL_BUCKET__"
ARCHIL_REGION="__ARCHIL_REGION__"
SSH_USERS="__SSH_USERS__"
WORKSPACE_PATH="/workspace"

# Install packages
echo "📦 Installing packages..."
apt-get update
apt-get install -y \
    openssh-server \
    sudo \
    curl \
    wget \
    tree \
    ripgrep \
    git \
    fuse

# Install Archil client
echo "📦 Installing Archil client..."
curl -fsSL https://s3.amazonaws.com/archil-client/install | sh

# Create workspace directory
echo "📁 Creating workspace..."
mkdir -p "$WORKSPACE_PATH"

# Configure SSH user (admin identity for ConstellationFS file operations)
SSH_USERNAME=""
if [ -n "$SSH_USERS" ] && [ "$SSH_USERS" != "__SSH_USERS__" ]; then
    echo "👤 Configuring SSH user..."
    # Only use the first user (primary SSH identity)
    IFS=':' read -ra USER_PARTS <<< "${SSH_USERS%%,*}"
    SSH_USERNAME="${USER_PARTS[0]}"
    SSH_PASSWORD="${USER_PARTS[1]}"

    echo "   Creating user: $SSH_USERNAME"
    useradd -m -s /bin/bash "$SSH_USERNAME" 2>/dev/null || echo "   User $SSH_USERNAME already exists"
    echo "$SSH_USERNAME:$SSH_PASSWORD" | chpasswd

    # Add to sudo group (needed for admin operations)
    usermod -aG sudo "$SSH_USERNAME"

    # Set up SSH directory
    mkdir -p "/home/$SSH_USERNAME/.ssh"
    touch "/home/$SSH_USERNAME/.ssh/authorized_keys"
    chown -R "$SSH_USERNAME:$SSH_USERNAME" "/home/$SSH_USERNAME/.ssh"
    chmod 700 "/home/$SSH_USERNAME/.ssh"
    chmod 600 "/home/$SSH_USERNAME/.ssh/authorized_keys"
fi

# Enable password authentication for SSH
echo "🔐 Configuring SSH..."
sed -i 's/^#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/^PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/^#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config

# Also handle Ubuntu 22.04+ which uses sshd_config.d
mkdir -p /etc/ssh/sshd_config.d
cat > /etc/ssh/sshd_config.d/constellation.conf << 'EOF'
PasswordAuthentication yes
PermitRootLogin yes
ChallengeResponseAuthentication yes
EOF

# Restart SSH to apply changes
systemctl restart sshd || service ssh restart

# Mount Archil if configured
if [ "$STORAGE_TYPE" = "archil" ]; then
    echo "🔗 Mounting Archil storage..."

    if [ -z "$ARCHIL_API_KEY" ] || [ "$ARCHIL_API_KEY" = "__ARCHIL_API_KEY__" ]; then
        echo "❌ ERROR: ARCHIL_API_KEY is required when STORAGE_TYPE=archil"
        exit 1
    fi

    if [ -z "$ARCHIL_BUCKET" ] || [ "$ARCHIL_BUCKET" = "__ARCHIL_BUCKET__" ]; then
        echo "❌ ERROR: ARCHIL_BUCKET is required when STORAGE_TYPE=archil"
        exit 1
    fi

    # Build mount command (must run as root with --force)
    MOUNT_CMD="sudo archil mount --force $ARCHIL_BUCKET $WORKSPACE_PATH --auth-token $ARCHIL_API_KEY"

    if [ -n "$ARCHIL_REGION" ] && [ "$ARCHIL_REGION" != "__ARCHIL_REGION__" ]; then
        MOUNT_CMD="$MOUNT_CMD --region $ARCHIL_REGION"
    fi

    echo "📁 Mounting bucket '$ARCHIL_BUCKET' at $WORKSPACE_PATH..."
    if $MOUNT_CMD; then
        echo "✅ Archil filesystem mounted successfully"

        # Change ownership of mounted workspace to SSH user so they can operate on it
        if [ -n "$SSH_USERNAME" ]; then
            echo "📁 Setting workspace ownership to $SSH_USERNAME..."
            chown -R "$SSH_USERNAME:$SSH_USERNAME" "$WORKSPACE_PATH"
        fi
    else
        echo "❌ ERROR: Failed to mount Archil filesystem"
        exit 1
    fi
else
    echo "📁 Using local storage at $WORKSPACE_PATH"
    # For local storage, also set ownership to SSH user
    if [ -n "$SSH_USERNAME" ]; then
        chown -R "$SSH_USERNAME:$SSH_USERNAME" "$WORKSPACE_PATH"
    fi
fi

echo ""
echo "✅ ConstellationFS VM Setup Complete!"
echo "📡 SSH is ready on port 22"
if [ -n "$SSH_USERNAME" ]; then
    echo "👤 SSH user: $SSH_USERNAME"
fi
echo "📁 Workspace: $WORKSPACE_PATH"
echo ""
