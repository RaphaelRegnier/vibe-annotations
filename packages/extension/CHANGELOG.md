# Changelog

All notable changes to the Vibe Annotations extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Update notification system for extension updates
- Version compatibility checking between extension and server
- Server update check with GitHub API integration
- Update banner UI in extension popup

## [1.0.0] - 2025-08-04

### Added
- Initial release of Vibe Annotations Chrome extension
- Visual annotation system for localhost development
- MCP integration for AI coding agents
- Light/dark theme support with system preference detection
- Persistent inspection mode for multiple annotations
- Pin-based annotation system with numbered badges
- Route-scoped annotation management
- Chrome Storage API integration
- Real-time synchronization with external server
- File protocol support for local HTML files
- Iconify integration with 200k+ icons
- Zero layout shift editing experience

### Fixed
- Server race conditions causing ENOENT errors
- Badge numbering inconsistencies
- Variable scope issues in error handling
- Redundant sync operations

### Security
- Localhost-only operation for development focus
- Minimal permissions model
- No external network requests from extension