import { randomUUID } from 'crypto'
import express, { type NextFunction, type Request, type Response } from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { ConstellationFS } from '../config/Config.js'
import { FileSystem } from '../FileSystem.js'
import type { Workspace } from '../workspace/Workspace.js'
import { registerTools } from './tools.js'

// ─────────────────────────────────────────────────────────────────
// CLI Argument Parsing
// ─────────────────────────────────────────────────────────────────

interface ServerConfig {
  appId: string
  // Stdio mode (single workspace)
  userId?: string
  workspace?: string
  // HTTP mode (multi-session)
  http?: boolean
  port?: number
  authToken?: string
}

function parseArgs(args: string[]): ServerConfig {
  const config: ServerConfig = { appId: '' }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const next = args[i + 1]

    switch (arg) {
      case '--appId':
        config.appId = next || ''
        i++
        break
      case '--userId':
        config.userId = next
        i++
        break
      case '--workspace':
        config.workspace = next
        i++
        break
      case '--http':
        config.http = true
        break
      case '--port':
        config.port = parseInt(next || '3000', 10)
        i++
        break
      case '--authToken':
        config.authToken = next
        i++
        break
    }
  }

  // Validation
  if (!config.appId) {
    console.error('--appId is required')
    printUsage()
    process.exit(1)
  }

  if (config.http) {
    if (!config.authToken) {
      console.error('--authToken is required in HTTP mode')
      printUsage()
      process.exit(1)
    }
  } else {
    if (!config.userId || !config.workspace) {
      console.error('--userId and --workspace are required in stdio mode')
      printUsage()
      process.exit(1)
    }
  }

  return config
}

function printUsage(): void {
  console.error(`
Usage:
  Stdio mode (single workspace):
    constellation-fs-mcp --appId <appId> --userId <userId> --workspace <workspace>

  HTTP mode (multi-session):
    constellation-fs-mcp --appId <appId> --http --port <port> --authToken <token>
`)
}

// ─────────────────────────────────────────────────────────────────
// Session Management (HTTP mode only)
// ─────────────────────────────────────────────────────────────────

interface SessionContext {
  userId: string
  workspaceName: string
  workspace: Workspace
  fs: FileSystem
}

const sessions = new Map<string, SessionContext>()

async function initializeSession(
  sessionId: string,
  headers: Record<string, string>
): Promise<SessionContext> {
  const userId = headers['x-user-id']
  const workspaceName = headers['x-workspace']

  if (!userId || !workspaceName) {
    throw new Error('Missing required headers: X-User-ID and X-Workspace')
  }

  const fs = new FileSystem({ userId, type: 'local' })
  const workspace = await fs.getWorkspace(workspaceName)

  const context: SessionContext = { userId, workspaceName, workspace, fs }
  sessions.set(sessionId, context)
  return context
}

function getSessionContext(sessionId: string): SessionContext {
  const context = sessions.get(sessionId)
  if (!context) {
    throw new Error(`Session not found: ${sessionId}`)
  }
  return context
}

async function destroySession(sessionId: string): Promise<void> {
  const context = sessions.get(sessionId)
  if (context) {
    await context.fs.destroy()
    sessions.delete(sessionId)
  }
}

// ─────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────

async function main() {
  const config = parseArgs(process.argv.slice(2))

  // Initialize ConstellationFS configuration
  ConstellationFS.setConfig({ appId: config.appId })

  // Create MCP server
  const mcpServer = new McpServer({
    name: 'constellation-fs',
    version: '1.0.0',
  })

  if (config.http) {
    // ─────────────────────────────────────────────────────────────
    // HTTP Mode: Multi-session, workspace from headers
    // ─────────────────────────────────────────────────────────────

    registerTools(mcpServer, (sessionId) => {
      if (!sessionId) throw new Error('Session ID required')
      return getSessionContext(sessionId).workspace
    })

    const transports: Record<string, StreamableHTTPServerTransport> = {}
    const app = express()
    app.use(express.json())

    // Auth middleware
    const authToken = config.authToken!
    app.use('/mcp', (req: Request, res: Response, next: NextFunction) => {
      const auth = req.headers.authorization
      if (!auth?.startsWith('Bearer ') || auth.slice(7) !== authToken) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }
      next()
    })

    // MCP endpoint
    app.post('/mcp', async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined

      if (sessionId && transports[sessionId]) {
        await transports[sessionId].handleRequest(req, res)
        return
      }

      if (req.body?.method !== 'initialize') {
        res.status(400).json({ error: 'Session not found' })
        return
      }

      const newSessionId = randomUUID()
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        onsessioninitialized: async (sid: string) => {
          const headers: Record<string, string> = {}
          for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === 'string') headers[k.toLowerCase()] = v
          }
          try {
            await initializeSession(sid, headers)
            transports[sid] = transport
          } catch (err) {
            console.error('Session init failed:', err)
          }
        },
        onsessionclosed: async (sid: string) => {
          await destroySession(sid)
          delete transports[sid]
        },
      })

      await mcpServer.connect(transport)
      await transport.handleRequest(req, res)
    })

    app.get('/health', (_: Request, res: Response) => {
      res.json({ status: 'ok', sessions: Object.keys(transports).length })
    })

    const port = config.port || 3000
    app.listen(port, '0.0.0.0', () => {
      console.log(`ConstellationFS MCP server (HTTP) listening on port ${port}`)
    })

  } else {
    // ─────────────────────────────────────────────────────────────
    // Stdio Mode: Single workspace, bound at startup
    // ─────────────────────────────────────────────────────────────

    const fs = new FileSystem({ userId: config.userId!, type: 'local' })
    const workspace = await fs.getWorkspace(config.workspace!)

    registerTools(mcpServer, () => workspace)

    const transport = new StdioServerTransport()
    await mcpServer.connect(transport)

    process.on('SIGINT', async () => {
      await fs.destroy()
      process.exit(0)
    })
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
