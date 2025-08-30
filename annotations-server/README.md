# vibe-annotations-server

Global MCP server for Vibe Annotations browser extension.

## Installation

```bash
npm install -g vibe-annotations-server
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

## AI Coding Agent Integration

After starting the server, connect it to your AI coding agent. The server supports multiple agents via MCP (Model Context Protocol) using both HTTP and SSE transports.

### Claude Code

In your project directory, run:

```bash
# Recommended (HTTP transport - more stable)
claude mcp add --transport http vibe-annotations http://127.0.0.1:3846/mcp

# Alternative (SSE transport - for compatibility)
claude mcp add --transport sse vibe-annotations http://127.0.0.1:3846/sse
```

### Cursor

1. Open Cursor → Settings → Cursor Settings
2. Go to the Tools & Integrations tab
3. Click + Add new global MCP server
4. Enter the following configuration and save:

```json
{
  "mcpServers": {
    "vibe-annotations": {
      "url": "http://127.0.0.1:3846/mcp"
    }
  }
}
```

### Windsurf

1. Navigate to Windsurf → Settings → Advanced Settings
2. Scroll down to the Cascade section
3. Click "Add new server" or edit the raw JSON config file
4. Add the following configuration:

```json
{
  "mcpServers": {
    "vibe-annotations": {
      "serverUrl": "http://127.0.0.1:3846/mcp"
    }
  }
}
```

### VS Code

1. Install an AI extension that supports MCP (like GitHub Copilot Chat or Continue)
2. Go to Code → Settings → Settings or use the shortcut ⌘,
3. In the search bar, type "MCP"
4. Look for MCP server configurations in your AI extension settings
5. Add the following SSE configuration:

```json
{
  "mcpServers": {
    "vibe-annotations": {
      "type": "sse",
      "url": "http://127.0.0.1:3846/mcp"
    }
  }
}
```

**Note:** MCP support varies by AI extension. Check your extension's documentation for specific setup instructions.

### Other Editors

Other code editors and tools that support SSE (Server-Sent Events) can also connect to the Vibe Annotations MCP server. If you're using a different editor or tool, check its documentation to confirm it supports SSE-based communication. If it does, you can manually add the server using this configuration:

```json
{
  "mcpServers": {
    "vibe-annotations": {
      "url": "http://127.0.0.1:3846/mcp"
    }
  }
}
```

**Note:** The Vibe Annotations MCP server supports both HTTP and SSE transports. HTTP transport is recommended for better stability. Use the URL: `http://127.0.0.1:3846/mcp` (HTTP) or `http://127.0.0.1:3846/sse` (SSE).

## Architecture

The server provides:
- **SSE Endpoint** (`/sse`): For AI coding agent MCP connections
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