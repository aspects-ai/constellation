import { FileSystem } from 'constellationfs'
import { readdir, stat } from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'

interface FileItem {
  path: string
  type: 'file' | 'directory'
  name: string
}

interface BackendConfig {
  type: 'local' | 'remote'
  host?: string
  username?: string
  workspace?: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const backendType = searchParams.get('backendType') || 'local'
    const host = searchParams.get('host')
    const username = searchParams.get('username')
    const workspace = searchParams.get('workspace')

    if (!sessionId) {
      return NextResponse.json({ error: 'SessionId is required' }, { status: 400 })
    }

    console.log('Filesystem API: sessionId =', JSON.stringify(sessionId), 'backend =', backendType)
    console.log('Remote connection params:', { host, username, workspace })

    // Create backend configuration
    let backendConfig: any

    if (backendType === 'remote') {
      if (!host || !username || !workspace) {
        console.error('Missing required remote backend parameters:', { host, username, workspace })
        return NextResponse.json({ 
          error: 'Remote backend requires host, username, and workspace parameters' 
        }, { status: 400 })
      }

      backendConfig = {
        type: 'remote',
        host,
        workspace,
        auth: {
          type: 'password',
          credentials: {
            username,
            password: 'constellation' // Default password for Docker container
          }
        }
      }
      console.log('Using remote backend config:', { ...backendConfig, auth: { ...backendConfig.auth, credentials: { username: backendConfig.auth.credentials.username, password: '[REDACTED]' } } })
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

    let files: FileItem[]

    if (backendType === 'remote') {
      // For remote backend, use ConstellationFS exec to list files
      try {
        console.log('Attempting to connect to remote backend and execute find command...')
        const output = await fs.exec('find . -type f -o -type d | head -100')
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
      files = await getFileTree(fs.workspace)
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

async function getFileTree(basePath: string, currentPath: string = '', files: FileItem[] = []): Promise<FileItem[]> {
  try {
    const fullPath = join(basePath, currentPath)
    const items = await readdir(fullPath)

    for (const item of items) {
      const itemPath = join(fullPath, item)
      const relativePath = currentPath ? join(currentPath, item) : item
      const stats = await stat(itemPath)

      if (stats.isDirectory()) {
        files.push({
          path: relativePath,
          type: 'directory',
          name: item
        })
        // Recursively get subdirectory contents
        await getFileTree(basePath, relativePath, files)
      } else {
        files.push({
          path: relativePath,
          type: 'file',
          name: item
        })
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${currentPath}:`, error)
  }

  return files
}