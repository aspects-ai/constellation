import { FileSystem } from 'constellationfs'
import { NextRequest, NextResponse } from 'next/server'

interface FileItem {
  path: string
  type: 'file' | 'directory'
  name: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    
    // Get backend type from environment variable
    const backendType = (process.env.NEXT_PUBLIC_CONSTELLATION_BACKEND_TYPE as 'local' | 'remote') || 'local'

    if (!sessionId) {
      return NextResponse.json({ error: 'SessionId is required' }, { status: 400 })
    }

    console.log('Filesystem API: sessionId =', JSON.stringify(sessionId), 'backend =', backendType)

    // Create backend configuration
    let backendConfig: any

    if (backendType === 'remote') {
      backendConfig = {
        type: 'remote',
        // Host will be determined from REMOTE_VM_HOST environment variable
        userId: sessionId,
        auth: {
          type: 'password',
          credentials: {
            username: 'root',
            password: 'constellation' // Default password for Docker container
          }
        }
      }
      console.log('Using remote backend config (host from env):', { ...backendConfig, auth: { ...backendConfig.auth, credentials: { username: backendConfig.auth.credentials.username, password: '[REDACTED]' } } })
    } else {
      backendConfig = {
        type: 'local',
        userId: sessionId
      }
      console.log('Using local backend config')
    }

    // Initialize ConstellationFS with specified backend
    console.log('Initializing FileSystem...')
    const fs = new FileSystem({
      userId: sessionId,
      ...backendConfig
    })

    // Get workspace
    const workspace = await fs.getWorkspace('default')

    let files: FileItem[]

    if (backendType === 'remote') {
      // For remote backend, use ConstellationFS exec to list files
      try {
        console.log('Attempting to connect to remote backend and execute find command...')
        const output = await workspace.exec('find . -type f -o -type d | head -100')
        if (typeof output !== 'string') {
          throw new Error('Output is not a string')
        }
        console.log('Remote command executed successfully, output:', output.substring(0, 200))
        files = parseRemoteFileTree(output)
      } catch (error) {
        console.error('Remote file listing failed:', error)
        console.error('Error details:', (error as Error).message, (error as Error).stack)
        return NextResponse.json({ 
          error: 'Remote connection failed', 
          details: (error as Error).message 
        }, { status: 500 })
      }
    } else {
      // For local backend, use direct filesystem access
      files = await getFileTree(workspace)
    }

    return NextResponse.json({ files, backend: backendType })
  } catch (error) {
    console.error('Filesystem API Error:', error)
    if (error instanceof Error) {
      return NextResponse.json({ 
        error: 'Failed to read filesystem', 
        details: error.message 
      }, { status: 500 })
    }
    return NextResponse.json({ error: 'Failed to read filesystem' }, { status: 500 })
  }
}

function parseRemoteFileTree(output: string): FileItem[] {
  const lines = output.split('\n').filter(line => line.trim())
  const files: FileItem[] = []
  
  for (const line of lines) {
    const path = line.replace(/^\.\//, '') // Remove leading ./
    if (!path || path === '.') continue
    
    const name = path.split('/').pop() || path
    
    // Heuristic: if it has an extension or doesn't end with common directory patterns, treat as file
    const isFile = name.includes('.') && !name.endsWith('/') && 
                   !(['bin', 'lib', 'etc', 'usr', 'var', 'tmp', 'opt'].includes(name))
    
    files.push({
      path,
      type: isFile ? 'file' : 'directory',
      name
    })
  }
  
  return files
}

async function getFileTree(workspace: any, currentPath: string = '', files: FileItem[] = [], depth: number = 0): Promise<FileItem[]> {
  // Limit recursion depth to prevent deep traversal
  if (depth > 3) return files
  
  // Directories to ignore
  const ignoreDirs = new Set([
    'node_modules',
    '.git',
    '.next',
    'dist',
    'build',
    '.cache',
    '.vscode',
    '.idea',
    '__pycache__',
    '.pytest_cache',
    'coverage',
    '.nyc_output'
  ])
  
  try {
    const searchPath = currentPath || '.'
    const output = await workspace.exec(`find "${searchPath}" -maxdepth 1 -type f -o -type d`)
    const lines = output.split('\n').filter((line: string) => line.trim())

    for (const line of lines) {
      const path = line.replace(/^\.\//, '') // Remove leading ./
      if (!path || path === '.' || path === currentPath) continue
      
      const name = path.split('/').pop() || path
      
      // Skip hidden files/directories (except .gitignore, .env, etc.)
      if (name.startsWith('.') && !name.match(/^\.(gitignore|env|env\..*|prettierrc|eslintrc.*|babelrc.*)$/)) {
        continue
      }
      
      // Skip ignored directories
      if (ignoreDirs.has(name)) {
        continue
      }
      
      const relativePath = currentPath ? `${currentPath}/${name}` : name

      // Check if it's a directory using find command
      const isDir = await workspace.exec(`find "${path}" -maxdepth 0 -type d`).then((result: string) => result.trim() !== '').catch(() => false)

      if (isDir) {
        files.push({
          path: relativePath,
          type: 'directory',
          name
        })
        // Recursively get subdirectory contents
        await getFileTree(workspace, relativePath, files, depth + 1)
      } else {
        files.push({
          path: relativePath,
          type: 'file',
          name
        })
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${currentPath}:`, error)
  }

  return files
}