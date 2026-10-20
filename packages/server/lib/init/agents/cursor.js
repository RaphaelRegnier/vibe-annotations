import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { hasBinary, mcpConfig, MCP_NAME } from './shared.js';

const USER_PATH = join(homedir(), '.cursor', 'mcp.json');
const PROJECT_PATH = (cwd) => join(cwd, '.cursor', 'mcp.json');

export default {
  id: 'cursor',
  label: 'Cursor',

  detect() {
    return hasBinary('cursor') || existsSync(join(homedir(), '.cursor'));
  },

  userConfig() {
    return {
      path: USER_PATH,
      format: 'json',
      keyPath: ['mcpServers', MCP_NAME],
      value: mcpConfig(),
    };
  },

  projectConfig(cwd) {
    return {
      path: PROJECT_PATH(cwd),
      format: 'json',
      keyPath: ['mcpServers', MCP_NAME],
      value: mcpConfig(),
    };
  },
};
