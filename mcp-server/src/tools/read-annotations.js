import fs from 'fs/promises';
import path from 'path';

/**
 * Read annotations from the data file
 * @param {Object} args - Tool arguments
 * @param {string} [args.status='pending'] - Filter by status (pending, completed, archived, all)
 * @param {number} [args.limit=50] - Maximum number of annotations to return
 * @param {string} [args.url] - Filter by specific localhost URL
 * @returns {Promise<Array>} Array of annotations
 */
export async function readAnnotations(args = {}) {
  const {
    status = 'pending',
    limit = 50,
    url = null
  } = args;

  try {
    // Try multiple sources for annotations
    let annotations = [];
    
    // 1. Try reading from Downloads sync location (auto-sync from extension)
    try {
      const downloadsPath = path.join(process.env.HOME || process.env.USERPROFILE, 'Downloads/claude-annotations-data/annotations.json');
      const data = await fs.readFile(downloadsPath, 'utf8');
      annotations = JSON.parse(data);
      console.error(`Read ${annotations.length} annotations from Downloads sync`);
    } catch (error) {
      // 2. Fallback to local data file
      try {
        const dataPath = path.join(process.cwd(), 'data', 'annotations.json');
        const data = await fs.readFile(dataPath, 'utf8');
        annotations = JSON.parse(data);
        console.error(`Read ${annotations.length} annotations from local data file`);
      } catch (error) {
        if (error.code === 'ENOENT') {
          console.error('No annotations found in Downloads or local data file');
          return [];
        }
        throw error;
      }
    }

    // Filter annotations
    let filteredAnnotations = annotations;

    // Filter by status
    if (status !== 'all') {
      filteredAnnotations = filteredAnnotations.filter(annotation => 
        annotation.status === status
      );
    }

    // Filter by URL if specified
    if (url) {
      filteredAnnotations = filteredAnnotations.filter(annotation => 
        annotation.url === url
      );
    }

    // Sort by creation date (newest first)
    filteredAnnotations.sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );

    // Apply limit
    if (limit > 0) {
      filteredAnnotations = filteredAnnotations.slice(0, limit);
    }

    console.error(`Found ${filteredAnnotations.length} annotations (filtered from ${annotations.length} total)`);
    
    return filteredAnnotations;

  } catch (error) {
    console.error('Error reading annotations:', error);
    throw new Error(`Failed to read annotations: ${error.message}`);
  }
}

// Tool definition for MCP server
export const readAnnotationsTool = {
  name: 'read_annotations',
  description: 'Read annotations from the Claude Annotations extension. Use this to get user feedback and annotation requests that need to be processed.',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['pending', 'completed', 'archived', 'all'],
        default: 'pending',
        description: 'Filter annotations by status. Use "pending" to get unprocessed annotations.'
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
        description: 'Filter annotations for a specific localhost URL (e.g., "http://localhost:3000/dashboard")'
      }
    },
    additionalProperties: false
  }
};