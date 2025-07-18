# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Annotations is a Chrome extension that enables developers to annotate localhost development projects with visual comments and integrate with Claude Code via MCP for automated code fixes. The system consists of two main components:

1. **Chrome Extension** (`/extension`): Manifest V3 extension with popup UI, content scripts for DOM interaction, and background service worker
2. **Local HTTP Server** (`/local-server`): Express server with dual role as HTTP API for extension and MCP endpoint for Claude Code

## Development Commands

### Chrome Extension Development
```bash
# Load extension in Chrome for testing
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked" 
# 4. Select the /extension directory

# No build process needed - extension uses vanilla JavaScript
```

### Local Server Development
```bash
cd local-server

# Install dependencies
npm install

# Start local HTTP server with MCP integration
npm start

# Server provides:
# - HTTP API for Chrome extension (port 3846)
# - MCP endpoint for Claude Code (/mcp)
# - Health checks (/health)

# Add to Claude Code
claude mcp add --transport http claude-annotations http://localhost:3846/mcp
```

### Testing the Extension
```bash
# Test on common localhost development servers:
# React: http://localhost:3000
# Vite: http://localhost:5173
# Next.js: http://localhost:3000
# Vue: http://localhost:8080
```

## Architecture Overview

### Architecture

The system uses a **local HTTP server** pattern:

```
Chrome Extension → HTTP API → Local Server → MCP HTTP ← Claude Code
```

**Architecture benefits:**
- Claude Code connects via HTTP transport
- Chrome extension communicates via standard HTTP API
- Local server bridges extension and MCP protocols
- Single server handles both responsibilities

### Components

1. **Chrome Extension** (`/extension`): 
   - Popup UI with theme system, settings modal, and annotation management
   - Content script with persistent inspection mode and synchronized theming
   - Background worker for storage sync and badge management
   - Theme Manager for light/dark/system theme handling

2. **Local HTTP Server** (`/local-server`): Express server with dual role:
   - **HTTP API**: Endpoints for Chrome extension CRUD operations
   - **MCP Endpoint**: `/mcp` endpoint for Claude Code integration

3. **Shared Data Storage**: JSON file accessible by both HTTP API and MCP tools

### Data Flow
1. Content script captures DOM elements and creates annotations
2. Extension manages annotations via Chrome Storage API
3. Background worker syncs to local HTTP server
4. Claude Code accesses annotations via MCP HTTP endpoint
5. Theme changes propagate through Chrome Storage to all extension components

### Annotation Data Structure
Annotations contain comprehensive context for AI processing:
```typescript
interface Annotation {
  id: string;
  url: string;                    // localhost URL
  selector: string;               // CSS selector
  comment: string;                // User feedback
  viewport: { width, height };    // Browser context
  element_context: {              // Rich DOM context
    tag, classes, text, styles, position
  };
  status: 'pending';
  created_at: string;
  updated_at: string;
}
```

## Key Technical Details

### Security Model
- Extension only operates on localhost URLs (`localhost`, `127.0.0.1`, `0.0.0.0`)
- Minimal permissions: `activeTab`, `storage`, `scripting`
- No external network requests from extension
- MCP server operates offline only

### Inspection Mode System
The content script implements persistent inspection mode:
- **Persistent Mode**: User stays in inspection mode until ESC or extension click
- **Multiple Annotations**: Can drop multiple annotations without exiting mode
- **Visual Feedback**: Single instruction overlay that fades after 3 seconds
- **Pin System**: Numbered pins (1, 2, 3...) positioned at top-center of elements
- **Tooltips**: Hover pins to see annotation comments (not HTML elements)
- **Edit Mode**: Click pins to open edit modal for existing annotations

### Storage Strategy
- **Extension**: Chrome Storage API for cross-session persistence
- **MCP Bridge**: JSON file (`mcp-server/data/annotations.json`) for Claude Code integration
- Real-time synchronization between popup and content scripts via storage events

### Visual Design System
Complete theme system with design tokens:
- **Theme Management**: Light/dark/system themes via ThemeManager class
- **Design Tokens**: CSS custom properties (`--theme-*`) for all colors
- **Typography**: Inter font family with proper font weights
- **Icons**: Iconify integration with 200k+ icons (Heroicons/Lucide preferred)
- **Colors**: Claude Orange (#d97757), proper contrast ratios
- **Layout**: Zero layout shift editing, consistent spacing tokens

## MCP Integration (CORRECTED)

### Connection Method
```bash
# Remove old stdio server
claude mcp remove claude-annotations

# Add HTTP server (CORRECT)
claude mcp add --transport http claude-annotations http://localhost:3846/mcp
```

### Tool Definitions
The local server implements MCP tools via HTTP:
- `read_annotations`: Retrieve pending annotations for bulk processing
- `delete_annotation`: Delete annotation after implementing the requested fix (replaces archive)
- `get_project_context`: Map localhost URLs to project file structure

### Offline Mode
When MCP server is offline:
- All annotation operations are disabled (create, edit, delete)
- UI shows clear "MCP server is offline" messages
- No local/offline storage mode - requires server connection

### Data Bridge (CORRECTED)
- Extension POSTs to `http://localhost:3846/api/annotations`
- Local server stores in shared JSON file
- MCP tools read from same JSON file via HTTP transport

## Development Workflow

### Adding New Features to Extension
1. Modify relevant component (popup, content, or background)
2. Update manifest.json if new permissions needed
3. Test on multiple localhost development servers
4. Ensure storage synchronization works correctly

### Extending MCP Server
1. Add new tools in `src/tools/` directory
2. Update main server index.js to register tools
3. Test with `npm run dev` and validate stdio transport
4. Ensure JSON file operations are atomic

### Debugging
- Extension: Use Chrome DevTools for each component (popup, content, background)
- Content Script: Check browser console on localhost pages
- MCP Server: Console logs via `npm run dev`
- Storage: Inspect Chrome Storage via DevTools Application tab

## Localhost-Specific Considerations

The extension is designed exclusively for localhost development:
- Supports common dev server ports (3000, 5173, 8080)
- Works with SPAs and traditional server-rendered pages
- Handles dynamic content and framework-specific DOM structures
- Element selectors designed to work across build tool configurations

## Current Implementation Status

**Completed:**
- ✅ Chrome extension with persistent inspection mode
- ✅ Pin-based annotation system with numbered badges and tooltips
- ✅ Edit-in-place functionality (click pins to edit)
- ✅ Route-scoped annotations (only show current page annotations)
- ✅ Local HTTP server with dual HTTP API + MCP endpoint
- ✅ Complete MCP tool implementations (`read_annotations`, `delete_annotation`, `get_project_context`)
- ✅ Server status awareness and offline mode handling
- ✅ Current route display in popup subtitle
- ✅ Complete design system with theme management (light/dark/system)
- ✅ Iconify integration with 200k+ icons
- ✅ Zero layout shift editing experience
- ✅ Cross-component theme synchronization

**Architecture Highlights:**
- **Persistent Inspection**: Users can drop multiple annotations without exiting mode
- **Performance**: CSS-only tooltips (no JavaScript positioning calculations)
- **Theme System**: Complete design token architecture with light/dark/system themes
- **UX**: Toggle button changes "Start Annotating" ↔ "Stop Annotating" based on state
- **Integration**: Claude uses `delete_annotation` tool when fixes are implemented
- **Reliability**: Server offline = all operations disabled (no confusing offline modes)
- **Design Quality**: Zero layout shift editing, 200k+ icon library, professional UI