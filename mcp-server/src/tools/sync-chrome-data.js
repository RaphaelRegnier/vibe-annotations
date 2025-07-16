import { readAnnotationsFromFile, writeAnnotationsToFile } from '../storage/annotations.js';

/**
 * Sync annotations from Chrome extension storage to MCP data file
 * This tool allows manually syncing when Chrome extension can't directly write to file system
 * @param {Object} args - Tool arguments
 * @param {Array} args.annotations - Array of annotations from Chrome storage
 * @returns {Promise<Object>} Sync result
 */
export async function syncChromeData(args = {}) {
  const { annotations = [] } = args;

  try {
    // Validate input
    if (!Array.isArray(annotations)) {
      throw new Error('Annotations must be an array');
    }

    // Write annotations to file
    await writeAnnotationsToFile(annotations);

    const result = {
      success: true,
      synced_count: annotations.length,
      synced_at: new Date().toISOString(),
      message: `Successfully synced ${annotations.length} annotations to MCP data file`
    };

    console.error(`MCP Sync completed: ${annotations.length} annotations`);
    return result;

  } catch (error) {
    console.error('Error syncing Chrome data:', error);
    throw new Error(`Failed to sync Chrome data: ${error.message}`);
  }
}

// Tool definition for MCP server
export const syncChromeDataTool = {
  name: 'sync_chrome_data',
  description: 'Sync annotations from Chrome extension storage to MCP data file. Use this to manually update the MCP server with latest annotations from the extension.',
  inputSchema: {
    type: 'object',
    properties: {
      annotations: {
        type: 'array',
        description: 'Array of annotations from Chrome extension storage',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            url: { type: 'string' },
            selector: { type: 'string' },
            comment: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'completed', 'archived'] },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
            viewport: { type: 'object' },
            element_context: { type: 'object' }
          },
          required: ['id', 'url', 'selector', 'comment', 'status']
        }
      }
    },
    required: ['annotations'],
    additionalProperties: false
  }
};