import { NextRequest, NextResponse } from 'next/server'
import { FileSystem, BackendConfig } from 'constellationfs'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const sessionId = formData.get('sessionId') as string
    // Get backend type from environment variable
    const backendType = (process.env.NEXT_PUBLIC_CONSTELLATION_BACKEND_TYPE as 'local' | 'remote') || 'local'

    if (!file || !sessionId) {
      return NextResponse.json({ error: 'File and sessionId are required' }, { status: 400 })
    }

    console.log('Upload API: sessionId =', JSON.stringify(sessionId), 'backend =', backendType)

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