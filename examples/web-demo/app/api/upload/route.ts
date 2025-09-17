import { NextRequest, NextResponse } from 'next/server'
import { FileSystem, BackendConfig } from 'constellationfs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const sessionId = formData.get('sessionId') as string
    const backendType = formData.get('backendType') as string || 'local'

    if (!file || !sessionId) {
      return NextResponse.json({ error: 'File and sessionId are required' }, { status: 400 })
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
    const arrayBuffer = await file.arrayBuffer()
    const content = Buffer.from(arrayBuffer).toString('utf8')

    // Write file to workspace
    await fs.write(file.name, content)

    return NextResponse.json({ 
      success: true, 
      message: `File "${file.name}" uploaded successfully`,
      filename: file.name 
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Upload failed' 
    }, { status: 500 })
  }
}