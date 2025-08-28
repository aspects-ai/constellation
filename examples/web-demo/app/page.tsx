'use client'

import { useState, useEffect, useRef } from 'react'
import FileExplorer from './components/FileExplorer'
import FileViewer from './components/FileViewer'
import Chat from './components/Chat'

export default function Home() {
  const [sessionId] = useState(() => {
    // Generate a sessionId that only contains valid characters (a-z, 0-9)
    return Math.random().toString(36).substring(2, 10).replace(/[^a-z0-9]/g, 'x')
  })
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  
  return (
    <div className="container">
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