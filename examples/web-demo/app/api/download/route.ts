import { NextRequest, NextResponse } from 'next/server'
import { FileSystem, BackendConfig } from 'constellationfs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const filePath = searchParams.get('file')
    const backendType = searchParams.get('backendType') || 'local'

    if (!sessionId || !filePath) {
      return NextResponse.json({ error: 'SessionId and file path are required' }, { status: 400 })
    }

    // Create backend configuration
    let backendConfig: Partial<BackendConfig>
    
    if (backendType === 'remote') {
      backendConfig = {
        type: 'remote',
        auth: {
          type: 'password',
          credentials: {
            username: 'root',
            password: 'constellation'
          }
        }
      }
    } else {
      backendConfig = {
        type: 'local',
        userId: sessionId
      }
    }

    // Initialize ConstellationFS with specified backend
    const fs = new FileSystem({
      userId: sessionId,
      ...backendConfig
    })

    // Read file content
    const content = await fs.read(filePath)

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