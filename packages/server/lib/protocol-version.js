import {
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
} from '@modelcontextprotocol/sdk/types.js';

const HEADER = 'mcp-protocol-version';

/**
 * The SDK's Streamable HTTP transport strictly rejects any `mcp-protocol-version`
 * header it doesn't know (HTTP 400), even though `initialize` would happily
 * negotiate down to LATEST_PROTOCOL_VERSION. Clients that adopt a newer spec
 * revision before the SDK does (Claude Code sending 2026-07-28, issue #95) are
 * therefore locked out entirely.
 *
 * Rewrite an unsupported header to LATEST_PROTOCOL_VERSION in place. Both
 * `req.headers` and `req.rawHeaders` are patched because the SDK converts the
 * Node request to a Web Request via @hono/node-server, which reads rawHeaders.
 *
 * Returns { from, to } when a rewrite happened, otherwise null.
 */
export function normalizeProtocolVersionHeader(req) {
  const value = req.headers?.[HEADER];
  if (typeof value !== 'string' || SUPPORTED_PROTOCOL_VERSIONS.includes(value)) {
    return null;
  }

  req.headers[HEADER] = LATEST_PROTOCOL_VERSION;

  if (Array.isArray(req.rawHeaders)) {
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      if (String(req.rawHeaders[i]).toLowerCase() === HEADER) {
        req.rawHeaders[i + 1] = LATEST_PROTOCOL_VERSION;
      }
    }
  }

  return { from: value, to: LATEST_PROTOCOL_VERSION };
}
