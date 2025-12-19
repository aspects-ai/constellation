#!/usr/bin/env node

/**
 * ConstellationFS MCP Server CLI Entry Point
 *
 * Usage:
 *   Stdio mode (single workspace):
 *     constellation-fs-mcp --appId <appId> --userId <userId> --workspace <workspace>
 *
 *   HTTP mode (multi-session):
 *     constellation-fs-mcp --appId <appId> --http --port <port> --authToken <token>
 */

import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Import CLI module (which imports the compiled server)
await import(join(__dirname, '..', 'cli', 'mcp-server.js'))
