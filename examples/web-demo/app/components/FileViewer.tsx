'use client'

import { useState, useEffect } from 'react'

interface FileViewerProps {
  sessionId: string
  selectedFile: string | null
}

export default function FileViewer({ sessionId, selectedFile }: FileViewerProps) {
  const [fileContent, setFileContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedFile) {
      setFileContent('')
      setError(null)
      return
    }

    const fetchFileContent = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        const response = await fetch(`/api/file-content?sessionId=${sessionId}&filePath=${encodeURIComponent(selectedFile)}`)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.statusText}`)
        }
        
        const data = await response.json()
        setFileContent(data.content || '')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file')
        setFileContent('')
      } finally {
        setIsLoading(false)
      }
    }

    fetchFileContent()
  }, [sessionId, selectedFile])

  if (!selectedFile) {
    return (
      <div className="file-viewer">
        <div className="file-viewer-header">
          <h3>File Viewer</h3>
        </div>
        <div className="file-viewer-content">
          <div className="file-viewer-empty">
            Select a file to view its contents
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="file-viewer">
      <div className="file-viewer-header">
        <h3>File Viewer</h3>
        <span className="file-name">{selectedFile}</span>
      </div>
      <div className="file-viewer-content">
        {isLoading ? (
          <div className="file-viewer-loading">Loading...</div>
        ) : error ? (
          <div className="file-viewer-error">{error}</div>
        ) : (
          <pre className="file-content">{fileContent}</pre>
        )}
      </div>
    </div>
  )
}