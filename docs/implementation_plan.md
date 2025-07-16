# Claude Annotations MVP - Implementation Plan

## Project Overview
Build a Chrome extension called "Claude Annotations" that allows developers to drop visual comments on their localhost development projects and bulk-process them via Claude Code MCP integration for automated code fixes.

## Phase 1: Chrome Extension Core (Week 1-2)

### Step 1.1: Project Setup
- [x] Initialize Chrome extension project structure
- [x] Set up manifest.json (Manifest V3)
- [x] Create basic popup UI mockup
- [x] Set up development environment with hot reload

### Step 1.2: Content Script Foundation
- [x] Implement content script injection
- [x] Create element selection system (hover highlighting)
- [x] Build comment overlay UI components
- [x] Add click-to-annotate functionality

### Step 1.3: Comment Management
- [x] Design comment data structure
- [x] Implement local storage for comments
- [x] Create comment list/management in popup
- [x] Add edit/delete comment functionality

### Step 1.4: Context Capture
- [x] Implement DOM element selector generation
- [x] Capture viewport dimensions and breakpoint info
- [x] Store element metadata (tag, classes, computed styles)
- [x] Detect localhost URLs and project structure
- [ ] Map DOM elements to potential source files
- [ ] Add optional element screenshot using html2canvas

## Phase 2: MCP Server Development (Week 2-3)

### Step 2.1: MCP Server Setup
- [x] Initialize Node.js MCP server project
- [x] Install @modelcontextprotocol/sdk
- [x] Set up basic server structure and tools
- [ ] Implement stdio transport for Claude Code

### Step 2.2: Core MCP Tools
- [ ] Implement `read_annotations` tool
- [ ] Implement `archive_annotation` tool
- [ ] Implement `get_annotation_summary` tool
- [ ] Implement `get_project_files` tool (localhost file discovery)
- [ ] Add localhost project path detection
- [ ] Add error handling and validation

### Step 2.3: Data Bridge
- [ ] Create shared storage mechanism (JSON file)
- [ ] Implement extension → MCP data flow
- [ ] Add annotation status tracking
- [ ] Implement bulk processing capabilities

## Phase 3: Integration & Polish (Week 3-4)

### Step 3.1: Extension-MCP Integration
- [ ] Test full workflow: annotate → MCP → resolve
- [ ] Implement status sync between extension and MCP
- [ ] Add success/error feedback in extension UI
- [ ] Create annotation export functionality

### Step 3.2: User Experience Polish
- [ ] Improve visual design and animations
- [ ] Add keyboard shortcuts
- [ ] Implement annotation filtering/search
- [ ] Add onboarding/help documentation

### Step 3.3: Testing & Validation
- [ ] Test on various websites (responsive, SPAs, etc.)
- [ ] Validate MCP integration with Claude Code
- [ ] Test performance with large annotation sets
- [ ] User acceptance testing with sample developers

## Phase 4: Packaging & Deployment (Week 4)

### Step 4.1: Chrome Web Store Preparation
- [ ] Finalize extension manifest and permissions
- [ ] Create store listing assets (screenshots, descriptions)
- [ ] Package extension for distribution
- [ ] Submit "Claude Annotations" to Chrome Web Store

### Step 4.2: MCP Distribution
- [ ] Package Claude Annotations MCP server for easy installation
- [ ] Create installation documentation for Claude Code integration
- [ ] Test installation process on clean environment
- [ ] Prepare for future DXT packaging

### Step 4.3: Landing Page & Marketing
- [ ] Design and build claude-annotations.dev landing page
- [ ] Create demo video/GIFs showing localhost workflow
- [ ] Write documentation and getting started guide
- [ ] Prepare launch announcement for Claude community

## Success Metrics
- **Technical**: Extension works on localhost:3000, localhost:8080, etc.
- **Usability**: Users can complete annotation → fix workflow in <3 minutes on their own projects
- **Performance**: MCP processes annotations and suggests file changes in <15 seconds
- **Adoption**: 50+ developers try the MVP within first month (smaller, focused audience)

## Risk Mitigation
- **Localhost detection**: Test on various dev servers (Vite, Webpack, Next.js, etc.)
- **Project structure**: Support common frameworks (React, Vue, Svelte, etc.)
- **File mapping**: Handle various build tools and file structures
- **MCP reliability**: Implement robust error handling and fallbacks
- **User onboarding**: Create clear documentation with localhost examples

## Technical Decisions Made
- **Extension**: Manifest V3 for future-proofing
- **Storage**: Local storage + JSON file bridge (simple, reliable)
- **MCP Transport**: stdio (most compatible with Claude Code)
- **Element Selection**: CSS selectors (portable, precise)
- **Screenshots**: html2canvas (client-side, no dependencies)

## Next Phase Ideas (Post-MVP)
- Visual editing tools (drag-to-resize, color picker)
- Team collaboration features
- Integration with design tools (Figma, Sketch)
- Advanced filtering and organization
- Desktop Extension (DXT) packaging
- Cloud sync and sharing