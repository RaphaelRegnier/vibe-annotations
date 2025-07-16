# SESSION.md

This file maintains session context and progress for Claude Code when working on Claude Annotations.

## Current Project Status

**Project**: Claude Annotations - Chrome extension for localhost development annotation + Claude Code MCP integration  
**Version**: 0.1.0 MVP  
**Owner**: Raphaël Régnier  
**License**: MIT  

## Implementation Progress

### ✅ COMPLETED (Phase 1)
- **Chrome Extension Core**: Full Manifest V3 implementation
  - `popup/`: Complete UI with Claude branding, annotation list, settings
  - `content/`: Element selection, highlighting, annotation modal, tooltips
  - `background/`: Service worker with storage, badges, cross-tab sync
  - `manifest.json`: Proper permissions (activeTab, storage, scripting), localhost-only
- **Storage System**: Chrome Storage API integration with real-time sync
- **Visual Design**: Claude brand compliance (#FF7A00 orange, #2563eb blue)
- **Element Selection**: CSS selector generation, hover highlighting, click-to-annotate
- **Badge Notifications**: Show pending annotation count on extension icon

### 🔄 IN PROGRESS (Phase 2 - MCP Server)
- **MCP Server Scaffolding**: Basic structure with @modelcontextprotocol/sdk
- **Missing**: Core MCP tools implementation

### ❌ TODO (Next Priorities)
1. **MCP Tools Implementation** (`mcp-server/src/tools/`):
   - `read-annotations.js` - Retrieve pending annotations for Claude Code
   - `archive-annotation.js` - Mark annotations completed after fixes
   - `get-project-context.js` - Map localhost to project files
2. **Data Bridge**: Extension → JSON file sync for MCP consumption
3. **Integration Testing**: Full workflow (annotate → MCP → Claude Code → resolve)

## Key Technical Decisions Made

- **Extension**: Vanilla JavaScript (no build process needed)
- **Storage**: Chrome Storage API + JSON file bridge to MCP
- **MCP Transport**: stdio for Claude Code compatibility  
- **Security**: Localhost-only operation (localhost, 127.0.0.1, 0.0.0.0)
- **Selectors**: CSS selectors for cross-framework compatibility

## Current File Structure

```
claude-annotations/
├── extension/              ✅ COMPLETE
│   ├── manifest.json      ✅ Manifest V3 with proper permissions
│   ├── popup/             ✅ Full UI implementation
│   ├── content/           ✅ DOM interaction & annotation creation
│   └── background/        ✅ Service worker with storage & badges
├── mcp-server/            🔄 PARTIAL
│   ├── package.json       ✅ Dependencies configured
│   ├── src/index.js       ✅ Basic MCP server scaffold
│   ├── src/tools/         ❌ EMPTY - Need tool implementations
│   └── data/              ✅ annotations.json created
└── docs/                  ✅ Complete PRD and implementation plan
```

## Development Commands Quick Reference

```bash
# Chrome Extension Testing
# 1. Open chrome://extensions/
# 2. Enable Developer mode  
# 3. Click "Load unpacked"
# 4. Select /extension directory
# 5. Test on localhost:3000, localhost:5173, etc.

# MCP Server Development
cd mcp-server
npm run dev          # Development with auto-reload
npm start           # Production mode
```

## Current Session Tasks & Issues

### 🚨 URGENT - MCP Server Connection Issue
**Problem**: Claude Code cannot connect to the MCP server
- User ran: `claude mcp add claude-annotations -s user node /path/to/mcp-server/src/index.js`
- User restarted Claude Code sessions
- Status shows "failed" for MCP server connection

**Debugging Steps Needed**:
1. Check `claude mcp list` output - what's the exact status/error?
2. Verify MCP server file path is correct: `ls -la /Users/raphael/Documents/Code/ai-projects/claude-annotations/mcp-server/src/index.js`
3. Test manual server start: `cd mcp-server && node src/index.js`
4. Check Claude Code logs: `claude mcp logs claude-annotations`
5. Verify npm dependencies: `cd mcp-server && npm install`

### ✅ COMPLETED THIS SESSION
1. **Real-time MCP Integration**: HTTP server (port 3002) + stdio server working
2. **Extension Integration**: Green/red indicator, real-time connection monitoring
3. **MCP Tools**: `read_annotations`, HTTP endpoints, data persistence
4. **User Testing**: Extension shows "MCP Connected", user has 4 real annotations ready

### 🎯 NEXT IMMEDIATE PRIORITIES
1. **Fix Claude Code MCP connection** - resolve stdio transport issue
2. **Test `read_annotations` tool** - verify Claude Code can read user's real annotations  
3. **Implement `archive_annotation` tool** - mark annotations completed after processing
4. **Full workflow test**: Annotate → Claude Code reads → Archive workflow

### 📋 ANNOTATION STATUS
- **User has 4 real annotations** created on localhost:3001 while MCP server was running
- **Extension working**: Real-time saving to MCP server confirmed  
- **MCP server running**: HTTP (extension) + stdio (Claude Code) dual setup
- **Waiting for**: Claude Code MCP connection to be fixed

## Important Context for Future Sessions

### Extension Architecture
- **3-Component System**: popup (UI) → content (DOM) → background (storage)
- **Event-Driven**: Chrome Storage changes trigger UI updates across all components
- **Localhost-Only**: Security model restricts to development URLs only

### Annotation Data Schema
```typescript
interface Annotation {
  id: string;                          // claude_ + timestamp + random
  url: string;                         // localhost:PORT/path
  selector: string;                    // CSS selector for element
  comment: string;                     // User feedback/request
  viewport: { width, height };         // Browser context
  element_context: {                   // Rich DOM context
    tag, classes, text, styles, position
  };
  status: 'pending' | 'completed' | 'archived';
  created_at: string;                  // ISO timestamp
  updated_at: string;                  // ISO timestamp
}
```

### MCP Tool Specifications
Based on PRD requirements:
- `read_annotations(status='pending', limit=50)` → Array<Annotation>
- `archive_annotation(id, status='completed')` → Success response
- `get_project_context(localhost_url, annotation_id?)` → Project structure

## Testing Strategy

### Manual Testing Checklist
- [ ] Extension loads on localhost pages only
- [ ] Element selection highlights with blue border
- [ ] Click creates annotation modal with element context
- [ ] Annotations persist across browser sessions
- [ ] Badge shows correct pending count
- [ ] MCP server responds to tool calls
- [ ] Data bridge syncs Chrome Storage → JSON file

### Common Localhost URLs for Testing
- `http://localhost:3000` (React, Next.js)
- `http://localhost:5173` (Vite)
- `http://localhost:8080` (Vue)
- `http://localhost:4200` (Angular)

## Debugging Notes

### Extension Debugging
- **Popup**: Right-click extension icon → Inspect popup
- **Content Script**: Open DevTools on localhost page → Console tab
- **Background**: chrome://extensions/ → Background page (inspect views)
- **Storage**: DevTools → Application → Chrome Storage

### MCP Server Debugging
- Use `npm run dev` for console output
- Test stdio transport with manual JSON-RPC messages
- Verify `annotations.json` file updates correctly

## Previous Session Accomplishments

**Session 1**: Successfully implemented complete Chrome extension core
- Popup UI with Claude branding and annotation management
- Content script with element selection and annotation creation  
- Background service worker with storage management and badge notifications
- All extension components working and tested locally

**Session 2**: Enhanced annotation system with critical fixes
- Fixed CSS selector generation to handle complex class names (CSS custom properties, brackets)
- Resolved React hydration errors by implementing framework-agnostic DOM stability detection
- Centered annotation badges on elements instead of top-right positioning
- Implemented annotation marker click functionality with popup focus integration
- Added visual prompt system to guide users to extension popup (MV3 limitation workaround)
- Optimized DOM observer to reduce unnecessary re-renders
- Enhanced error handling and improved user experience

**Session 3 (Current)**: Real-time MCP Integration Implementation
- ✅ **Implemented Real-Time Architecture**: MCP server now runs dual servers (HTTP + stdio)
  - HTTP server on localhost:3002 for Chrome extension communication
  - stdio server for Claude Code integration
  - Real-time connection monitoring every 10 seconds
- ✅ **Extension Real-Time Integration**: 
  - Direct HTTP communication with MCP server (no file sync needed)
  - Green/red connection indicator in popup
  - Extension disabled when MCP server offline
  - Annotations save directly to MCP server in real-time
- ✅ **MCP Tools Implemented**:
  - `read_annotations` - reads annotations from data file
  - `sync_chrome_data` - manual sync tool (fallback)
  - HTTP endpoints: `/health`, `/annotations` (GET/POST), `/annotations/:id` (PUT)

**Status**: Real-time MCP integration complete. CURRENT ISSUE: Claude Code MCP server connection failing