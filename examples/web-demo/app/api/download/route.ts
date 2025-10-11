import { FileSystem } from 'constellationfs'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const filePath = searchParams.get('file')
    // Get backend type from environment variable
    const backendType = (process.env.NEXT_PUBLIC_CONSTELLATION_BACKEND_TYPE as 'local' | 'remote') || 'local'

    if (!sessionId || !filePath) {
      return NextResponse.json({ error: 'SessionId and file path are required' }, { status: 400 })
    }

    console.log('Download API: sessionId =', JSON.stringify(sessionId), 'backend =', backendType)

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
    const fs = new FileSystem({
      userId: sessionId,
      ...backendConfig
    })

    // Get workspace and read file content
    const workspace = await fs.getWorkspace('default')
    const content = await workspace.read(filePath)

    // Get filename from path
    const filename = filePath.split('/').pop() || 'download.txt'

    // Return file as download
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })

  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Download failed' 
    }, { status: 500 })
  }
}