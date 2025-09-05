# Makefile for ConstellationFS LD_PRELOAD intercept library

CC = gcc
CFLAGS = -Wall -Wextra -fPIC -O2
LDFLAGS = -shared -ldl

# Target library
TARGET = libintercept.so

# Source files
SOURCES = intercept.c

# Object files
OBJECTS = $(SOURCES:.c=.o)

# Default target
all: $(TARGET)

# Build the shared library
$(TARGET): $(OBJECTS)
	$(CC) $(LDFLAGS) -o $@ $^

# Compile source files to object files
%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

# Clean build artifacts
clean:
	rm -f $(OBJECTS) $(TARGET)

# Install the library to a system location (optional)
install: $(TARGET)
	install -m 755 $(TARGET) /usr/local/lib/
	ldconfig

# Test compilation without errors
test: $(TARGET)
	@echo "Library compiled successfully: $(TARGET)"
	@ldd $(TARGET)

# Development target with debug symbols
debug: CFLAGS += -g -DDEBUG
debug: $(TARGET)

.PHONY: all clean install test debug

# Help target
help:
	@echo "Available targets:"
	@echo "  all     - Build the shared library (default)"
	@echo "  clean   - Remove build artifacts"
	@echo "  install - Install library to /usr/local/lib"
	@echo "  test    - Test compilation and show dependencies"
	@echo "  debug   - Build with debug symbols"
	@echo "  help    - Show this help message"