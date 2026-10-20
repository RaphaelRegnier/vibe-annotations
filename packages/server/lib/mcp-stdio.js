import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { getAuthToken } from './auth.js';

// Keep the bearer credential out of agent config files, especially project files
// that may be committed. Only this local subprocess reads it from the user's home.
export async function runStdioProxy({ url = 'http://127.0.0.1:3846/mcp' } = {}) {
  const target = new URL(url);
  if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || target.username || target.password) {
    throw new Error('The MCP proxy must connect to IPv4 loopback.');
  }
  const client = new Client({ name: 'vibe-annotations-local-client', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(target, {
    requestInit: { headers: { Authorization: `Bearer ${getAuthToken()}` }, redirect: 'error' },
  });
  await client.connect(transport);
  const server = new Server({ name: 'vibe-annotations', version: '1.0.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, request => client.listTools(request.params));
  server.setRequestHandler(CallToolRequestSchema, (request, extra) => {
    // A watch can block for up to 30 minutes; the SDK's default 60-second
    // timeout would otherwise break watch mode after switching to the proxy.
    const seconds = Number(request.params.arguments?.timeout) || 300;
    const timeout = request.params.name === 'watch_annotations'
      ? Math.min(1800, Math.max(30, seconds)) * 1000 + 15000
      : 60000;
    return client.callTool(request.params, undefined, { timeout, signal: extra.signal });
  });
  const stdio = new StdioServerTransport();
  server.onclose = () => client.close();
  process.stdin.once('end', () => server.close());
  try {
    await server.connect(stdio);
  } catch (error) {
    await client.close();
    throw error;
  }
}
