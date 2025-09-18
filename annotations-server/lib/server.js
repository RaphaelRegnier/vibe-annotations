#!/usr/bin/env node

// Test simplified workflow using NPM as version source
import express from 'express';
import cors from 'cors';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read version from package.json automatically
const packageJson = JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

// Configuration
const PORT = 3846;
const DATA_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.vibe-annotations');
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
    this.transports = {}; // Track transport sessions
    this.connections = new Set(); // Track HTTP connections
    this.saveLock = Promise.resolve(); // Serialize save operations to prevent race conditions
    
    this.setupExpress();
    this.setupMCP();
  }

  setupExpress() {
    this.app.use(cors({
      origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:8080', 'http://127.0.0.1:3000'],
      credentials: true
    }));
    this.app.use(express.json());

    // Health check with version info
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        version: packageJson.version,
        minExtensionVersion: '1.0.0', // Minimum compatible extension version
        timestamp: new Date().toISOString() 
      });
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

        // Get current annotations for comparison
        const currentAnnotations = await this.loadAnnotations();
        console.log(`Sync request: replacing ${currentAnnotations.length} annotations with ${annotations.length} annotations`);

        // Check if data is actually different to avoid redundant saves
        const currentJson = JSON.stringify(currentAnnotations.sort((a, b) => a.id.localeCompare(b.id)));
        const newJson = JSON.stringify(annotations.sort((a, b) => a.id.localeCompare(b.id)));
        
        if (currentJson === newJson) {
          console.log(`Sync skipped: data is identical`);
          res.json({ success: true, count: annotations.length, skipped: true });
          return;
        }

        // Replace all annotations with the new set
        await this.saveAnnotations(annotations);
        console.log(`Sync completed: now have ${annotations.length} annotations`);
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

    // SSE endpoint for MCP connection (proper MCP SSE transport)
    this.app.get('/sse', async (req, res) => {
      console.log('Received GET request to /sse (MCP SSE transport)');
      
      try {
        const transport = new SSEServerTransport('/messages', res);
        this.transports[transport.sessionId] = transport;
        
        // Clean up transport on connection close
        res.on("close", () => {
          console.log(`SSE connection closed for session ${transport.sessionId}`);
          try {
            if (transport && typeof transport.close === 'function') {
              transport.close();
            }
          } catch (error) {
            console.warn(`Error closing transport ${transport.sessionId}:`, error.message);
          }
          delete this.transports[transport.sessionId];
        });
        
        // Handle connection errors
        res.on("error", (error) => {
          console.warn(`SSE connection error for session ${transport.sessionId}:`, error.message);
          try {
            if (transport && typeof transport.close === 'function') {
              transport.close();
            }
          } catch (closeError) {
            console.warn(`Error closing transport ${transport.sessionId}:`, closeError.message);
          }
          delete this.transports[transport.sessionId];
        });
        
        // Create fresh server and connect to transport
        const server = this.createMCPServer();
        await server.connect(transport);
        
        console.log(`SSE transport connected with session ID: ${transport.sessionId}`);
      } catch (error) {
        console.error('Error setting up SSE transport:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to establish SSE connection' });
        }
      }
    });

    // Messages endpoint for SSE transport (handles incoming MCP messages)
    this.app.post('/messages', async (req, res) => {
      console.log('Received POST request to /messages');
      
      try {
        const sessionId = req.query.sessionId;
        const transport = this.transports[sessionId];
        
        if (!transport || !(transport instanceof SSEServerTransport)) {
          console.error(`No SSE transport found for session ID: ${sessionId}`);
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid SSE transport found for session ID',
            },
            id: null,
          });
          return;
        }
        
        // Handle the message using the transport
        await transport.handlePostMessage(req, res, req.body);
        console.log(`Message handled for session ${sessionId}`);
      } catch (error) {
        console.error('Error handling message:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error',
            },
            id: null,
          });
        }
      }
    });

    // MCP HTTP endpoint - create fresh instances per request
    this.app.use('/mcp', async (req, res) => {
      try {
        // Create fresh server and transport for each request to avoid "already initialized" error
        const server = this.createMCPServer();
        
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

  // Helper method to create fresh MCP server instances
  createMCPServer() {
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
    
    return server;
  }

  /**
   * MCP Tool Architecture Documentation
   *
   * This method sets up MCP (Model Context Protocol) tool handlers for the server.
   * MCP tools provide a standardized way for AI agents to interact with the annotation system.
   *
   * ARCHITECTURE OVERVIEW:
   * 1. Tool Registration: Tools are defined in the ListToolsRequestSchema handler
   * 2. Tool Execution: Tool calls are handled in the CallToolRequestSchema handler
   * 3. Response Format: All tools return standardized JSON responses with metadata
   *
   * ADDING NEW TOOLS - Follow this pattern:
   *
   * Step 1: Add tool definition to the tools array (lines 355-433)
   * {
   *   name: 'your_tool_name',
   *   description: 'Clear description of what the tool does and when to use it',
   *   inputSchema: {
   *     type: 'object',
   *     properties: {
   *       param_name: {
   *         type: 'string|number|boolean',
   *         description: 'Parameter description',
   *         // Optional: enum, default, minimum, maximum
   *       }
   *     },
   *     required: ['required_param_names'],
   *     additionalProperties: false
   *   }
   * }
   *
   * Step 2: Add case handler in the switch statement (lines 442-515)
   * case 'your_tool_name': {
   *   const result = await this.yourMethodName(args);
   *   return {
   *     content: [{
   *       type: 'text',
   *       text: JSON.stringify({
   *         tool: 'your_tool_name',
   *         status: 'success',
   *         data: result,
   *         timestamp: new Date().toISOString()
   *       }, null, 2)
   *     }]
   *   };
   * }
   *
   * Step 3: Implement the method (after line 714)
   * async yourMethodName(args) {
   *   // Validate arguments
   *   // Perform business logic
   *   // Return result data
   * }
   *
   * CONVENTIONS:
   * - Tool names use snake_case (e.g., 'read_annotations', 'update_status')
   * - Method names use camelCase (e.g., readAnnotations, updateStatus)
   * - All tools return standardized JSON with: tool, status, data, timestamp
   * - Use descriptive error messages for validation failures
   * - Include input validation in the method implementations
   * - Set additionalProperties: false to prevent unexpected parameters
   *
   * RESPONSE FORMAT:
   * All tools return this structure:
   * {
   *   tool: 'tool_name',           // Echo the tool name
   *   status: 'success|error',     // Operation status
   *   data: {},                    // Tool-specific response data
   *   timestamp: 'ISO_STRING'      // When the operation completed
   * }
   */
  setupMCPHandlersForServer(server) {
    // List tools - This handler tells AI agents what tools are available
    // Each tool definition includes name, description, and input schema validation
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'read_annotations',
            description: 'Retrieves user-created visual annotations with pagination support. Returns annotation data with has_screenshot flag instead of full screenshot data for token efficiency. Use url parameter to filter by project. MULTI-PROJECT SAFETY: This tool detects when annotations exist across multiple localhost projects and provides warnings with specific URL filtering guidance. CRITICAL WORKFLOW: (1) First call WITHOUT url parameter to see all projects, (2) Use get_project_context tool to determine current project, (3) Call again WITH url parameter (e.g., "http://localhost:3000/*") to filter for current project only. This prevents cross-project contamination where you might implement changes in wrong codebase. Use limit and offset parameters for pagination when handling large annotation sets. Use this tool when users mention: annotations, comments, feedback, suggestions, notes, marked changes, or visual issues they\'ve identified.',
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
                offset: {
                  type: 'number',
                  default: 0,
                  minimum: 0,
                  description: 'Number of annotations to skip for pagination'
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
            description: 'Permanently removes a specific annotation after successfully implementing the requested change or fix. IMPORTANT: Consider using delete_project_annotations for batch deletion when implementing multiple fixes. Use this individual deletion tool when: (1) You have successfully implemented a single annotation fix, (2) You prefer to delete annotations one-by-one as you implement them, (3) You are working on just one annotation. For efficiency when handling multiple annotations, use delete_project_annotations instead. The deletion is irreversible and removes the annotation from both extension storage and MCP data. NEVER delete annotations that still need work, contain unaddressed feedback, or serve as ongoing reminders.',
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
            description: 'Analyzes a localhost development URL to infer project framework and technology stack context. This tool helps understand the development environment when implementing annotation fixes by identifying likely frameworks (React, Vue, Angular, etc.) based on common port conventions. Use this tool when you need to understand what type of project you\'re working with before making code changes or when annotations reference framework-specific concerns. The tool maps common development server ports to their typical frameworks: port 3000 suggests React/Next.js, 5173 indicates Vite, 8080 points to Vue/Webpack, 4200 suggests Angular, and 3001 typically indicates Express/Node.js. This context helps you choose appropriate implementation approaches and understand the likely project structure. ENHANCED: Now includes working directory detection, package.json analysis, and recommended URL filtering patterns for multi-project environments.',
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
          },
          {
            name: 'delete_project_annotations',
            description: 'Batch delete ALL annotations for a specific project after successfully implementing all requested changes. CRITICAL WORKFLOW: Use this tool instead of individual delete_annotation calls when you have completed ALL annotation fixes for a project. This implements the efficient "read all → implement all → delete all" workflow. SAFETY: Requires URL pattern (like "http://localhost:3000/*") to prevent accidental deletion across projects. Always confirm the count of annotations to be deleted before proceeding. Use this tool when: (1) You have successfully implemented ALL annotation fixes for a project, (2) All code changes are complete and working, (3) You want to clean up all annotations for the project at once. This is more efficient than deleting annotations one-by-one.',
            inputSchema: {
              type: 'object',
              properties: {
                url_pattern: {
                  type: 'string',
                  description: 'URL pattern to match annotations for deletion (e.g., "http://localhost:3000/*" or "http://localhost:3000/" for all annotations from that project)'
                },
                confirm: {
                  type: 'boolean',
                  default: false,
                  description: 'Set to true to confirm batch deletion. First call without confirm=true to see how many annotations would be deleted.'
                }
              },
              required: ['url_pattern'],
              additionalProperties: false
            }
          },
          {
            name: 'update_annotation_status',
            description: 'Updates the status of a single annotation to track processing lifecycle (pending/completed/archived). Use this tool to mark annotations as completed after implementing fixes, or to archive annotations that are no longer relevant. Status changes are persisted to disk and immediately available to the extension. Use "completed" when you have successfully implemented the annotation\'s requested change, "archived" for annotations that are no longer applicable, and "pending" to reset an annotation back to active status.',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Annotation ID to update'
                },
                status: {
                  type: 'string',
                  enum: ['pending', 'completed', 'archived'],
                  description: 'New status value'
                }
              },
              required: ['id', 'status'],
              additionalProperties: false
            }
          },
          {
            name: 'bulk_update_status',
            description: 'Updates the status of multiple annotations in a single operation for efficient batch processing. Use this tool when you need to update many annotations at once, such as marking multiple completed fixes or archiving a batch of outdated annotations. This is more efficient than multiple individual update_annotation_status calls and ensures atomic updates. Status changes are persisted to disk and immediately available to the extension.',
            inputSchema: {
              type: 'object',
              properties: {
                ids: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of annotation IDs to update'
                },
                status: {
                  type: 'string',
                  enum: ['pending', 'completed', 'archived'],
                  description: 'New status value for all annotations'
                }
              },
              required: ['ids', 'status'],
              additionalProperties: false
            }
          },
          {
            name: 'get_annotation_screenshot',
            description: 'Retrieves the screenshot data for a specific annotation when visual context is needed. Use this tool to access the full screenshot information that was captured when the annotation was created. This provides visual context that can help understand the user\'s feedback and implement appropriate fixes. The screenshot includes viewport dimensions and element positioning data. Only call this tool when you need to see the visual context - the read_annotations tool provides a has_screenshot flag to indicate if screenshot data is available.',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Annotation ID to get screenshot for'
                }
              },
              required: ['id'],
              additionalProperties: false
            }
          }
        ]
      };
    });

    /**
     * Tool Call Handler
     *
     * This handler processes actual tool invocations from AI agents.
     * It receives the tool name and arguments, then dispatches to the appropriate method.
     *
     * HANDLER PATTERN:
     * 1. Extract tool name and arguments from the request
     * 2. Use switch statement to route to appropriate method
     * 3. Call the corresponding class method with arguments
     * 4. Wrap response in standardized MCP format
     * 5. Handle errors uniformly
     *
     * When adding new tools, add a new case following this exact pattern:
     * case 'your_tool_name': {
     *   const result = await this.yourMethodName(args);
     *   return {
     *     content: [{
     *       type: 'text',
     *       text: JSON.stringify({
     *         tool: 'your_tool_name',
     *         status: 'success',
     *         data: result,
     *         timestamp: new Date().toISOString()
     *       }, null, 2)
     *     }]
     *   };
     * }
     *
     * ERROR HANDLING:
     * - Individual method errors are caught and re-thrown with context
     * - The outer try/catch ensures all tool errors are handled uniformly
     * - Always include the tool name in error messages for debugging
     */
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          // TOOL HANDLER EXAMPLE: read_annotations
          // This demonstrates the standard pattern for MCP tool handlers
          case 'read_annotations': {
            // 1. Call the corresponding method with arguments (use empty object as fallback)
            const result = await this.readAnnotations(args || {});
            const { annotations, projectInfo, multiProjectWarning } = result;

            // 2. Return standardized MCP response format
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    tool: 'read_annotations',           // Always echo the tool name
                    status: 'success',                  // success/error status
                    data: annotations,                  // Primary response data
                    count: annotations.length,          // Additional metadata (tool-specific)
                    projects: projectInfo,              // Additional metadata (tool-specific)
                    multi_project_warning: multiProjectWarning, // Additional metadata (tool-specific)
                    filter_applied: args?.url || 'none', // Additional metadata (tool-specific)
                    timestamp: new Date().toISOString() // Always include timestamp
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

          case 'delete_project_annotations': {
            const result = await this.deleteProjectAnnotations(args);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    tool: 'delete_project_annotations',
                    status: 'success',
                    data: result,
                    timestamp: new Date().toISOString()
                  }, null, 2)
                }
              ]
            };
          }

          // DEFAULT CASE: Handle unknown tools
          // This ensures we get clear error messages for typos or unregistered tools
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        // CENTRALIZED ERROR HANDLING
        // All tool errors are caught here and wrapped with additional context
        // The MCP protocol will handle the error response format
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
    // Serialize all save operations to prevent race conditions
    this.saveLock = this.saveLock.then(async () => {
      return this._saveAnnotationsInternal(annotations);
    });
    
    return this.saveLock;
  }

  async _saveAnnotationsInternal(annotations) {
    // Move jsonData outside try block to make it accessible in catch
    console.log(`Saving ${annotations.length} annotations to disk`);
    const jsonData = JSON.stringify(annotations, null, 2);
    
    try {
      // Ensure directory exists right before operations  
      const dataDir = path.dirname(DATA_FILE);
      if (!existsSync(dataDir)) {
        console.log(`Creating data directory: ${dataDir}`);
        await mkdir(dataDir, { recursive: true });
      }
      
      // Atomic write: write to temp file first, then rename
      const tempFile = DATA_FILE + '.tmp';
      console.log(`Writing temp file: ${tempFile}`);
      await writeFile(tempFile, jsonData);
      
      // Rename temp file to actual file (atomic operation)
      console.log(`Renaming ${tempFile} to ${DATA_FILE}`);
      const fs = await import('fs');
      await fs.promises.rename(tempFile, DATA_FILE);
      
      console.log(`Successfully saved ${annotations.length} annotations to ${DATA_FILE}`);
    } catch (error) {
      console.error('Error saving annotations:', error);
      
      // Clean up temp file if it exists
      const tempFile = DATA_FILE + '.tmp';
      try {
        if (existsSync(tempFile)) {
          const fs = await import('fs');
          await fs.promises.unlink(tempFile);
          console.log(`Cleaned up temp file: ${tempFile}`);
        }
      } catch (cleanupError) {
        console.warn(`Failed to clean up temp file: ${cleanupError.message}`);
      }
      
      // Fallback: try direct write without atomic operation
      console.log('Attempting fallback direct write...');
      try {
        await writeFile(DATA_FILE, jsonData);
        console.log(`Fallback write successful: ${DATA_FILE}`);
        return;
      } catch (fallbackError) {
        console.error('Fallback write also failed:', fallbackError);
      }
      
      throw error;
    }
  }

  async ensureDataFile() {
    const dataDir = path.dirname(DATA_FILE);
    if (!existsSync(dataDir)) {
      console.log(`Creating data directory: ${dataDir}`);
      await mkdir(dataDir, { recursive: true });
    }
    
    if (!existsSync(DATA_FILE)) {
      console.log(`Creating new annotation file: ${DATA_FILE}`);
      await writeFile(DATA_FILE, JSON.stringify([], null, 2));
    } else {
      // File exists - log current annotation count for verification
      try {
        const existingData = await readFile(DATA_FILE, 'utf8');
        const annotations = JSON.parse(existingData || '[]');
        console.log(`Annotation file exists with ${annotations.length} annotations`);
      } catch (error) {
        console.warn(`Warning: Could not read existing annotation file: ${error.message}`);
      }
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
    let multiProjectWarning = null;
    
    if (projectCount > 1 && !url) {
      const projectSuggestions = Object.keys(groupedByProject).map(baseUrl => `"${baseUrl}/*"`).join(' or ');
      multiProjectWarning = {
        warning: `MULTI-PROJECT DETECTED: Found annotations from ${projectCount} different projects. This may cause cross-project contamination.`,
        recommendation: `Use the 'url' parameter to filter annotations for your current project.`,
        suggested_filters: Object.keys(groupedByProject).map(baseUrl => `${baseUrl}/*`),
        guidance: `Example: Use url: "${Object.keys(groupedByProject)[0]}/*" to filter for the first project.`,
        projects_detected: Object.keys(groupedByProject)
      };
      console.warn(`MULTI-PROJECT WARNING: Found annotations from ${projectCount} different projects. Use url parameter: ${projectSuggestions}`);
    }
    
    // Build project info for better context
    const projectInfo = Object.entries(groupedByProject).map(([baseUrl, annotations]) => ({
      base_url: baseUrl,
      annotation_count: annotations.length,
      paths: [...new Set(annotations.map(a => new URL(a.url).pathname))].slice(0, 5), // Show up to 5 unique paths
      recommended_filter: `${baseUrl}/*`
    }));
    
    return {
      annotations: filtered.slice(0, limit),
      projectInfo: projectInfo,
      multiProjectWarning: multiProjectWarning
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

  async deleteProjectAnnotations(args) {
    const { url_pattern, confirm = false } = args;
    
    const annotations = await this.loadAnnotations();
    
    // Filter annotations matching the URL pattern
    let matchingAnnotations;
    if (url_pattern.includes('*') || url_pattern.endsWith('/')) {
      // Pattern matching: "http://localhost:3000/*" or "http://localhost:3000/"
      const baseUrl = url_pattern.replace('*', '').replace(/\/$/, '');
      matchingAnnotations = annotations.filter(a => a.url.startsWith(baseUrl));
    } else {
      // Exact URL matching
      matchingAnnotations = annotations.filter(a => a.url === url_pattern);
    }
    
    if (matchingAnnotations.length === 0) {
      return {
        url_pattern,
        count: 0,
        message: 'No annotations found matching the URL pattern',
        deleted: false
      };
    }
    
    // If confirm is false, return preview of what would be deleted
    if (!confirm) {
      const projectInfo = matchingAnnotations.reduce((acc, annotation) => {
        const url = annotation.url;
        if (!acc[url]) {
          acc[url] = [];
        }
        acc[url].push({
          id: annotation.id,
          comment: annotation.comment.substring(0, 100) + (annotation.comment.length > 100 ? '...' : ''),
          created_at: annotation.created_at
        });
        return acc;
      }, {});
      
      return {
        url_pattern,
        count: matchingAnnotations.length,
        preview: projectInfo,
        message: `Found ${matchingAnnotations.length} annotation(s) that would be deleted. Set confirm=true to proceed with deletion.`,
        deleted: false,
        urls_affected: Object.keys(projectInfo)
      };
    }
    
    // Proceed with deletion
    const remainingAnnotations = annotations.filter(a => !matchingAnnotations.find(m => m.id === a.id));
    await this.saveAnnotations(remainingAnnotations);
    
    const deletedInfo = matchingAnnotations.map(a => ({
      id: a.id,
      url: a.url,
      comment: a.comment.substring(0, 100) + (a.comment.length > 100 ? '...' : '')
    }));
    
    return {
      url_pattern,
      count: matchingAnnotations.length,
      deleted: true,
      message: `Successfully deleted ${matchingAnnotations.length} annotation(s) for project ${url_pattern}`,
      deleted_annotations: deletedInfo,
      remaining_total: remainingAnnotations.length
    };
  }

  async getProjectContext(args) {
    const { url } = args;
    
    // Parse localhost URL to infer project structure
    const urlObj = new URL(url);
    const port = urlObj.port;
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    
    const commonPorts = {
      '3000': 'React/Next.js',
      '5173': 'Vite',
      '8080': 'Vue/Webpack Dev Server',
      '4200': 'Angular',
      '3001': 'Express/Node.js'
    };
    
    // Get current working directory context
    const cwd = process.cwd();
    const workingDirectory = {
      path: cwd,
      name: path.basename(cwd)
    };
    
    // Try to read package.json for additional context
    let packageInfo = null;
    try {
      const packageJsonPath = path.join(cwd, 'package.json');
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
        packageInfo = {
          name: packageJson.name,
          scripts: Object.keys(packageJson.scripts || {}),
          dependencies: Object.keys(packageJson.dependencies || {}),
          devDependencies: Object.keys(packageJson.devDependencies || {})
        };
      }
    } catch (error) {
      // Package.json not found or invalid, continue without it
    }
    
    // Get all annotations to provide project mapping context
    const annotations = await this.loadAnnotations();
    const projectUrls = [...new Set(annotations.map(a => {
      try {
        const aUrl = new URL(a.url);
        return `${aUrl.protocol}//${aUrl.host}`;
      } catch (e) {
        return null;
      }
    }).filter(Boolean))];
    
    // Recommend URL filter pattern for this project
    const recommendedFilter = `${baseUrl}/*`;
    
    // Check if current project matches working directory context
    const isCurrentProject = url.includes(baseUrl);
    
    return {
      url,
      port,
      base_url: baseUrl,
      likely_framework: commonPorts[port] || 'Unknown',
      working_directory: workingDirectory,
      package_info: packageInfo,
      recommended_filter: recommendedFilter,
      all_project_urls: projectUrls,
      is_current_project: isCurrentProject,
      annotation_guidance: projectUrls.length > 1 
        ? `Multiple projects detected (${projectUrls.length}). Use url parameter: "${recommendedFilter}" to filter annotations for this specific project.`
        : 'Single project detected. No URL filtering needed.',
      timestamp: new Date().toISOString()
    };
  }


  setupProcessHandlers() {
    if (this.handlersSetup) return;
    this.handlersSetup = true;
    
    const gracefulShutdown = async (signal) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      
      // Set a force exit timer as a last resort
      const forceExitTimer = setTimeout(() => {
        console.log('Force exiting...');
        process.exit(1);
      }, 5000); // Increased to 5 seconds
      
      try {
        // Step 1: Close all MCP transport sessions
        console.log('Closing MCP transport sessions...');
        const transportPromises = Object.entries(this.transports).map(([sessionId, transport]) => {
          return new Promise((resolve) => {
            try {
              if (transport && typeof transport.close === 'function') {
                transport.close();
              }
              delete this.transports[sessionId];
              resolve();
            } catch (error) {
              console.warn(`Error closing transport ${sessionId}:`, error.message);
              resolve();
            }
          });
        });
        
        await Promise.all(transportPromises);
        console.log('MCP transports closed');
        
        // Step 2: Close all HTTP connections
        console.log('Closing HTTP connections...');
        this.connections.forEach(connection => {
          try {
            connection.destroy();
          } catch (error) {
            console.warn('Error destroying connection:', error.message);
          }
        });
        this.connections.clear();
        
        // Step 3: Close the HTTP server
        if (this.server) {
          console.log('Closing HTTP server...');
          await new Promise((resolve) => {
            this.server.close((error) => {
              if (error) {
                console.warn('Error closing server:', error.message);
              }
              resolve();
            });
          });
          console.log('HTTP server closed');
        }
        
        // Clean shutdown completed
        clearTimeout(forceExitTimer);
        console.log('Graceful shutdown completed');
        process.exit(0);
        
      } catch (error) {
        console.error('Error during graceful shutdown:', error);
        clearTimeout(forceExitTimer);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      gracefulShutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });
  }

  async checkForUpdates() {
    try {
      // Check cache first (24hr TTL)
      const updateCacheFile = path.join(DATA_DIR, '.update-check');
      let lastCheck = 0;
      
      try {
        if (existsSync(updateCacheFile)) {
          const cacheData = await readFile(updateCacheFile, 'utf8');
          lastCheck = parseInt(cacheData, 10) || 0;
        }
      } catch (error) {
        // Ignore cache read errors
      }
      
      // Only check once per day
      if (Date.now() - lastCheck < 86400000) return;
      
      // Fetch latest version from NPM registry
      const response = await fetch('https://registry.npmjs.org/vibe-annotations-server/latest', {
        headers: {
          'User-Agent': 'vibe-annotations-server'
        }
      });
      
      // If package not found (404), skip update check
      if (response.status === 404) {
        console.log('[Update Check] Package not found in NPM registry yet');
        await writeFile(updateCacheFile, Date.now().toString());
        return;
      }
      
      if (!response.ok) {
        console.log(`[Update Check] NPM Registry error: ${response.status}`);
        return;
      }
      
      const data = await response.json();
      const latestVersion = data.version || packageJson.version;
      
      // Simple version comparison (assuming semantic versioning)
      const currentParts = packageJson.version.split('.').map(Number);
      const latestParts = latestVersion.split('.').map(Number);
      
      let hasUpdate = false;
      for (let i = 0; i < 3; i++) {
        if ((latestParts[i] || 0) > (currentParts[i] || 0)) {
          hasUpdate = true;
          break;
        }
        if ((latestParts[i] || 0) < (currentParts[i] || 0)) {
          break;
        }
      }
      
      if (hasUpdate) {
        console.log(chalk.yellow(`
╔════════════════════════════════════════════════════════════════╗
║  Update available: ${packageJson.version} → ${latestVersion}                          ║
║  Run: npm update -g vibe-annotations-server                    ║
╚════════════════════════════════════════════════════════════════╝
        `));
      }
      
      // Save last check timestamp
      await writeFile(updateCacheFile, Date.now().toString());
    } catch (error) {
      // Log error for debugging but don't disrupt user experience
      console.log(`[Update Check] Failed: ${error.message}`);
    }
  }

  async start() {
    await this.ensureDataFile();
    
    // Set up process handlers only once
    this.setupProcessHandlers();
    
    // Check for updates (non-blocking)
    this.checkForUpdates().catch(() => {});
    
    this.server = this.app.listen(PORT, () => {
      console.log(`Vibe Annotations server running on http://127.0.0.1:${PORT}`);
      console.log(`SSE Endpoint: http://127.0.0.1:${PORT}/sse`);
      console.log(`HTTP API: http://127.0.0.1:${PORT}/api/annotations`);
      console.log(`MCP Endpoint: http://127.0.0.1:${PORT}/mcp`);
      console.log(`Health: http://127.0.0.1:${PORT}/health`);
      console.log(`Data: ${DATA_FILE}`);
      console.log('\nServer ready to handle requests');
    });
    
    // Track connections for graceful shutdown
    this.server.on('connection', (connection) => {
      this.connections.add(connection);
      
      connection.on('close', () => {
        this.connections.delete(connection);
      });
      
      connection.on('error', () => {
        this.connections.delete(connection);
      });
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