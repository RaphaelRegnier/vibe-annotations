#!/usr/bin/env node

import http from 'http';
import { readAnnotations } from './tools/read-annotations.js';
import { syncChromeData } from './tools/sync-chrome-data.js';
import { ensureDataFile, writeAnnotationsToFile, readAnnotationsFromFile, updateAnnotationInFile } from './storage/annotations.js';

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

// HTTP Server for Extension Communication
function createHTTPServer() {
  const server = http.createServer(async (req, res) => {
    // Enable CORS for localhost extension
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    
    try {
      if (url.pathname === '/health' && req.method === 'GET') {
        // Health check endpoint
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'ok', 
          server: 'claude-annotations-mcp',
          timestamp: new Date().toISOString() 
        }));
        
      } else if (url.pathname === '/annotations' && req.method === 'GET') {
        // Get annotations
        const annotations = await readAnnotationsFromFile();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          data: annotations,
          count: annotations.length 
        }));
        
      } else if (url.pathname === '/annotations' && req.method === 'POST') {
        // Add new annotation
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const annotation = JSON.parse(body);
            const annotations = await readAnnotationsFromFile();
            annotations.push(annotation);
            await writeAnnotationsToFile(annotations);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              success: true, 
              message: 'Annotation added',
              id: annotation.id 
            }));
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
          }
        });
        
      } else if (url.pathname.startsWith('/annotations/') && req.method === 'PUT') {
        // Update annotation
        const id = url.pathname.split('/')[2];
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const updates = JSON.parse(body);
            const success = await updateAnnotationInFile(id, updates);
            
            if (success) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, message: 'Annotation updated' }));
            } else {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Annotation not found' }));
            }
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: error.message }));
          }
        });
        
      } else {
        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Endpoint not found' }));
      }
      
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
  });
  
  return server;
}

// Start both servers
async function main() {
  try {
    // Ensure data file exists
    await ensureDataFile();
    
    // Start HTTP server for extension
    const httpServer = createHTTPServer();
    const HTTP_PORT = 3002;
    
    httpServer.listen(HTTP_PORT, 'localhost', () => {
      console.error(`Claude Annotations HTTP Server running on http://localhost:${HTTP_PORT}`);
      console.error("Endpoints: /health, /annotations");
    });
    
    // Start MCP stdio server for Claude Code
    console.error("Claude Annotations MCP Server running on stdio");
    console.error("Available tools: read_annotations, sync_chrome_data");
    
    new SimpleMCPServer();
    
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});