import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { hasBinary, MCP_URL, MCP_NAME } from './shared.js';

const USER_PATH = join(homedir(), '.claude.json');
const PROJECT_PATH = (cwd) => join(cwd, '.mcp.json');

export default {
  id: 'claude-code',
  label: 'Claude Code',

  detect() {
    return hasBinary('claude') || existsSync(USER_PATH);
  },

  userConfig() {
    return {
      path: USER_PATH,
      format: 'json',
      keyPath: ['mcpServers', MCP_NAME],
      value: { type: 'http', url: MCP_URL },
    };
  },

  projectConfig(cwd) {
    return {
      path: PROJECT_PATH(cwd),
      format: 'json',
      keyPath: ['mcpServers', MCP_NAME],
      value: { type: 'http', url: MCP_URL },
    };
  },

  userCli() {
    return [
      'claude', 'mcp', 'add',
      '--scope', 'user',
      '--transport', 'http',
      MCP_NAME, MCP_URL,
    ];
  },

  projectCli() {
    return [
      'claude', 'mcp', 'add',
      '--scope', 'project',
      '--transport', 'http',
      MCP_NAME, MCP_URL,
    ];
  },

  scopeNote: 'user scope — works across all projects',
};
