import { FileSystem } from 'constellationfs'
import { NextRequest, NextResponse } from 'next/server'

// Cache FileSystem instances for better performance
const fsCache = new Map<string, FileSystem>()

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  console.log('[API] File content request started')
  
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const filePath = searchParams.get('filePath')
    // Get backend type from environment variable
    const backendType = (process.env.NEXT_PUBLIC_CONSTELLATION_BACKEND_TYPE as 'local' | 'remote') || 'local'

    if (!sessionId || !filePath) {
      return NextResponse.json({ error: 'sessionId and filePath are required' }, { status: 400 })
    }

    console.log('File-content API: sessionId =', JSON.stringify(sessionId), 'backend =', backendType)

    // Create a cache key
    const cacheKey = `${sessionId}-${backendType}`
    
    // Try to get cached filesystem or create new one
    let fs = fsCache.get(cacheKey)
    const wasCached = !!fs
    
    if (!fs) {
      console.log(`[API] Creating new FileSystem instance for ${cacheKey}`)
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
      fs = new FileSystem({ 
        userId: sessionId,
        ...backendConfig
      })
      
      // Cache it for future requests
      fsCache.set(cacheKey, fs)
      console.log(`[API] FileSystem cached (total cache size: ${fsCache.size})`)
      
      // Clean up old cache entries if too many
      if (fsCache.size > 50) {
        const firstKey = fsCache.keys().next().value
        if (firstKey) {
          fsCache.delete(firstKey)
        }
      }
    }

    console.log(`[API] Reading file: ${filePath} (cached: ${wasCached})`)
    const readStartTime = Date.now()
    
    try {
      const content = await fs.read(filePath)
      
      const readTime = Date.now() - readStartTime
      const totalTime = Date.now() - startTime
      console.log(`[API] File read completed in ${readTime}ms, total API time: ${totalTime}ms`)
      
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