import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { spawnSync } from 'child_process';
import { homedir } from 'os';

export const MCP_URL = 'http://127.0.0.1:3846/mcp';
export const MCP_NAME = 'vibe-annotations';

export function hasBinary(name) {
  const cmd = process.platform === 'win32' ? 'where' : 'sh';
  const args = process.platform === 'win32' ? [name] : ['-c', `command -v ${name}`];
  const result = spawnSync(cmd, args, { stdio: 'ignore' });
  return result.status === 0;
}

export function expandHome(p) {
  if (p.startsWith('~/') || p === '~') {
    return p.replace(/^~/, homedir());
  }
  return p;
}

export function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

export function readText(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

export function writeText(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

export function getAt(obj, keyPath) {
  if (!obj) return undefined;
  let cur = obj;
  for (const k of keyPath) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[k];
  }
  return cur;
}

export function setAt(obj, keyPath, value) {
  const root = obj && typeof obj === 'object' ? { ...obj } : {};
  let cur = root;
  for (let i = 0; i < keyPath.length - 1; i++) {
    const k = keyPath[i];
    const next = cur[k];
    cur[k] = next && typeof next === 'object' ? { ...next } : {};
    cur = cur[k];
  }
  cur[keyPath[keyPath.length - 1]] = value;
  return root;
}

export function deleteAt(obj, keyPath) {
  if (!obj || typeof obj !== 'object') return obj;
  const root = { ...obj };
  let cur = root;
  for (let i = 0; i < keyPath.length - 1; i++) {
    const k = keyPath[i];
    if (!cur[k] || typeof cur[k] !== 'object') return obj;
    cur[k] = { ...cur[k] };
    cur = cur[k];
  }
  delete cur[keyPath[keyPath.length - 1]];
  return root;
}

export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
  return true;
}

export function runCli(argv) {
  const [cmd, ...args] = argv;
  const result = spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8' });
  return {
    ok: result.status === 0,
    stdout: result.stdout?.toString() ?? '',
    stderr: result.stderr?.toString() ?? '',
  };
}

const TOML_SECTION_RE = (name) =>
  new RegExp(`(^|\\n)\\[${escapeRegex(name)}\\][^\\[]*`, 'g');

function escapeRegex(s) {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export function tomlReadSection(text, sectionName) {
  if (!text) return null;
  const re = TOML_SECTION_RE(sectionName);
  const match = re.exec(text);
  return match ? match[0] : null;
}

export function tomlUpsertSection(text, sectionName, body) {
  const block = `[${sectionName}]\n${body}\n`;
  if (!text || text.trim() === '') return block;
  const re = TOML_SECTION_RE(sectionName);
  if (re.test(text)) {
    return text.replace(re, (m) => (m.startsWith('\n') ? '\n' : '') + block);
  }
  const sep = text.endsWith('\n') ? '\n' : '\n\n';
  return text + sep + block;
}

export function tomlRemoveSection(text, sectionName) {
  if (!text) return text;
  const re = TOML_SECTION_RE(sectionName);
  return text.replace(re, (m) => (m.startsWith('\n') ? '\n' : ''));
}
