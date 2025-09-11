import type { AgentDefinition } from '@codebuff/sdk';

/**
 * Content Normalizer Agent
 * 
 * Converts various news formats into a unified schema for processing.
 */

interface NormalizedArticle {
  id: string;
  title: string;
  author: string;
  timestamp: string;
  source: string;
  content: string;
  tags: string[];
  media: Array<{
    type: 'image' | 'video';
    url: string;
    caption?: string;
  }>;
  metadata: {
    originalUrl: string;
    wordCount: number;
    readingTime: number;
    language: string;
  };
}

const agent: AgentDefinition = {
  id: 'content-normalizer',
  displayName: 'Content Normalizer Node',
  model: 'anthropic/claude-3-5-sonnet-20241022',
  version: '1.0.0',
  outputMode: 'last_message',
  includeMessageHistory: false,
  
  toolNames: [
    'read_files',
    'write_file',
    'run_terminal_command',
    'code_search',
    'spawn_agents',
    'end_turn'
  ],
  
  spawnableAgents: [
    'trend-analyzer',
    'cyber-stylizer'
  ],

  instructionsPrompt: `You are the Content Normalizer - transforming chaotic data into structured intelligence.

Your tasks:
1. Read raw articles from /data/queue/raw/
2. Convert to NormalizedArticle schema
3. Extract and clean content
4. Calculate metadata (word count, reading time)
5. Output to /data/queue/normalized/

Normalization steps:
- Strip HTML/markdown if present
- Extract main content from description/summary
- Identify and tag topics
- Extract media URLs and captions
- Standardize timestamps to ISO format
- Calculate reading time (200 words/minute)

Handle various RSS/JSON formats:
- RSS 2.0
- Atom 1.0
- JSON Feed
- Custom API responses

Ensure all text is properly escaped and validated.`,

  spawnerPrompt: `Use this agent to normalize raw news into unified format`,

  inputSchema: {
    prompt: {
      type: 'string',
      description: 'Instructions for normalizing content'
    },
    params: {
      type: 'object',
      properties: {
        batchSize: {
          type: 'number',
          description: 'Number of articles to process',
          default: 10
        }
      }
    }
  },

  systemPrompt: `You are the Content Normalizer - a data transformation node in the pipeline.

Speak like a data processor:
"[NORMALIZE] Processing batch: 10 articles"
"[EXTRACT] Content cleaned, 542 words extracted"
"[METADATA] Tags: tech, AI, security"

Be precise and efficient. Focus on data quality and consistency.`,

  stepPrompt: `Continue normalizing content. Process raw articles and output clean, structured data.`
};

export default agent;
