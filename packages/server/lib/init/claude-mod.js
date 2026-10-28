import { spawnSync } from 'child_process';
import { hasBinary } from './agents/shared.js';

// The Claude Code mod (packages/claude-mod in the vibe-annotations repo):
// shows new annotations above the prompt, sends them to Claude in one press,
// and starts this server when a session starts. Installed from the repo's own
// plugin marketplace, at user scope so every project gets it.
export const MOD_INSTALL_ARGS = [
  'plugin', 'install', 'vibe-annotations',
  '--marketplace', 'RaphaelRegnier/vibe-annotations',
  '--scope', 'user',
];

export const MOD_INSTALL_COMMAND = `claude ${MOD_INSTALL_ARGS.join(' ')}`;

export function canInstallClaudeMod() {
  return hasBinary('claude');
}

export function installClaudeMod() {
  const result = spawnSync('claude', MOD_INSTALL_ARGS, {
    stdio: 'pipe',
    encoding: 'utf8',
    timeout: 120_000,
  });
  if (result.status === 0) return { ok: true };
  return { ok: false, output: (result.stderr || result.stdout || result.error?.message || '').trim() };
}
