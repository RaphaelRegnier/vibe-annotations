# Update Notification System

This document describes the comprehensive update notification system implemented in Vibe Annotations to keep users informed about extension and server updates.

## Overview

The update system consists of three main components:
1. **Extension Update Detection** - Detects Chrome extension updates automatically
2. **Server Update Checking** - Monitors GitHub releases for server package updates  
3. **Version Compatibility** - Ensures extension and server versions work together

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Chrome Extension│    │ Local Server     │    │ GitHub Releases │
│                 │    │                  │    │                 │
│ Update Detection│◄──►│ Version API      │◄──►│ Latest Releases │
│ Badge Notification   │ Compatibility    │    │ Version Tags    │
│ Banner UI       │    │ Update Check     │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Extension Update Detection

### How It Works

The Chrome extension automatically detects when it has been updated using the `chrome.runtime.onInstalled` API.

**File**: `extension/background/background.js`

```javascript
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'update') {
    this.handleUpdate(details.previousVersion);
  }
});
```

### Update Flow

1. **Chrome Updates Extension** - Happens automatically via Chrome Web Store
2. **Background Script Detects Update** - `onInstalled` event fires with reason 'update'
3. **Store Update Info** - Saves update details to Chrome storage
4. **Show Badge** - Displays "NEW" badge on extension icon
5. **Display Banner** - Shows update banner in popup when opened
6. **Clear Notification** - Badge clears when user opens popup

### Update Banner UI

The update banner appears at the top of the extension popup with:
- ✨ Sparkles icon indicating new features
- Version update message (e.g., "Extension updated to v1.0.1")
- "What's new" button to view changelog
- Dismiss button to hide banner

**Implementation**: `extension/popup/popup.html` + `extension/popup/popup.css`

### Changelog Integration

Real changelog data is stored in the background script:

```javascript
getChangelogForVersion(version) {
  const changelogs = {
    '1.0.0': [
      'Initial release of Vibe Annotations',
      'Visual annotation system for localhost development',
      'MCP integration for AI coding agents',
      'Light/dark theme support with system preference detection'
    ]
  };
  
  return changelogs[version] || ['Various improvements and bug fixes'];
}
```

## Server Update Checking

### How It Works

The server automatically checks NPM registry for newer versions on startup.

**File**: `annotations-server/lib/server.js`

```javascript
async checkForUpdates() {
  // Check NPM registry for latest version
  const response = await fetch(
    'https://registry.npmjs.org/vibe-annotations-server/latest'
  );
  
  // Compare versions and notify if newer available
  if (hasUpdate) {
    console.log(chalk.yellow(`
╔════════════════════════════════════════════════════════════════╗
║  Update available: ${currentVersion} → ${latestVersion}        ║
║  Run: npm update -g vibe-annotations-server                    ║
╚════════════════════════════════════════════════════════════════╝
    `));
  }
}
```

### Update Check Features

- **24-Hour Cache** - Prevents spamming NPM registry (stored in `~/.vibe-annotations/.update-check`)
- **Beautiful Console Notifications** - Formatted update messages with exact commands
- **Graceful Failure** - Handles API errors and missing releases without disrupting service
- **Version Comparison** - Semantic version comparison to determine if update needed

### NPM Registry Integration

The system calls the NPM Registry API:
```
GET https://registry.npmjs.org/vibe-annotations-server/latest
```

**Response handling**:
- **200 OK** - Compare versions and show update if available
- **404 Not Found** - Package not found in registry
- **Other errors** - Log error but continue server operation

### Update Commands

When an update is available, users get a simple update command:

```bash
# Update to latest version
npm update -g vibe-annotations-server
```

## Version Compatibility System

### Health Endpoint

The server exposes version information via the `/health` endpoint:

```json
{
  "status": "ok",
  "version": "0.1.3",
  "minExtensionVersion": "1.0.0",
  "timestamp": "2025-08-05T06:39:22.635Z"
}
```

### Compatibility Checking

The extension checks server compatibility when connecting:

**File**: `extension/background/background.js`

```javascript
async checkAPIConnectionStatus() {
  const response = await fetch(`${this.apiServerUrl}/health`);
  const data = await response.json();
  
  // Check if extension version meets minimum requirement
  if (data.minExtensionVersion) {
    const extensionVersion = chrome.runtime.getManifest().version;
    const versionCompatible = compareVersions(extensionVersion, data.minExtensionVersion);
    
    if (!versionCompatible) {
      // Show compatibility warning to user
    }
  }
}
```

### Compatibility Matrix

| Extension Version | Server Version | Compatible | Notes |
|-------------------|----------------|------------|-------|
| 1.0.0+           | 0.1.3+         | ✅ Yes     | Full feature support |
| < 1.0.0          | 0.1.3+         | ❌ No      | Update extension required |
| 1.0.0+           | < 0.1.3        | ⚠️ Limited | Some features may not work |

## User Experience

### Non-Intrusive Design

- Updates don't block functionality
- Notifications are dismissible
- Clear, actionable instructions provided
- Visual feedback with automatic cleanup

### Update Flow for Users

1. **Extension Updates** (automatic via Chrome):
   - Chrome updates extension silently
   - User sees "NEW" badge on extension icon
   - Clicking extension shows update banner
   - User can view changelog or dismiss notification

2. **Server Updates** (manual):
   - Server shows console notification on startup if update available
   - Clear installation commands provided
   - User runs npm commands to update
   - Server restarts with new version

### Visual Indicators

- **🔴 Red Badge**: Critical server update required
- **🟠 Orange Badge**: Extension update notification  
- **🟢 Green Badge**: Normal annotation count
- **✨ Sparkles Icon**: New features available

## Configuration

### Extension Configuration

Update notifications can be configured in the extension:

**Storage Structure**:
```javascript
{
  updateInfo: {
    hasUpdate: true,
    previousVersion: "0.9.0",
    currentVersion: "1.0.0", 
    timestamp: 1628097600000,
    changelog: ["Feature 1", "Fix 2", "Enhancement 3"]
  }
}
```

### Server Configuration

**Update Check Settings**:
- Cache duration: 24 hours (86400000 ms)
- Cache file: `~/.vibe-annotations/.update-check`
- NPM Registry endpoint: `https://registry.npmjs.org/vibe-annotations-server/latest`

## Development Guidelines

### Adding New Versions

1. **Extension Updates**:
   - Update `manifest.json` version
   - Add changelog entry to `getChangelogForVersion()`
   - Test update notification locally
   - Submit to Chrome Web Store

2. **Server Updates**:
   - Update `package.json` version
   - Update `CHANGELOG.md`
   - Publish to NPM registry with `npm publish`

### Testing Updates

**Extension Testing**:
```javascript
// Simulate extension update
chrome.storage.local.set({
  updateInfo: {
    hasUpdate: true,
    currentVersion: "1.0.1",
    changelog: ["Test feature"]
  }
});
```

**Server Testing**:
```bash
# Remove cache to force check
rm ~/.vibe-annotations/.update-check

# Start server to see update check
npm run dev
```

### Version Numbering

Follow [Semantic Versioning](https://semver.org/):
- **MAJOR.MINOR.PATCH** (e.g., 1.0.0)
- **Major**: Breaking changes
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, backward compatible

## Error Handling

### NPM Registry Failures

- **Rate Limiting**: 24-hour cache prevents excessive requests
- **Network Errors**: Logged but don't prevent server startup
- **404 Not Found**: Package not found in registry, handled gracefully
- **Invalid JSON**: Fallback to current version, log error

### Extension Errors

- **Storage Failures**: Graceful degradation, notifications still work
- **Version Parse Errors**: Fallback to generic changelog
- **Badge Update Failures**: Logged but don't prevent extension function

## Security Considerations

### API Security

- Uses HTTPS for all NPM Registry calls
- No authentication tokens required (public package)  
- User-Agent header identifies the application
- No sensitive data transmitted

### Extension Security

- Update notifications use Chrome Storage API (local only)
- No external network requests from extension
- Version data validated before use
- XSS protection in changelog display

## Troubleshooting

### Common Issues

**Update check not working**:
```bash
# Check cache file exists
ls -la ~/.vibe-annotations/.update-check

# Check NPM Registry manually  
curl https://registry.npmjs.org/vibe-annotations-server/latest
```

**Extension badge not clearing**:
- Open extension popup (badge clears automatically)
- Check Chrome storage: `chrome.storage.local.get(['updateInfo'])`

**Version compatibility errors**:
- Verify extension and server versions
- Check `/health` endpoint response
- Update extension or server as needed

## Future Enhancements

### Planned Features

- **Automatic Server Updates**: Optional auto-update for server package
- **Release Notes Integration**: Fetch changelogs from package metadata
- **Update Scheduling**: Allow users to schedule update checks
- **Multiple Update Channels**: Support beta/stable release channels

### API Improvements

- **Webhook Integration**: Real-time update notifications
- **Delta Updates**: Only download changed files
- **Rollback Support**: Easy version rollback if issues occur
- **Update Analytics**: Track update adoption rates

## Contributing

When contributing to the update system:

1. Test both extension and server update paths
2. Verify version compatibility logic
3. Update documentation for new features
4. Follow semantic versioning guidelines
5. Test with various network conditions

## Changelog

See [CHANGELOG.md](../CHANGELOG.md) for detailed version history and [annotations-server/CHANGELOG.md](../annotations-server/CHANGELOG.md) for server changes.