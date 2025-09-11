'use client'

import { Box, Container, Tabs, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import ApiKeyModal from './components/ApiKeyModal'
import BackendSelector, { BackendConfig } from './components/BackendSelector'
import Chat from './components/Chat'
import ComponentSandbox from './components/ComponentSandbox'
import FileExplorer from './components/FileExplorer'
import FileViewer from './components/FileViewer'

function FileExplorerTab({ sessionId, backendConfig }: {
  sessionId: string
  backendConfig: BackendConfig
}) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  return (
    <Box style={{ height: '100%', display: 'flex', overflow: 'hidden' }}>
      <FileExplorer 
        sessionId={sessionId} 
        onFileSelect={setSelectedFile}
        selectedFile={selectedFile}
        backendConfig={backendConfig}
      />
      <FileViewer 
        sessionId={sessionId} 
        selectedFile={selectedFile}
        backendConfig={backendConfig}
      />
    </Box>
  )
}

export default function Home() {
  const [sessionId, setSessionId] = useState<string>('')
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [activeTab, setActiveTab] = useState<string | null>('files')
  const [backendConfig, setBackendConfig] = useState<BackendConfig>({ type: 'local' })
  
  useEffect(() => {
    const id = Math.random().toString(36).substring(2, 10).replace(/[^a-z0-9]/g, 'x')
    setSessionId(id)
    
    const envApiKey = process.env.NEXT_PUBLIC_CODEBUFF_API_KEY
    if (envApiKey) {
      setApiKey(envApiKey)
      setShowApiKeyModal(false)
    } else {
      setShowApiKeyModal(true)
    }
  }, [])

  const handleApiKeySubmit = (key: string) => {
    setApiKey(key)
    setShowApiKeyModal(false)
  }

  const testBackendConnection = async (config: BackendConfig): Promise<boolean> => {
    if (config.type === 'local') return true
    
    console.log('Testing backend connection:', config)
    
    try {
      const params = new URLSearchParams({
        sessionId: sessionId,
        backendType: config.type,
        host: config.host || '',
        username: config.username || '',
        workspace: config.workspace || ''
      })
      
      console.log('Making request to:', `/api/filesystem?${params}`)
      
      // Add timeout to prevent indefinite hanging
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
      
      const response = await fetch(`/api/filesystem?${params}`, {
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      console.log('Response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Response error:', errorText)
        return false
      }
      
      const data = await response.json()
      console.log('Response data:', data)
      return true
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.error('Backend connection test timed out after 10 seconds')
      } else {
        console.error('Backend connection test failed:', error)
      }
      return false
    }
  }
  
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
      
      <Box style={{ 
        height: '100vh', 
        display: 'flex',
        backgroundColor: '#0F172A'
      }}>
        {/* Left Ribbon Bar */}
        <Box
          style={{
            width: '20px',
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 100%)',
            borderRight: '2px solid transparent',
            borderImage: 'linear-gradient(180deg, #228BE6, #A855F7, #F783AC) 1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flexShrink: 0,
            boxShadow: '8px 0 32px rgba(0, 0, 0, 0.3), inset -1px 0 0 rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            position: 'relative',
            overflow: 'visible',
            pointerEvents: 'none'
          }}
        >
          <Box
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'radial-gradient(circle at 50% 20%, rgba(34, 139, 230, 0.05) 0%, transparent 50%), radial-gradient(circle at 50% 80%, rgba(168, 85, 247, 0.05) 0%, transparent 50%)',
              animation: 'headerGlow 8s ease-in-out infinite alternate'
            }}
          />
          
          <Box style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
            <Box
              style={{
                transform: 'rotate(-90deg)',
                transformOrigin: 'center',
                whiteSpace: 'nowrap',
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
                overflow: 'hidden',
                width: '100vh'
              }}
            >
              <Text
                size="xs"
                fw={600}
                style={{
                  backgroundImage: 'linear-gradient(135deg, #228BE6 0%, #A855F7 50%, #F783AC 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontSize: '9px',
                  letterSpacing: '0.1em',
                  animation: 'scrollBanner 30s linear infinite',
                  position: 'absolute'
                }}
              >
✨ BUILD • CODE • DREAM • SHIP • REPEAT ✨ POWERED BY AI • INFINITE POSSIBILITIES • CREATE THE FUTURE ✨ BUILD • CODE • DREAM • SHIP • REPEAT ✨ POWERED BY AI • INFINITE POSSIBILITIES • CREATE THE FUTURE ✨ BUILD • CODE • DREAM • SHIP • REPEAT ✨ POWERED BY AI • INFINITE POSSIBILITIES • CREATE THE FUTURE ✨ BUILD • CODE • DREAM • SHIP • REPEAT ✨ POWERED BY AI • INFINITE POSSIBILITIES • CREATE THE FUTURE ✨ BUILD • CODE • DREAM • SHIP • REPEAT ✨ POWERED BY AI • INFINITE POSSIBILITIES • CREATE THE FUTURE ✨ BUILD • CODE • DREAM • SHIP • REPEAT ✨ POWERED BY AI • INFINITE POSSIBILITIES • CREATE THE FUTURE ✨ BUILD • CODE • DREAM • SHIP • REPEAT ✨ POWERED BY AI • INFINITE POSSIBILITIES • CREATE THE FUTURE ✨
              </Text>
            </Box>
          </Box>
        </Box>

        {/* Main content area */}
        <Box style={{ flex: 1, minHeight: 0, display: 'flex', padding: '24px', gap: '24px', overflow: 'hidden' }}>
          <Box style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <Box style={{ 
              flex: 1,
              minHeight: 0,
              background: 'linear-gradient(135deg, var(--mantine-color-dark-6) 0%, var(--mantine-color-dark-7) 100%)',
              backgroundImage: 'radial-gradient(circle at 30% 70%, rgba(34, 139, 230, 0.05) 0%, transparent 50%)',
              borderRadius: '20px',
              border: '1px solid rgba(34, 139, 230, 0.2)',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.3s ease'
            }}>
              <Tabs 
                value={activeTab} 
                onChange={setActiveTab} 
                style={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column'
                }}
                styles={{
                  list: {
                    backgroundColor: 'var(--mantine-color-dark-5)',
                    borderBottom: '1px solid var(--mantine-color-dark-4)',
                    padding: '0 24px',
                    paddingTop: '8px'
                  },
                  tab: {
                    fontSize: '14px',
                    fontWeight: 500,
                    padding: '12px 20px',
                    '&:hover': {
                      backgroundColor: 'var(--mantine-color-dark-4)'
                    },
                    '&[dataActive]': {
                      backgroundColor: 'var(--mantine-color-blue-9)',
                      color: 'var(--mantine-color-blue-1)'
                    }
                  }
                }}
              >
                <Tabs.List>
                  <Tabs.Tab value="files">Workspace Files</Tabs.Tab>
                  <Tabs.Tab value="sandbox">Component Sandbox</Tabs.Tab>
                  <Tabs.Tab value="config">Backend Config</Tabs.Tab>
                </Tabs.List>

                <Box style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  <Tabs.Panel value="files" style={{ height: '100%', overflow: 'hidden' }}>
                    <FileExplorerTab sessionId={sessionId} backendConfig={backendConfig} />
                  </Tabs.Panel>

                  <Tabs.Panel value="sandbox" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <ComponentSandbox sessionId={sessionId} backendConfig={backendConfig} />
                  </Tabs.Panel>

                  <Tabs.Panel value="config" style={{ height: '100%', overflow: 'auto', padding: '24px' }}>
                    <Box style={{ maxWidth: '800px', margin: '0 auto' }}>
                      <BackendSelector
                        sessionId={sessionId}
                        config={backendConfig}
                        onChange={setBackendConfig}
                        onTestConnection={testBackendConnection}
                      />
                    </Box>
                  </Tabs.Panel>
                </Box>
              </Tabs>
            </Box>
          </Box>

          {/* Chat side panel */}
          <Box 
            style={{ 
              width: '400px',
              flexShrink: 0,
              background: 'linear-gradient(135deg, var(--mantine-color-dark-6) 0%, var(--mantine-color-dark-7) 100%)',
              backgroundImage: 'radial-gradient(circle at 70% 30%, rgba(168, 85, 247, 0.05) 0%, transparent 50%)',
              borderRadius: '20px',
              border: '1px solid rgba(34, 139, 230, 0.2)',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 0.3s ease'
            }}
          >
            <Box 
              p="md" 
              style={{ 
                borderBottom: '1px solid var(--mantine-color-dark-4)',
                backgroundColor: 'var(--mantine-color-dark-5)',
                padding: '16px 24px'
              }}
            >
              <Text 
                size="lg" 
                fw={600}
                c="blue.4"
              >
                🤖 AI Assistant
              </Text>
            </Box>
            <Box style={{ flex: 1, minHeight: 0 }}>
              <Chat sessionId={sessionId} apiKey={apiKey} backendConfig={backendConfig} />
            </Box>
          </Box>
        </Box>

        {/* Right Ribbon Bar */}
        <Box
          style={{
            width: '20px',
            background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 100%)',
            borderLeft: '2px solid transparent',
            borderImage: 'linear-gradient(180deg, #228BE6, #A855F7, #F783AC) 1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flexShrink: 0,
            boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.3), inset 1px 0 0 rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(20px)',
            position: 'relative',
            overflow: 'visible',
            pointerEvents: 'none'
          }}
        >
          <Box
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'radial-gradient(circle at 50% 20%, rgba(34, 139, 230, 0.05) 0%, transparent 50%), radial-gradient(circle at 50% 80%, rgba(168, 85, 247, 0.05) 0%, transparent 50%)',
              animation: 'headerGlow 8s ease-in-out infinite alternate'
            }}
          />
          
          <Box style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
            <Box
              style={{
                transform: 'rotate(90deg)',
                transformOrigin: 'center',
                whiteSpace: 'nowrap',
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                position: 'relative',
                overflow: 'hidden',
                width: '100vh'
              }}
            >
              <Text
                size="xs"
                fw={600}
                style={{
                  backgroundImage: 'linear-gradient(135deg, #228BE6 0%, #A855F7 50%, #F783AC 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontSize: '9px',
                  letterSpacing: '0.1em',
                  animation: 'scrollBannerLeftToRight 30s linear infinite',
                  position: 'absolute'
                }}
              >
✨ BUILD • CODE • DREAM • SHIP • REPEAT ✨ POWERED BY AI • INFINITE POSSIBILITIES • CREATE THE FUTURE ✨ BUILD • CODE • DREAM • SHIP • REPEAT ✨ POWERED BY AI • INFINITE POSSIBILITIES • CREATE THE FUTURE ✨ BUILD • CODE • DREAM • SHIP • REPEAT ✨ POWERED BY AI • INFINITE POSSIBILITIES • CREATE THE FUTURE ✨ BUILD • CODE • DREAM • SHIP • REPEAT ✨ POWERED BY AI • INFINITE POSSIBILITIES • CREATE THE FUTURE ✨ BUILD • CODE • DREAM • SHIP • REPEAT ✨ POWERED BY AI • INFINITE POSSIBILITIES • CREATE THE FUTURE ✨ BUILD • CODE • DREAM • SHIP • REPEAT ✨ POWERED BY AI • INFINITE POSSIBILITIES • CREATE THE FUTURE ✨ BUILD • CODE • DREAM • SHIP • REPEAT ✨ POWERED BY AI • INFINITE POSSIBILITIES • CREATE THE FUTURE ✨
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  )
}