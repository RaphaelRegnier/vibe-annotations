# Vibe Annotations

AI-powered development annotations for localhost projects. Drop comments on your localhost apps and let Claude Code implement the fixes automatically.

## Features

- 🏠 **Localhost-focused**: Works on your development projects
- 🤖 **AI-powered**: Integrates with Claude Code via MCP
- ⚡ **Instant feedback**: Click, comment, bulk-fix
- 👨‍💻 **Developer-friendly**: Built for modern web development

## Architecture

Vibe Annotations uses a two-piece architecture:

1. **Browser Extension** (`/extension`): UI, setup guidance, annotation management
2. **NPM Package** (`vibe-annotations-server`): MCP server, local HTTP API, data storage

## Quick Start

### 1. Install the Browser Extension
Install the `vibe-annotations` extension from the Chrome Web Store.

### 2. Install the Global Server
```bash
npm install -g git+https://github.com/RaphaelRegnier/vibe-annotations-server.git
```

### 3. Start the Server
```bash
vibe-annotations-server start
```

### 4. Connect Claude Code
In your project directory:
```bash
claude mcp add --transport sse vibe-annotations http://127.0.0.1:3846/sse
```

### 5. Start Using Annotations
- Open the extension popup for detailed setup instructions
- Start annotating your localhost projects!
- Use Claude Code to automatically implement fixes

## User Experience Flow

1. **Extension Installation**: Install from Chrome Web Store
2. **Setup Instructions**: Extension popup guides through terminal setup
3. **Server Detection**: Extension automatically detects running server
4. **Daily Usage**: Create annotations → Use Claude Code → Fixes implemented

## Server Management

```bash
# Check server status
vibe-annotations-server status

# Stop server
vibe-annotations-server stop

# Restart server
vibe-annotations-server restart
```

## Development

See `/extension` directory for browser extension development. The server package will be published separately as `vibe-annotations-server`.

## License

MIT