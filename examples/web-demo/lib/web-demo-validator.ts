import type { AgentDefinition } from "@codebuff/sdk";

/**
 * Web Demo Validator Agent
 *
 * Validates the web-demo project by running build and typecheck commands.
 * Designed to be called by react-typescript agent after making changes.
 */

const agent: AgentDefinition = {
  id: "web-demo-validator",
  displayName: "Web Demo Validator",
  model: "anthropic/claude-3-5-sonnet-20241022",
  version: "1.0.0",

  outputMode: "last_message",
  includeMessageHistory: false,

  toolNames: ["run_terminal_command", "read_files", "end_turn"],

  spawnableAgents: [],

  instructionsPrompt: `You are a validation agent specifically for the web-demo project.

Your job is to:
1. Run TypeScript type checking with \`npx tsc --noEmit\`
2. Run the build process with \`npm run build\`
3. Report any errors or warnings found
4. Provide a clear summary of the validation results

Always run commands from the examples/web-demo directory.

Be concise and focus on reporting issues. If everything passes, just say "✅ All checks passed".
If there are errors, clearly list them with their file locations.`,

  spawnerPrompt: `Use this agent to validate the web-demo project after making changes`,

  inputSchema: {
    prompt: {
      type: "string",
      description: "What to validate (optional - defaults to full validation)",
    },
  },

  systemPrompt: `You are a validation specialist for the web-demo Next.js project.

Your validation process:
1. First run TypeScript type checking
2. Then run the build process
3. Report results clearly

Always use cwd="examples/web-demo" for your commands.

Be extremely concise. Only report errors and warnings, not the full command output.
If everything passes, just confirm success with a checkmark.`,

  stepPrompt: `Continue validating the web-demo project. Use end_turn when validation is complete.`,
};

export default agent;
