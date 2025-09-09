# ConstellationFS Native Library Builder
# Ubuntu-based container for cross-platform native library compilation

FROM ubuntu:22.04

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    make \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /src

# Default command builds the library
CMD ["make"]