import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';
import {
  hasBinary,
  MCP_URL,
  MCP_NAME,
  readText,
  writeText,
  tomlReadSection,
  tomlUpsertSection,
  tomlRemoveSection,
} from './shared.js';

const USER_PATH = join(homedir(), '.codex', 'config.toml');
const SECTION = `mcp_servers.${MCP_NAME}`;
const TOML_BODY =
  `transport = "http"\n` +
  `url = "${MCP_URL}"`;

export default {
  id: 'codex',
  label: 'Codex',

  detect() {
    return hasBinary('codex') || existsSync(join(homedir(), '.codex'));
  },

  userConfig() {
    return {
      path: USER_PATH,
      format: 'toml',
      section: SECTION,
      body: TOML_BODY,

      read: () => {
        const text = readText(USER_PATH);
        return tomlReadSection(text, SECTION);
      },
      write: () => {
        const text = readText(USER_PATH) ?? '';
        writeText(USER_PATH, tomlUpsertSection(text, SECTION, TOML_BODY));
      },
      remove: () => {
        const text = readText(USER_PATH);
        if (text == null) return;
        writeText(USER_PATH, tomlRemoveSection(text, SECTION));
      },
      expected: `[${SECTION}]\n${TOML_BODY}\n`,
    };
  },
};
