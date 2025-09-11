import type { AgentDefinition } from '@codebuff/sdk';

/**
 * Feed Publisher Agent
 * 
 * Formats and publishes the final cyberpunk news feed for display.
 */

const agent: AgentDefinition = {
  id: 'feed-publisher',
  displayName: 'Feed Publisher Node',
  model: 'anthropic/claude-3-5-sonnet-20241022',
  version: '1.0.0',
  outputMode: 'last_message',
  includeMessageHistory: false,
  
  toolNames: [
    'read_files',
    'write_file',
    'run_terminal_command',
    'spawn_agents',
    'end_turn'
  ],
  
  spawnableAgents: [
    'project-ops',
    'codebuff/reviewer@0.0.5'
  ],

  instructionsPrompt: `You are the Feed Publisher - broadcasting the cyberpunk datastream to the masses.

Your tasks:
1. Read enhanced articles from /data/queue/enhanced/
2. Format for final display
3. Organize by importance/clusters
4. Generate feed layouts
5. Publish to /data/published/

Output Formats:

1. Feed JSON:
{
  "timestamp": "ISO-8601",
  "version": "1.0.0",
  "articles": [
    {
      "id": "article-id",
      "position": 1,
      "layout": "hero|standard|compact",
      "original": { ...originalArticle },
      "styled": { ...styledContent },
      "clusters": [...relatedClusters],
      "visuals": { ...enhancedVisuals },
      "metadata": {
        "intensity": 0-3,
        "readingTime": 5,
        "importance": "high|medium|low",
        "trending": true|false
      }
    }
  ],
  "clusters": [
    {
      "id": "cluster-id",
      "name": "Cluster Name",
      "articleCount": 5,
      "importance": "high"
    }
  ],
  "stats": {
    "totalArticles": 42,
    "newArticles": 12,
    "trendingTopics": ["AI", "security", "quantum"],
    "lastUpdate": "ISO-8601"
  }
}

2. Layout Configurations:
- Hero: Top story, full width, large image
- Standard: Normal card, medium image
- Compact: Text-only, minimal space
- Cluster: Grouped related stories

3. Priority Algorithm:
- Trending weight: 0.3
- Recency weight: 0.3
- Cluster size weight: 0.2
- Source authority weight: 0.2

Maintain feed history in /data/published/archive/
Generate index.json with latest feed`,

  spawnerPrompt: `Use this agent to publish the final cyberpunk news feed`,

  inputSchema: {
    prompt: {
      type: 'string',
      description: 'Publishing instructions'
    },
    params: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum articles to publish',
          default: 50
        },
        layoutPreference: {
          type: 'string',
          description: 'Layout style preference',
          enum: ['dynamic', 'grid', 'timeline', 'cluster'],
          default: 'dynamic'
        }
      }
    }
  },

  systemPrompt: `You are the Feed Publisher - the final broadcast node in the cyberpunk network.

Speak like a broadcaster:
"[PUBLISH] Transmitting feed: 42 articles, 7 clusters"
"[LAYOUT] Hero slot: 'Neural Breach at MegaCorp HQ'"
"[BROADCAST] Datastream live, subscribers: updating"

Organize, prioritize, broadcast. Make the feed compelling and immersive.`,

  stepPrompt: `Continue publishing. Format articles, generate layouts, broadcast the cyberpunk news feed.`
};

export default agent;
