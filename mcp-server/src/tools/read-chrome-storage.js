import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Read annotations directly from Chrome extension storage
 * This attempts to read from Chrome's Local Storage for the extension
 */
export async function readChromeStorage() {
  try {
    // Chrome extension storage locations vary by platform
    const platform = os.platform();
    let chromeStoragePaths = [];
    
    if (platform === 'darwin') { // macOS
      const userHome = os.homedir();
      chromeStoragePaths = [
        path.join(userHome, 'Library/Application Support/Google/Chrome/Default/Local Extension Settings'),
        path.join(userHome, 'Library/Application Support/Google/Chrome/Profile 1/Local Extension Settings'),
      ];
    } else if (platform === 'win32') { // Windows
      const userHome = os.homedir();
      chromeStoragePaths = [
        path.join(userHome, 'AppData/Local/Google/Chrome/User Data/Default/Local Extension Settings'),
        path.join(userHome, 'AppData/Local/Google/Chrome/User Data/Profile 1/Local Extension Settings'),
      ];
    } else { // Linux
      const userHome = os.homedir();
      chromeStoragePaths = [
        path.join(userHome, '.config/google-chrome/Default/Local Extension Settings'),
        path.join(userHome, '.config/google-chrome/Profile 1/Local Extension Settings'),
      ];
    }

    // Try to find the extension's storage
    for (const basePath of chromeStoragePaths) {
      try {
        const dirs = await fs.readdir(basePath);
        console.error(`Found Chrome extension directories: ${dirs.length}`);
        
        // Look for directories that might be our extension
        // Extension IDs are typically 32-character strings
        for (const dir of dirs) {
          if (dir.length === 32) {
            const extensionPath = path.join(basePath, dir);
            console.error(`Checking extension: ${dir}`);
            // This would require parsing Chrome's internal storage format
            // which is complex and platform-specific
          }
        }
      } catch (error) {
        // Directory doesn't exist, try next path
        continue;
      }
    }

    // For now, return empty since direct Chrome storage access is complex
    console.error('Direct Chrome storage access not implemented - use sync_chrome_data tool instead');
    return [];

  } catch (error) {
    console.error('Error reading Chrome storage:', error);
    return [];
  }
}

/**
 * Alternative: Read from the Downloads location where extension syncs data
 */
export async function readFromDownloads() {
  try {
    const userHome = os.homedir();
    const downloadsPath = path.join(userHome, 'Downloads/claude-annotations-data/annotations.json');
    
    const data = await fs.readFile(downloadsPath, 'utf8');
    const annotations = JSON.parse(data);
    
    console.error(`Read ${annotations.length} annotations from Downloads sync`);
    return annotations;
    
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Error reading from Downloads:', error);
    }
    return [];
  }
}

// Tool definition for MCP server
export const readChromeStorageTool = {
  name: 'read_chrome_storage',
  description: 'Read annotations directly from Chrome extension storage or Downloads sync location',
  inputSchema: {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        enum: ['downloads', 'storage'],
        default: 'downloads',
        description: 'Source to read from: downloads (synced file) or storage (direct Chrome access)'
      }
    },
    additionalProperties: false
  }
};