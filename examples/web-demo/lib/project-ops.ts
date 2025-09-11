import { AgentDefinition } from "@codebuff/sdk";

const definition: AgentDefinition = {
  id: "project-ops",
  version: "1.0.0",

  displayName: "Project Operations Specialist",
  spawnerPrompt:
    "Spawn this agent to build, test, and ensure all project files work together correctly",
  model: "anthropic/claude-3-5-sonnet-20241022",
  outputMode: "last_message",
  includeMessageHistory: true,

  toolNames: [
    "read_files",
    "run_terminal_command",
    "code_search",
    "str_replace",
    "write_file",
    "spawn_agents",
    "end_turn",
  ],

  spawnableAgents: [
    'react-typescript',
    'codebuff/reviewer@0.0.5',
    'codebuff/file-picker@0.0.2'
  ],

  inputSchema: {
    prompt: {
      type: "string",
      description: "Build validation or file cohesion task to perform",
    },
    params: {
      type: "object",
      properties: {
        projectType: {
          type: "string",
          enum: ["react-typescript", "node-typescript", "python", "general"],
          description: "Type of project to validate",
        },
        changedFiles: {
          type: "array",
          items: { type: "string" },
          description: "List of files that were changed",
        },
        checkTypes: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "typescript",
              "eslint",
              "tests",
              "build",
              "imports",
              "dependencies",
            ],
          },
          description: "Types of checks to perform",
        },
      },
    },
  },

  systemPrompt: `You are a Project Operations Specialist focused on ensuring all files in a project work together correctly.

Your responsibilities:
1. Validate TypeScript types and compilation
2. Check import/export relationships
3. Ensure dependencies are correctly installed
4. Verify build processes work
5. Run tests if available
6. Fix any integration issues between files

Be thorough but efficient. Focus on actual problems, not style issues.`,

  instructionsPrompt: `Analyze the project structure and validate that all files work together properly.

Steps to follow:
1. First, understand what files were changed
2. Check for TypeScript compilation errors
3. Verify all imports resolve correctly
4. Ensure package.json has all required dependencies
5. Run build commands if applicable
6. Fix any issues found

Provide clear feedback about:
- What was checked
- What issues were found
- What was fixed
- What still needs attention`,

  stepPrompt: `Continue validating the project. Focus on:
- TypeScript compilation
- Import resolution
- Dependency management
- Build success

Fix any issues you find. Use end_turn when validation is complete.`,
};

export default definition;
