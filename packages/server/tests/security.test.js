import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { request } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('local server enforces authentication and browser boundaries', { timeout: 30000 }, async t => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'vibe-security-test-'));
  process.env.VIBE_ANNOTATIONS_DATA_DIR = dataDir;
  const { getAuthToken, TOKEN_FILE, EXTENSION_ORIGIN } = await import('../lib/auth.js');
  const { LocalAnnotationsServer } = await import('../lib/server.js');
  const token = getAuthToken();
  const annotations = new LocalAnnotationsServer({ port: 0 });
  // Exercise the real listener/routes/storage without installing process-wide
  // signal handlers or making update-check requests from the test runner.
  annotations.setupProcessHandlers = () => {};
  annotations.checkForUpdates = async () => {};
  await annotations.start();
  if (!annotations.server.listening) await once(annotations.server, 'listening');
  const url = `http://127.0.0.1:${annotations.port}`;
  const auth = { Authorization: `Bearer ${token}` };
  t.after(async () => {
    clearInterval(annotations.watcherSweepInterval);
    annotations.stopAllWatchers();
    const closed = new Promise(resolve => annotations.server.close(resolve));
    annotations.server.closeAllConnections();
    await closed;
    assert.ok(path.resolve(dataDir).startsWith(path.resolve(tmpdir()) + path.sep));
    await rm(dataDir, { recursive: true, force: true });
    delete process.env.VIBE_ANNOTATIONS_DATA_DIR;
  });

  await t.test('binds only to IPv4 loopback and persists a private random token', async () => {
    assert.equal(annotations.server.address().address, '127.0.0.1');
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.equal(getAuthToken(), token);
    assert.equal((await readFile(TOKEN_FILE, 'utf8')).trim(), token);
    if (process.platform !== 'win32') assert.equal((await stat(TOKEN_FILE)).mode & 0o777, 0o600);
    const health = await (await fetch(`${url}/health`)).json();
    assert.equal(health.authentication, 'bearer');
    assert.equal(JSON.stringify(health).includes(token), false);
  });

  await t.test('protects HTTP, attachments, exports, watchers, MCP and legacy SSE', async () => {
    const routes = [
      ['GET', '/api/annotations'], ['POST', '/api/annotations'],
      ['POST', '/api/annotations/sync'], ['PUT', '/api/annotations/example'],
      ['DELETE', '/api/annotations/example'], ['GET', '/api/export'],
      ['GET', '/api/watchers'], ['POST', '/api/watchers/stop'],
      ['GET', '/api/annotations/example/attachments/a'],
      ['POST', '/api/annotations/example/attachments'],
      ['DELETE', '/api/annotations/example/attachments/a'],
      ['POST', '/mcp'], ['GET', '/sse'], ['POST', '/messages'],
    ];
    for (const [method, route] of routes) {
      const response = await fetch(url + route, { method });
      assert.equal(response.status, 401, `${method} ${route}`);
    }
    assert.equal((await fetch(`${url}/api/annotations`, { headers: { Authorization: 'Bearer wrong' } })).status, 401);
  });

  await t.test('rejects hostile hosts and origins before requests can mutate data', async () => {
    const before = await readFile(path.join(dataDir, 'annotations.json'), 'utf8');
    for (const origin of ['https://attacker.example', 'http://attacker.local', 'null', 'chrome-extension://' + 'a'.repeat(32)]) {
      const response = await fetch(`${url}/api/annotations/sync`, {
        method: 'POST', headers: { ...auth, Origin: origin, 'Content-Type': 'text/plain' },
        body: '{"annotations":[]}',
      });
      assert.equal(response.status, 403, origin);
    }
    for (const route of ['/health', '/mcp']) {
      const status = await new Promise((resolve, reject) => {
        const req = request(url + route, { headers: { Host: 'attacker.example', ...auth } }, response => {
          response.resume();
          resolve(response.statusCode);
        });
        req.on('error', reject);
        req.end();
      });
      assert.equal(status, 403, route);
    }
    const preflight = await fetch(`${url}/api/annotations`, {
      method: 'OPTIONS', headers: { Origin: EXTENSION_ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), EXTENSION_ORIGIN);
    assert.equal(await readFile(path.join(dataDir, 'annotations.json'), 'utf8'), before);
  });

  await t.test('paired extension can create/read annotations and image attachments', async () => {
    const headers = { ...auth, Origin: EXTENSION_ORIGIN, 'Content-Type': 'application/json' };
    const annotation = { id: 'test-pin', url: 'http://localhost:3000/', selector: 'h1', comment: 'Use larger text', status: 'pending' };
    assert.equal((await fetch(`${url}/api/annotations`, { method: 'POST', headers, body: JSON.stringify(annotation) })).status, 200);
    const response = await fetch(`${url}/api/annotations`, { headers });
    assert.equal((await response.json()).annotations[0].comment, annotation.comment);
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');
    const upload = await fetch(`${url}/api/annotations/test-pin/attachments`, {
      method: 'POST', headers: { ...auth, Origin: EXTENSION_ORIGIN, 'Content-Type': 'image/png' }, body: image,
    });
    assert.equal(upload.status, 200);
    const { attachment } = await upload.json();
    const downloaded = await fetch(`${url}/api/annotations/test-pin/attachments/${attachment.id}`, { headers: auth });
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), image);
  });

  await t.test('authenticated HTTP MCP still lists and calls tools', async () => {
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${url}/mcp`), { requestInit: { headers: auth } }));
    try {
      assert.ok((await client.listTools()).tools.some(tool => tool.name === 'read_annotations'));
      const result = await client.callTool({ name: 'read_annotations', arguments: {} });
      assert.equal(result.isError, undefined);
      assert.match(JSON.stringify(result), /Use larger text/);
    } finally { await client.close(); }
  });

  await t.test('stdio proxy pairs from the private file and forwards real MCP calls', async () => {
    const proxyUrl = new URL('../lib/mcp-stdio.js', import.meta.url).href;
    const script = `import { runStdioProxy } from ${JSON.stringify(proxyUrl)}; await runStdioProxy({ url: process.env.TEST_MCP_URL });`;
    const client = new Client({ name: 'stdio-test', version: '1.0.0' });
    const transport = new StdioClientTransport({
      command: process.execPath, args: ['--input-type=module', '-e', script],
      env: { ...process.env, VIBE_ANNOTATIONS_DATA_DIR: dataDir, TEST_MCP_URL: `${url}/mcp` },
      stderr: 'pipe',
    });
    await client.connect(transport);
    try {
      assert.ok((await client.listTools()).tools.some(tool => tool.name === 'watch_annotations'));
      const result = await client.callTool({ name: 'read_annotations', arguments: {} });
      assert.match(JSON.stringify(result), /Use larger text/);
      assert.equal(JSON.stringify(result).includes(token), false);
      const watched = await client.callTool({ name: 'watch_annotations', arguments: { url: 'http://localhost:3000/*' } });
      assert.match(JSON.stringify(watched), /Use larger text/);
    } finally { await client.close(); }
  });
});
