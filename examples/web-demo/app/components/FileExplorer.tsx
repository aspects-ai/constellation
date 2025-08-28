'use client'

import { useState, useEffect } from 'react'

interface FileItem {
  path: string
  type: 'file' | 'directory'
  name: string
}

interface FileExplorerProps {
  sessionId: string
  onFileSelect?: (filePath: string) => void
  selectedFile?: string | null
}

export default function FileExplorer({ sessionId, onFileSelect, selectedFile }: FileExplorerProps) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchFileSystem = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/filesystem?sessionId=${sessionId}`)
      if (response.ok) {
        const data = await response.json()
        setFiles(data.files || [])
      }
    } catch (error) {
      console.error('Failed to fetch filesystem:', error)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    fetchFileSystem()
  }, [sessionId])

  useEffect(() => {
    // Listen for filesystem updates from chat
    const handleUpdate = () => {
      fetchFileSystem()
    }
    
    window.addEventListener('filesystem-update', handleUpdate)
    return () => window.removeEventListener('filesystem-update', handleUpdate)
  }, [])

  const handleFileClick = (item: FileItem) => {
    if (item.type === 'file' && onFileSelect) {
      onFileSelect(item.path)
    }
  }

  const renderFileTree = (items: FileItem[], prefix: string = '') => {
    // Sort directories first, then files
    const sorted = [...items].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })

    return sorted.map((item, index) => (
      <div 
        key={item.path} 
        className={`file-item ${item.type} ${item.type === 'file' && selectedFile === item.path ? 'selected' : ''} ${item.type === 'file' ? 'clickable' : ''}`}
        onClick={() => handleFileClick(item)}
      >
        {prefix}{item.name}
        {item.type === 'directory' && '/'}
      </div>
    ))
  }

  return (
    <div className="file-explorer">
      <div className="file-tree">
        <h3>Workspace Files</h3>
        {isLoading ? (
          <div>Loading...</div>
        ) : files.length === 0 ? (
          <div>No files yet. Start by asking the AI to create something!</div>
        ) : (
          renderFileTree(files)
        )}
        <button 
          onClick={fetchFileSystem} 
          className="refresh-button"
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
    </div>
  )
}