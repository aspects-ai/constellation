'use client'

import { useEffect, useRef, useState } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatProps {
  sessionId: string
}

export default function Chat({ sessionId }: ChatProps) {
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
    if (!input.trim() || isLoading) return

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
      // Send message to API
      const response = await fetch('/api/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      // Start listening to the stream
      const eventSource = new EventSource(`/api/stream?sessionId=${sessionId}`)
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
        if (data.type === 'content') {
          setCurrentResponse(prev => prev + data.text)
        } else if (data.type === 'done') {
          // Move the streaming response to permanent messages
          // Use a ref to prevent duplicate calls in strict mode
          let hasProcessed = false
          setCurrentResponse(streamedContent => {
            if (hasProcessed) {
              return ''
            }
            hasProcessed = true
            
            // Add the complete streamed message to permanent messages
            if (streamedContent.trim()) {
              const assistantMessage: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: streamedContent
              }
              setMessages(prev => {
                // Check if we already have this message to prevent duplicates
                const isDuplicate = prev.some(msg => 
                  msg.role === 'assistant' && msg.content === streamedContent
                )
                if (isDuplicate) {
                  return prev
                }
                return [...prev, assistantMessage]
              })
            }
            return '' // Clear the streaming preview
          })
          
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

  return (
    <div className="chat-area">
      <div className="messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            {message.content}
          </div>
        ))}
        {isLoading && currentResponse && (
          <div className="message assistant">
            {currentResponse}
            <span className="cursor">▋</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="input-area">
        <div className="input-container">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me to help with your project..."
            className="message-input"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="send-button"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}