import { AgentDefinition } from './types/agent-definition'

const definition: AgentDefinition = {
  id: "security-coordinator",
  version: "1.0.0",

  displayName: "Security Coordinator",
  spawnerPrompt: "Spawn this agent to coordinate security-focused development workflows and ensure secure coding practices",
  model: "anthropic/claude-4-sonnet-20250522",
  outputMode: "last_message",
  includeMessageHistory: true,

  toolNames: ["read_files", "spawn_agents", "code_search", "end_turn"],
  spawnableAgents: ["codebuff/reviewer@0.0.1", "codebuff/researcher@0.0.1", "codebuff/file-picker@0.0.1"],

  inputSchema: {
    prompt: {
      type: "string",
      description: "Security analysis or coordination task"
    }
  },

  systemPrompt: "You are a security coordinator responsible for ensuring secure development practices.",
  instructionsPrompt: "Analyze the security implications of the request and coordinate appropriate security-focused agents.",
  stepPrompt: "Continue analyzing security requirements and coordinating the workflow. Use end_turn when complete."
}

export default definition