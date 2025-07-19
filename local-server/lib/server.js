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
const DATA_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.claude-annotations');
const DATA_FILE = path.join(DATA_DIR, 'annotations.json');

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
        // Only log significant sync operations
        if (annotations.length > 0) {
          console.log(`Synced ${annotations.length} annotations`);
        }
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

    // SSE endpoint for MCP connection
    this.app.get('/sse', async (req, res) => {
      console.log('SSE connection established');
      
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      
      // Send initial connection event
      res.write('event: open\n');
      res.write(`data: {"type":"connection","status":"connected"}\n\n`);
      
      // Keep connection alive
      const keepAlive = setInterval(() => {
        res.write(':keepalive\n\n');
      }, 30000);
      
      // Clean up on client disconnect
      req.on('close', () => {
        console.log('SSE connection closed');
        clearInterval(keepAlive);
      });
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
            description: 'Retrieves user-created visual annotations from the Claude Annotations extension. Use when users want to review, implement, or address their UI feedback and comments. This tool returns annotations containing user comments, DOM element selectors, viewport dimensions, and positioning data. CRITICAL: Always filter by URL parameter (e.g., "http://localhost:3000/") to avoid mixing annotations from different localhost projects. Annotations include viewport width/height which must be mapped to responsive breakpoints (Tailwind sm/md/lg, Bootstrap xs/sm/md, etc.) to ensure fixes target the correct screen size. Returns structured data with project grouping information to help distinguish between multiple localhost applications. Use this tool when users mention: annotations, comments, feedback, suggestions, notes, marked changes, or visual issues they\'ve identified.',
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
                  description: 'Filter by specific localhost URL. Supports exact match (e.g., "http://localhost:3000/dashboard") or pattern match with base URL (e.g., "http://localhost:3000/" or "http://localhost:3000/*" to get all annotations from that project)'
                }
              },
              additionalProperties: false
            }
          },
          {
            name: 'delete_annotation',
            description: 'Permanently removes a specific annotation after successfully implementing the requested change or fix. CRITICAL: You MUST delete annotations immediately after implementing fixes - this is required workflow behavior. Use this tool when: (1) You have successfully implemented the user\'s requested change, (2) The code change addresses the annotation\'s feedback, (3) The modification is complete and working. The deletion is irreversible and removes the annotation from both extension storage and MCP data. NEVER delete annotations that still need work, contain unaddressed feedback, or serve as ongoing reminders. This maintains a clean annotation workspace by automatically removing completed tasks.',
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
            description: 'Analyzes a localhost development URL to infer project framework and technology stack context. This tool helps understand the development environment when implementing annotation fixes by identifying likely frameworks (React, Vue, Angular, etc.) based on common port conventions. Use this tool when you need to understand what type of project you\'re working with before making code changes or when annotations reference framework-specific concerns. The tool maps common development server ports to their typical frameworks: port 3000 suggests React/Next.js, 5173 indicates Vite, 8080 points to Vue/Webpack, 4200 suggests Angular, and 3001 typically indicates Express/Node.js. This context helps you choose appropriate implementation approaches and understand the likely project structure.',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'Complete localhost development URL (e.g., "http://localhost:3000/dashboard") to analyze for project context and framework inference'
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
            const result = await this.readAnnotations(args || {});
            const { annotations, projectInfo } = result;
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    tool: 'read_annotations',
                    status: 'success',
                    data: annotations,
                    count: annotations.length,
                    projects: projectInfo,
                    filter_applied: args?.url || 'none',
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
      
      // Handle empty or corrupted file
      if (!data || data.trim() === '') {
        console.warn('Empty annotations file, initializing with empty array');
        await this.saveAnnotations([]);
        return [];
      }
      
      try {
        return JSON.parse(data);
      } catch (parseError) {
        console.error('Corrupted JSON file, reinitializing:', parseError);
        // Backup corrupted file
        const backupFile = DATA_FILE + '.corrupted.' + Date.now();
        await writeFile(backupFile, data);
        console.log(`Corrupted file backed up to: ${backupFile}`);
        
        // Reinitialize with empty array
        await this.saveAnnotations([]);
        return [];
      }
    } catch (error) {
      console.error('Error loading annotations:', error);
      return [];
    }
  }

  async saveAnnotations(annotations) {
    try {
      await this.ensureDataFile();
      const jsonData = JSON.stringify(annotations, null, 2);
      
      // Atomic write: write to temp file first, then rename
      const tempFile = DATA_FILE + '.tmp';
      await writeFile(tempFile, jsonData);
      
      // Rename temp file to actual file (atomic operation)
      const fs = await import('fs');
      await fs.promises.rename(tempFile, DATA_FILE);
    } catch (error) {
      console.error('Error saving annotations:', error);
      throw error;
    }
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
      // Support both exact URL matching and base URL pattern matching
      if (url.includes('*') || url.endsWith('/')) {
        // Pattern matching: "http://localhost:3000/*" or "http://localhost:3000/"
        const baseUrl = url.replace('*', '').replace(/\/$/, '');
        filtered = filtered.filter(a => a.url.startsWith(baseUrl));
      } else {
        // Exact URL matching
        filtered = filtered.filter(a => a.url === url);
      }
    }
    
    // Group annotations by base URL for better context
    const groupedByProject = {};
    filtered.forEach(annotation => {
      try {
        const urlObj = new URL(annotation.url);
        const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
        if (!groupedByProject[baseUrl]) {
          groupedByProject[baseUrl] = [];
        }
        groupedByProject[baseUrl].push(annotation);
      } catch (e) {
        // Handle invalid URLs gracefully
      }
    });
    
    // Add project context to response
    const projectCount = Object.keys(groupedByProject).length;
    if (projectCount > 1 && !url) {
      console.warn(`Found annotations from ${projectCount} different projects. Consider using the 'url' parameter to filter.`);
    }
    
    // Build project info for better context
    const projectInfo = Object.entries(groupedByProject).map(([baseUrl, annotations]) => ({
      base_url: baseUrl,
      annotation_count: annotations.length,
      paths: [...new Set(annotations.map(a => new URL(a.url).pathname))].slice(0, 5) // Show up to 5 unique paths
    }));
    
    return {
      annotations: filtered.slice(0, limit),
      projectInfo: projectInfo
    };
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
      console.log(`Claude Annotations server running on http://127.0.0.1:${PORT}`);
      console.log(`SSE Endpoint: http://127.0.0.1:${PORT}/sse`);
      console.log(`HTTP API: http://127.0.0.1:${PORT}/api/annotations`);
      console.log(`MCP Endpoint: http://127.0.0.1:${PORT}/mcp`);
      console.log(`Health: http://127.0.0.1:${PORT}/health`);
      console.log(`Data: ${DATA_FILE}`);
      console.log('\nServer ready to handle requests');
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