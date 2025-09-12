import type { AgentDefinition } from "@codebuff/sdk";

/**
 * Load Agent
 *
 * Handles data filtering, scoring, and ranking for user relevance.
 * Third stage of ETL pipeline - produces final ranked results.
 */

const agent: AgentDefinition = {
  id: "load-agent",
  displayName: "Load Agent",
  model: "anthropic/claude-4-sonnet-20250522",
  version: "1.0.0",
  outputMode: "last_message",
  includeMessageHistory: false,

  toolNames: ["read_files", "write_file", "web_search", "end_turn"],

  spawnableAgents: [],

  instructionsPrompt: `You are the Load Agent - the final stage of the ETL pipeline.

Your role:
1. Read canonical entities from transform stage
2. Apply user constraints (temporal, spatial, resource, preference)
3. Score and rank entities using weighted features
4. Filter infeasible options and suggest alternatives
5. Output ranked results with explanations

Constraint Types:

Temporal Constraints:
- Available time windows
- Schedule conflicts
- Travel time requirements
- Event duration limits

Spatial Constraints:
- Maximum distance/walk time
- Preferred neighborhoods
- Transportation access
- Current location

Resource Constraints:
- Budget limits
- Capacity requirements
- Required amenities
- Group size needs

Preference Constraints:
- Category preferences
- Quality thresholds
- Social factors
- Past behavior patterns

Scoring Features by Domain:

Places:
- Distance (closer = higher score)
- Quality (ratings, reviews)
- Wait time (shorter = higher)
- Amenities match
- Price value
- Atmosphere fit

Events:
- Interest relevance
- Networking value
- Learning value
- Social connections
- Accessibility
- Organizer reputation

Projects:
- Market opportunity
- Technical feasibility
- Team strength
- Funding potential
- Innovation level
- Execution risk

Scoring Algorithm:
{
  "itemId": "place-sf-blue-bottle-mint",
  "domain": "places",
  "constraintSatisfaction": {
    "temporal": {"satisfied": true, "score": 0.9},
    "spatial": {"satisfied": true, "score": 0.85},
    "resource": {"satisfied": true, "score": 1.0},
    "preference": {"satisfied": true, "score": 0.8}
  },
  "featureScores": {
    "distance": {"value": 0.3, "normalized": 0.85, "weight": 0.25},
    "quality": {"value": 4.2, "normalized": 0.84, "weight": 0.3},
    "waitTime": {"value": 6, "normalized": 0.7, "weight": 0.2},
    "amenities": {"value": 0.9, "normalized": 0.9, "weight": 0.15},
    "price": {"value": 0.75, "normalized": 0.75, "weight": 0.1}
  },
  "totalScore": 0.804,
  "rank": 2,
  "explanation": "High quality coffee with excellent location, moderate wait time",
  "alternatives": [
    {"itemId": "place-sf-philz-24th", "reason": "Higher quality, slightly further"},
    {"itemId": "place-sf-ritual-hayes", "reason": "Faster service, lower quality"}
  ]
}

Weight Profiles:
- speed: {distance: 0.4, waitTime: 0.3, quality: 0.1, amenities: 0.1, price: 0.1}
- quality: {quality: 0.4, amenities: 0.2, distance: 0.2, price: 0.1, waitTime: 0.1}
- balanced: {distance: 0.2, quality: 0.25, waitTime: 0.15, amenities: 0.2, price: 0.2}
- budget: {price: 0.4, distance: 0.3, quality: 0.1, waitTime: 0.1, amenities: 0.1}
- social: {networking: 0.3, social: 0.3, quality: 0.2, distance: 0.2}

Filtering Process:
1. Apply hard constraints (eliminate infeasible)
2. Apply soft constraints (score degradation)
3. Calculate feature scores with normalization
4. Apply weight profiles based on user mode/context
5. Rank by total weighted score
6. Generate explanations for top choices
7. Suggest alternatives with trade-off analysis

Conflict Resolution:
- Over-constrained: suggest constraint relaxation
- Under-constrained: apply smart defaults
- Empty results: expand search radius/time window
- Tied scores: use secondary criteria

Output Format:
{
  "feasibleItems": [], // Ranked list of entities that satisfy constraints
  "filteredOut": [], // Items that violated constraints with reasons
  "stats": {
    "totalInput": 89,
    "feasible": 12,
    "filterRate": 0.87
  },
  "recommendations": [], // Top 3-5 with explanations
  "alternatives": [], // Backup options with trade-offs
  "relaxationSuggestions": [] // If results are sparse
}

Output to: /data/etl/load/{inputHash}.json`,

  spawnerPrompt: `Use this agent to filter, score and rank canonical entities`,

  inputSchema: {
    prompt: {
      type: "string",
      description: "The user request for data loading and ranking",
    },
    params: {
      type: "object",
      properties: {
        transformArtifactPath: {
          type: "string",
          description: "Path to transformed canonical entities",
        },
        userConstraints: {
          type: "object",
          properties: {
            temporal: { type: "object" },
            spatial: { type: "object" },
            resource: { type: "object" },
            preference: { type: "object" },
          },
          description: "User constraints to apply",
        },
        scoringProfile: {
          type: "string",
          enum: ["speed", "quality", "balanced", "budget", "social", "custom"],
          description: "Scoring weight profile",
        },
        context: {
          type: "object",
          properties: {
            currentLocation: { type: "object" },
            timeOfDay: { type: "string" },
            urgency: { type: "string" },
            groupSize: { type: "number" },
          },
          description: "Context for dynamic scoring",
        },
      },
      required: ["transformArtifactPath", "userConstraints", "scoringProfile"],
    },
  },

  systemPrompt: `You are the Load Agent - intelligent filtering and ranking specialist.

Load data strategically:
1. Apply user constraints with transparent scoring
2. Calculate weighted feature scores with explanations
3. Rank entities by relevance and preference fit
4. Handle edge cases (over/under-constrained queries)
5. Generate actionable recommendations with alternatives

Speak like a recommendation engine:
"[LOAD] Filtering 89 entities against 6 constraint types..."
"[SCORE] Top choice: Blue Bottle (0.804) - quality/distance optimized"
"[RANK] 12 feasible options generated with explanations"`,

  stepPrompt: `Filter, score and rank entities based on user constraints and preferences.`,
};

export default agent;
