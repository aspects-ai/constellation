FROM node:18

# Install build tools needed for native library compilation
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the local ConstellationFS package (for development)
# NOTE: This is development-specific for using file:// dependency
# Production consumers would use published npm package instead
COPY constellation-typescript /constellationfs-local

# Build ConstellationFS package first
WORKDIR /constellationfs-local
RUN npm install && npm run build

# Switch back to app directory
WORKDIR /app

# Copy web-demo source code first
COPY examples/web-demo .

# Fix the ConstellationFS dependency path for Docker build
RUN sed -i 's|"constellationfs": "file:../../constellation-typescript/"|"constellationfs": "file:/constellationfs-local"|g' package.json

# Install dependencies with corrected path
RUN npm install

# Build the app
RUN npm run build

# Expose port
EXPOSE 3000

# Default command
CMD ["npm", "start"]