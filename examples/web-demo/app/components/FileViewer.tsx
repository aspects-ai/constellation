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

  if (!selectedFile) {
    return (
      <Box 
        flex={1} 
        p="md" 
        style={{ 
          backgroundColor: 'var(--mantine-color-dark-8)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Text fw={600} size="lg" mb="md">File Viewer</Text>
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
      flex={1} 
      p="md" 
      style={{ 
        backgroundColor: 'var(--mantine-color-dark-8)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box mb="md">
        <Text fw={600} size="lg">File Viewer</Text>
        <Text size="sm" c="dimmed" ff="monospace">
          {selectedFile}
        </Text>
      </Box>
      
      <ScrollArea flex={1}>
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
        ) : (
          <CodeHighlight
            code={fileContent}
            language={getFileLanguage(selectedFile)}
            style={{ fontSize: '0.9em' }}
          />
        )}
      </ScrollArea>
    </Box>
  )
}