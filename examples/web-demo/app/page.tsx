'use client'

import { Box, Container, Group, Tabs, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import ApiKeyModal from './components/ApiKeyModal'
import BackendSelector, { BackendConfig } from './components/BackendSelector'
import Chat from './components/Chat'
import FileExplorer from './components/FileExplorer'
import FileViewer from './components/FileViewer'
import ComponentSandbox from './components/ComponentSandbox'

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

  const testBackendConnection = async (config: BackendConfig): Promise<boolean> => {
    if (config.type === 'local') return true
    
    console.log('Testing backend connection:', config)
    
    try {
      // Test remote connection by trying to list files with timeout
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
      
      <Box style={{ 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: 'var(--mantine-color-dark-7)'
      }}>
        {/* Header */}
        <Box
          style={{
            height: '72px',
            backgroundColor: 'var(--mantine-color-dark-6)',
            borderBottom: '1px solid var(--mantine-color-dark-4)',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
          }}
        >
          <Container size="xl" style={{ width: '100%', maxWidth: '100%', padding: '0 24px' }}>
            <Group justify="space-between">
              <Text size="xl" fw={700}>
                Codebuff SDK on ConstellationFS Demo
              </Text>
              <Group gap="lg">
                <Text size="sm" c="dimmed" ff="monospace">
                  Session: {sessionId}
                </Text>
                <Text 
                  size="sm" 
                  c={backendConfig.type === 'local' ? 'blue' : 'green'}
                  fw={500}
                >
                  Backend: {backendConfig.type === 'local' ? 'Local' : `Remote (${backendConfig.host})`}
                </Text>
                {apiKey && (
                  <Text size="xs" c="green">
                    API Key: ●●●●●{apiKey.slice(-4)}
                  </Text>
                )}
              </Group>
            </Group>
          </Container>
        </Box>

        {/* Main content area with center content and chat panel */}
        <Box style={{ flex: 1, minHeight: 0, display: 'flex', padding: '24px', gap: '24px', overflow: 'hidden' }}>
          {/* Center content area */}
          <Box style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <Box style={{ 
              flex: 1,
              minHeight: 0,
              backgroundColor: 'var(--mantine-color-dark-6)',
              borderRadius: '12px',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
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
                    padding: '12px 20px'
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

                  <Tabs.Panel value="sandbox" style={{ height: '100%' }}>
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

          {/* Chat side panel on the right */}
          <Box 
            style={{ 
              width: '400px',
              flexShrink: 0,
              backgroundColor: 'var(--mantine-color-dark-6)',
              borderRadius: '12px',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
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
              <Text size="lg" fw={600}>Chat Assistant</Text>
            </Box>
            <Box style={{ flex: 1, minHeight: 0 }}>
              <Chat sessionId={sessionId} apiKey={apiKey} backendConfig={backendConfig} />
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  )
}