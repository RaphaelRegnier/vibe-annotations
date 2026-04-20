import { execSync } from 'child_process';

const PORT = 3846;
const HEALTH_URL = `http://127.0.0.1:${PORT}/health`;

export async function checkEnvironment() {
  const [portState, serverInstalled] = await Promise.all([
    checkPortState(),
    checkServerInstalled(),
  ]);

  return {
    node: process.versions.node,
    nodeOk: majorVersion(process.versions.node) >= 16,
    pkgMgr: detectPackageManager(),
    portState,
    serverInstalled,
  };
}

function majorVersion(v) {
  return Number.parseInt(v.split('.')[0], 10);
}

function detectPackageManager() {
  const ua = process.env.npm_config_user_agent || '';
  if (ua.startsWith('pnpm')) return 'pnpm';
  if (ua.startsWith('yarn')) return 'yarn';
  if (ua.startsWith('npm')) return 'npm';

  for (const mgr of ['pnpm', 'yarn', 'npm']) {
    if (hasBinary(mgr)) return mgr;
  }
  return null;
}

function hasBinary(name) {
  try {
    execSync(`command -v ${name}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function checkPortState() {
  let res;
  try {
    res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(1500) });
  } catch {
    return { state: 'free' };
  }

  try {
    const body = await res.json();
    if (body && body.status === 'ok' && typeof body.version === 'string') {
      return { state: 'ours', version: body.version };
    }
  } catch {
    // fall through to foreign
  }
  return { state: 'foreign' };
}

async function checkServerInstalled() {
  try {
    const out = execSync('npm ls -g --depth=0 --json vibe-annotations-server', {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString();
    const parsed = JSON.parse(out);
    const dep = parsed?.dependencies?.['vibe-annotations-server'];
    if (dep?.version) return { installed: true, version: dep.version };
  } catch {
    // not installed or npm not available
  }
  return { installed: false };
}
