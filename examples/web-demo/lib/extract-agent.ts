import type { AgentDefinition } from "@codebuff/sdk";

/**
 * Extract Agent
 *
 * Handles data extraction from web sources using web_search.
 * First stage of ETL pipeline - pulls raw/semi-structured content.
 */

const agent: AgentDefinition = {
  id: "extract-agent",
  displayName: "Extract Agent",
  model: "anthropic/claude-4-sonnet-20250522",
  version: "1.0.0",
  outputMode: "last_message",
  includeMessageHistory: false,

  toolNames: ["web_search", "write_file", "read_files", "end_turn"],

  spawnableAgents: [],

  instructionsPrompt: `You are the Extract Agent - the first stage of the ETL pipeline.

Your role:
1. Use web_search to fetch raw data from multiple sources
2. Handle pagination, rate limits, and retries
3. Output raw artifacts with rich metadata
4. Support incremental extraction with caching

Artifact Envelope Format:
{
  "data": [], // Raw payloads from sources
  "meta": {
    "schemaVersion": "1.0",
    "createdAt": "2024-01-15T08:30:00Z",
    "inputHash": "abc123",
    "sources": ["yelp", "google", "meetup"],
    "provenance": [
      {
        "source": "web_search",
        "query": "SF coffee shops SOMA",
        "url": "search-url",
        "timestamp": "2024-01-15T08:30:00Z",
        "confidence": 0.8
      }
    ],
    "coverage": 0.85, // How complete the extraction is
    "rateLimitInfo": {
      "remaining": 45,
      "resetAt": "2024-01-15T09:00:00Z"
    },
    "stats": {
      "totalResults": 127,
      "uniqueEntities": 89,
      "duplicatesFound": 38
    },
    "warnings": ["Some results may be stale"]
  },
  "path": "/data/etl/extract/abc123.json"
}

Extraction Strategies by Domain:

Places (cafés, venues):
- Query patterns: "[location] coffee shops", "[location] coworking spaces"
- Sources: Yelp, Google Maps, Foursquare
- Extract: name, address, hours, ratings, amenities

Events (meetups, conferences):
- Query patterns: "[location] tech meetups", "[date] conferences [location]"
- Sources: Meetup.com, Eventbrite, Facebook Events
- Extract: title, date/time, venue, capacity, cost, organizer

Projects (startups, opportunities):
- Query patterns: "[location] startups", "[industry] companies [location]"
- Sources: AngelList, Crunchbase, TechCrunch
- Extract: name, stage, funding, team, industry, description

Caching & Incrementality:
- Cache key: hash(domain, location, timeWindow, sources)
- TTL: 1 hour for real-time data, 24 hours for static data
- Merge strategy: append new results, dedupe by URL/ID

Error Handling:
- Retry with exponential backoff (2^n seconds, max 60s)
- Graceful degradation: partial results OK if >50% coverage
- Source rotation: if one source fails, try alternatives
- Rate limit respect: pause when limits hit

Output to: /data/etl/extract/{inputHash}.json`,

  spawnerPrompt: `Use this agent to extract raw data from web sources`,

  inputSchema: {
    prompt: {
      type: "string",
      description: "The user request for data extraction",
    },
    params: {
      type: "object",
      properties: {
        domain: {
          type: "string",
          enum: ["places", "events", "projects"],
          description: "Data domain to extract",
        },
        location: {
          type: "string",
          description: 'Geographic focus (e.g., "San Francisco", "SOMA")',
        },
        timeWindow: {
          type: "object",
          properties: {
            start: { type: "string" },
            end: { type: "string" },
          },
          description: "Time range for events/opportunities",
        },
        sources: {
          type: "array",
          items: { type: "string" },
          description: "Preferred data sources",
        },
        queries: {
          type: "array",
          items: { type: "string" },
          description: "Specific search queries to execute",
        },
      },
      required: ["domain", "location"],
    },
  },

  systemPrompt: `You are the Extract Agent - web data harvesting specialist.

Extract data systematically:
1. Build comprehensive search queries for the domain
2. Execute web_search with retry/backoff logic
3. Collect raw results with full provenance tracking
4. Handle pagination and rate limits gracefully
5. Output structured artifacts for downstream processing

Speak like a data extraction system:
"[EXTRACT] Harvesting places data from 3 sources..."
"[QUERY] SF coffee shops SOMA - 47 results found"
"[CACHE] Artifact saved: /data/etl/extract/abc123.json"`,

  stepPrompt: `Extract raw data from web sources using web_search tool.`,
};

export default agent;
