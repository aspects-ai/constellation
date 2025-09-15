FROM node:18-slim

# Install SSH client and bash (bash needed for LD_PRELOAD command execution)
RUN apt-get update && apt-get install -y openssh-client bash && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the local ConstellationFS package (for development)
# NOTE: This is development-specific for using file:// dependency
# Production consumers would use published npm package instead
COPY constellation-typescript /constellationfs-local

# Copy web-demo source code (including pre-built native library)
COPY examples/web-demo .

# Fix the ConstellationFS dependency path for Docker build
RUN sed -i 's|"constellationfs": "file:../../constellation-typescript/"|"constellationfs": "file:/constellationfs-local"|g' package.json

# Install dependencies
RUN npm install

# Build the app
RUN npm run build

# Expose port
EXPOSE 3000

# Default command  
ENTRYPOINT []
CMD ["/usr/local/bin/node", "/app/node_modules/.bin/next", "start"]