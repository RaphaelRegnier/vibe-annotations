# Claude Annotations MVP - Product Requirements Document

## Executive Summary

**Product Name**: Claude Annotations MVP  
**Target Users**: Web developers using Claude Code  
**Primary Goal**: Enable visual annotation of localhost projects with bulk AI-powered code fixing via MCP integration  

## Problem Statement

Developers working on localhost projects waste time describing visual bugs and UI changes in text, then manually implementing fixes. Current tools don't understand local development context or integrate with AI for automated code changes in the actual project files.

## Solution Overview

A Chrome extension called "Claude Annotations" that captures precise visual feedback on localhost development projects with smart context (DOM selectors, breakpoints, element metadata, project file mapping) and integrates with Claude Code via MCP for automated bulk code fixes in the actual source files.

## User Stories

### Primary Flow
1. **As a developer**, I want to click on any web element and leave a comment so I can document needed changes
2. **As a developer**, I want my comments to include breakpoint context so responsive issues are clear
3. **As a developer**, I want to bulk-process my comments through Claude Code so all fixes are implemented automatically
4. **As a developer**, I want to archive completed comments so I can track my progress

### Secondary Flow
1. **As a developer**, I want to see all my pending comments in one place so I can prioritize work
2. **As a developer**, I want to edit/delete comments so I can refine my feedback
3. **As a developer**, I want comments to persist across browser sessions so I don't lose work

## Technical Requirements

### Chrome Extension Architecture

#### Core Components
```
claude-annotations/
├── extension/
│   ├── manifest.json              # Extension manifest (V3)
│   ├── popup/
│   │   ├── popup.html            # Main popup interface
│   │   ├── popup.js              # Popup logic and comment management
│   │   └── popup.css             # Popup styling
│   ├── content/
│   │   ├── content.js            # DOM interaction and annotation overlay
│   │   ├── content.css           # Annotation UI styling
│   │   └── selector.js           # Element selection utilities
│   ├── background/
│   │   └── background.js         # Service worker for persistence
│   └── assets/
│       ├── icons/               # Extension icons
│       └── images/              # UI assets
└── mcp-server/
    ├── package.json             # Node.js dependencies  
    ├── src/
    │   ├── index.js            # Main MCP server entry
    │   ├── tools/              # MCP tool implementations
    │   ├── storage/            # JSON file operations
    │   └── utils/              # Validation and helpers
    └── data/
        └── annotations.json     # Shared data store
```

#### Tech Stack
- **Framework**: Vanilla JavaScript (lightweight, no dependencies)
- **Storage**: Chrome Storage API (chrome.storage.local)
- **Screenshots**: html2canvas library (optional element captures)
- **CSS**: Modern CSS with CSS Grid/Flexbox
- **Build**: Simple file structure (no bundler needed for MVP)

### MCP Server Architecture

#### Core Structure
```
claude-annotations-mcp/
├── package.json              # Node.js dependencies
├── src/
│   ├── index.js             # Main MCP server entry
│   ├── tools/
│   │   ├── read-annotations.js
│   │   ├── archive-annotation.js
│   │   └── get-project-context.js
│   ├── storage/
│   │   └── file-storage.js   # JSON file operations
│   └── utils/
│       └── validation.js     # Input validation
└── data/
    └── annotations.json      # Shared data store
```

#### Tech Stack
- **Runtime**: Node.js 18+
- **MCP SDK**: @modelcontextprotocol/sdk
- **Transport**: stdio (for Claude Code compatibility)
- **Storage**: JSON file (simple, human-readable)
- **Validation**: Joi or Zod for input validation

## Data Models

### Annotation Schema
```typescript
interface Annotation {
  id: string;                          // Unique identifier
  url: string;                         // Localhost URL (e.g., localhost:3000)
  project_path?: string;               // Local project directory path
  selector: string;                    // CSS selector for element
  comment: string;                     // User comment/feedback
  viewport: {
    width: number;                     // Browser width when created
    height: number;                    // Browser height when created
  };
  element_context: {
    tag: string;                       // HTML tag name
    classes: string[];                 // CSS classes
    text: string;                      // Element text content
    styles: Record<string, string>;    // Computed styles
    position: {                        // Element position
      x: number;
      y: number;
      width: number;
      height: number;
    };
    potential_files?: string[];        // Possible source files for this element
  };
  screenshot?: string;                 // Base64 element screenshot (optional)
  status: 'pending' | 'completed' | 'archived';
  created_at: string;                  // ISO timestamp
  updated_at: string;                  // ISO timestamp
}
```

### MCP Tool Schemas
```json
{
  "read_annotations": {
    "name": "read_annotations",
    "description": "Read all pending web annotations for processing",
    "inputSchema": {
      "type": "object",
      "properties": {
        "status": {
          "type": "string",
          "enum": ["pending", "completed", "archived", "all"],
          "default": "pending"
        },
        "url_filter": {
          "type": "string",
          "description": "Filter by URL pattern"
        }
      }
    }
  }
}
```

## User Interface Requirements

### Chrome Extension Popup
- **Header**: Claude Annotations logo + title + settings icon
- **Comment List**: Scrollable list of annotations with:
  - Website favicon + localhost URL
  - Comment preview (truncated)
  - Timestamp and status indicator
  - Quick actions (edit, delete, view)
- **Footer**: "New Comment" button + MCP connection status

### Content Script Overlay
- **Element Highlighting**: Claude blue border on hover (#2563eb)
- **Comment Badge**: Small numbered badge on annotated elements
- **Comment Tooltip**: Hover to see comment preview
- **Add Comment Modal**: 
  - Text area for comment with Claude-styled UI
  - Element preview and context
  - Viewport info display
  - Save/Cancel buttons with Claude branding

### Visual Design
- **Color Scheme**: Claude orange (#FF7A00) primary, Claude blue (#2563eb) secondary
- **Typography**: System fonts (SF Pro, Segoe UI, Roboto) 
- **Iconography**: Heroicons or Lucide icons with Claude aesthetic
- **Animation**: Subtle hover effects, smooth transitions matching Claude UI
- **Branding**: Consistent with Claude family of products

## MCP Integration Specifications

### Tool Definitions

#### read_annotations
```javascript
{
  name: "read_annotations",
  description: "Retrieve pending web annotations for bulk processing",
  inputSchema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["pending", "all"], default: "pending" },
      limit: { type: "number", default: 50 }
    }
  }
}
```

#### archive_annotation
```javascript
{
  name: "archive_annotation", 
  description: "Mark annotation as completed after implementing fix",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", required: true },
      status: { type: "string", enum: ["completed", "archived"], default: "completed" }
    },
    required: ["id"]
  }
}
```

#### get_project_context
```javascript
{
  name: "get_project_context",
  description: "Get project structure and potential source files for annotations",
  inputSchema: {
    type: "object", 
    properties: {
      localhost_url: { type: "string", required: true },
      annotation_id: { type: "string" }
    },
    required: ["localhost_url"]
  }
}
```

## Performance Requirements

### Extension Performance
- **Load Time**: <200ms popup open time
- **Memory Usage**: <10MB RAM footprint
- **Element Selection**: <50ms highlight response time
- **Storage**: <5MB local storage limit

### MCP Performance  
- **Response Time**: <2s for read_annotations (100 items)
- **Throughput**: Handle 500+ annotations efficiently
- **Memory**: <50MB server RAM usage
- **Startup**: <3s MCP server initialization

## Security Requirements

### Extension Security
- **Permissions**: Minimal required permissions only
  - `activeTab`: Current tab access
  - `storage`: Local data persistence
  - `scripting`: Content script injection
  - **Note**: Only works on localhost URLs for security
- **Localhost Only**: Extension only activates on localhost domains
- **Content Security Policy**: Strict CSP in manifest
- **No External Requests**: No network calls from extension

### MCP Security
- **Input Validation**: Sanitize all tool inputs
- **File System**: Read/write only to designated data directory
- **No Network**: MCP server operates offline only
- **Audit Trail**: Log all annotation modifications

## Success Criteria

### MVP Launch Criteria
- [ ] Claude Annotations extension installs and works on common localhost ports (3000, 8080, 5173, etc.)
- [ ] Detects React, Vue, Svelte, and vanilla HTML projects
- [ ] Complete annotation workflow (create → process → archive) works
- [ ] MCP integration successfully maps annotations to source files
- [ ] Claude Code can implement fixes in actual project files
- [ ] No crashes or data loss during normal usage
- [ ] Installation documentation covers Claude Code + localhost setup

### User Experience Goals
- [ ] Users can create their first annotation in <2 minutes
- [ ] Complete Claude Annotations workflow demo takes <5 minutes
- [ ] 90% of users successfully process annotations via Claude Code MCP
- [ ] Users report time savings vs. manual implementation
- [ ] Tool feels like a natural extension of Claude ecosystem

## Launch Plan

### Pre-Launch (Week 4)
- [ ] Internal testing on 20+ diverse localhost projects
- [ ] Documentation and video tutorials complete
- [ ] Chrome Web Store submission for "Claude Annotations" approved
- [ ] Landing page live at claude-annotations.dev with clear value proposition

### Launch Week
- [ ] Announce on Claude community channels and developer communities
- [ ] Share with Claude Code user groups and early adopters
- [ ] Gather initial user feedback from Claude ecosystem
- [ ] Monitor for critical bugs and Claude Code integration issues

### Post-Launch (Month 1)
- [ ] Weekly user feedback collection
- [ ] Performance monitoring and optimization
- [ ] Bug fixes and UX improvements
- [ ] Plan next phase features based on usage data

## Future Considerations

### Potential Enhancements
- Desktop Extension (DXT) packaging for one-click MCP setup
- Team collaboration and comment sharing
- Integration with design tools (Figma, Sketch)
- Advanced element editing (drag-to-resize, color picker)
- Cloud sync for cross-device annotation access

### Technical Debt Prevention
- Modular code architecture for easy feature additions
- Comprehensive error handling and user feedback
- Performance monitoring and optimization from day one
- Clear documentation for future development