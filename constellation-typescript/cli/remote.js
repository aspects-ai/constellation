/**
 * ConstellationFS Remote Backend Management
 * 
 * Handles Docker-based remote backend lifecycle
 */

import { execSync, spawn } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PACKAGE_ROOT = join(__dirname, '..')
const REMOTE_DIR = join(PACKAGE_ROOT, 'remote')

/**
 * Start the ConstellationFS remote backend service
 * @param {Object} options - Configuration options
 * @param {boolean} options.build - Force rebuild the Docker image
 */
export async function startRemote(options = {}) {
  console.log('🚀 Starting ConstellationFS remote backend...')
  
  // Check if Docker is available
  try {
    execSync('docker --version', { stdio: 'ignore' })
  } catch {
    throw new Error(
      'Docker is required for the remote backend\n' +
      'Please install Docker Desktop: https://www.docker.com/products/docker-desktop/'
    )
  }
  
  // Build image if requested (do this first, even if container is running)
  if (options.build) {
    console.log('   Building Docker image...')
    await buildImage()
    console.log('   ✅ Docker image built successfully')
  }
  
  // Check if service is already running
  try {
    execSync('docker ps --filter "name=constellation-remote" --format "{{.Names}}"', { stdio: 'pipe' })
    const output = execSync('docker ps --filter "name=constellation-remote" --format "{{.Names}}"', { 
      encoding: 'utf8', 
      stdio: 'pipe' 
    }).trim()
    
    if (output.includes('constellation-remote')) {
      if (options.build) {
        console.log('   Restarting container with new image...')
        // Stop and remove existing container
        await runCommand(['docker', 'stop', 'constellation-remote-backend']).catch(() => {})
        await runCommand(['docker', 'rm', 'constellation-remote-backend']).catch(() => {})
        // Container will be recreated below
      } else {
        console.log('✅ Remote backend is already running')
        console.log('   SSH available at: root@localhost:2222')
        console.log('   Default password: constellation')
        return
      }
    }
  } catch {
    // Service not running, continue
  }
  
  try {
    // Use docker-compose if available
    try {
      await runDockerCompose()
    } catch {
      // Fallback to direct docker run
      await runDockerDirect(options)
    }
    
    // Wait a moment for service to start
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    console.log('✅ Remote backend started successfully')
    console.log('   SSH available at: root@localhost:2222')
    console.log('   Default password: constellation')
    console.log('   ')
    console.log('   You can now run your app with:')
    console.log('   REMOTE_VM_HOST=root@localhost:2222 LD_PRELOAD=$(npx constellationfs path) npm run dev')
    
  } catch (error) {
    throw new Error(`Failed to start remote backend: ${error.message}`)
  }
}

/**
 * Stop the ConstellationFS remote backend service
 */
export async function stopRemote() {
  console.log('🛑 Stopping ConstellationFS remote backend...')
  
  try {
    // Try docker-compose down first
    try {
      await runCommand([
        'docker-compose', '-f', join(REMOTE_DIR, 'docker-compose.yml'), 'down'
      ])
    } catch {
      // Fallback to stopping containers directly
      const containers = execSync(
        'docker ps --filter "name=constellation-remote" --format "{{.Names}}"',
        { encoding: 'utf8', stdio: 'pipe' }
      ).trim().split('\n').filter(name => name.trim())
      
      for (const container of containers) {
        if (container.trim()) {
          await runCommand(['docker', 'stop', container.trim()])
          await runCommand(['docker', 'rm', container.trim()])
        }
      }
    }
    
    console.log('✅ Remote backend stopped')
    
  } catch (error) {
    throw new Error(`Failed to stop remote backend: ${error.message}`)
  }
}

/**
 * Start using docker-compose
 */
async function runDockerCompose() {
  console.log('   Using docker-compose...')
  
  await runCommand([
    'docker-compose', 
    '-f', join(REMOTE_DIR, 'docker-compose.yml'),
    'up', '-d'
  ])
}

/**
 * Build the Docker image
 */
async function buildImage() {
  await runCommand([
    'docker', 'build',
    '-f', join(REMOTE_DIR, 'Dockerfile.runtime'),
    '-t', 'constellationfs/remote-backend:latest',
    PACKAGE_ROOT
  ])
}

/**
 * Start using direct docker run as fallback
 */
async function runDockerDirect(options = {}) {
  console.log('   Using direct docker run...')
  
  // Build image if not already built via --build flag
  if (!options.build) {
    console.log('   Building Docker image...')
    await buildImage()
  }
  
  // Run container
  await runCommand([
    'docker', 'run', '-d',
    '--name', 'constellation-remote-backend',
    '-p', '2222:22',
    'constellationfs/remote-backend:latest'
  ])
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