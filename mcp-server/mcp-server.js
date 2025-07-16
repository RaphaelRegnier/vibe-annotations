#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readAnnotations } from './src/tools/read-annotations.js';
import { syncChromeData } from './src/tools/sync-chrome-data.js';
import { ensureDataFile } from './src/storage/annotations.js';

class ClaudeAnnotationsMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'claude-annotations',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'read_annotations',
            description: 'Read annotations from the Claude Annotations extension',
            inputSchema: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: ['pending', 'completed', 'archived', 'all'],
                  default: 'pending',
                  description: 'Filter annotations by status'
                },
                limit: {
                  type: 'number',
                  default: 50,
                  minimum: 1,
                  maximum: 200,
                  description: 'Maximum number of annotations to return'
                },
                url: {
                  type: 'string',
                  description: 'Filter by specific localhost URL'
                }
              },
              additionalProperties: false
            }
          },
          {
            name: 'sync_chrome_data',
            description: 'Sync annotations from Chrome extension to MCP data file',
            inputSchema: {
              type: 'object',
              properties: {
                annotations: {
                  type: 'array',
                  description: 'Array of annotations from Chrome extension',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      url: { type: 'string' },
                      selector: { type: 'string' },
                      comment: { type: 'string' },
                      status: { type: 'string', enum: ['pending', 'completed', 'archived'] },
                      created_at: { type: 'string' },
                      updated_at: { type: 'string' }
                    },
                    required: ['id', 'url', 'selector', 'comment', 'status']
                  }
                }
              },
              required: ['annotations'],
              additionalProperties: false
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'read_annotations':
            const annotations = await readAnnotations(args || {});
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
            const syncResult = await syncChromeData(args || {});
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
      } catch (error) {
        throw new Error(`Tool execution failed: ${error.message}`);
      }
    });
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    // Ensure data file exists
    await ensureDataFile();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    // Keep the server running
    console.error('Claude Annotations MCP Server started successfully');
  }
}

// Start the server
async function main() {
  try {
    const server = new ClaudeAnnotationsMCPServer();
    await server.run();
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});