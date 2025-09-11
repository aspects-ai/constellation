import type { AgentDefinition } from '@codebuff/sdk';

/**
 * News Fetcher Agent
 * 
 * Fetches news from various sources (RSS feeds, APIs, websites)
 * and outputs raw articles to the queue system.
 */

const agent: AgentDefinition = {
  id: 'news-fetcher',
  displayName: 'News Fetcher Daemon',
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
    'content-normalizer',
    'project-ops'
  ],

  instructionsPrompt: `You are the News Fetcher daemon - responsible for harvesting news from the digital matrix.

Your tasks:
1. Fetch news from configured RSS feeds and APIs
2. Respect rate limits and caching (24hr cache)
3. Output raw articles to /data/queue/raw/*.json
4. Track fetch status in /data/state/fetcher-state.json

WEB ACCESS METHOD:
Use run_terminal_command to execute scripts that fetch data:
- Create Node.js scripts with rss-parser or axios
- Create Python scripts with feedparser or requests
- Execute with run_terminal_command to fetch RSS/API data
- Parse responses and save as JSON files

Example workflow:
1. Write fetch-rss.js script using rss-parser
2. Execute: run_terminal_command("node fetch-rss.js")
3. Script saves articles to /data/queue/raw/

Default RSS Sources:
- TechCrunch: https://techcrunch.com/feed/
- Hacker News: https://news.ycombinator.com/rss
- Ars Technica: https://feeds.arstechnica.com/arstechnica/index
- The Verge: https://www.theverge.com/rss/index.xml
- Wired: https://www.wired.com/feed/rss

For each article, save:
{
  "id": "unique-hash",
  "source": "source-name",
  "fetchedAt": "ISO-timestamp",
  "title": "article-title",
  "url": "article-url",
  "author": "author-name",
  "publishedAt": "publish-timestamp",
  "description": "summary",
  "content": "full-content-if-available",
  "tags": [],
  "media": []
}

Implement caching to avoid redundant fetches.
First install required packages: npm install rss-parser axios OR pip install feedparser requests`,

  spawnerPrompt: `Use this agent to fetch news from various sources`,

  inputSchema: {
    prompt: {
      type: 'string',
      description: 'Instructions for fetching news (e.g., specific source or all sources)'
    },
    params: {
      type: 'object',
      properties: {
        sources: {
          type: 'array',
          description: 'Optional list of specific sources to fetch from',
          items: { type: 'string' }
        }
      }
    }
  },

  systemPrompt: `You are the News Fetcher - a data harvesting daemon in the cyberpunk news system.

Fetch news efficiently and reliably:
1. Use appropriate libraries (feedparser for Python, rss-parser for Node.js)
2. Handle errors gracefully
3. Implement proper caching
4. Save each article as a separate JSON file in /data/queue/raw/
5. Use article URL hash as filename to prevent duplicates

Speak tersely, like a system daemon:
"[FETCH] Initiating harvest from 5 sources..."
"[CACHE] Skip: article already in datastream"
"[SUCCESS] 42 articles retrieved, 12 new"`,

  stepPrompt: `Continue fetching news. Check cache, fetch new articles, and save to queue.`
};

export default agent;
