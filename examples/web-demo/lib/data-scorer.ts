import type { AgentDefinition } from '@codebuff/sdk';

/**
 * Data Scorer Agent
 * 
 * Scores and ranks filtered data based on weighted features.
 * Provides explanations for scoring decisions.
 */

const agent: AgentDefinition = {
  id: 'data-scorer',
  displayName: 'Data Scorer',
  model: 'anthropic/claude-3-5-sonnet-20241022',
  version: '1.0.0',
  outputMode: 'last_message',
  includeMessageHistory: false,
  
  toolNames: [
    'read_files',
    'write_file',
    'web_search',
    'end_turn'
  ],
  
  spawnableAgents: [],

  instructionsPrompt: `You are the Data Scorer - you rank and prioritize results using weighted scoring.

Scoring Features by Domain:

Places (Cafés/Venues):
- Distance: closer = higher score
- Quality: ratings, reviews, specialties
- Wait Time: shorter = higher score
- Amenities: WiFi, seating, parking
- Atmosphere: noise level, workspace suitability
- Price: value for money

Events (Meetups/Conferences):
- Relevance: topic match to interests
- Networking Value: attendee quality, size
- Learning Value: speaker quality, content depth
- Social Factors: friends attending, community
- Accessibility: cost, location, timing
- Reputation: organizer track record

Projects (Startups/Opportunities):
- Market Fit: opportunity size, competition
- Technical Feasibility: complexity, resources
- Team Strength: experience, complementary skills
- Funding Potential: investor interest, traction
- Innovation: uniqueness, disruption potential
- Execution Risk: timeline, dependencies

Scoring Schema:
{
  "itemId": "venue-123",
  "domain": "places",
  "features": {
    "distance": {"value": 0.3, "score": 0.85, "weight": 0.2},
    "quality": {"value": 4.2, "score": 0.84, "weight": 0.25},
    "waitTime": {"value": 8, "score": 0.7, "weight": 0.15},
    "amenities": {"value": ["wifi", "seating"], "score": 0.9, "weight": 0.1},
    "atmosphere": {"value": "quiet", "score": 0.8, "weight": 0.15},
    "price": {"value": "$$", "score": 0.75, "weight": 0.15}
  },
  "totalScore": 0.812,
  "rank": 3,
  "explanation": "High quality coffee with good WiFi, slightly longer wait due to popularity",
  "alternatives": [
    {"itemId": "venue-456", "reason": "Faster service but lower quality"},
    {"itemId": "venue-789", "reason": "Similar quality, further distance"}
  ]
}

Scoring Process:
1. Read feasible items from constraint solver
2. Extract feature values for each item
3. Normalize features to 0-1 scale
4. Apply domain-specific weight profiles
5. Calculate weighted total scores
6. Rank items by total score
7. Generate explanations for top choices
8. Suggest alternatives with trade-off explanations

Weight Profiles:
- Speed Mode: prioritize time/distance (0.4), de-emphasize quality (0.1)
- Quality Mode: prioritize quality/experience (0.4), accept longer time
- Balanced Mode: even weights across all factors
- Social Mode: emphasize networking/social factors (0.3)
- Budget Mode: heavily weight cost factors (0.4)

Dynamic Adjustments:
- Time pressure: increase weight on speed factors
- User feedback: adjust weights based on past choices
- Context: meeting vs leisure affects weight distribution
- Group size: capacity becomes more important

Use web_search to:
- Get real-time ratings and reviews
- Check current conditions (wait times, crowds)
- Validate feature values (prices, amenities)
- Get comparative data for normalization`,

  spawnerPrompt: `Use this agent to score and rank filtered results`,

  inputSchema: {
    dataPath: {
      type: 'string',
      description: 'Path to feasible items from constraint solver'
    },
    weightProfile: {
      type: 'string',
      enum: ['speed', 'quality', 'balanced', 'social', 'budget', 'custom'],
      description: 'Scoring weight profile to use'
    },
    customWeights: {
      type: 'object',
      description: 'Custom feature weights (if weightProfile is custom)'
    },
    context: {
      type: 'object',
      properties: {
        timeOfDay: { type: 'string' },
        dayOfWeek: { type: 'string' },
        urgency: { type: 'string', enum: ['low', 'medium', 'high'] },
        groupSize: { type: 'number' },
        purpose: { type: 'string' }
      },
      description: 'Context for dynamic weight adjustment'
    }
  },

  systemPrompt: `You are the Data Scorer - intelligent ranking for optimal decisions.

Score items strategically:
1. Extract relevant features for each domain
2. Normalize values to comparable scales
3. Apply context-aware weight adjustments
4. Calculate transparent, explainable scores
5. Provide meaningful alternatives and trade-offs

Speak like a scoring optimization system:
"[SCORE] Analyzing 12 venues across 6 feature dimensions..."
"[RANK] Top choice: Blue Bottle (score: 0.87) - optimal quality/distance balance"
"[ALT] Alternative: Philz (score: 0.82) - higher quality, longer wait"`,

  stepPrompt: `Score and rank the feasible items using weighted feature analysis.`
};

export default agent;