import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { hasBinary, MCP_URL, MCP_NAME } from './shared.js';

const USER_PATH = join(homedir(), '.openclaw', 'openclaw.json');

export default {
  id: 'openclaw',
  label: 'OpenClaw',

  detect() {
    return hasBinary('openclaw') || existsSync(join(homedir(), '.openclaw'));
  },

  userConfig() {
    return {
      path: USER_PATH,
      format: 'json',
      keyPath: ['mcpServers', MCP_NAME],
      value: { transport: 'http', url: MCP_URL },
    };
  },
};
