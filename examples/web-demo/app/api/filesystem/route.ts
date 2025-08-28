import { FileSystem } from 'constellationfs'
import { readdir, stat } from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'

interface FileItem {
  path: string
  type: 'file' | 'directory'
  name: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'SessionId is required' }, { status: 400 })
    }

    console.log('Filesystem API: sessionId =', JSON.stringify(sessionId))

    // Initialize ConstellationFS with session-based userId
    const fs = new FileSystem({ userId: sessionId })
    const files = await getFileTree(fs.workspace)

    return NextResponse.json({ files })
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