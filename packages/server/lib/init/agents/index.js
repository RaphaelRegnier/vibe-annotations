import claudeCode from './claude-code.js';
import cursor from './cursor.js';
import windsurf from './windsurf.js';
import codex from './codex.js';
import openclaw from './openclaw.js';
import vscode from './vscode.js';
import { existsSync, readFileSync } from 'fs';
import {
  readJson,
  writeJson,
  getAt,
  setAt,
  deleteAt,
  deepEqual,
  runCli,
} from './shared.js';

export const AGENTS = [claudeCode, cursor, windsurf, codex, openclaw, vscode];

export function findAgent(id) {
  return AGENTS.find((a) => a.id === id) || null;
}

export async function detectAll() {
  const entries = await Promise.all(
    AGENTS.map(async (a) => [a.id, Boolean(await a.detect())]),
  );
  return Object.fromEntries(entries);
}

export function planConfig(agent, { scope, cwd }) {
  const getter = scope === 'project' ? agent.projectConfig : agent.userConfig;
  if (!getter) {
    return { supported: false };
  }
  return { supported: true, config: getter.call(agent, cwd) };
}

export async function applyAgent(agent, { scope, cwd, detected, confirmOverwrite }) {
  const { supported, config } = planConfig(agent, { scope, cwd });
  if (!supported) {
    return { status: 'unsupported-scope', agent: agent.id };
  }

  if (config.format === 'toml') {
    return applyToml(agent, config, { detected, confirmOverwrite });
  }
  return applyJson(agent, config, { scope, detected, confirmOverwrite });
}

async function applyJson(agent, config, { scope, detected, confirmOverwrite }) {
  if (existsSync(config.path) && !isParseable(config.path)) {
    return { status: 'unreadable', agent: agent.id, path: config.path };
  }
  const existing = readJson(config.path);

  const current = getAt(existing, config.keyPath);
  if (current && deepEqual(current, config.value)) {
    return { status: 'noop', agent: agent.id, path: config.path };
  }

  if (current) {
    const ok = await confirmOverwrite({
      agent,
      path: config.path,
      current,
      next: config.value,
    });
    if (!ok) return { status: 'skipped', agent: agent.id, path: config.path };
  }

  const cli = detected && pickCli(agent, scope);
  if (cli) {
    const result = runCli(cli);
    if (result.ok) {
      return { status: 'ok', method: 'cli', agent: agent.id, path: config.path, cli };
    }
  }

  const next = setAt(existing || {}, config.keyPath, config.value);
  writeJson(config.path, next);
  return { status: 'ok', method: 'file', agent: agent.id, path: config.path };
}

async function applyToml(agent, config, { confirmOverwrite }) {
  const existing = config.read();
  if (existing && existing.includes(config.body)) {
    return { status: 'noop', agent: agent.id, path: config.path };
  }

  if (existing) {
    const ok = await confirmOverwrite({
      agent,
      path: config.path,
      current: existing.trim(),
      next: config.expected.trim(),
    });
    if (!ok) return { status: 'skipped', agent: agent.id, path: config.path };
  }

  config.write();
  return { status: 'ok', method: 'file', agent: agent.id, path: config.path };
}

export function removeAgent(agent, { scope, cwd }) {
  const { supported, config } = planConfig(agent, { scope, cwd });
  if (!supported) return { status: 'unsupported-scope' };

  if (config.format === 'toml') {
    const before = config.read();
    if (!before) return { status: 'not-present' };
    config.remove();
    return { status: 'removed', path: config.path };
  }

  const existing = readJson(config.path);
  if (!existing || getAt(existing, config.keyPath) === undefined) {
    return { status: 'not-present', path: config.path };
  }
  const next = deleteAt(existing, config.keyPath);
  writeJson(config.path, next);
  return { status: 'removed', path: config.path };
}

function pickCli(agent, scope) {
  if (scope === 'project') return agent.projectCli?.();
  return agent.userCli?.();
}

function isParseable(path) {
  try {
    const text = readFileSync(path, 'utf8').trim();
    if (text === '') return true;
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}
