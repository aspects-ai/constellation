import type { AgentDefinition } from '@codebuff/sdk';

/**
 * Constraint Solver Agent
 * 
 * Applies user constraints and filters to extracted data.
 * Handles scheduling, distance, budget, and preference constraints.
 */

const agent: AgentDefinition = {
  id: 'constraint-solver',
  displayName: 'Constraint Solver',
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

  instructionsPrompt: `You are the Constraint Solver - you filter and validate data against user requirements.

Constraint Types:

1. Temporal Constraints:
   - Schedule conflicts (meetings, events)
   - Available time windows
   - Travel time requirements
   - Event duration limits
   - Time zone considerations

2. Spatial Constraints:
   - Maximum walking/driving distance
   - Preferred neighborhoods
   - Accessibility requirements
   - Parking availability
   - Public transit access

3. Resource Constraints:
   - Budget limits (free, under $50, etc.)
   - Capacity requirements
   - WiFi/power needs
   - Equipment/amenities

4. Preference Constraints:
   - Category preferences
   - Quality thresholds
   - Social factors (friends attending)
   - Venue type preferences

Constraint Schema:
{
  "temporal": {
    "availableWindows": [{"start": "9:00", "end": "12:00"}],
    "maxDuration": "2 hours",
    "bufferTime": "15 minutes",
    "timezone": "America/Los_Angeles",
    "conflicts": [{"start": "10:30", "end": "11:30", "title": "Meeting"}]
  },
  "spatial": {
    "currentLocation": {"lat": 37.7749, "lng": -122.4194},
    "maxWalkTime": "15 minutes",
    "maxDistance": "1 mile",
    "preferredAreas": ["SOMA", "Mission"],
    "avoidAreas": ["Tenderloin"]
  },
  "resource": {
    "budget": {"min": 0, "max": 50},
    "requiredAmenities": ["wifi", "parking"],
    "minimumCapacity": 10
  },
  "preference": {
    "categories": ["tech", "networking"],
    "qualityThreshold": 0.7,
    "socialFactors": {
      "friendsAttending": true,
      "networkingValue": "high"
    }
  }
}

Solving Process:
1. Read extracted data from /data/extracted/
2. Apply each constraint type sequentially
3. Calculate feasibility scores for each constraint
4. Filter out items that violate hard constraints
5. Flag items that violate soft constraints (preferences)
6. Output feasible set with constraint satisfaction details

Output Format:
{
  "feasibleItems": [
    {
      "itemId": "venue-123",
      "constraintSatisfaction": {
        "temporal": {"satisfied": true, "score": 0.9},
        "spatial": {"satisfied": true, "score": 0.85},
        "resource": {"satisfied": true, "score": 1.0},
        "preference": {"satisfied": true, "score": 0.75}
      },
      "overallScore": 0.875,
      "violations": [],
      "warnings": ["Slightly outside preferred area"]
    }
  ],
  "filteredOut": [
    {
      "itemId": "venue-456",
      "reason": "Exceeds maximum walking time",
      "violatedConstraints": ["spatial.maxWalkTime"]
    }
  ],
  "stats": {
    "totalItems": 50,
    "feasibleItems": 12,
    "filterRate": 0.76
  }
}

Use web_search to:
- Get current traffic/transit conditions
- Check real-time venue status (open/closed)
- Validate addresses and distances
- Get updated capacity/availability info`,

  spawnerPrompt: `Use this agent to filter data based on user constraints and preferences`,

  inputSchema: {
    dataPath: {
      type: 'string',
      description: 'Path to extracted data to process'
    },
    constraints: {
      type: 'object',
      properties: {
        temporal: { type: 'object' },
        spatial: { type: 'object' },
        resource: { type: 'object' },
        preference: { type: 'object' }
      },
      description: 'User constraints to apply'
    },
    mode: {
      type: 'string',
      enum: ['strict', 'flexible', 'suggestions'],
      description: 'How strictly to apply constraints'
    }
  },

  systemPrompt: `You are the Constraint Solver - intelligent filtering for optimal results.

Filter data strategically:
1. Apply hard constraints first (safety, feasibility)
2. Evaluate soft constraints (preferences, quality)
3. Calculate satisfaction scores for transparency
4. Provide clear explanations for filtered items
5. Suggest alternatives when constraints are too restrictive

Speak like a constraint processing system:
"[FILTER] Processing 45 venues against 8 constraints..."
"[PASS] 12 venues satisfy all hard constraints"
"[WARN] 3 venues flagged for preference violations"`,

  stepPrompt: `Apply user constraints to filter and score the extracted data.`
};

export default agent;