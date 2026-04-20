import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { hasBinary, MCP_URL, MCP_NAME } from './shared.js';

function userSettingsDir() {
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Code', 'User');
  }
  if (process.platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'Code', 'User');
  }
  return join(homedir(), '.config', 'Code', 'User');
}

const USER_PATH = join(userSettingsDir(), 'mcp.json');

export default {
  id: 'vscode',
  label: 'VS Code',

  detect() {
    return hasBinary('code') || existsSync(userSettingsDir());
  },

  userConfig() {
    return {
      path: USER_PATH,
      format: 'json',
      keyPath: ['servers', MCP_NAME],
      value: { type: 'http', url: MCP_URL },
    };
  },

  projectConfig(cwd) {
    return {
      path: join(cwd, '.vscode', 'mcp.json'),
      format: 'json',
      keyPath: ['servers', MCP_NAME],
      value: { type: 'http', url: MCP_URL },
    };
  },
};
