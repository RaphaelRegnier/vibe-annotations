# vibe-annotations-server

Global MCP server for Vibe Annotations browser extension.

## Quick start

```bash
npx vibe-annotations-server init
```

Interactive wizard — installs the global package, starts the server on port 3846, configures your AI coding agent (Claude Code, Cursor, Windsurf, Codex, OpenClaw, VS Code), and links the Chrome extension. Supports these flags: `--agent <name>` (repeatable), `--non-interactive`, `--project` (use project scope instead of user), `--skip-server`, `--skip-extension`, `--reset`.

## Manual installation

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

Run the setup wizard again after upgrading to migrate old HTTP-only agent configurations:

```bash
vibe-annotations-server init
vibe-annotations-server token
```

Paste the token only into the extension's **Options** page (open it from Chrome's extension menu or chrome://extensions). Pair again after restarting Chrome. The credential is stored only in trusted extension session storage. Do not paste it into a website or commit it to a project config.

The wizard configures agents to run a local stdio proxy. The proxy reads `~/.vibe-annotations/auth-token` and authenticates to the running server. A generic manual configuration is:

```json
{ "mcpServers": { "vibe-annotations": { "command": "vibe-annotations-server", "args": ["mcp"] } } }
```

For Claude Code:

```bash
claude mcp add --scope user --transport stdio vibe-annotations -- vibe-annotations-server mcp
```

All data endpoints, including legacy SSE, require bearer authentication. Only the non-sensitive health check and approved extension preflights are public. HTTP clients may explicitly configure an Authorization header; prefer the local proxy to keep credentials out of configuration files.

The listener binds only to `127.0.0.1:3846`. WSL/cross-host development requires an explicitly secured tunnel; do not expose the port to a network. An unpacked extension has a different ID: start the server with `VIBE_ANNOTATIONS_EXTENSION_ID` set to its exact 32-character ID from chrome://extensions.

Screenshots use temporary `activeTab` permission. Activate the extension with its toolbar icon or registered keyboard shortcut before capturing. The unauthenticated `window.__vibeAnnotations` page API is removed; agents still read and resolve user-created feedback over authenticated MCP.

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