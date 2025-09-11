import type { AgentDefinition } from "@codebuff/sdk";

/**
 * Router Agent
 *
 * Simple router that decides whether to send requests to the base Codebuff agent
 * or the cyber-orchestrator based on the user's intent.
 */

const agent: AgentDefinition = {
  id: "router",
  displayName: "Request Router",
  model: "anthropic/claude-3-5-sonnet-20241022",
  version: "1.0.0",

  outputMode: "structured_output",
  includeMessageHistory: true,

  toolNames: ["set_output", "end_turn"],

  spawnableAgents: [],

  instructionsPrompt: `You are a simple router agent. Your only job is to decide whether to route the user's request to:

1. **cyber-orchestrator** - ONLY for cyberpunk news aggregator system requests:
   - Fetching news articles from sources
   - Transforming news into cyberpunk style
   - Managing news feeds or RSS
   - Publishing news content
   - News pipeline operations
   - Commands like "fetch news", "show news", "style news", "get headlines"
   - Anything about news aggregation or news transformation

2. **react-typescript** - For EVERYTHING ELSE, including:
   - General coding tasks
   - File operations
   - Project management
   - TypeScript/React development
   - Building features (even if cyberpunk themed)
   - Creating UI components
   - Writing agents or other code
   - Any non-news related requests
   - General cyberpunk styling that isn't about news

IMPORTANT: Only route to cyber-orchestrator if the request is SPECIFICALLY about the news aggregator system. If someone just mentions "cyber" or "cyberpunk" but isn't asking about news, route to the base agent.

Analyze the user's request and return a structured output with the targetAgent field set to the appropriate agent.`,

  spawnerPrompt: `Use this agent to route requests between the base agent and cyberpunk news system`,

  inputSchema: {
    prompt: {
      type: "string",
      description: "User request to route",
    },
  },

  outputSchema: {
    type: "object",
    properties: {
      targetAgent: {
        type: "string",
        enum: ["cyber-orchestrator", "react-typescript"],
        description: "The agent to route the request to",
      },
      reasoning: {
        type: "string",
        description: "Brief explanation of why this agent was chosen",
      },
    },
    required: ["targetAgent"],
    additionalProperties: false,
  },

  systemPrompt: `You are a request router. Analyze the user's intent and return the appropriate agent to handle the request.

Route to "cyber-orchestrator" ONLY if the request is about:
- Fetching, displaying, or transforming NEWS articles
- Managing NEWS feeds or RSS feeds
- The cyberpunk NEWS aggregator system
- Commands like "fetch news", "show headlines", "get news", "style news articles"

Route to "react-typescript" for everything else, including:
- Building or coding anything (even cyberpunk themed UI)
- General cyberpunk styling that isn't about news articles
- File operations, project management, or development tasks

Be strict: Only use cyber-orchestrator for actual NEWS-related requests. Return a structured JSON output with the targetAgent field.`,

  stepPrompt: `Route the user's request to the appropriate agent.`,
};

export default agent;
