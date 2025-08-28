# ConstellationFS Web Demo

An interactive web demo showcasing ConstellationFS with an AI coding assistant. Chat with Claude and watch as it creates files, runs commands, and builds projects using ConstellationFS.

## Features

- 🤖 **AI Chat Interface**: Chat with Claude-3.5-Sonnet powered by ConstellationFS
- 📁 **Live File Explorer**: See filesystem changes in real-time
- 🔄 **Streaming Responses**: Watch AI responses stream in like ChatGPT
- 🛡️ **Safe Sandboxing**: Each session gets an isolated workspace
- ⚡ **Server-Sent Events**: Real-time updates without WebSockets

## Quick Start

### Local Development

1. **Build ConstellationFS package** (from repository root):
   ```bash
   npm install
   npm run build
   ```

2. **Set up the demo**:
   ```bash
   cd examples/web-demo
   npm install
   ```

3. **Set up environment**:
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local and add your Anthropic API key
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000)** in your browser

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/constellation-fs/constellation-fs/tree/main/examples/web-demo)

1. **One-click deploy** using the button above
2. **Set environment variable**: Add your `ANTHROPIC_API_KEY` in Vercel dashboard
3. **Deploy**: Your demo will be live at `your-project.vercel.app`

### Manual Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variable
vercel env add ANTHROPIC_API_KEY
```

## How It Works

### Architecture

```
Browser ←→ Next.js API Routes ←→ ConstellationFS ←→ Filesystem
   ↓              ↓                     ↓
Chat UI    AI Processing         File Operations
   ↑              ↑                     ↑
Server-Sent  Anthropic API      Isolated Workspace
Events       (Claude 3.5)        (/tmp/demo-${sessionId})
```

### API Endpoints

- `POST /api/message` - Send user message to AI
- `GET /api/stream` - Server-Sent Events for AI responses  
- `GET /api/filesystem` - Get current workspace file tree

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
- "Create a simple Node.js package.json"

**Development Tasks**:
- "Build a simple Express.js server"
- "Create a Python Flask hello world app"
- "Set up a basic React component"
- "Write a shell script to automate deployments"

**Project Building**:
- "Create a complete Todo app with HTML, CSS, and JavaScript"
- "Build a REST API with proper error handling"
- "Set up a basic CI/CD pipeline configuration"

## Technical Details

### ConstellationFS Integration

The demo uses ConstellationFS to provide the AI with filesystem access:

```typescript
import { FileSystem } from 'constellation-fs'

// Each user gets an isolated workspace
const fs = new FileSystem(`/tmp/demo-${sessionId}`)

// AI can perform operations
await fs.write('app.js', 'console.log("Hello World")')
await fs.exec('npm init -y')
const files = await fs.ls()
```

### Safety Features

- **Workspace Isolation**: Each session gets a unique `/tmp` directory
- **Dangerous Command Blocking**: ConstellationFS prevents harmful operations
- **Ephemeral Storage**: Workspaces are temporary and auto-cleaned
- **Request Timeouts**: Long-running operations are limited

### Deployment Considerations

**Vercel Serverless**:
- ✅ Works great for demos and light usage
- ✅ Automatic scaling and global distribution
- ⚠️ Limited to `/tmp` directory (ephemeral)
- ⚠️ 60-second timeout for AI operations

**For Production**:
- Consider persistent storage (databases, cloud storage)
- Use container-based deployment for more control
- Implement user authentication and rate limiting
- Add monitoring and error tracking

## Development

### Project Structure

```
examples/web-demo/
├── app/
│   ├── api/
│   │   ├── message/route.ts    # AI message processing
│   │   ├── stream/route.ts     # Server-Sent Events
│   │   └── filesystem/route.ts # File tree API
│   ├── components/
│   │   ├── Chat.tsx           # Chat interface
│   │   └── FileExplorer.tsx   # File tree viewer
│   ├── page.tsx               # Main page
│   ├── layout.tsx             # App layout
│   └── globals.css            # Styles
├── package.json
├── next.config.js
├── vercel.json
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