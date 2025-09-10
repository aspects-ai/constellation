'use client'

import { useState, useEffect } from 'react'
import { 
  Box, 
  Text, 
  ScrollArea, 
  Center, 
  Loader,
  Alert
} from '@mantine/core'
import { CodeHighlight } from '@mantine/code-highlight'
import { IconAlertCircle, IconFile } from '@tabler/icons-react'
import ReactMarkdown from 'react-markdown'

interface BackendConfig {
  type: 'local' | 'remote'
  host?: string
  username?: string
  workspace?: string
}

interface FileViewerProps {
  sessionId: string
  selectedFile: string | null
  backendConfig: BackendConfig
}

export default function FileViewer({ sessionId, selectedFile, backendConfig }: FileViewerProps) {
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
        const params = new URLSearchParams({
          sessionId: sessionId,
          filePath: selectedFile,
          backendType: backendConfig.type
        })
        
        // Add remote backend parameters if needed
        if (backendConfig.type === 'remote') {
          if (backendConfig.host) params.append('host', backendConfig.host)
          if (backendConfig.username) params.append('username', backendConfig.username)
          if (backendConfig.workspace) params.append('workspace', backendConfig.workspace)
        }
        
        const response = await fetch(`/api/file-content?${params}`)
        
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
  }, [sessionId, selectedFile, backendConfig])

  const getFileLanguage = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'js': case 'jsx': return 'javascript'
      case 'ts': case 'tsx': return 'typescript'
      case 'py': return 'python'
      case 'java': return 'java'
      case 'cpp': case 'cc': case 'cxx': return 'cpp'
      case 'c': return 'c'
      case 'cs': return 'csharp'
      case 'go': return 'go'
      case 'rs': return 'rust'
      case 'php': return 'php'
      case 'rb': return 'ruby'
      case 'html': return 'html'
      case 'css': return 'css'
      case 'scss': case 'sass': return 'scss'
      case 'json': return 'json'
      case 'xml': return 'xml'
      case 'yaml': case 'yml': return 'yaml'
      case 'md': return 'markdown'
      case 'sh': case 'bash': return 'bash'
      case 'sql': return 'sql'
      default: return 'text'
    }
  }

  const isMarkdownFile = (filename: string): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase()
    return ext === 'md' || ext === 'markdown'
  }

  if (!selectedFile) {
    return (
      <Box 
        style={{ 
          flex: 1,
          minWidth: 0,
          padding: '16px',
          backgroundColor: 'var(--mantine-color-dark-7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <Text fw={700} size="lg" mb="md">File Viewer</Text>
        <Center flex={1}>
          <Box ta="center">
            <IconFile size={48} color="var(--mantine-color-gray-5)" />
            <Text size="sm" c="dimmed" mt="md">
              Select a file to view its contents
            </Text>
          </Box>
        </Center>
      </Box>
    )
  }

  return (
    <Box 
      style={{ 
        flex: 1,
        minWidth: 0,
        padding: '16px',
        backgroundColor: 'var(--mantine-color-dark-7)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <Box mb="md" pb="sm" style={{ borderBottom: '1px solid var(--mantine-color-dark-5)', flexShrink: 0 }}>
        <Text fw={700} size="lg">File Viewer</Text>
        <Text size="sm" c="dimmed" ff="monospace" style={{ 
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {selectedFile}
        </Text>
      </Box>
      
      <ScrollArea style={{ flex: 1, minHeight: 0 }} styles={{
        viewport: {
          paddingRight: '12px'
        }
      }}>
        {isLoading ? (
          <Center p="xl">
            <Loader size="md" />
          </Center>
        ) : error ? (
          <Alert 
            icon={<IconAlertCircle size={16} />} 
            color="red" 
            variant="light"
          >
            {error}
          </Alert>
        ) : isMarkdownFile(selectedFile) ? (
          <Box 
            style={{ 
              backgroundColor: 'var(--mantine-color-dark-8)',
              borderRadius: '8px',
              padding: '24px',
              border: '1px solid var(--mantine-color-dark-5)',
              color: 'var(--mantine-color-gray-2)',
              '& h1': {
                fontSize: '2em',
                fontWeight: 700,
                marginBottom: '16px',
                color: 'var(--mantine-color-gray-0)',
                borderBottom: '2px solid var(--mantine-color-dark-4)',
                paddingBottom: '8px'
              },
              '& h2': {
                fontSize: '1.5em',
                fontWeight: 600,
                marginTop: '24px',
                marginBottom: '12px',
                color: 'var(--mantine-color-gray-0)'
              },
              '& h3': {
                fontSize: '1.25em',
                fontWeight: 600,
                marginTop: '20px',
                marginBottom: '10px',
                color: 'var(--mantine-color-gray-1)'
              },
              '& p': {
                marginBottom: '12px',
                lineHeight: 1.7
              },
              '& ul, & ol': {
                marginBottom: '12px',
                paddingLeft: '24px'
              },
              '& li': {
                marginBottom: '4px',
                lineHeight: 1.6
              },
              '& code': {
                backgroundColor: 'var(--mantine-color-dark-6)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '0.9em',
                color: 'var(--mantine-color-blue-3)'
              },
              '& pre': {
                backgroundColor: 'var(--mantine-color-dark-7)',
                padding: '16px',
                borderRadius: '8px',
                overflow: 'auto',
                marginBottom: '16px'
              },
              '& pre code': {
                backgroundColor: 'transparent',
                padding: 0,
                color: 'var(--mantine-color-gray-2)'
              },
              '& blockquote': {
                borderLeft: '4px solid var(--mantine-color-blue-5)',
                paddingLeft: '16px',
                marginLeft: 0,
                marginBottom: '16px',
                color: 'var(--mantine-color-gray-3)',
                fontStyle: 'italic'
              },
              '& a': {
                color: 'var(--mantine-color-blue-4)',
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline'
                }
              },
              '& table': {
                width: '100%',
                marginBottom: '16px',
                borderCollapse: 'collapse'
              },
              '& th, & td': {
                padding: '8px 12px',
                border: '1px solid var(--mantine-color-dark-4)',
                textAlign: 'left'
              },
              '& th': {
                backgroundColor: 'var(--mantine-color-dark-6)',
                fontWeight: 600
              },
              '& hr': {
                border: 'none',
                height: '1px',
                backgroundColor: 'var(--mantine-color-dark-4)',
                margin: '24px 0'
              }
            }}
          >
            <ReactMarkdown>{fileContent}</ReactMarkdown>
          </Box>
        ) : (
          <Box style={{ 
            backgroundColor: 'var(--mantine-color-dark-8)',
            borderRadius: '8px',
            padding: '16px',
            border: '1px solid var(--mantine-color-dark-5)'
          }}>
            <CodeHighlight
              code={fileContent}
              language={getFileLanguage(selectedFile)}
              style={{ fontSize: '0.95em', lineHeight: 1.6 }}
            />
          </Box>
        )}
      </ScrollArea>
    </Box>
  )
}