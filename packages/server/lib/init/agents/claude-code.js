import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import { hasBinary, mcpConfig, MCP_COMMAND, MCP_ARGS, MCP_NAME } from './shared.js';

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
      value: { type: 'stdio', ...mcpConfig() },
    };
  },

  projectConfig(cwd) {
    return {
      path: PROJECT_PATH(cwd),
      format: 'json',
      keyPath: ['mcpServers', MCP_NAME],
      value: { type: 'stdio', ...mcpConfig() },
    };
  },

  userCli() {
    return [
      'claude', 'mcp', 'add',
      '--scope', 'user',
      '--transport', 'stdio',
      MCP_NAME, '--', MCP_COMMAND, ...MCP_ARGS,
    ];
  },

  projectCli() {
    return [
      'claude', 'mcp', 'add',
      '--scope', 'project',
      '--transport', 'stdio',
      MCP_NAME, '--', MCP_COMMAND, ...MCP_ARGS,
    ];
  },

  scopeNote: 'user scope — works across all projects',
};
