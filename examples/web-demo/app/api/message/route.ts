import { CodebuffClient } from "@codebuff/sdk";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getCodebuffClient } from "../../../lib/codebuff-init";
import { broadcastToStream } from "../../../lib/streams";
import { createFileSystem, initConstellationFS } from "../../../lib/constellation-init";
import type { FileSystem } from "constellationfs";

export async function POST(request: NextRequest) {
  try {
    // Check if request has a body
    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error("[API] ❌ Invalid content type");
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
        console.error("[API] ❌ Empty request body");
        return NextResponse.json(
          { error: "Request body is empty" },
          { status: 400 },
        );
      }
      body = JSON.parse(text);
    } catch (parseError) {
      console.error("[API] ❌ JSON parse error:", parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    const { message, sessionId, previousRunState } = body;
    console.log(
      "[API] 📝 Message:",
      message?.substring(0, 100) + (message?.length > 100 ? "..." : ""),
    );
    console.log("[API] 🆔 Session ID:", sessionId);
    console.log("[API] 🔄 Previous runState present:", !!previousRunState);
    if (previousRunState) {
      console.log("[API] 📊 Previous runState type:", typeof previousRunState);
      console.log(
        "[API] 📊 Previous runState keys:",
        Object.keys(previousRunState || {}),
      );
      console.log(
        "[API] 📊 Previous runState size (JSON):",
        JSON.stringify(previousRunState).length,
        "chars",
      );
    }

    if (!sessionId) {
      console.log("[API] ❌ Missing sessionId");
      return NextResponse.json(
        { error: "SessionId is required" },
        { status: 400 },
      );
    }

    // Check if this is an initialization request (empty message)
    const isInitializationOnly = !message || message.trim() === "";
    if (isInitializationOnly) {
      console.log("[API] 🔧 Initialization request detected");
    }

    // Create a unique stream ID for this request
    const streamId = uuidv4();
    console.log("[API] 🌊 Stream ID created:", streamId);

    // Initialize ConstellationFS configuration
    initConstellationFS()

    // Create FileSystem instance
    console.log("[API] 🗂️ Initializing FileSystem");
    const fs = createFileSystem(sessionId);
    console.log("[API] ✅ FileSystem initialized");

    // Initialize workspace with sample files if empty
    console.log("[API] 🔄 Initializing workspace...");
    await initializeWorkspace(fs);
    console.log("[API] ✅ Workspace initialized");

    // If this is just initialization, return early without starting AI processing
    if (isInitializationOnly) {
      console.log("[API] ✅ Initialization complete - skipping AI processing");
      return NextResponse.json({ success: true, initialized: true });
    }

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
    const workspace = await fs.getWorkspace('default');
    const result = await workspace.exec("ls");
    if (typeof result !== 'string') {
      throw new Error('Output is not a string')
    }
    const files = result ? result.split("\n").filter(Boolean) : [];
    console.log(
      "[WORKSPACE] 📋 Found",
      files.length,
      "files:",
      files.slice(0, 5),
    );

    // If workspace is empty, create cyberpunk SF map app
    if (files.length === 0) {
      workspace.write("README.md", "Hello, world!");
      // console.log(
      //   "[WORKSPACE] 🌃 Creating cyberpunk SF map app for empty workspace...",
      // );

      // try {
      //   // Get the path to the cyberpunk-sf-map files from project root
      //   const projectRoot = process.cwd();
      //   const cyberpunkPath = join(projectRoot, "cyberpunk-sf-map");
      //   console.log("[WORKSPACE] 📂 Reading from:", cyberpunkPath);

      //   // Recursively copy all files and directories from cyberpunk-sf-map
      //   const copyRecursively = async (
      //     sourcePath: string,
      //     destPath: string = "",
      //   ) => {
      //     const items = await readdir(sourcePath);

      //     for (const itemName of items) {
      //       // Skip hidden files/directories
      //       if (itemName.startsWith(".")) continue;

      //       const sourceItemPath = join(sourcePath, itemName);
      //       const destItemPath = destPath ? join(destPath, itemName) : itemName;
      //       const itemStat = await stat(sourceItemPath);

      //       if (itemStat.isFile()) {
      //         try {
      //           const content = await readFile(sourceItemPath, "utf-8");
      //           await fs.write(destItemPath, content);
      //           console.log(`[WORKSPACE] ✅ Copied file: ${destItemPath}`);
      //         } catch (fileError) {
      //           console.warn(
      //             `[WORKSPACE] ⚠️ Failed to copy file ${destItemPath}:`,
      //             fileError,
      //           );
      //         }
      //       } else if (itemStat.isDirectory()) {
      //         console.log(`[WORKSPACE] 📁 Creating directory: ${destItemPath}`);
      //         // Create the directory in the filesystem
      //         await fs.exec(`mkdir -p "${destItemPath}"`);
      //         // Recursively copy the directory contents
      //         await copyRecursively(sourceItemPath, destItemPath);
      //       }
      //     }
      //   };

      //   console.log(
      //     "[WORKSPACE] 🔄 Starting recursive copy from:",
      //     cyberpunkPath,
      //   );
      //   await copyRecursively(cyberpunkPath);

      //   console.log(
      //     "[WORKSPACE] ✅ Cyberpunk SF map files copied successfully",
      //   );
      // } catch (copyError) {
      //   console.error(
      //     "[WORKSPACE] ⚠️ Failed to copy cyberpunk files, creating basic files:",
      //     copyError,
      //   );
      //   await fs.write(
      //     "README.md",
      //     "# Cyberpunk SF Map\n\nA React app with cyberpunk-themed San Francisco map.",
      //   );
      // }
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
    const workspace = await fs.getWorkspace('default');
    console.log("[CODEBUFF] 🗂️ Workspace path:", workspace.workspacePath);

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

    // Define agent context
    const baseAgentName = "Base Agent";
    const baseAgentId = "base";

    // Start streaming response
    console.log("[CODEBUFF] 🌊 Starting stream for session:", sessionId);
    // const targetAgent = "orchestrator";
    broadcastToStream(sessionId, {
      type: "message_start",
      role: "assistant",
      agentName: baseAgentName,
      agentId: baseAgentId,
    });

    // Use orchestrator as master coordinator
    // console.log("[CODEBUFF] 🎯 Target agent:", targetAgent);
    // const agentDefinitions: AgentDefinition[] = [
    //   // orchestrator
    //   orchestratorAgent,

    //   // builder
    //   reactTypescriptBuilder,

    //   // etl
    //   etlManager
    // ];
    // console.log(
    //   "[CODEBUFF] 📋 Agent definitions loaded:",
    //   agentDefinitions.map((a) => a.id),
    // );

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
      agent: baseAgentId,
      prompt: message,
      ...(previousRunState && { previousRun: previousRunState }),
      handleEvent: (event: any) => {
        console.log("[CODEBUFF] 📡 Event received:", event.type);

        // Forward subagent lifecycle events directly
        if (
          event.type === "subagent_start" ||
          event.type === "subagent_finish"
        ) {
          console.log(`[CODEBUFF] Forwarding ${event.type} event`, event);
          broadcastToStream(sessionId, {
            type: event.type,
            agentName: event.displayName,
            agentId: event.agentId,
          });
        }

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
