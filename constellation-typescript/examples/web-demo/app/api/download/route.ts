import { NextRequest, NextResponse } from 'next/server'
import { FileSystem } from 'constellationfs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const filePath = searchParams.get('file')

    if (!sessionId || !filePath) {
      return NextResponse.json({ error: 'SessionId and file path are required' }, { status: 400 })
    }

    // Initialize ConstellationFS with session-based userId
    const fs = new FileSystem({ userId: sessionId })

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