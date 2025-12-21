/**
 * ConstellationFS MCP Server CLI
 *
 * This module exports startMcpServer for use as a subcommand,
 * and also auto-runs when invoked directly via bin/constellation-fs-mcp.js
 */

import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Start the MCP server with the given arguments.
 * Called from CLI dispatcher or directly.
 */
export async function startMcpServer(args) {
  // Dynamically import the compiled server module
  const serverModule = await import(join(__dirname, '..', 'dist', 'mcp', 'server.js'))
  await serverModule.main(args)
}

// Auto-run when this module is imported directly from bin/constellation-fs-mcp.js
// The bin script imports this file, which triggers the auto-run
const args = process.argv.slice(2)
if (args.length > 0 || process.argv[1]?.includes('constellation-fs-mcp')) {
  startMcpServer(args).catch((err) => {
    console.error('[constellation-fs-mcp] Fatal error:', err.message || err)
    process.exit(1)
  })
}
