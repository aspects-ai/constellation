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
            backgroundColor: "rgba(10, 15, 30, 0.8)",
            padding: "12px",
            borderRadius: "6px",
            border: "1px solid rgba(34, 139, 230, 0.15)",
            fontFamily: "'SF Mono', Monaco, 'Cascadia Code', monospace",
            fontSize: "12px",
            color: "rgba(148, 163, 184, 0.9)",
          }}
        >
          {outputStr}
        </pre>
      ) : (
        <Box
          style={{
            color: "rgba(148, 163, 184, 0.6)",
            fontSize: "0.9em",
            fontFamily: "monospace",
            letterSpacing: "0.05em",
          }}
        >
          [OUTPUT CACHED]
        </Box>
      )}
      <Box
        style={{
          marginTop: "8px",
        }}
      >
        <Text
          size="xs"
          style={{
            cursor: "pointer",
            userSelect: "none",
            opacity: 0.8,
            transition: "all 0.2s",
            color: "#60A5FA",
            fontFamily: "monospace",
            letterSpacing: "0.05em",
            fontSize: "11px",
            display: "inline-block",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.color = "#93C5FD";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0.8";
            e.currentTarget.style.color = "#60A5FA";
          }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? "[↑ COLLAPSE]" : "[↓ EXPAND]"}
        </Text>
      </Box>
    </Box>
  );
};

ToolOutput.displayName = "ToolOutput";

// Message component
const MessageComponent = ({ message }: { message: Message }) => {
  const renderToolParams = useCallback((params: any) => {
    if (!params || Object.keys(params).length === 0) return null;

    return (
      <Box mt="xs" style={{ fontSize: "0.85em", opacity: 0.9 }}>
        {Object.entries(params).map(([key, value]) => (
          <div key={key} style={{ marginBottom: "4px" }}>
            <Text span fw={500} style={{ color: "#A78BFA" }}>
              {key}:
            </Text>{" "}
            <span style={{ color: "var(--mantine-color-gray-4)" }}>
              {JSON.stringify(value, null, 2)}
            </span>
          </div>
        ))}
      </Box>
    );
  }, []);

  // Tool messages
  if (message.role === "tool_use" || message.role === "tool_result") {
    return (
      <Box
        className="tool-message"
        p="md"
        style={{
          backgroundColor: "rgba(15, 23, 42, 0.8)",
          borderLeft:
            message.role === "tool_use"
              ? "3px solid #228BE6"
              : "3px solid #10B981",
          borderRadius: "8px",
          fontSize: "0.9em",
          border: "1px solid rgba(34, 139, 230, 0.2)",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
          position: "relative",
        }}
      >
        <Text
          size="xs"
          fw={600}
          style={{
            color: message.role === "tool_use" ? "#60A5FA" : "#34D399",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {message.role === "tool_use" ? "[EXEC]" : "[RESULT]"}{" "}
          {message.toolName}
        </Text>
        {message.role === "tool_use" && renderToolParams(message.params)}
        {message.role === "tool_result" && (
          <ToolOutput output={message.output} />
        )}
      </Box>
    );
  }

  // Regular messages
  return (
    <Box
      className={message.role === "user" ? "user-message" : "assistant-message"}
      p="lg"
      style={{
        background:
          message.role === "user"
            ? "linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)"
            : "linear-gradient(135deg, rgba(20, 27, 45, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)",
        alignSelf: message.role === "user" ? "flex-end" : "flex-start",
        maxWidth: "85%",
        minWidth: 0,
        overflowWrap: "break-word",
        wordBreak: "break-word",
        borderLeft:
          message.role === "user" ? "3px solid #A855F7" : "3px solid #228BE6",
        borderRadius: "0 8px 8px 0",
        position: "relative",
        boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)",
        clipPath:
          message.role === "user"
            ? "polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)"
            : "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)",
      }}
    >
      <Box
        style={{
          overflowWrap: "break-word",
          wordBreak: "break-word",
          minWidth: 0,
          color: message.role === "user" ? "#E2E8F0" : "#CBD5E1",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: "14px",
          lineHeight: "1.6",
          letterSpacing: "0.02em",
          "& code": {
            backgroundColor: "rgba(10, 15, 30, 0.6)",
            padding: "2px 6px",
            borderRadius: "3px",
            fontSize: "0.9em",
            fontFamily: "'SF Mono', Monaco, 'Cascadia Code', monospace",
            color: message.role === "user" ? "#F472B6" : "#60A5FA",
            border: "1px solid rgba(34, 139, 230, 0.2)",
            overflowWrap: "break-word",
            wordBreak: "break-all",
          },
          "& pre": {
            backgroundColor: "rgba(10, 15, 30, 0.8)",
            padding: "16px",
            borderRadius: "6px",
            overflowX: "auto",
            maxWidth: "100%",
            border: "1px solid rgba(34, 139, 230, 0.15)",
            boxShadow: "inset 0 2px 8px rgba(0, 0, 0, 0.4)",
            margin: "12px 0",
          },
          "& pre code": {
            backgroundColor: "transparent",
            padding: 0,
            border: "none",
            overflowWrap: "normal",
            wordBreak: "normal",
            color: "#94A3B8",
          },
          "& p": {
            margin: "0 0 8px 0",
          },
          "& p:last-child": {
            margin: 0,
          },
        }}
      >
        {message.role === "assistant" ? (
          <ReactMarkdown>{message.content}</ReactMarkdown>
        ) : (
          <Text
            style={{
              color: "inherit",
              fontSize: "inherit",
              lineHeight: "inherit",
            }}
          >
            {message.content}
          </Text>
        )}
      </Box>
    </Box>
  );
};

MessageComponent.displayName = "MessageComponent";

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
    if (
      !newMessage.content?.trim() &&
      newMessage.role !== "tool_use" &&
      newMessage.role !== "tool_result"
    ) {
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
          const asyncTools = [
            "write_file",
            "update_subgoal",
            "add_subgoal",
            "str_replace",
          ];
          const hasEmptyOutput =
            !data.output ||
            (typeof data.output === "object" &&
              Object.keys(data.output).length === 0) ||
            (typeof data.output === "string" && data.output.trim() === "");

          const shouldShowResult = !(
            asyncTools.includes(data.toolName || "") && hasEmptyOutput
          );

          if (shouldShowResult) {
            const toolResultMessage: Message = {
              id: data.id + "_result",
              role: "tool_result",
              content: `Tool result from ${data.toolName}`,
              toolName: data.toolName,
              output: data.output,
            };
            addMessageWithDuplicateCheck(toolResultMessage);
          }

          const fileTools = [
            "write_file",
            "str_replace",
            "edit_file",
            "create_file",
          ];
          if (fileTools.includes(data.toolName || "")) {
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
  }, [
    input,
    isLoading,
    apiKey,
    sessionId,
    backendConfig,
    addMessageWithDuplicateCheck,
  ]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  // Filter out empty messages
  const filteredMessages = messages.filter(
    (msg) =>
      msg.content?.trim() ||
      msg.role === "tool_use" ||
      msg.role === "tool_result",
  );

  return (
    <Box h="100%" style={{ display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes subtle-glow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.8; }
        }

        @keyframes pulse-border {
          0%, 100% {
            border-color: rgba(34, 139, 230, 0.2);
            box-shadow: 0 0 10px rgba(34, 139, 230, 0.1);
          }
          50% {
            border-color: rgba(168, 85, 247, 0.3);
            box-shadow: 0 0 20px rgba(168, 85, 247, 0.15);
          }
        }

        .cyber-message {
          position: relative;
        }

        .cyber-message::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(34, 139, 230, 0.3), transparent);
          animation: subtle-glow 3s ease-in-out infinite;
        }

        .tool-message {
          font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', monospace;
          position: relative;
          overflow: hidden;
        }

        .tool-message::after {
          content: '';
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          background: linear-gradient(45deg, rgba(34, 139, 230, 0.1), rgba(168, 85, 247, 0.1));
          opacity: 0;
          transition: opacity 0.3s;
          border-radius: 12px;
          z-index: -1;
        }

        .tool-message:hover::after {
          opacity: 1;
        }

        .typing-indicator {
          display: inline-flex;
          gap: 4px;
          padding: 4px;
        }

        .typing-indicator span {
          width: 8px;
          height: 8px;
          background: linear-gradient(135deg, #228BE6, #A855F7);
          border-radius: 50%;
          animation: typing-pulse 1.4s infinite;
        }

        .typing-indicator span:nth-child(2) {
          animation-delay: 0.2s;
        }

        .typing-indicator span:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typing-pulse {
          0%, 60%, 100% {
            transform: scale(0.8);
            opacity: 0.5;
          }
          30% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .user-message::before {
          content: '[USER.TX]';
          position: absolute;
          top: -18px;
          right: 0;
          font-size: 10px;
          font-family: 'SF Mono', Monaco, monospace;
          color: #A855F7;
          letter-spacing: 0.05em;
          opacity: 0.7;
        }

        .assistant-message::before {
          content: '[CYBERBUFFY.RX]';
          position: absolute;
          top: -18px;
          left: 0;
          font-size: 10px;
          font-family: 'SF Mono', Monaco, monospace;
          color: #228BE6;
          letter-spacing: 0.05em;
          opacity: 0.7;
        }

        .user-message::after,
        .assistant-message::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg,
            transparent,
            currentColor 20%,
            currentColor 80%,
            transparent);
          opacity: 0.3;
        }

        .user-message:hover,
        .assistant-message:hover {
          transform: translateX(2px);
          transition: transform 0.2s ease;
        }

        .user-message {
          margin-top: 20px;
          border-right: 1px solid rgba(168, 85, 247, 0.2);
        }

        .assistant-message {
          margin-top: 20px;
          border-right: 1px solid rgba(34, 139, 230, 0.2);
        }

        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3), 0 0 20px rgba(34, 139, 230, 0.1);
          }
          50% {
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3), 0 0 30px rgba(34, 139, 230, 0.2);
          }
        }

        .typing-message::before {
          content: '[CYBERBUFFY.STREAMING]';
          animation: blink 1s infinite;
        }

        @keyframes blink {
          0%, 50% { opacity: 0.7; }
          51%, 100% { opacity: 0.3; }
        }
      `}</style>

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
            <Box
              className="assistant-message typing-message"
              p="lg"
              style={{
                background:
                  "linear-gradient(135deg, rgba(20, 27, 45, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)",
                alignSelf: "flex-start",
                maxWidth: "85%",
                minWidth: 0,
                overflowWrap: "break-word",
                wordBreak: "break-word",
                borderLeft: "3px solid #228BE6",
                borderRadius: "0 8px 8px 0",
                position: "relative",
                boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3)",
                clipPath:
                  "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)",
                marginTop: "20px",
                borderRight: "1px solid rgba(34, 139, 230, 0.2)",
                animation: "pulse-glow 2s ease-in-out infinite",
              }}
            >
              <Group gap="xs" align="flex-start">
                <Box
                  flex={1}
                  style={{
                    minWidth: 0,
                    overflowWrap: "break-word",
                    wordBreak: "break-word",
                    color: "#CBD5E1",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    fontSize: "14px",
                    lineHeight: "1.6",
                    letterSpacing: "0.02em",
                  }}
                >
                  <ReactMarkdown>{currentResponse}</ReactMarkdown>
                </Box>
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </Group>
            </Box>
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
              backgroundColor: "rgba(15, 23, 42, 0.95)",
              border: "2px solid rgba(34, 139, 230, 0.3)",
              borderRadius: "12px",
              padding: "16px 20px",
              fontSize: "16px",
              lineHeight: "1.5",
              resize: "none",
              transition: "all 0.2s ease",
              fontFamily: "system-ui, -apple-system, sans-serif",
              "&:focus": {
                borderColor: "rgba(34, 139, 230, 0.6)",
                boxShadow:
                  "0 0 0 3px rgba(34, 139, 230, 0.1), 0 0 20px rgba(34, 139, 230, 0.15), 0 4px 20px rgba(0, 0, 0, 0.15)",
                transform: "translateY(-1px)",
                backgroundColor: "rgba(15, 23, 42, 1)",
              },
              "&:hover:not(:disabled)": {
                borderColor: "rgba(34, 139, 230, 0.4)",
                transform: "translateY(-1px)",
                boxShadow: "0 2px 12px rgba(34, 139, 230, 0.1)",
              },
              "&::placeholder": {
                color: "rgba(148, 163, 184, 0.6)",
                fontSize: "15px",
                letterSpacing: "0.02em",
              },
            },
          }}
        />

        {apiKey && (
          <Text
            size="xs"
            mt="sm"
            ta="center"
            style={{
              opacity: 0.6,
              fontFamily: "monospace",
              letterSpacing: "0.05em",
              color: "rgba(148, 163, 184, 0.8)",
              textTransform: "uppercase",
              fontSize: "11px",
            }}
          >
            [ENTER] → TRANSMIT • [SHIFT+ENTER] → NEWLINE
          </Text>
        )}
      </Box>
    </Box>
  );
}
