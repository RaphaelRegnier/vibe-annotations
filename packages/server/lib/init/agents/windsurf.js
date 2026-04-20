import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { hasBinary, MCP_URL, MCP_NAME } from './shared.js';

const USER_PATH = join(homedir(), '.codeium', 'windsurf', 'mcp_config.json');

export default {
  id: 'windsurf',
  label: 'Windsurf',

  detect() {
    return hasBinary('windsurf') || existsSync(join(homedir(), '.codeium', 'windsurf'));
  },

  userConfig() {
    return {
      path: USER_PATH,
      format: 'json',
      keyPath: ['mcpServers', MCP_NAME],
      value: { serverUrl: MCP_URL },
    };
  },
};
