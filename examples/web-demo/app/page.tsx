'use client'

import { useState, useEffect, useRef } from 'react'
import FileExplorer from './components/FileExplorer'
import FileViewer from './components/FileViewer'
import Chat from './components/Chat'

export default function Home() {
  const [sessionId, setSessionId] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  
  // Generate sessionId on client side only to avoid hydration mismatch
  useEffect(() => {
    // Generate a sessionId that only contains valid characters (a-z, 0-9)
    const id = Math.random().toString(36).substring(2, 10).replace(/[^a-z0-9]/g, 'x')
    setSessionId(id)
  }, [])
  
  // Don't render until sessionId is generated on client
  if (!sessionId) {
    return (
      <div className="container">
        <div className="loading">Initializing session...</div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="session-id-display">
        Session: {sessionId}
      </div>
      <div className="main-content">
        <Chat sessionId={sessionId} />
      </div>
      <div className="bottom-panel">
        <FileExplorer 
          sessionId={sessionId} 
          onFileSelect={setSelectedFile}
          selectedFile={selectedFile}
        />
        <FileViewer 
          sessionId={sessionId} 
          selectedFile={selectedFile}
        />
      </div>
    </div>
  )
}