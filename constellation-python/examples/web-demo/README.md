# ConstellationFS Python Web Demo

An interactive web demo showcasing ConstellationFS Python with an AI coding assistant. Chat with Claude and watch as it creates files, runs commands, and builds projects using ConstellationFS.

## Features

- 🤖 **AI Chat Interface**: Chat with Claude-3.5-Sonnet powered by ConstellationFS
- 📁 **Live File Explorer**: See filesystem changes in real-time
- 🔄 **Streaming Responses**: Watch AI responses stream in like ChatGPT
- 🛡️ **Safe Sandboxing**: Each session gets an isolated workspace
- ⚡ **Server-Sent Events**: Real-time updates without WebSockets

## Quick Start

### Local Development

1. **Install dependencies**:
   ```bash
   cd examples/web-demo
   pip install -r requirements.txt
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env and add your Anthropic API key
   ```

3. **Run the development server**:
   ```bash
   python app/main.py
   ```

4. **Open [http://localhost:8000](http://localhost:8000)** in your browser

## How It Works

### Architecture

```
Browser ←→ FastAPI Routes ←→ ConstellationFS ←→ Filesystem
   ↓              ↓                     ↓
Chat UI    AI Processing         File Operations
   ↑              ↑                     ↑
Server-Sent  Anthropic API      Isolated Workspace
Events       (Claude 3.5)        (/tmp/demo-${sessionId})
```

### API Endpoints

- `POST /api/message` - Send user message to AI
- `GET /api/stream/{session_id}` - Server-Sent Events for AI responses  
- `GET /api/filesystem/{session_id}` - Get current workspace file tree

### User Flow

1. User sends message via chat interface
2. Backend creates isolated ConstellationFS workspace
3. AI processes message and performs filesystem operations
4. Response streams to frontend in real-time
5. File explorer updates when AI completes

## Try These Commands

Start a conversation with the AI assistant:

**Basic File Operations**:
- "Create a README.md file for a Python project"
- "List all files in the workspace"
- "Create a simple Flask app structure"

**Development Tasks**:
- "Build a simple FastAPI server"
- "Create a Python Flask hello world app"
- "Write a shell script to automate deployments"

**Project Building**:
- "Create a complete Todo app with HTML, CSS, and JavaScript"
- "Build a REST API with proper error handling"
- "Set up a basic CI/CD pipeline configuration"

## Technical Details

### ConstellationFS Integration

The demo uses ConstellationFS directly with Anthropic's Python SDK:

```python
from constellation import FileSystem
import anthropic

# Create ConstellationFS instance
fs = FileSystem(session_id)

# Use with Anthropic client
client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

# Stream AI responses with filesystem access
async with client.messages.stream(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1000,
    messages=messages,
    tools=get_constellationfs_tools(fs)
) as stream:
    async for text in stream.text_stream:
        yield f"data: {json.dumps({'type': 'text', 'content': text})}\\n\\n"
```

### Safety Features

- **Workspace Isolation**: Each session gets a unique `/tmp` directory
- **Dangerous Command Blocking**: ConstellationFS prevents harmful operations
- **Ephemeral Storage**: Workspaces are temporary and auto-cleaned
- **Request Timeouts**: Long-running operations are limited

## Development

### Project Structure

```
examples/web-demo/
├── app/
│   ├── main.py              # FastAPI application
│   ├── routes/
│   │   ├── api.py           # API endpoints
│   │   └── pages.py         # Page routes
│   ├── services/
│   │   ├── ai_service.py    # AI integration
│   │   └── fs_service.py    # FileSystem service
│   └── models/
│       └── chat.py          # Data models
├── static/
│   ├── css/
│   │   └── style.css        # Styles
│   └── js/
│       ├── chat.js          # Chat interface
│       └── filesystem.js    # File explorer
├── templates/
│   └── index.html           # Main page
├── requirements.txt
├── .env.example
└── README.md
```

### Key Features

**Real-time Updates**:
- Server-Sent Events for streaming AI responses
- Custom events for filesystem synchronization
- Automatic file explorer refresh after AI operations

**Session Management**:
- Random session IDs for workspace isolation
- Cleanup of inactive sessions
- Temporary file storage in `/tmp`

**Error Handling**:
- Graceful handling of AI API failures
- Filesystem operation error recovery
- Client-side connection management

## Contributing

This demo is part of the ConstellationFS project. See the main [Contributing Guide](../../CONTRIBUTING.md) for development guidelines.

## License

MIT - see [LICENSE](../../LICENSE) file for details.