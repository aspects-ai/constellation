/**
 * ConstellationFS CLI Main Dispatcher
 */

import { buildNative } from './build-native.js'
import { getNativeLibraryPath } from './path.js'
import { getLDPreloadPath } from './native-path.js'
import { dockerRun } from './docker-run.js'
import { startRemote, stopRemote } from './remote.js'

export async function main(args) {
  const command = args[0]
  
  if (!command) {
    printHelp()
    return
  }
  
  switch (command) {
    case 'build-native':
      await handleBuildNative(args.slice(1))
      break
      
    case 'path':
      handlePath()
      break
      
    case 'docker-run':
      await handleDockerRun(args.slice(1))
      break
      
    case 'start-remote':
      await handleStartRemote()
      break
      
    case 'stop-remote':
      await handleStopRemote()
      break
      
    case 'docker-dev':
      await handleDockerDev(args.slice(1))
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

async function handleBuildNative(args) {
  let outputDir = './dist-native'
  
  // Parse --output argument
  const outputIndex = args.indexOf('--output')
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    outputDir = args[outputIndex + 1]
  }
  
  try {
    const libraryPath = await buildNative({ output: outputDir })
    console.log(`✅ Native library built successfully: ${libraryPath}`)
  } catch (error) {
    console.error(`❌ Build failed: ${error.message}`)
    process.exit(1)
  }
}

function handlePath() {
  try {
    const path = getNativeLibraryPath()
    console.log(path)
  } catch (error) {
    console.error(`❌ ${error.message}`)
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

async function handleStartRemote() {
  try {
    await startRemote()
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
  build-native [--output DIR]    Build native library for current platform
                                 Linux: Uses local build tools
                                 macOS/Windows: Uses Docker
                                 
  path                          Show path to built native library
  
  start-remote                  Start ConstellationFS remote backend service
                                (Docker-based SSH filesystem service)
  
  stop-remote                   Stop ConstellationFS remote backend service
  
  docker-run "COMMAND"          Run command with ConstellationFS Docker setup
                                (Experimental - for advanced usage)
  
  help                          Show this help message

Examples:
  # Build native library
  npx constellationfs build-native --output ./build/
  
  # Find built library path  
  npx constellationfs path
  
  # Start remote backend service
  npx constellationfs start-remote
  
  # Use with remote backend
  REMOTE_VM_HOST=root@localhost:2222 LD_PRELOAD=$(npx constellationfs path) npm run dev
  
  # Stop remote backend when done
  npx constellationfs stop-remote

For more information, see: https://github.com/constellation-fs/constellation-fs
`)
}