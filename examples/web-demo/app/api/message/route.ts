import { AgentDefinition, CodebuffClient } from "@codebuff/sdk";
import { FileSystem } from "constellationfs";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getCodebuffClient } from "../../../lib/codebuff-init";
import { broadcastToStream } from "../../../lib/streams";
import orchestratorAgent from "../../../lib/orchestrator-agent";
import reactTypescriptBuilder from "../../../lib/react-typescript-builder";


// Import ETL pipeline manager
import etlManager from "../../../lib/etl-manager";

export async function POST(request: NextRequest) {
  console.log("[API] 🚀 POST request received");
  try {
    // Check if request has a body
    const contentType = request.headers.get("content-type");
    console.log("[API] Content-Type:", contentType);
    if (!contentType || !contentType.includes("application/json")) {
      console.log("[API] ❌ Invalid content type");
      return NextResponse.json(
        { error: "Content-Type must be application/json" },
        { status: 400 },
      );
    }

    // Parse JSON with better error handling
    let body;
    try {
      const text = await request.text();
      console.log("[API] Raw request body length:", text.length);
      if (!text) {
        console.log("[API] ❌ Empty request body");
        return NextResponse.json(
          { error: "Request body is empty" },
          { status: 400 },
        );
      }
      body = JSON.parse(text);
      console.log("[API] ✅ JSON parsed successfully");
    } catch (parseError) {
      console.error("[API] ❌ JSON parse error:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    const { message, sessionId, backendConfig, previousRunState } = body;
    console.log(
      "[API] 📝 Message:",
      message?.substring(0, 100) + (message?.length > 100 ? "..." : ""),
    );
    console.log("[API] 🆔 Session ID:", sessionId);
    console.log("[API] 🔧 Backend config:", backendConfig?.type || "local");

    if (!message || !sessionId) {
      console.log(
        "[API] ❌ Missing required fields - message:",
        !!message,
        "sessionId:",
        !!sessionId,
      );
      return NextResponse.json(
        { error: "Message and sessionId are required" },
        { status: 400 },
      );
    }

    // Create a unique stream ID for this request
    const streamId = uuidv4();
    console.log("[API] 🌊 Stream ID created:", streamId);

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
    console.log("[API] 🗂️ Initializing FileSystem with config:", fsConfig.type);
    const fs = new FileSystem({
      userId: sessionId,
      ...fsConfig,
    });
    console.log("[API] ✅ FileSystem initialized");

    // Initialize workspace with sample files if empty
    console.log("[API] 🔄 Initializing workspace...");
    await initializeWorkspace(fs);
    console.log("[API] ✅ Workspace initialized");

    // Start the AI processing in the background using Codebuff SDK
    console.log("[API] 🤖 Starting Codebuff processing...");
    processWithCodebuff(fs, message, sessionId, previousRunState);
    console.log("[API] 📤 Returning stream ID:", streamId);
    return NextResponse.json({ streamId });
  } catch (error) {
    console.error("[API] 💥 Critical error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function initializeWorkspace(fs: FileSystem) {
  console.log("[WORKSPACE] 📂 Checking workspace contents...");
  try {
    const result = await fs.exec("ls");
    const files = result ? result.split("\n").filter(Boolean) : [];
    console.log(
      "[WORKSPACE] 📋 Found",
      files.length,
      "files:",
      files.slice(0, 5),
    );

    // If workspace is empty, create some sample files
    if (files.length === 0) {
      console.log(
        "[WORKSPACE] 📝 Creating sample files for empty workspace...",
      );
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
      console.log("[WORKSPACE] ✅ Sample files created");
    } else {
      console.log("[WORKSPACE] ✅ Workspace already contains files");
    }
  } catch (error) {
    console.error("[WORKSPACE] ❌ Failed to initialize workspace:", error);
  }
}

async function processWithCodebuff(
  fs: FileSystem,
  message: string,
  sessionId: string,
  previousRunState?: any,
) {
  console.log(
    "[CODEBUFF] 🤖 Starting Codebuff processing for session:",
    sessionId,
  );
  try {
    console.log("[CODEBUFF] 🗂️ Workspace path:", fs.workspace);

    // Get Codebuff client - it will use the ConstellationFS workspace directly
    const apiKey = process.env.NEXT_PUBLIC_CODEBUFF_API_KEY;
    console.log("[CODEBUFF] 🔑 API key present:", !!apiKey);
    if (!apiKey) {
      console.error("[CODEBUFF] ❌ Missing API key");
      throw new Error(
        "NEXT_PUBLIC_CODEBUFF_API_KEY environment variable is required",
      );
    }
    console.log("[CODEBUFF] 🔗 Creating Codebuff client...");
    const client: CodebuffClient = await getCodebuffClient(fs, apiKey);
    console.log("[CODEBUFF] ✅ Client created successfully");

    // Start streaming response
    console.log("[CODEBUFF] 🌊 Starting stream for session:", sessionId);
    broadcastToStream(sessionId, { type: "message_start", role: "assistant" });

    // Use orchestrator as master coordinator
    const targetAgent = "orchestrator";
    console.log("[CODEBUFF] 🎯 Target agent:", targetAgent);
    const agentDefinitions: AgentDefinition[] = [
      // orchestrator
      orchestratorAgent,

      // builder
      reactTypescriptBuilder,


      // etl
      etlManager,
    ];
    console.log(
      "[CODEBUFF] 📋 Agent definitions loaded:",
      agentDefinitions.map((a) => a.id),
    );

    // Run the selected agent with appropriate definitions
    console.log(
      "[CODEBUFF] 🚀 Running agent with message:",
      message.substring(0, 100) + "...",
    );
    console.log(
      "[CODEBUFF] 🔄 Previous run state present:",
      !!previousRunState,
    );
    const result = await client.run({
      agent: targetAgent,
      agentDefinitions,
      prompt: message,
      ...(previousRunState && { runState: previousRunState }),
      handleEvent: (event: any) => {
        console.log("[CODEBUFF] 📡 Event received:", event.type);
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
          console.log("[CODEBUFF] 🔧 Tool call:", event.toolName, event.params);
          broadcastToStream(sessionId, {
            type: "tool_use",
            id: uuidv4(),
            toolName: event.toolName,
            params: event.params || {},
          });
        } else if (event.type === "tool_result") {
          // Send tool result as a separate message type with unique ID
          console.log("[CODEBUFF] 📊 Tool result for:", JSON.stringify(event));
          broadcastToStream(sessionId, {
            type: "tool_result",
            id: uuidv4(),
            toolName: event.toolName,
            output: event.output,
          });
        } else if (event.type === "text") {
          // Send text as complete message that gets interleaved with tools
          console.log(
            "[CODEBUFF] 💬 Text message:",
            event.text.substring(0, 50) + "...",
          );
          broadcastToStream(sessionId, {
            type: "assistant_message",
            id: uuidv4(),
            text: event.text,
          });
        }
      },
    });

    console.log("[CODEBUFF] ✅ Agent execution completed successfully");

    // Send the run state back to client for next message
    console.log("[CODEBUFF] 📤 Sending run state update");
    broadcastToStream(sessionId, {
      type: "run_state_update",
      runState: result,
    });

    // End assistant message and signal completion
    console.log("[CODEBUFF] 🏁 Ending message and closing stream");
    broadcastToStream(sessionId, {
      type: "message_end",
      id: uuidv4(),
      role: "assistant",
    });
    broadcastToStream(sessionId, { type: "done" });

    // Keep connection alive for reuse
    console.log("[CODEBUFF] ♻️ Keeping client connection alive for reuse");
  } catch (error) {
    console.error("[CODEBUFF] 💥 Processing error:", error);
    broadcastToStream(sessionId, {
      type: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
