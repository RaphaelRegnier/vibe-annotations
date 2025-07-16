#!/usr/bin/env node

import { readAnnotations } from './src/tools/read-annotations.js';
import { syncChromeData } from './src/tools/sync-chrome-data.js';
import { ensureDataFile } from './src/storage/annotations.js';

// Simple MCP-compatible server using stdio
class SimpleMCPServer {
  constructor() {
    this.setupStdio();
    this.tools = {
      read_annotations: {
        name: 'read_annotations',
        description: 'Read annotations from the Claude Annotations extension',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['pending', 'completed', 'archived', 'all'], default: 'pending' },
            limit: { type: 'number', default: 50, minimum: 1, maximum: 200 },
            url: { type: 'string', description: 'Filter by localhost URL' }
          }
        }
      },
      sync_chrome_data: {
        name: 'sync_chrome_data',
        description: 'Sync annotations from Chrome extension to MCP data file',
        inputSchema: {
          type: 'object',
          properties: {
            annotations: { type: 'array', description: 'Array of annotations from Chrome extension' }
          },
          required: ['annotations']
        }
      }
    };
  }

  setupStdio() {
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (data) => {
      this.handleRequest(data.trim());
    });
  }

  async handleRequest(input) {
    try {
      const request = JSON.parse(input);
      const response = await this.processRequest(request);
      process.stdout.write(JSON.stringify(response) + '\n');
    } catch (error) {
      const errorResponse = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: error.message
        }
      };
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  }

  async processRequest(request) {
    const { method, params, id } = request;

    switch (method) {
      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: Object.values(this.tools)
          }
        };

      case 'tools/call':
        const { name, arguments: args } = params;
        const result = await this.callTool(name, args);
        return {
          jsonrpc: '2.0',
          id,
          result
        };

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  async callTool(name, args) {
    switch (name) {
      case 'read_annotations':
        const annotations = await readAnnotations(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                tool: 'read_annotations',
                status: 'success',
                data: annotations,
                count: annotations.length,
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };

      case 'sync_chrome_data':
        const syncResult = await syncChromeData(args);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                tool: 'sync_chrome_data',
                status: 'success',
                data: syncResult,
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
}

// Start MCP server only when called by Claude Code
async function main() {
  try {
    await ensureDataFile();
    
    // Only start if this is being used as MCP server (has stdin input)
    if (!process.stdin.isTTY) {
      console.error("Claude Annotations MCP Server starting...");
      new SimpleMCPServer();
    } else {
      console.log("Claude Annotations MCP Server ready for stdio communication");
      process.exit(0);
    }
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});