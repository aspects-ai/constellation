import type { AgentDefinition } from "@codebuff/sdk";

/**
 * ETL Manager Agent
 *
 * Coordinates the ETL pipeline using handleSteps for sequential execution.
 * A lightweight shim that spawns extract → transform → load in sequence.
 */

const agent: AgentDefinition = {
  id: "etl-manager",
  displayName: "ETL Pipeline Manager",
  model: "openai/gpt-5",
  version: "1.0.0",
  publisher: "web-demo",

  toolNames: ["spawn_agents", "set_output", "think_deeply"],

  outputMode: "structured_output",
  stepPrompt: "",
  includeMessageHistory: true,

  spawnableAgents: ["extract-agent", "transform-agent", "load-agent"],

  outputSchema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "Prompt for the next step",
      },
      etlResults: {
        type: "object",
        description: "The final ETL results",
        properties: {
          extract: {
            type: "object",
            description: "The extracted data",
          },
          transform: {
            type: "object",
            description: "The transformed data",
          },
          load: {
            type: "object",
            description: "The final load data",
          },
        },
      },
      finalData: {
        type: "string",
        description: "The final (loaded) result",
      },
    },
  },

  handleSteps: function* ({ prompt, params }) {
    // Step 1: Generate context-aware prompt for extract agent
    const { toolResult: extractPrompt } = yield {
      toolName: "think_deeply",
      input: {
        thought: `Analyzing user request "${prompt}" to generate optimal extraction strategy. Consider: data domain (${params?.domain || "unknown"}), specific search terms needed, target sources, and query refinement for maximum relevance.`,
      },
    };

    const { toolResult: extractResults } = yield {
      toolName: "spawn_agents",
      input: {
        agents: [
          {
            agent_type: "extract-agent",
            prompt: extractPrompt,
            params: params?.extractParams || {},
          },
        ],
      },
    };
    if (!extractResults?.[0]) {
      yield {
        toolName: "set_output",
        input: { error: "Extract step failed." },
      };
      return;
    }
    const extractResult = extractResults[0];

    // Step 2: Generate context-aware prompt for transform agent
    const { toolResult: transformPrompt } = yield {
      toolName: "think_deeply",
      input: {
        thought: `Processing extracted data from previous step. Need to transform raw data into canonical schema. Consider: data quality, normalization needs, deduplication strategy, and enrichment opportunities based on extracted content.`,
      },
    };

    const { toolResult: transformResults } = yield {
      toolName: "spawn_agents",
      input: {
        agents: [
          {
            agent_type: "transform-agent",
            prompt: transformPrompt,
            params: {
              ...params?.transformParams,
              extractResult: extractResult,
            },
          },
        ],
      },
    };
    if (!transformResults?.[0]) {
      yield {
        toolName: "set_output",
        input: { error: "Transform step failed." },
      };
      return;
    }
    const transformResult = transformResults[0];

    // Step 3: Generate context-aware prompt for load agent
    const { toolResult: loadPrompt } = yield {
      toolName: "think_deeply",
      input: {
        thought: `Final filtering and ranking phase for user request "${prompt}". Need to apply user constraints, score relevance, and rank results. Consider: user preferences, contextual relevance, quality metrics, and practical constraints.`,
      },
    };

    const { toolResult: loadResults } = yield {
      toolName: "spawn_agents",
      input: {
        agents: [
          {
            agent_type: "load-agent",
            prompt: loadPrompt,
            params: {
              ...params?.loadParams,
              transformResult: transformResult,
            },
          },
        ],
      },
    };
    if (!loadResults?.[0]) {
      yield { toolName: "set_output", input: { error: "Load step failed." } };
      return;
    }
    const loadResult = loadResults[0];

    // Return final ETL results
    yield {
      toolName: "set_output",
      input: {
        etlResults: {
          extract: extractResult,
          transform: transformResult,
          load: loadResult,
        },
        finalData: loadResult,
      },
    };
  },

  inputSchema: {
    prompt: {
      type: "string",
      description:
        "The data processing request to execute through ETL pipeline",
    },
    params: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["places", "events", "projects"],
          description: "Data domain for ETL processing",
        },
        extractParams: {
          type: "object",
          description: "Parameters for extract agent",
        },
        transformParams: {
          type: "object",
          description: "Parameters for transform agent",
        },
        loadParams: {
          type: "object",
          description: "Parameters for load agent",
        },
      },
    },
  },

  systemPrompt:
    "You are an ETL pipeline manager that coordinates sequential data processing through extract, transform, and load stages.",

  spawnerPrompt:
    "Use this agent to execute a complete ETL pipeline for data processing requests",

  instructionsPrompt: "",
};

export default agent;
