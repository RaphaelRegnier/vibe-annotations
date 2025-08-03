# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of Vibe Annotations
- Chrome extension for creating annotations on localhost development projects
- Persistent inspection mode for creating multiple annotations
- Pin-based annotation system with numbered badges
- Click-to-edit functionality for existing annotations
- Route-scoped annotations (only show current page annotations)
- Complete theme system (light/dark/system themes)
- External server detection via health checks
- Setup instructions with command copying
- MCP integration via SSE transport
- Support for Claude Code, Cursor, Windsurf, and VS Code
- Local file support (file:// protocol)
- Cross-component theme synchronization
- Zero layout shift editing experience

### Architecture
- Two-piece architecture: Chrome extension + external npm server
- Global server installation via npm
- Shared JSON storage for annotations
- Real-time synchronization between components

### Developer Experience
- Complete onboarding flow
- Server status detection and management UI
- Iconify integration with 200k+ icons
- Professional UI with Vibe Orange branding

## [1.0.0] - TBD

- First stable release
- Chrome Web Store publication
- NPM package publication for vibe-annotations-server

[Unreleased]: https://github.com/RaphaelRegnier/vibe-annotations/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/RaphaelRegnier/vibe-annotations/releases/tag/v1.0.0