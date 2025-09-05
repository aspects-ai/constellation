'use client'

import {
  Box,
  Button,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  TextInput
} from '@mantine/core'
import { IconSend } from '@tabler/icons-react'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool_use' | 'tool_result'
  content: string
  toolName?: string
  params?: any
  output?: any
}

interface BackendConfig {
  type: 'local' | 'remote'
  host?: string
  username?: string
  workspace?: string
}

interface ChatProps {
  sessionId: string
  apiKey: string | null
  backendConfig: BackendConfig
}

export default function Chat({ sessionId, apiKey, backendConfig }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentResponse, setCurrentResponse] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messageEndProcessed = useRef(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Simple ID-based duplicate prevention
  const addMessageWithDuplicateCheck = (newMessage: Message) => {
    setMessages(prev => {
      // Simple ID check - much cleaner!
      const isDuplicate = prev.some(msg => msg.id === newMessage.id)
      if (isDuplicate) return prev
      return [...prev, newMessage]
    })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, currentResponse])

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !apiKey) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    }

    addMessageWithDuplicateCheck(userMessage)
    setInput('')
    setIsLoading(true)
    setCurrentResponse('')

    try {
      // Prepare request body
      const requestBody = {
        message: userMessage.content,
        sessionId,
        apiKey,
        backendConfig,
      }
      
      // Send message to API with user's API key
      const response = await fetch('/api/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('[Chat] API error:', errorData)
        throw new Error(errorData.error || 'Failed to send message')
      }

      // Start listening to the stream
      const eventSource = new EventSource(`/api/stream?sessionId=${sessionId}`)
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
        if (data.type === 'message_start') {
          setCurrentResponse('')
          messageEndProcessed.current = false
        } else if (data.type === 'assistant_delta') {
          // Accumulate chunks for streaming messages
          setCurrentResponse(prev => prev + data.text)
        } else if (data.type === 'assistant_message') {
          // Complete text message - add immediately and interleaved
          const assistantMessage: Message = {
            id: data.id,
            role: 'assistant',
            content: data.text
          }
          addMessageWithDuplicateCheck(assistantMessage)
        } else if (data.type === 'tool_use') {
          const toolUseMessage: Message = {
            id: data.id, // Use ID from backend
            role: 'tool_use',
            content: `Using ${data.toolName} tool`,
            toolName: data.toolName,
            params: data.params
          }
          addMessageWithDuplicateCheck(toolUseMessage)
        } else if (data.type === 'tool_result') {
          const toolResultMessage: Message = {
            id: data.id, // Use ID from backend
            role: 'tool_result',
            content: `Tool result from ${data.toolName}`,
            toolName: data.toolName,
            output: data.output
          }
          addMessageWithDuplicateCheck(toolResultMessage)
        } else if (data.type === 'message_end') {
          // Finalize any remaining streaming content
          if (messageEndProcessed.current) return
          messageEndProcessed.current = true
          
          setCurrentResponse(currentContent => {
            if (currentContent.trim()) {
              const newMessage: Message = {
                id: data.id || Date.now().toString(),
                role: 'assistant',
                content: currentContent
              }
              addMessageWithDuplicateCheck(newMessage)
            }
            return ''
          })
        } else if (data.type === 'done') {
          setIsLoading(false)
          eventSource.close()
          
          // Trigger filesystem refresh
          window.dispatchEvent(new CustomEvent('filesystem-update'))
        } else if (data.type === 'error') {
          console.error('Stream error:', data.message)
          setIsLoading(false)
          eventSource.close()
        }
      }

      eventSource.onerror = (error) => {
        console.error('[Chat] EventSource error:', error)
        setIsLoading(false)
        eventSource.close()
      }

    } catch (error) {
      console.error('Failed to send message:', error)
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const renderToolParams = (params: any) => {
    if (!params || Object.keys(params).length === 0) return null
    
    return (
      <Box mt="xs" style={{ fontSize: '0.85em', opacity: 0.8 }}>
        {Object.entries(params).map(([key, value]) => (
          <div key={key}>
            <Text span fw={600}>{key}:</Text> {JSON.stringify(value, null, 2)}
          </div>
        ))}
      </Box>
    )
  }
  
  const renderToolOutput = (output: any) => {
    if (!output) return null
    
    const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2)
    const lines = outputStr.split('\n').slice(0, 10) // Show first 10 lines
    const truncated = outputStr.split('\n').length > 10
    
    return (
      <Box mt="xs" style={{ fontSize: '0.85em' }}>
        <pre style={{ 
          margin: 0, 
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: '200px',
          overflow: 'auto'
        }}>
          {lines.join('\n')}
          {truncated && '\n...truncated'}
        </pre>
      </Box>
    )
  }

  return (
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      <ScrollArea flex={1} p="md">
        <Stack gap="md">
          {messages.map((message) => {
            // Tool messages get system-style rendering
            if (message.role === 'tool_use' || message.role === 'tool_result') {
              return (
                <Box
                  key={message.id}
                  p="sm"
                  style={{
                    backgroundColor: 'var(--mantine-color-dark-6)',
                    borderLeft: message.role === 'tool_use' 
                      ? '3px solid var(--mantine-color-blue-5)' 
                      : '3px solid var(--mantine-color-green-5)',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '0.9em',
                    opacity: 0.9
                  }}
                >
                  <Text size="xs" fw={600} c={message.role === 'tool_use' ? 'blue.4' : 'green.4'}>
                    {message.role === 'tool_use' ? '🔧 Tool Use' : '✓ Tool Result'}: {message.toolName}
                  </Text>
                  {message.role === 'tool_use' && renderToolParams(message.params)}
                  {message.role === 'tool_result' && renderToolOutput(message.output)}
                </Box>
              )
            }
            
            // Regular user/assistant messages
            return (
              <Paper
                key={message.id}
                p="md"
                radius="md"
                shadow="xs"
                style={{
                  backgroundColor: message.role === 'user' 
                    ? 'var(--mantine-color-blue-6)' 
                    : 'var(--mantine-color-gray-8)',
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '80%'
                }}
              >
                {message.role === 'assistant' ? (
                  <Box 
                    style={{ 
                      '& code': { 
                        backgroundColor: 'var(--mantine-color-dark-7)',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        fontSize: '0.9em'
                      },
                      '& pre': {
                        backgroundColor: 'var(--mantine-color-dark-7)',
                        padding: '16px',
                        borderRadius: '8px',
                        overflow: 'auto'
                      },
                      '& pre code': {
                        backgroundColor: 'transparent',
                        padding: 0
                      }
                    }}
                  >
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </Box>
                ) : (
                  <Text size="sm">
                    {message.content}
                  </Text>
                )}
              </Paper>
            )
          })}
          
          {isLoading && currentResponse && (
            <Paper
              p="md"
              radius="md"
              shadow="xs"
              style={{
                backgroundColor: 'var(--mantine-color-gray-8)',
                alignSelf: 'flex-start',
                maxWidth: '80%',
              }}
            >
              <Group gap="xs" align="flex-start">
                <Box flex={1}>
                  <ReactMarkdown>{currentResponse}</ReactMarkdown>
                </Box>
                <Loader size="xs" />
              </Group>
            </Paper>
          )}
          <div ref={messagesEndRef} />
        </Stack>
      </ScrollArea>
      
      <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}>
        <Group gap="md">
          <TextInput
            flex={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={apiKey ? "Ask me to help with your project..." : "Please enter your API key to start chatting"}
            disabled={isLoading || !apiKey}
            size="md"
          />
          <Button
            onClick={sendMessage}
            disabled={isLoading || !input.trim() || !apiKey}
            loading={isLoading}
            leftSection={<IconSend size={16} />}
            size="md"
          >
            {isLoading ? 'Sending' : 'Send'}
          </Button>
        </Group>
      </Box>
    </Box>
  )
}