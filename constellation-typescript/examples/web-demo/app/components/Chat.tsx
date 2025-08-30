'use client'

import { useEffect, useRef, useState } from 'react'
import { 
  Box, 
  TextInput, 
  Button, 
  Stack, 
  ScrollArea, 
  Paper, 
  Text, 
  Loader,
  Group
} from '@mantine/core'
import { IconSend } from '@tabler/icons-react'
import ReactMarkdown from 'react-markdown'

interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
}

interface ChatProps {
  sessionId: string
  apiKey: string | null
}

export default function Chat({ sessionId, apiKey }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentResponse, setCurrentResponse] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setCurrentResponse('')

    try {
      // Send message to API with user's API key
      const response = await fetch('/api/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId,
          apiKey,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      // Start listening to the stream
      const eventSource = new EventSource(`/api/stream?sessionId=${sessionId}`)
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
        if (data.type === 'message_start') {
          // Start a new message
          setCurrentResponse('')
        } else if (data.type === 'content') {
          setCurrentResponse(prev => prev + data.text)
        } else if (data.type === 'message_end') {
          // Finalize the current message
          setCurrentResponse(streamedContent => {
            if (streamedContent.trim()) {
              const newMessage: Message = {
                id: Date.now().toString(),
                role: data.role || 'assistant',
                content: streamedContent
              }
              setMessages(prev => {
                // Check if we already have this message to prevent duplicates
                const isDuplicate = prev.some(msg => 
                  msg.role === newMessage.role && msg.content === streamedContent
                )
                if (isDuplicate) {
                  return prev
                }
                return [...prev, newMessage]
              })
            }
            return '' // Clear for next message
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

  const getMessageColor = (role: string) => {
    switch (role) {
      case 'user': return 'blue'
      case 'assistant': return 'gray'
      case 'tool': return 'green'
      default: return 'gray'
    }
  }

  return (
    <Box h="100%" style={{ display: 'flex', flexDirection: 'column' }}>
      <ScrollArea flex={1} p="md">
        <Stack gap="md">
          {messages.map((message) => (
            <Paper
              key={message.id}
              p="md"
              radius="md"
              style={{
                backgroundColor: `var(--mantine-color-${getMessageColor(message.role)}-9)`,
                alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                borderLeft: message.role === 'tool' 
                  ? '4px solid var(--mantine-color-green-5)' 
                  : undefined
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
                <Text 
                  size="sm" 
                  ff={message.role === 'tool' ? 'monospace' : undefined}
                >
                  {message.content}
                </Text>
              )}
            </Paper>
          ))}
          
          {isLoading && currentResponse && (
            <Paper
              p="md"
              radius="md"
              style={{
                backgroundColor: 'var(--mantine-color-gray-9)',
                alignSelf: 'flex-start',
                maxWidth: '80%',
              }}
            >
              <Group gap="xs">
                <ReactMarkdown>{currentResponse}</ReactMarkdown>
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