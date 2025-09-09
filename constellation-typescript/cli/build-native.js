/**
 * ConstellationFS Native Library Builder
 * 
 * Handles cross-platform building of the LD_PRELOAD native library
 */

import { execSync, spawn } from 'child_process'
import { existsSync, mkdirSync, copyFileSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import os from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PACKAGE_ROOT = resolve(__dirname, '..')
const NATIVE_DIR = join(PACKAGE_ROOT, 'native')

/**
 * Build the native library for the current platform
 * @param {Object} options - Build options
 * @param {string} options.output - Output directory for the built library
 * @returns {Promise<string>} Path to the built library
 */
export async function buildNative(options = {}) {
  const outputDir = options.output || './dist-native'
  const platform = process.platform
  
  console.log(`🔨 Building ConstellationFS native library...`)
  console.log(`   Platform: ${platform} (${process.arch})`)
  console.log(`   Output: ${outputDir}`)
  
  // Create output directory
  const fullOutputPath = resolve(outputDir)
  if (!existsSync(fullOutputPath)) {
    mkdirSync(fullOutputPath, { recursive: true })
  }
  
  const libraryPath = join(fullOutputPath, 'libintercept.so')
  
  if (platform === 'linux') {
    await buildNativeLinux(libraryPath)
  } else {
    await buildNativeDocker(libraryPath)
  }
  
  return libraryPath
}

/**
 * Build natively on Linux using system build tools
 */
async function buildNativeLinux(libraryPath) {
  console.log('🐧 Building natively on Linux...')
  
  // Check for build tools
  const missingTools = checkBuildTools()
  if (missingTools.length > 0) {
    throw new Error(
      `Missing build tools: ${missingTools.join(', ')}\\n` +
      'On Ubuntu/Debian: sudo apt-get install build-essential\\n' +
      'On CentOS/RHEL: sudo yum groupinstall "Development Tools"'
    )
  }
  
  // Check if Makefile exists
  const makefilePath = join(NATIVE_DIR, 'Makefile')
  if (!existsSync(makefilePath)) {
    throw new Error(`Makefile not found at ${makefilePath}`)
  }
  
  try {
    // Clean previous build
    execSync('make clean', { 
      cwd: NATIVE_DIR, 
      stdio: ['ignore', 'pipe', 'pipe'] 
    })
    
    // Build the library
    console.log('   Compiling...')
    execSync('make', { 
      cwd: NATIVE_DIR,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    
    // Verify library was built
    const builtLibrary = join(NATIVE_DIR, 'libintercept.so')
    if (!existsSync(builtLibrary)) {
      throw new Error('Native library was not created')
    }
    
    // Copy to output location
    copyFileSync(builtLibrary, libraryPath)
    console.log('✅ Native build completed')
    
  } catch (error) {
    throw new Error(`Native build failed: ${error.message}`)
  }
}

/**
 * Build using Docker on non-Linux platforms
 */
async function buildNativeDocker(libraryPath) {
  console.log('🐳 Building using Docker...')
  
  // Check if Docker is available
  try {
    execSync('docker --version', { stdio: 'ignore' })
  } catch {
    throw new Error(
      'Docker is required for building on non-Linux platforms\\n' +
      'Please install Docker Desktop: https://www.docker.com/products/docker-desktop/'
    )
  }
  
  const builderImage = 'constellationfs-builder'
  const containerName = 'constellationfs-build-' + Date.now()
  
  try {
    // Build or pull builder image
    await ensureBuilderImage(builderImage)
    
    // Run build in container
    console.log('   Running build container...')
    
    const buildCommand = [
      'docker', 'run', '--rm',
      '--name', containerName,
      '-v', `${NATIVE_DIR}:/src-readonly:ro`,
      '-v', `${dirname(libraryPath)}:/output`,
      builderImage,
      '/bin/bash', '-c', 
      'mkdir -p /tmp/build && cp -r /src-readonly/* /tmp/build/ && cd /tmp/build && make clean && make && cp libintercept.so /output/'
    ]
    
    await runCommand(buildCommand)
    
    // Verify output
    if (!existsSync(libraryPath)) {
      throw new Error('Docker build did not produce expected output')
    }
    
    console.log('✅ Docker build completed')
    
  } catch (error) {
    // Clean up container if it exists
    try {
      execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' })
    } catch {
      // Ignore cleanup errors
    }
    throw error
  }
}

/**
 * Ensure the Docker builder image exists
 */
async function ensureBuilderImage(imageName) {
  try {
    // Check if image exists
    execSync(`docker image inspect ${imageName}`, { stdio: 'ignore' })
    console.log('   Using existing builder image')
  } catch {
    // Build the image
    console.log('   Building Docker builder image...')
    await buildBuilderImage(imageName)
  }
}

/**
 * Build the Docker builder image
 */
async function buildBuilderImage(imageName) {
  const dockerfilePath = join(NATIVE_DIR, 'Dockerfile.builder')
  
  if (!existsSync(dockerfilePath)) {
    // Create a basic builder Dockerfile if it doesn't exist
    const dockerfileContent = `FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \\
    build-essential \\
    gcc \\
    make \\
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
`
    await import('fs').then(fs => 
      fs.writeFileSync(dockerfilePath, dockerfileContent)
    )
  }
  
  const buildCommand = [
    'docker', 'build', 
    '-f', dockerfilePath,
    '-t', imageName,
    NATIVE_DIR
  ]
  
  await runCommand(buildCommand)
}

/**
 * Check if required build tools are available
 */
function checkBuildTools() {
  const requiredTools = ['gcc', 'make']
  const missing = []

  for (const tool of requiredTools) {
    try {
      execSync(`which ${tool}`, { stdio: 'ignore' })
    } catch (error) {
      missing.push(tool)
    }
  }

  return missing
}

/**
 * Run a command with proper error handling
 */
function runCommand(command) {
  return new Promise((resolve, reject) => {
    const process = spawn(command[0], command.slice(1), {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    
    let stdout = ''
    let stderr = ''
    
    process.stdout?.on('data', (data) => {
      stdout += data.toString()
    })
    
    process.stderr?.on('data', (data) => {
      stderr += data.toString()
    })
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${stderr || stdout}`))
      }
    })
    
    process.on('error', reject)
  })
}