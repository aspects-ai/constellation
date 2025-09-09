# Development environment container for ConstellationFS web demo
FROM ubuntu:22.04

# Set non-interactive installation
ENV DEBIAN_FRONTEND=noninteractive

# Install Node.js, build tools, and development utilities
RUN apt-get update && apt-get install -y \
    # Node.js and npm
    curl gnupg2 \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    # Build tools for LD_PRELOAD library
    && apt-get install -y \
    gcc \
    make \
    build-essential \
    # Development tools that Codebuff expects
    && apt-get install -y \
    ripgrep \
    fd-find \
    git \
    wget \
    vim \
    nano \
    tree \
    htop \
    jq \
    zip \
    unzip \
    # SSH client and sshpass for connecting to backend
    && apt-get install -y \
    openssh-client \
    sshpass \
    # Cleanup
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create app directory
WORKDIR /app

# Environment variables for runtime (LD_PRELOAD set in entrypoint)
ENV REMOTE_VM_HOST="constellation-fs-backend:2222"
ENV CONSTELLATION_CWD="/workspace"
ENV CONSTELLATION_DEBUG="1"

# Create workspace directory
RUN mkdir -p /workspace

# Copy native source code and build LD_PRELOAD library in container location
COPY native/ /tmp/native/
WORKDIR /tmp/native

# Build LD_PRELOAD library inside Linux container
RUN ls -la && \
    make clean && \
    make && \
    ls -la libintercept.so && \
    chmod 755 libintercept.so && \
    echo "LD_PRELOAD library built successfully"

# Copy the built LD_PRELOAD library to container-native location (persistent across bind mounts)
RUN mkdir -p /container-native && \
    cp /tmp/native/libintercept.so /container-native/ && \
    ls -la /container-native/libintercept.so && \
    echo "LD_PRELOAD library stored in container-native location"

# Copy web demo application
WORKDIR /app
COPY examples/web-demo/ ./

# Install dependencies (this will fail on constellationfs but that's okay for now)
RUN npm install --omit=optional || echo "Some dependencies failed, continuing..."

# We'll mount the built ConstellationFS at runtime

# Set working directory back to app
WORKDIR /app

# Create entrypoint script
COPY docker/devenv/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose Next.js port
EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["npm", "run", "dev"]