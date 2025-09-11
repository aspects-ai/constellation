"use client";

import {
  Box,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
} from "@mantine/core";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant" | "tool_use" | "tool_result";
  content: string;
  toolName?: string;
  params?: any;
  output?: any;
}

interface BackendConfig {
  type: "local" | "remote";
  host?: string;
  username?: string;
  workspace?: string;
}

interface ChatProps {
  sessionId: string;
  apiKey: string | null;
  backendConfig: BackendConfig;
}

// Separate component for expandable tool output
const ToolOutput = ({ output }: { output: any }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!output) return null;

  const outputStr =
    typeof output === "string" ? output : JSON.stringify(output, null, 2);
  
  // Always show the expand button if there's output
  return (
    <Box mt="xs" style={{ fontSize: "0.85em", position: "relative" }}>
      {isExpanded ? (
        <pre
          style={{
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: "400px",
            overflowX: "auto",
            overflowY: "auto",
            maxWidth: "100%",
            backgroundColor: "var(--mantine-color-dark-7)",
            padding: "8px",
            borderRadius: "4px",
          }}
        >
          {outputStr}
        </pre>
      ) : (
        <Box
          style={{
            color: "var(--mantine-color-dimmed)",
            fontSize: "0.9em",
            fontStyle: "italic",
          }}
        >
          Output available
        </Box>
      )}
      <Box
        style={{
          marginTop: "8px",
        }}
      >
        <Text
          size="xs"
          c="blue.4"
          style={{
            cursor: "pointer",
            userSelect: "none",
            opacity: 0.9,
            transition: "opacity 0.2s",
            "&:hover": {
              opacity: 1,
            },
          }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? "⬆ Hide output" : "⬇ Show output"}
        </Text>
      </Box>
    </Box>
  );
};

ToolOutput.displayName = 'ToolOutput';

// Message component
const MessageComponent = ({ message }: { message: Message }) => {
  const renderToolParams = useCallback((params: any) => {
    if (!params || Object.keys(params).length === 0) return null;

    return (
      <Box mt="xs" style={{ fontSize: "0.85em", opacity: 0.8 }}>
        {Object.entries(params).map(([key, value]) => (
          <div key={key}>
            <Text span fw={600}>
              {key}:
            </Text>{" "}
            {JSON.stringify(value, null, 2)}
          </div>
        ))}
      </Box>
    );
  }, []);

  // Tool messages
  if (message.role === "tool_use" || message.role === "tool_result") {
    return (
      <Box
        p="md"
        style={{
          backgroundColor: "var(--mantine-color-dark-6)",
          borderLeft:
            message.role === "tool_use"
              ? "4px solid var(--mantine-color-blue-5)"
              : "4px solid var(--mantine-color-green-5)",
          borderRadius: "12px",
          fontFamily: "monospace",
          fontSize: "0.9em",
          opacity: 0.95,
          border: "1px solid var(--mantine-color-dark-4)",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
        }}
      >
        <Text
          size="xs"
          fw={600}
          c={message.role === "tool_use" ? "blue.4" : "green.4"}
        >
          {message.role === "tool_use" ? "🔧 Tool Use" : "✓ Tool Result"}: {message.toolName}
        </Text>
        {message.role === "tool_use" && renderToolParams(message.params)}
        {message.role === "tool_result" && <ToolOutput output={message.output} />}
      </Box>
    );
  }

  // Regular messages
  return (
    <Paper
      p="lg"
      radius="xl"
      shadow="md"
      style={{
        backgroundColor:
          message.role === "user"
            ? "var(--mantine-color-blue-6)"
            : "var(--mantine-color-gray-8)",
        alignSelf: message.role === "user" ? "flex-end" : "flex-start",
        maxWidth: "85%",
        minWidth: 0,
        overflowWrap: "break-word",
        wordBreak: "break-word",
        border:
          message.role === "user"
            ? "1px solid rgba(34, 139, 230, 0.3)"
            : "1px solid rgba(75, 85, 99, 0.3)",
      }}
    >
      {message.role === "assistant" ? (
        <Box
          style={{
            overflowWrap: "break-word",
            wordBreak: "break-word",
            minWidth: 0,
            "& code": {
              backgroundColor: "var(--mantine-color-dark-7)",
              padding: "2px 4px",
              borderRadius: "4px",
              fontSize: "0.9em",
              overflowWrap: "break-word",
              wordBreak: "break-all",
            },
            "& pre": {
              backgroundColor: "var(--mantine-color-dark-7)",
              padding: "16px",
              borderRadius: "8px",
              overflowX: "auto",
              maxWidth: "100%",
            },
            "& pre code": {
              backgroundColor: "transparent",
              padding: 0,
              overflowWrap: "normal",
              wordBreak: "normal",
            },
          }}
        >
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </Box>
      ) : (
        <Text
          size="sm"
          style={{
            overflowWrap: "break-word",
            wordBreak: "break-word",
          }}
        >
          {message.content}
        </Text>
      )}
    </Paper>
  );
};

MessageComponent.displayName = 'MessageComponent';

export default function Chat({ sessionId, apiKey, backendConfig }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentResponse, setCurrentResponse] = useState("");
  const [streamError, setStreamError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageEndProcessed = useRef(false);
  // Immediate scroll without debouncing
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Optimized message addition with deduplication
  const addMessageWithDuplicateCheck = useCallback((newMessage: Message) => {
    // Don't add empty messages
    if (!newMessage.content?.trim() && newMessage.role !== "tool_use" && newMessage.role !== "tool_result") {
      return;
    }
    
    setMessages((prev) => {
      const isDuplicate = prev.some((msg) => msg.id === newMessage.id);
      if (isDuplicate) return prev;
      return [...prev, newMessage];
    });
  }, []);

  // Only scroll when new messages are added
  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading || !apiKey) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    addMessageWithDuplicateCheck(userMessage);
    setInput("");
    setIsLoading(true);
    setCurrentResponse("");

    try {
      const requestBody = {
        message: userMessage.content,
        sessionId,
        apiKey,
        backendConfig,
      };

      const response = await fetch("/api/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        console.error("[Chat] API error:", errorData);
        throw new Error(errorData.error || "Failed to send message");
      }

      const eventSource = new EventSource(`/api/stream?sessionId=${sessionId}`);

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "message_start") {
          setCurrentResponse("");
          messageEndProcessed.current = false;
        } else if (data.type === "assistant_delta") {
          setCurrentResponse((prev) => prev + data.text);
        } else if (data.type === "assistant_message") {
          const assistantMessage: Message = {
            id: data.id,
            role: "assistant",
            content: data.text,
          };
          addMessageWithDuplicateCheck(assistantMessage);
        } else if (data.type === "tool_use") {
          const toolUseMessage: Message = {
            id: data.id,
            role: "tool_use",
            content: `Using ${data.toolName} tool`,
            toolName: data.toolName,
            params: data.params,
          };
          addMessageWithDuplicateCheck(toolUseMessage);
        } else if (data.type === "tool_result") {
          const asyncTools = ['write_file', 'update_subgoal', 'add_subgoal', 'str_replace'];
          const hasEmptyOutput = !data.output || 
            (typeof data.output === 'object' && Object.keys(data.output).length === 0) ||
            (typeof data.output === 'string' && data.output.trim() === '');
          
          const shouldShowResult = !(asyncTools.includes(data.toolName || '') && hasEmptyOutput);
          
          if (shouldShowResult) {
            const toolResultMessage: Message = {
              id: data.id + '_result',
              role: "tool_result",
              content: `Tool result from ${data.toolName}`,
              toolName: data.toolName,
              output: data.output,
            };
            addMessageWithDuplicateCheck(toolResultMessage);
          }
          
          const fileTools = ['write_file', 'str_replace', 'edit_file', 'create_file'];
          if (fileTools.includes(data.toolName || '')) {
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent("filesystem-update"));
            }, 100);
          }
        } else if (data.type === "message_end") {
          if (messageEndProcessed.current) return;
          messageEndProcessed.current = true;

          setCurrentResponse((currentContent) => {
            if (currentContent.trim()) {
              const newMessage: Message = {
                id: data.id || Date.now().toString(),
                role: "assistant",
                content: currentContent,
              };
              addMessageWithDuplicateCheck(newMessage);
            }
            return "";
          });
        } else if (data.type === "done") {
          setIsLoading(false);
          setStreamError(null);
          eventSource.close();
          window.dispatchEvent(new CustomEvent("filesystem-update"));
        } else if (data.type === "error") {
          console.error("Stream error:", data.message);
          setStreamError(data.message);
          setIsLoading(false);
          eventSource.close();
          
          // Add error message to chat
          const errorMessage: Message = {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: `⚠️ **Error:** ${data.message}\n\nPlease check your API key or account status.`,
          };
          addMessageWithDuplicateCheck(errorMessage);
        }
      };

      eventSource.onerror = (error) => {
        console.error("[Chat] EventSource error:", error);
        setIsLoading(false);
        eventSource.close();
      };
    } catch (error) {
      console.error("Failed to send message:", error);
      setIsLoading(false);
    }
  }, [input, isLoading, apiKey, sessionId, backendConfig, addMessageWithDuplicateCheck]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  // Filter out empty messages
  const filteredMessages = messages.filter(msg => 
    msg.content?.trim() || msg.role === "tool_use" || msg.role === "tool_result"
  );

  return (
    <Box h="100%" style={{ display: "flex", flexDirection: "column" }}>
      <ScrollArea
        flex={1}
        p="lg"
        style={{
          backgroundColor: "var(--mantine-color-dark-6)",
          backgroundImage:
            "radial-gradient(circle at 20% 80%, rgba(34, 139, 230, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(168, 85, 247, 0.05) 0%, transparent 50%)",
        }}
      >
        <Stack gap="md">
          {filteredMessages.map((message) => (
            <MessageComponent key={message.id} message={message} />
          ))}

          {isLoading && currentResponse && (
            <Paper
              p="lg"
              radius="xl"
              shadow="md"
              style={{
                backgroundColor: "var(--mantine-color-gray-8)",
                alignSelf: "flex-start",
                maxWidth: "85%",
                minWidth: 0,
                overflowWrap: "break-word",
                wordBreak: "break-word",
                border: "1px solid rgba(75, 85, 99, 0.3)",
              }}
            >
              <Group gap="xs" align="flex-start">
                <Box
                  flex={1}
                  style={{
                    minWidth: 0,
                    overflowWrap: "break-word",
                    wordBreak: "break-word",
                  }}
                >
                  <ReactMarkdown>{currentResponse}</ReactMarkdown>
                </Box>
                <Loader size="xs" />
              </Group>
            </Paper>
          )}
          <div ref={messagesEndRef} />
        </Stack>
      </ScrollArea>

      <Box
        p="lg"
        style={{
          borderTop: "1px solid var(--mantine-color-dark-4)",
          background:
            "linear-gradient(135deg, var(--mantine-color-dark-5) 0%, var(--mantine-color-dark-6) 100%)",
          boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.15)",
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder={
            apiKey
              ? "Let's start building!"
              : "Please enter your API key to start chatting"
          }
          disabled={isLoading || !apiKey}
          autosize
          minRows={1}
          maxRows={8}
          styles={{
            input: {
              backgroundColor: "var(--mantine-color-dark-7)",
              border: "2px solid var(--mantine-color-dark-4)",
              borderRadius: "12px",
              padding: "16px 20px",
              fontSize: "16px",
              lineHeight: "1.5",
              resize: "none",
              transition: "all 0.2s ease",
              "&:focus": {
                borderColor: "var(--mantine-color-blue-5)",
                boxShadow:
                  "0 0 0 3px rgba(34, 139, 230, 0.1), 0 4px 20px rgba(0, 0, 0, 0.15)",
                transform: "translateY(-1px)",
              },
              "&:hover:not(:disabled)": {
                borderColor: "var(--mantine-color-dark-3)",
                transform: "translateY(-1px)",
                boxShadow: "0 2px 12px rgba(0, 0, 0, 0.1)",
              },
              "&::placeholder": {
                color: "var(--mantine-color-dark-2)",
                fontSize: "15px",
              },
            },
          }}
        />
        
        {apiKey && (
          <Text
            size="xs"
            c="dimmed"
            mt="sm"
            ta="center"
            style={{ opacity: 0.7 }}
          >
            Press Enter to send • Shift+Enter for new line
          </Text>
        )}
      </Box>
    </Box>
  );
}
