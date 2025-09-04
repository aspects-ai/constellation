'use client'

import { Box, Container, Group, Text } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import ApiKeyModal from './components/ApiKeyModal'
import Chat from './components/Chat'
import FileExplorer from './components/FileExplorer'
import FileViewer from './components/FileViewer'

function ResizableLayout({ sessionId, selectedFile, setSelectedFile, apiKey }: {
  sessionId: string
  selectedFile: string | null
  setSelectedFile: (file: string | null) => void
  apiKey: string | null
}) {
  const [bottomHeight, setBottomHeight] = useState(300)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      
      const availableHeight = window.innerHeight - 60 // Total height minus header
      const mouseYFromTop = e.clientY - 60 // Mouse position relative to content area (after header)
      const newBottomHeight = availableHeight - mouseYFromTop
      
      // Constrain the height between 200px and 80% of available space
      const minHeight = 200
      const maxHeight = availableHeight * 0.8
      const constrainedHeight = Math.max(minHeight, Math.min(maxHeight, newBottomHeight))
      
      setBottomHeight(constrainedHeight)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.body.style.cursor = 'default'
      document.body.style.userSelect = 'auto'
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'ns-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const handleMouseDown = () => {
    setIsDragging(true)
  }

  return (
    <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Chat area */}
      <Box style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Chat sessionId={sessionId} apiKey={apiKey} />
      </Box>
      
      {/* Draggable divider */}
      <Box
        ref={dragRef}
        onMouseDown={handleMouseDown}
        className="draggable-divider"
        style={{
          height: '6px',
          backgroundColor: 'var(--mantine-color-dark-4)',
          cursor: 'ns-resize',
          borderTop: '1px solid var(--mantine-color-dark-3)',
          borderBottom: '1px solid var(--mantine-color-dark-5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}
      >
        <Box 
          className="divider-handle"
          style={{
            width: '60px',
            height: '3px',
            backgroundColor: 'var(--mantine-color-gray-5)',
            borderRadius: '2px',
            transition: 'background-color 0.2s ease'
          }}
        />
      </Box>
      
      {/* File explorer and viewer */}
      <Box 
        style={{ 
          height: `${bottomHeight}px`, 
          display: 'flex',
          minHeight: '200px'
        }}
      >
        <FileExplorer 
          sessionId={sessionId} 
          onFileSelect={setSelectedFile}
          selectedFile={selectedFile}
        />
        <FileViewer 
          sessionId={sessionId} 
          selectedFile={selectedFile}
        />
      </Box>
    </Box>
  )
}

export default function Home() {
  const [sessionId, setSessionId] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  
  // Generate sessionId and check for environment API key
  useEffect(() => {
    // Generate a sessionId that only contains valid characters (a-z, 0-9)
    const id = Math.random().toString(36).substring(2, 10).replace(/[^a-z0-9]/g, 'x')
    setSessionId(id)
    
    // Check if API key is provided via environment variable
    const envApiKey = process.env.NEXT_PUBLIC_CODEBUFF_API_KEY
    if (envApiKey) {
      setApiKey(envApiKey)
      setShowApiKeyModal(false)
    } else {
      // Show API key modal if no environment variable is set
      setShowApiKeyModal(true)
    }
  }, [])

  const handleApiKeySubmit = (key: string) => {
    setApiKey(key)
    setShowApiKeyModal(false)
  }
  
  // Don't render until sessionId is generated on client
  if (!sessionId) {
    return (
      <Container size="xl" h="100vh" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text>Initializing session...</Text>
      </Container>
    )
  }

  return (
    <>
      <ApiKeyModal opened={showApiKeyModal} onSubmit={handleApiKeySubmit} />
      
      <Box style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box
          style={{
            height: '60px',
            backgroundColor: 'var(--mantine-color-dark-6)',
            borderBottom: '1px solid var(--mantine-color-dark-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            flexShrink: 0
          }}
        >
          <Text size="lg" fw={600}>
            Codebuff SDK on ConstellationFS Demo
          </Text>
          <Group gap="md">
            <Text size="sm" c="dimmed" ff="monospace">
              Session: {sessionId}
            </Text>
            {apiKey && (
              <Text size="xs" c="green">
                API Key: ●●●●●{apiKey.slice(-4)}
              </Text>
            )}
          </Group>
        </Box>

        {/* Main content area */}
        <Box style={{ flex: 1, minHeight: 0 }}>
          <ResizableLayout sessionId={sessionId} selectedFile={selectedFile} setSelectedFile={setSelectedFile} apiKey={apiKey} />
        </Box>
      </Box>
    </>
  )
}