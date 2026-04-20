import { spawn, spawnSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync, openSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const PORT = 3846;
const HEALTH_URL = `http://127.0.0.1:${PORT}/health`;
const CONFIG_DIR = join(homedir(), '.vibe-annotations');
const PID_FILE = join(CONFIG_DIR, 'server.pid');
const LOG_FILE = join(CONFIG_DIR, 'server.log');

export async function installServer(pkgMgr) {
  const mgr = pkgMgr || 'npm';
  const args = installArgs(mgr);
  const result = spawnSync(mgr, args, { stdio: 'pipe', encoding: 'utf8' });

  if (result.status === 0) {
    return { ok: true };
  }

  const stderr = (result.stderr || '').toString();
  const permDenied = /EACCES|permission denied/i.test(stderr);
  return { ok: false, permDenied, stderr };
}

function installArgs(mgr) {
  if (mgr === 'pnpm') return ['add', '-g', 'vibe-annotations-server'];
  if (mgr === 'yarn') return ['global', 'add', 'vibe-annotations-server'];
  return ['install', '-g', 'vibe-annotations-server'];
}

export async function startServer() {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });

  const resolved = resolveServerEntry();
  if (!resolved) {
    return { ok: false, reason: 'server-entry-not-found' };
  }

  const out = openSync(LOG_FILE, 'a');
  const err = openSync(LOG_FILE, 'a');
  const child = spawn(process.execPath, [resolved], {
    detached: true,
    stdio: ['ignore', out, err],
    env: { ...process.env, NODE_ENV: 'production' },
  });
  child.unref();
  writeFileSync(PID_FILE, String(child.pid));

  for (let i = 0; i < 20; i++) {
    if (await healthOk()) return { ok: true, pid: child.pid };
    await sleep(250);
  }

  if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
  return { ok: false, reason: 'server-did-not-respond', logFile: LOG_FILE };
}

function resolveServerEntry() {
  const candidates = [];

  try {
    const viaNpm = spawnSync('npm', ['root', '-g'], { stdio: 'pipe', encoding: 'utf8' });
    if (viaNpm.status === 0) {
      const root = viaNpm.stdout.trim();
      candidates.push(join(root, 'vibe-annotations-server', 'lib', 'server.js'));
    }
  } catch {
    // ignore
  }

  try {
    const bundled = new URL('../server.js', import.meta.url);
    candidates.push(bundled.pathname);
  } catch {
    // ignore
  }

  return candidates.find((p) => existsSync(p));
}

async function healthOk() {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(1000) });
    if (!res.ok) return false;
    const body = await res.json();
    return body?.status === 'ok';
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
