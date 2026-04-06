# Vibe Annotations

[![License: PolyForm Shield](https://img.shields.io/badge/License-PolyForm%20Shield-blue)](https://polyformproject.org/licenses/shield/1.0.0)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-green)](https://chrome.google.com/webstore)
[![Server Package](https://img.shields.io/badge/Server-NPM-blue)](https://www.npmjs.com/package/vibe-annotations-server)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

_[Vibe Annotations](https://www.vibe-annotations.com/) is a visual collaborative tool for you and your AI coding agent_

---
**Get started:** Install the [browser extension](https://chromewebstore.google.com/detail/gkofobaeeepjopdpahbicefmljcmpeof?utm_source=item-share-cb)
**What it does:** Annotate any website or app, make direct design tweaks, collaborate with your AI coding agent or teammates.
**Should I use it?** If you're a PM, Marketer, Designer or Developper having to review websites regularly, and looking for an efficient way to convey intent and share context with your AI, then Vibe Annotations is made for you.

## Feature demos

✏️ Annotate, copy/paste to your AI coding agent:
https://github.com/user-attachments/assets/ebcf5a17-423c-459c-b5d5-2876b671c5a7

🎨 Make persisting direct design tweaks:
https://github.com/user-attachments/assets/66bc31ed-86d6-4fc0-ab69-7e4ed8c7c27a

🔌 Use the MCP server to share your annotations, any websites, multiple pages:
https://github.com/user-attachments/assets/2dc8e03c-a760-4e31-afac-537200387788

🤖 Annotate with a browser-capable AI coding agent:
https://github.com/user-attachments/assets/5839d3df-f3e6-4b05-b58a-fdd619487aa4

🤝 Collaborate with teammates using export / import features:
https://github.com/user-attachments/assets/58de5fad-d7fa-490d-849f-d25771758067

👀 Use watch mode, never leave your website:
https://github.com/user-attachments/assets/c74d3a43-61c4-4542-ab43-c559cd6e44bf


## Documentation (available in the extension)

### 1. Install the Browser Extension

**From Chrome Web Store:**
Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/gkofobaeeepjopdpahbicefmljcmpeof)

**For Development:**
Go to your chromium browser extension page, and click "Load unpacked" then select /extension directory.

### 2. Install the Global Server
```bash
npm install -g vibe-annotations-server
```

### 3. Start the Server
```bash
vibe-annotations-server start
```

### 4. Connect Your AI Coding Agent
Choose your AI coding agent and follow the setup:

#### Claude Code
In your project directory:
```bash
# Recommended (HTTP transport - more stable)
claude mcp add --transport http vibe-annotations http://127.0.0.1:3846/mcp

# Alternative (SSE transport - for compatibility)
claude mcp add --transport sse vibe-annotations http://127.0.0.1:3846/sse
```

#### Cursor
1. Open Cursor → Settings → Cursor Settings
2. Go to the Tools & Integrations tab
3. Click + Add new global MCP server
4. Add this configuration:
```json
{
  "mcpServers": {
    "vibe-annotations": {
      "url": "http://127.0.0.1:3846/mcp"
    }
  }
}
```

**Alternative (SSE transport):**
```json
{
  "mcpServers": {
    "vibe-annotations": {
      "url": "http://127.0.0.1:3846/sse"
    }
  }
}
```

#### Windsurf
1. Navigate to Windsurf → Settings → Advanced Settings
2. Scroll down to the Cascade section
3. Add this configuration:
```json
{
  "mcpServers": {
    "vibe-annotations": {
      "serverUrl": "http://127.0.0.1:3846/mcp"
    }
  }
}
```

**Alternative (SSE transport):**
```json
{
  "mcpServers": {
    "vibe-annotations": {
      "serverUrl": "http://127.0.0.1:3846/sse"
    }
  }
}
```

#### Codex
Add to `~/.codex/config.toml`:
```toml
[mcp_servers.vibe-annotations]
url = "http://127.0.0.1:3846/mcp"
```

#### OpenClaw
Add to `~/.openclaw/openclaw.json`:
```json
{
  "mcpServers": {
    "vibe-annotations": {
      "url": "http://127.0.0.1:3846/mcp"
    }
  }
}
```

#### VS Code
Install an AI extension that supports MCP, then add this configuration to your MCP settings:
```json
{
  "mcpServers": {
    "vibe-annotations": {
      "url": "http://127.0.0.1:3846/mcp"
    }
  }
}
```

### 5. Start Annotating

Open a localhost page, click **Annotate** in the toolbar, and click any element to leave feedback. Then either:

- **Copy & paste**: Click **Copy** in the toolbar and paste into any AI chat
- **MCP (automatic)**: Tell your agent to read and implement vibe annotations
- **Watch mode (hands-free)**: Tell your agent "Start watching Vibe Annotations" — it loops automatically

### 6. (Optional) Enable Local File Support

To annotate local HTML files (file:// URLs) instead of localhost:

1. Go to `chrome://extensions/`
2. Find "Vibe Annotations" and click "Details"
3. Enable "Allow access to file URLs"
4. Refresh your local HTML file

**Note:** This is only needed for local files. Localhost development servers work without this step.

## MCP Architecture

Vibe Annotations is split into two independent pieces that talk over HTTP:

1. **Browser Extension** (`/extension`) — Injects a floating toolbar on any page. Handles inspection mode, annotation popovers, live CSS previews, badge rendering, import/export, and clipboard copy. Stores annotations in Chrome Storage and syncs them to the server when available.

2. **MCP Server** (`vibe-annotations-server`) — A global npm package that runs locally. Exposes an HTTP API for the extension and MCP endpoints for AI coding agents. Stores annotations as JSON on disk. Agents connect via MCP to read, watch, and delete annotations.

```
┌─────────────────┐         HTTP          ┌─────────────────┐         MCP
│                  │  ←── sync/CRUD ───→   │                 │  ←── tools ───→  AI Agents
│  Browser Extension │                     │  MCP Server      │                (Claude Code,
│  (Chrome)         │                      │  (port 3846)     │                 Cursor, etc.)
└─────────────────┘                        └─────────────────┘
```

The extension works standalone (copy/paste, export) but the server unlocks MCP integration and watch mode.


The server exposes these tools to connected agents:

| Tool | Description |
|------|-------------|
| `read_annotations` | Retrieve pending annotations with URL filtering and pagination |
| `watch_annotations` | Long-poll for new annotations (used in watch mode loops) |
| `delete_annotation` | Remove an annotation after implementing the fix |
| `delete_project_annotations` | Batch delete all annotations for a project URL |
| `get_project_context` | Infer framework and tech stack from a localhost URL |
| `get_annotation_screenshot` | Get screenshot data for visual context |

## Server Management

```bash
# Check server status
vibe-annotations-server status

# Stop server
vibe-annotations-server stop

# Restart server
vibe-annotations-server restart
```

## Uninstallation

To completely remove Vibe Annotations from your system:

### 1. Remove MCP Server from Your AI Coding Agent

#### Claude Code
```bash
claude mcp remove vibe-annotations
```

#### Cursor
Go to Cursor → Settings → Cursor Settings → Tools & Integrations tab and remove the vibe-annotations server configuration.

#### Windsurf
Go to Windsurf → Settings → Advanced Settings → Cascade section and remove the vibe-annotations server from your MCP configuration.

#### Other Editors
Remove the vibe-annotations server from your editor's MCP configuration settings.

### 2. Uninstall the Global Server
```bash
npm uninstall -g vibe-annotations-server
```

### 3. Remove Data Files
```bash
rm -rf ~/.vibe-annotations
```

### 4. Remove Browser Extension
Go to Chrome Extensions (`chrome://extensions/`) and remove the Vibe Annotations extension.

## Development

### Local Server Development (Advanced)

If you're developing Vibe Annotations or prefer to run the server locally instead of the global installation:

```bash
# Clone the repository
git clone https://github.com/RaphaelRegnier/vibe-annotations.git
cd vibe-annotations/annotations-server

# Install dependencies
npm install

# Run the server locally
npm run start
# or for development with auto-restart:
npm run dev
```

### Extension Development

See `/extension` directory for browser extension development. Load the extension in Chrome as unpacked extension.

## Documentation

- **[Update System](docs/UPDATE_SYSTEM.md)** - Comprehensive guide to extension and server update notifications
- **[Development Guide](docs/DEVELOPMENT.md)** - Development setup and guidelines

## Troubleshooting

Having issues? Check our [GitHub Issues](https://github.com/RaphaelRegnier/vibe-annotations/issues) or create a new one.

### Common Issues

- **Server not detected**: Make sure the server is running with `vibe-annotations-server status`
- **Extension not working on public URLs**: The extension works on any URL, but MCP server features (auto-sync, watch mode) require localhost. On public sites, use copy/paste or export
- **MCP connection failed**: Verify your AI coding agent configuration matches the examples above
- **SSE connection drops/timeouts**: If experiencing "TypeError: terminated" or frequent disconnections, switch to HTTP transport (replace `/sse` with `/mcp` in your configuration)

## Contributing

We love contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Contributors

Thanks to everyone who has contributed to making Vibe Annotations better!

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

## License

[PolyForm Shield 1.0.0](https://polyformproject.org/licenses/shield/1.0.0) — see [LICENSE](LICENSE) and [NOTICE](NOTICE) for details. Versions prior to v1.5.0 were released under MIT.
