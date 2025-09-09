#!/bin/bash

# Clear the old log file
docker exec constellation-fs-devenv rm -f /tmp/constellation-fs-debug.log

# Run a simple ls command which should trigger LD_PRELOAD interception
echo "Running test command to trigger interception..."
docker exec constellation-fs-devenv ls /tmp

# Wait a moment for logs to be written
sleep 2

# Check log file size
echo -e "\nLog file size:"
docker exec constellation-fs-devenv ls -lh /tmp/constellation-fs-debug.log 2>/dev/null || echo "No log file found"

# Show first 200 lines to see the initial trigger
echo -e "\nFirst 200 lines of debug log:"
docker exec constellation-fs-devenv head -200 /tmp/constellation-fs-debug.log 2>/dev/null || echo "No logs"

# Show if recursion is happening
echo -e "\nChecking for recursion pattern:"
docker exec constellation-fs-devenv bash -c "grep -c 'ssh.*ssh.*ssh' /tmp/constellation-fs-debug.log 2>/dev/null || echo '0'"