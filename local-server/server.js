#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = 3846;
const DATA_FILE = path.join(__dirname, '..', 'mcp-server', 'data', 'annotations.json');

class LocalAnnotationsServer {
  constructor() {
    this.app = express();
    this.mcpServer = new Server(
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
    this.isShuttingDown = false;
    this.handlersSetup = false;
    
    this.setupExpress();
    this.setupMCP();
  }

  setupExpress() {
    this.app.use(cors({
      origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:8080', 'http://127.0.0.1:3000'],
      credentials: true
    }));
    this.app.use(express.json());

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // API endpoints for Chrome extension
    this.app.get('/api/annotations', async (req, res) => {
      try {
        const annotations = await this.loadAnnotations();
        const { status, url, limit = 50 } = req.query;
        
        let filtered = annotations;
        
        if (status && status !== 'all') {
          filtered = filtered.filter(a => a.status === status);
        }
        
        if (url) {
          filtered = filtered.filter(a => a.url === url);
        }
        
        filtered = filtered.slice(0, parseInt(limit));
        
        res.json({
          annotations: filtered,
          count: filtered.length,
          total: annotations.length
        });
      } catch (error) {
        console.error('Error loading annotations:', error);
        res.status(500).json({ error: 'Failed to load annotations' });
      }
    });

    this.app.post('/api/annotations', async (req, res) => {
      try {
        const annotation = req.body;
        
        // Validate annotation
        if (!annotation.id || !annotation.url || !annotation.comment) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        const annotations = await this.loadAnnotations();
        const existingIndex = annotations.findIndex(a => a.id === annotation.id);
        
        if (existingIndex >= 0) {
          annotations[existingIndex] = { ...annotations[existingIndex], ...annotation, updated_at: new Date().toISOString() };
        } else {
          annotations.push({
            ...annotation,
            created_at: annotation.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
        
        await this.saveAnnotations(annotations);
        console.log(`Saved annotation ${annotation.id} for ${annotation.url}`);
        res.json({ success: true, annotation });
      } catch (error) {
        console.error('Error saving annotation:', error);
        res.status(500).json({ error: 'Failed to save annotation' });
      }
    });

    // New endpoint to sync all annotations (replace existing)
    this.app.post('/api/annotations/sync', async (req, res) => {
      try {
        const { annotations } = req.body;
        
        if (!Array.isArray(annotations)) {
          return res.status(400).json({ error: 'annotations must be an array' });
        }

        // Replace all annotations with the new set
        await this.saveAnnotations(annotations);
        console.log(`Synced ${annotations.length} annotations (full replacement)`);
        res.json({ success: true, count: annotations.length });
      } catch (error) {
        console.error('Error syncing annotations:', error);
        res.status(500).json({ error: 'Failed to sync annotations' });
      }
    });

    this.app.put('/api/annotations/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const updates = req.body;
        
        const annotations = await this.loadAnnotations();
        const index = annotations.findIndex(a => a.id === id);
        
        if (index === -1) {
          return res.status(404).json({ error: 'Annotation not found' });
        }
        
        annotations[index] = {
          ...annotations[index],
          ...updates,
          updated_at: new Date().toISOString()
        };
        
        await this.saveAnnotations(annotations);
        res.json({ success: true, annotation: annotations[index] });
      } catch (error) {
        console.error('Error updating annotation:', error);
        res.status(500).json({ error: 'Failed to update annotation' });
      }
    });

    this.app.delete('/api/annotations/:id', async (req, res) => {
      try {
        const { id } = req.params;
        
        const annotations = await this.loadAnnotations();
        const index = annotations.findIndex(a => a.id === id);
        
        if (index === -1) {
          return res.status(404).json({ error: 'Annotation not found' });
        }
        
        const deletedAnnotation = annotations[index];
        annotations.splice(index, 1);
        
        await this.saveAnnotations(annotations);
        console.log(`Deleted annotation ${id}`);
        res.json({ 
          success: true, 
          deleted: true,
          message: `Annotation ${id} has been successfully deleted`,
          deletedAnnotation 
        });
      } catch (error) {
        console.error('Error deleting annotation:', error);
        res.status(500).json({ error: 'Failed to delete annotation' });
      }
    });

    // MCP HTTP endpoint - create fresh instances per request
    this.app.use('/mcp', async (req, res) => {
      try {
        // Create fresh server and transport for each request to avoid "already initialized" error
        const server = new Server(
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
        
        // Set up handlers for this instance
        this.setupMCPHandlersForServer(server);
        
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // Stateless mode
          allowedOrigins: ['*'], // Allow all origins for MCP
          enableDnsRebindingProtection: false // Disable for localhost
        });
        
        // Connect server to transport and handle request
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error('MCP connection error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'MCP connection failed' });
        }
      }
    });
  }

  setupMCP() {
    // Original server setup - now unused
  }

  setupMCPHandlersForServer(server) {
    // List tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'read_annotations',
            description: 'Read annotations from the Claude Annotations extension. IMPORTANT: Each annotation includes viewport width/height data. Always map these dimensions to the project\'s UI library breakpoints (Tailwind, Bootstrap, Material-UI, etc.) to ensure fixes are applied to the correct responsive breakpoint. For example, if an annotation was created at 475px width, determine which breakpoint range this falls into in the project\'s design system and apply fixes specifically for that breakpoint to respect the user\'s intent for responsive-specific changes.',
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
            name: 'delete_annotation',
            description: 'Delete annotation after implementing the requested fix or change. Use this when the annotation has been addressed and should be removed.',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Annotation ID to delete'
                }
              },
              required: ['id'],
              additionalProperties: false
            }
          },
          {
            name: 'get_project_context',
            description: 'Get context about the project structure for a localhost URL',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'Localhost URL to get context for'
                }
              },
              required: ['url'],
              additionalProperties: false
            }
          }
        ]
      };
    });

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'read_annotations': {
            const annotations = await this.readAnnotations(args || {});
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
          }

          case 'delete_annotation': {
            const result = await this.deleteAnnotation(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    tool: 'delete_annotation',
                    status: 'success',
                    data: result,
                    timestamp: new Date().toISOString()
                  }, null, 2)
                }
              ]
            };
          }

          case 'get_project_context': {
            const context = await this.getProjectContext(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    tool: 'get_project_context',
                    status: 'success',
                    data: context,
                    timestamp: new Date().toISOString()
                  }, null, 2)
                }
              ]
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        throw new Error(`Tool execution failed: ${error.message}`);
      }
    });

    server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };
  }

  async loadAnnotations() {
    try {
      if (!existsSync(DATA_FILE)) {
        await this.ensureDataFile();
        return [];
      }
      const data = await readFile(DATA_FILE, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading annotations:', error);
      return [];
    }
  }

  async saveAnnotations(annotations) {
    await this.ensureDataFile();
    await writeFile(DATA_FILE, JSON.stringify(annotations, null, 2));
  }

  async ensureDataFile() {
    const dataDir = path.dirname(DATA_FILE);
    if (!existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }
    if (!existsSync(DATA_FILE)) {
      await writeFile(DATA_FILE, JSON.stringify([], null, 2));
    }
  }

  // MCP Tool implementations
  async readAnnotations(args) {
    const annotations = await this.loadAnnotations();
    const { status = 'pending', limit = 50, url } = args;
    
    let filtered = annotations;
    
    if (status !== 'all') {
      filtered = filtered.filter(a => a.status === status);
    }
    
    if (url) {
      filtered = filtered.filter(a => a.url === url);
    }
    
    return filtered.slice(0, limit);
  }

  async deleteAnnotation(args) {
    const { id } = args;
    
    const annotations = await this.loadAnnotations();
    const index = annotations.findIndex(a => a.id === id);
    
    if (index === -1) {
      throw new Error(`Annotation with id ${id} not found`);
    }
    
    const deletedAnnotation = annotations[index];
    annotations.splice(index, 1); // Remove the annotation completely
    
    await this.saveAnnotations(annotations);
    
    return {
      id,
      deleted: true,
      message: `Annotation ${id} has been successfully deleted`,
      deletedAnnotation
    };
  }

  async getProjectContext(args) {
    const { url } = args;
    
    // Parse localhost URL to infer project structure
    const urlObj = new URL(url);
    const port = urlObj.port;
    
    const commonPorts = {
      '3000': 'React/Next.js',
      '5173': 'Vite',
      '8080': 'Vue/Webpack Dev Server',
      '4200': 'Angular',
      '3001': 'Express/Node.js'
    };
    
    return {
      url,
      port,
      likely_framework: commonPorts[port] || 'Unknown',
      timestamp: new Date().toISOString()
    };
  }


  setupProcessHandlers() {
    if (this.handlersSetup) return;
    this.handlersSetup = true;
    
    const forceExit = () => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      
      console.log('\nShutting down gracefully...');
      
      // Force exit after 2 seconds if graceful shutdown doesn't work
      const forceExitTimer = setTimeout(() => {
        console.log('Force exiting...');
        process.exit(1);
      }, 2000);
      
      if (this.server) {
        this.server.close(() => {
          clearTimeout(forceExitTimer);
          console.log('Server closed');
          process.exit(0);
        });
      } else {
        clearTimeout(forceExitTimer);
        process.exit(0);
      }
    };

    process.on('SIGINT', forceExit);
    process.on('SIGTERM', forceExit);
  }

  async start() {
    await this.ensureDataFile();
    
    // Set up process handlers only once
    this.setupProcessHandlers();
    
    this.server = this.app.listen(PORT, () => {
      console.log(`Local server running on http://localhost:${PORT}`);
      console.log(`HTTP API: http://localhost:${PORT}/api/annotations`);
      console.log(`MCP Endpoint: http://localhost:${PORT}/mcp`);
      console.log(`Health: http://localhost:${PORT}/health`);
      console.log('MCP server ready to handle requests');
    });
  }
}

// Start server
async function main() {
  try {
    const server = new LocalAnnotationsServer();
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch(console.error);