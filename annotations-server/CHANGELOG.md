# Changelog - Vibe Annotations Server

All notable changes to the vibe-annotations-server package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Automatic update check against GitHub releases
- Version information in health endpoint
- Dynamic version reading from package.json in CLI

## [0.1.3] - 2025-08-05

### Added
- File locking mechanism to prevent save race conditions
- Data comparison in sync endpoint to skip redundant saves
- Enhanced logging for file operations

### Fixed
- ENOENT errors during concurrent annotation saves
- Variable scope bug in fallback write mechanism
- CLI version now reads from package.json instead of hardcoded value

### Changed
- Improved error handling with proper fallback mechanisms
- Better concurrent operation handling

## [0.1.2] - 2025-08-04

### Added
- SSE transport implementation for Claude Code integration
- Bidirectional synchronization with smart conflict resolution
- Session management for transport connections
- Enhanced startup logging with annotation counts

### Fixed
- SSE transport timeout issues with Claude Code
- Annotation persistence across server restarts

## [0.1.0] - 2025-08-03

### Added
- Initial release of vibe-annotations-server
- HTTP API for Chrome extension communication
- MCP tool implementations (read_annotations, delete_annotation, get_project_context)
- SSE endpoint for AI coding agent integration
- CLI with start/stop/restart/status commands
- Atomic file operations for data persistence
- Multi-project detection and warnings
- Graceful shutdown handling

### Security
- Local-only operation (127.0.0.1)
- No external dependencies for core functionality