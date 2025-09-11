import { CodebuffClient } from "@codebuff/sdk";
import { FileSystem } from "constellationfs";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getCodebuffClient } from "../../../lib/codebuff-init";
import { broadcastToStream } from "../../../lib/streams";
import reactTypescriptAgent from "../../../lib/react-typescript-agent";
import projectOpsAgent from "../../../lib/project-ops";
import webDemoValidatorAgent from "../../../lib/web-demo-validator";

// Import cyberpunk news agents from lib folder
import newsFetcherAgent from "../../../lib/news-fetcher";
import cyberOrchestratorAgent from "../../../lib/cyber-orchestrator";
import cyberStylizerAgent from "../../../lib/cyber-stylizer";

import routerAgent from "../../../lib/router";

export async function POST(request: NextRequest) {
  try {
    // Check if request has a body
    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 400 },
      );
    }

    // Parse JSON with better error handling
    let body;
    try {
      const text = await request.text();
      if (!text) {
        return NextResponse.json(
          { error: "Request body is empty" },
          { status: 400 },
        );
      }
      body = JSON.parse(text);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    const { message, sessionId, backendConfig, previousRunState } = body;

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: "Message and sessionId are required" },
        { status: 400 },
      );
    }

    // Create a unique stream ID for this request
    const streamId = uuidv4();

    // Create backend configuration
    let fsConfig: any;

    if (backendConfig && backendConfig.type === "remote") {
      if (
        !backendConfig.host ||
        !backendConfig.username ||
        !backendConfig.workspace
      ) {
        return NextResponse.json(
          {
            error:
              "Remote backend requires host, username, and workspace parameters",
          },
          { status: 400 },
        );
      }

      fsConfig = {
        type: "remote",
        host: backendConfig.host,
        workspace: backendConfig.workspace,
        auth: {
          type: "password",
          credentials: {
            username: backendConfig.username,
            password: "constellation",
          },
        },
      };
    } else {
      fsConfig = {
        type: "local",
        userId: sessionId,
      };
    }

    // Initialize ConstellationFS with specified backend
    const fs = new FileSystem({
      userId: sessionId,
      ...fsConfig,
    });

    // Initialize workspace with sample files if empty
    await initializeWorkspace(fs);

    // Start the AI processing in the background using Codebuff SDK
    processWithCodebuff(fs, message, sessionId, undefined, previousRunState);
    return NextResponse.json({ streamId });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function initializeWorkspace(fs: FileSystem) {
  try {
    const result = await fs.exec("ls");
    const files = result ? result.split("\n").filter(Boolean) : [];

    // If workspace is empty, create some sample files
    if (files.length === 0) {
      await fs.write(
        "README.md",
        `# Welcome to ConstellationFS Demo

This is a sample workspace where you can interact with an AI assistant that can:
- Create and edit files
- Run shell commands
- Build projects
- Help with development tasks

Try asking me to:
- "Create a simple Node.js application"
- "Add a package.json file"
- "Write a Python hello world script"
- "List all files in the workspace"
`,
      );

      await fs.write("hello.txt", "Hello from ConstellationFS!");
    }
  } catch (error) {
    console.error("Failed to initialize workspace:", error);
  }
}

async function processWithCodebuff(
  fs: FileSystem,
  message: string,
  sessionId: string,
  routeOverride?: string,
  previousRunState?: any,
) {
  try {
    console.log("Workspace:", fs.workspace);

    // Get Codebuff client - it will use the ConstellationFS workspace directly
    const apiKey = process.env.NEXT_PUBLIC_CODEBUFF_API_KEY;
    if (!apiKey) {
      throw new Error(
        "NEXT_PUBLIC_CODEBUFF_API_KEY environment variable is required",
      );
    }
    const client: CodebuffClient = await getCodebuffClient(fs, apiKey);

    // Start streaming response
    broadcastToStream(sessionId, { type: "message_start", role: "assistant" });

    // Handle different types of routing result outputs
    let targetAgent: string;
    let agentDefinitions: any[];

    // Check if there's a route override (e.g., from cyber mode button)
    if (routeOverride) {
      console.log("🎯 Using route override:", routeOverride);
      targetAgent = routeOverride;
    } else {
      // Determine which agent to route to using router agent
      const routingResult = await client.run({
        agent: "router",
        agentDefinitions: [routerAgent],
        prompt: message,
        handleEvent: () => {}, // No streaming for routing decision
      });

      if (routingResult.output.type === "error") {
        throw new Error(routingResult.output.message);
      }

      if (
        routingResult.output.type !== "structuredOutput" ||
        !routingResult.output.value
      ) {
        throw new Error("Unexpected output type: " + routingResult.output.type);
      }

      // Extract the target agent from the structured output
      targetAgent = routingResult.output.value.targetAgent;
      const reasoning = routingResult.output.value.reasoning;

      console.log("🎯 Router decision:", targetAgent);
      console.log("📝 Router reasoning:", reasoning);
    }

    if (targetAgent === "cyber-orchestrator") {
      // Cyberpunk news agents only
      agentDefinitions = [
        cyberOrchestratorAgent,
        newsFetcherAgent,
        cyberStylizerAgent,
      ];
    } else {
      // React/TypeScript development agents only
      targetAgent = "react-typescript";
      agentDefinitions = [
        reactTypescriptAgent,
        projectOpsAgent,
        webDemoValidatorAgent,
      ];
    }

    // Run the selected agent with appropriate definitions
    const result = await client.run({
      agent: targetAgent,
      agentDefinitions,
      prompt: message,
      ...(previousRunState && { runState: previousRunState }),
      handleEvent: (event: any) => {
        if (event.type === "assistant_message_delta") {
          // Stream assistant message content in chunks for real-time typing
          const text = event.delta;
          const chunkSize = 30;

          for (let i = 0; i < text.length; i += chunkSize) {
            const chunk = text.slice(i, i + chunkSize);
            broadcastToStream(sessionId, {
              type: "assistant_delta",
              text: chunk,
            });
          }
        } else if (event.type === "tool_call") {
          // Send tool call as a separate message type with unique ID
          broadcastToStream(sessionId, {
            type: "tool_use",
            id: uuidv4(),
            toolName: event.toolName,
            params: event.params || {},
          });
        } else if (event.type === "tool_result") {
          // Send tool result as a separate message type with unique ID
          broadcastToStream(sessionId, {
            type: "tool_result",
            id: uuidv4(),
            toolName: event.toolName,
            output: event.output,
          });
        } else if (event.type === "text") {
          // Send text as complete message that gets interleaved with tools
          broadcastToStream(sessionId, {
            type: "assistant_message",
            id: uuidv4(),
            text: event.text,
          });
        }
      },
    });

    console.log("✅ Codebuff agent execution completed");

    // Send the run state back to client for next message
    broadcastToStream(sessionId, {
      type: "run_state_update",
      runState: result,
    });

    // End assistant message and signal completion
    broadcastToStream(sessionId, {
      type: "message_end",
      id: uuidv4(),
      role: "assistant",
    });
    broadcastToStream(sessionId, { type: "done" });

    // Close connection
    client.closeConnection();
  } catch (error) {
    console.error("Codebuff Processing Error:", error);
    broadcastToStream(sessionId, {
      type: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
