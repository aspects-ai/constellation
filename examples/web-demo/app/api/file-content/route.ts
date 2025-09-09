import { FileSystem } from 'constellationfs'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const filePath = searchParams.get('filePath')
    const backendType = searchParams.get('backendType') || 'local'
    const host = searchParams.get('host')
    const username = searchParams.get('username')
    const workspace = searchParams.get('workspace')

    if (!sessionId || !filePath) {
      return NextResponse.json({ error: 'sessionId and filePath are required' }, { status: 400 })
    }

    // Create backend configuration
    let backendConfig: any

    if (backendType === 'remote') {
      if (!host || !username || !workspace) {
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

    try {
      const content = await fs.read(filePath)
      return NextResponse.json({ content, backend: backendType })
    } catch (error) {
      // Handle file not found or read errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return NextResponse.json({ error: `Failed to read file: ${errorMessage}` }, { status: 404 })
    }

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}