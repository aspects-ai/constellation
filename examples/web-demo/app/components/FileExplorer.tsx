'use client'

import {
  ActionIcon,
  Box,
  Button,
  Center,
  FileInput,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Text
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconDownload, IconFile, IconFolder, IconRefresh, IconUpload } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'

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
  const fileInputRef = useRef<HTMLButtonElement>(null)

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

  const handleUpload = async (file: File | null) => {
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('sessionId', sessionId)

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        notifications.show({
          title: 'Upload successful',
          message: `File "${file.name}" uploaded successfully`,
          color: 'green'
        })
        await fetchFileSystem() // Refresh the file list
      } else {
        const errorText = await response.text()
        notifications.show({
          title: 'Upload failed',
          message: errorText,
          color: 'red'
        })
      }
    } catch (error) {
      notifications.show({
        title: 'Upload error',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red'
      })
    }
  }

  const handleDownload = async (filePath: string) => {
    try {
      const response = await fetch(`/api/download?sessionId=${sessionId}&file=${encodeURIComponent(filePath)}`)
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filePath.split('/').pop() || 'download'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        notifications.show({
          title: 'Download started',
          message: `Downloading ${filePath.split('/').pop()}`,
          color: 'green'
        })
      } else {
        const errorText = await response.text()
        notifications.show({
          title: 'Download failed',
          message: errorText,
          color: 'red'
        })
      }
    } catch (error) {
      notifications.show({
        title: 'Download error',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red'
      })
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
      <Group 
        key={item.path} 
        justify="space-between"
        p="xs"
        style={{
          cursor: item.type === 'file' ? 'pointer' : 'default',
          backgroundColor: item.type === 'file' && selectedFile === item.path 
            ? 'var(--mantine-color-blue-9)' 
            : undefined,
          borderRadius: 'var(--mantine-radius-sm)',
          ':hover': {
            backgroundColor: 'var(--mantine-color-dark-6)'
          }
        }}
      >
        <Group gap="xs" onClick={() => handleFileClick(item)}>
          {item.type === 'directory' ? 
            <IconFolder size={16} color="var(--mantine-color-yellow-5)" /> : 
            <IconFile size={16} color="var(--mantine-color-blue-5)" />
          }
          <Text size="sm">
            {prefix}{item.name}{item.type === 'directory' && '/'}
          </Text>
        </Group>
        {item.type === 'file' && (
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              handleDownload(item.path)
            }}
          >
            <IconDownload size={14} />
          </ActionIcon>
        )}
      </Group>
    ))
  }

  return (
    <Box 
      w={300} 
      h="100%" 
      p="md" 
      style={{ 
        borderRight: '1px solid var(--mantine-color-dark-4)',
        backgroundColor: 'var(--mantine-color-dark-7)'
      }}
    >
      <Stack gap="md" h="100%">
        <Group justify="space-between">
          <Text fw={600} size="lg">Workspace Files</Text>
          <Group gap="xs">
            <FileInput
              placeholder=""
              size="xs"
              style={{ display: 'none' }}
              onChange={handleUpload}
              accept="*"
              ref={fileInputRef as React.RefObject<HTMLButtonElement>}
            />
            <Button 
              size="xs" 
              variant="light" 
              leftSection={<IconUpload size={14} />}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload
            </Button>
            <ActionIcon 
              variant="light" 
              size="sm"
              onClick={fetchFileSystem}
              loading={isLoading}
            >
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>
        </Group>

        <ScrollArea flex={1}>
          <Stack gap="xs">
            {isLoading ? (
              <Center p="xl">
                <Loader size="sm" />
              </Center>
            ) : files.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" p="xl">
                No files yet. Start by asking the AI to create something!
              </Text>
            ) : (
              renderFileTree(files)
            )}
          </Stack>
        </ScrollArea>
      </Stack>
    </Box>
  )
}