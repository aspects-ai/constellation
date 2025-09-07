FROM ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install SSH server and development tools
RUN apt-get update && apt-get install -y \
    openssh-server \
    sudo \
    curl \
    wget \
    git \
    python3 \
    python3-pip \
    nodejs \
    npm \
    build-essential \
    vim \
    nano \
    htop \
    tree \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Create workspace directory
RUN mkdir -p /workspace
WORKDIR /workspace

# Set up SSH configuration
RUN mkdir /var/run/sshd

# Create SSH host keys
RUN ssh-keygen -A

# Configure SSH daemon
RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/#Port 22/Port 22/' /etc/ssh/sshd_config && \
    sed -i 's/#AddressFamily any/AddressFamily any/' /etc/ssh/sshd_config && \
    sed -i 's/#ListenAddress 0.0.0.0/ListenAddress 0.0.0.0/' /etc/ssh/sshd_config

# SSH login fix for PAM
RUN sed -i 's@session\s*required\s*pam_loginuid.so@session optional pam_loginuid.so@g' /etc/pam.d/sshd

# Ensure SSH can start properly
RUN mkdir -p /run/sshd

# Set root password (for development only - in production use keys only)
RUN echo 'root:constellation' | chpasswd

# Create .ssh directory for root
RUN mkdir -p /root/.ssh && \
    chmod 700 /root/.ssh && \
    touch /root/.ssh/authorized_keys && \
    chmod 600 /root/.ssh/authorized_keys

# Copy startup script
COPY docker/backend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create a non-root user for testing (optional)
RUN useradd -m -s /bin/bash testuser && \
    echo 'testuser:constellation' | chpasswd && \
    usermod -aG sudo testuser

# Create workspace subdirectories
RUN mkdir -p /workspace/projects && \
    chmod 755 /workspace && \
    chown -R root:root /workspace

# Expose SSH port
EXPOSE 22

# Health check to ensure SSH is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD service ssh status || exit 1

# Start SSH daemon
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/sbin/sshd", "-D"]