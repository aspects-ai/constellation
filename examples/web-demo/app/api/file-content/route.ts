import { FileSystem } from 'constellationfs'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const filePath = searchParams.get('filePath')

    if (!sessionId || !filePath) {
      return NextResponse.json({ error: 'sessionId and filePath are required' }, { status: 400 })
    }

    // Initialize ConstellationFS with session-based userId
    const fs = new FileSystem({ userId: sessionId })

    try {
      const content = await fs.read(filePath)
      return NextResponse.json({ content })
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