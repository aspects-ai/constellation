/**
 * ConstellationFS CLI Main Dispatcher
 */

import { dockerRun } from './docker-run.js'
import { startRemote, stopRemote } from './remote.js'
import { startMcpServer } from './mcp-server.js'

export async function main(args) {
  const command = args[0]
  
  if (!command) {
    printHelp()
    return
  }
  
  switch (command) {
    case 'docker-run':
      await handleDockerRun(args.slice(1))
      break
      
    case 'start-remote':
      await handleStartRemote(args.slice(1))
      break
      
    case 'stop-remote':
      await handleStopRemote()
      break

    case 'mcp-server':
      await startMcpServer(args.slice(1))
      break

    case 'help':
    case '--help':
    case '-h':
      printHelp()
      break
      
    default:
      console.error(`Unknown command: ${command}`)
      printHelp()
      process.exit(1)
  }
}

async function handleDockerRun(args) {
  if (args.length === 0) {
    console.error('❌ Docker run command requires a command to execute')
    console.error('Usage: npx constellationfs docker-run "npm run dev"')
    process.exit(1)
  }
  
  try {
    await dockerRun(args.join(' '))
  } catch (error) {
    console.error(`❌ Docker run failed: ${error.message}`)
    process.exit(1)
  }
}

async function handleStartRemote(args) {
  const shouldBuild = args.includes('--build')
  
  try {
    await startRemote({ build: shouldBuild })
  } catch (error) {
    console.error(`❌ Failed to start remote backend: ${error.message}`)
    process.exit(1)
  }
}

async function handleStopRemote() {
  try {
    await stopRemote()
  } catch (error) {
    console.error(`❌ Failed to stop remote backend: ${error.message}`)
    process.exit(1)
  }
}

function printHelp() {
  console.log(`
🌟 ConstellationFS CLI

Usage:
  npx constellationfs <command> [options]

Commands:
  mcp-server                    Start MCP server for AI agent filesystem access
                                --appId <id>       Application identifier (required)
                                --userId <id>      User identifier (required for stdio)
                                --workspace <name> Workspace name (required for stdio)
                                --http             Run in HTTP mode (multi-session)
                                --port <port>      HTTP port (default: 3000)
                                --authToken <tok>  Auth token (required for HTTP)

  start-remote [--build]        Start ConstellationFS remote backend service
                                (Docker-based SSH filesystem service)
                                --build: Force rebuild the Docker image

  stop-remote                   Stop ConstellationFS remote backend service

  docker-run "COMMAND"          Run command with ConstellationFS Docker setup
                                (Experimental - for advanced usage)

  help                          Show this help message

Examples:
  # Start remote backend service
  npx constellationfs start-remote
  
  # Use with remote backend
  REMOTE_VM_HOST=root@localhost:2222 LD_PRELOAD=$(npx constellationfs path) npm run dev
  
  # Stop remote backend when done
  npx constellationfs stop-remote

For more information, see: https://github.com/constellation-fs/constellation-fs
`)
}