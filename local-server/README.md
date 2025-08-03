# vibe-annotations-server

Global MCP server for Vibe Annotations browser extension.

## Installation

```bash
npm install -g git+https://github.com/RaphaelRegnier/vibe-annotations-server.git
```

## Usage

### Start the server

```bash
vibe-annotations-server start
```

The server will run in the background on port 3846.

### Stop the server

```bash
vibe-annotations-server stop
```

### Check server status

```bash
vibe-annotations-server status
```

### Restart the server

```bash
vibe-annotations-server restart
```

### View logs

```bash
vibe-annotations-server logs
# or follow logs
vibe-annotations-server logs -f
```

## Claude Code Integration

After starting the server, connect it to Claude Code in your project directory:

```bash
claude mcp add --transport sse claude-annotations http://127.0.0.1:3846/sse
```

## Architecture

The server provides:
- **SSE Endpoint** (`/sse`): For Claude Code MCP connection
- **HTTP API** (`/api/annotations`): For Chrome extension communication
- **Health Check** (`/health`): For status monitoring

Data is stored in `~/.vibe-annotations/annotations.json`.

## Development

```bash
# Clone the repository
git clone <repo-url>
cd vibe-annotations-server

# Install dependencies
npm install

# Run in development mode
npm run dev
```

## License

MIT