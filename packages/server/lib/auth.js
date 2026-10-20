import { randomBytes, timingSafeEqual } from 'crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';

export const DATA_DIR = process.env.VIBE_ANNOTATIONS_DATA_DIR || path.join(homedir(), '.vibe-annotations');
export const TOKEN_FILE = path.join(DATA_DIR, 'auth-token');
const extensionId = process.env.VIBE_ANNOTATIONS_EXTENSION_ID || 'gkofobaeeepjopdpahbicefmljcmpeof';
if (!/^[a-p]{32}$/.test(extensionId)) throw new Error('Invalid VIBE_ANNOTATIONS_EXTENSION_ID');
export const EXTENSION_ORIGIN = `chrome-extension://${extensionId}`;

export function getAuthToken() {
  mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  try {
    writeFileSync(TOKEN_FILE, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  chmodSync(TOKEN_FILE, 0o600);
  const token = readFileSync(TOKEN_FILE, 'utf8').trim();
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid auth-token file; remove it and restart to pair again.');
  return token;
}

// Enforce these checks before CORS, parsers, and every route (including legacy SSE).
// CORS alone does not stop a browser from sending a request or a native client
// from reading its response. Missing Origin is allowed only with authentication.
export function requestGuard(token, getPort, extensionOrigin = EXTENSION_ORIGIN) {
  return (req, res, next) => {
    const port = typeof getPort === 'function' ? getPort() : getPort;
    const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    if (!hosts.has(req.headers.host)) return res.status(403).json({ error: 'Host not allowed' });
    const origin = req.headers.origin;
    if (origin !== undefined && origin !== extensionOrigin) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
    // Only the non-sensitive health probe and legitimate CORS preflight are public.
    if ((req.method === 'GET' && req.path === '/health') || (req.method === 'OPTIONS' && origin === extensionOrigin)) {
      return next();
    }
    const supplied = Buffer.from(req.headers.authorization || '');
    const expected = Buffer.from(`Bearer ${token}`);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return res.status(401).json({ error: 'Pair this client with the local server first' });
    }
    next();
  };
}
