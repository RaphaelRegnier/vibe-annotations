import fs from 'fs/promises';
import path from 'path';

const ANNOTATIONS_FILE = path.join(process.cwd(), 'data', 'annotations.json');

/**
 * Ensure the data directory and annotations file exist
 */
export async function ensureDataFile() {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(ANNOTATIONS_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    // Check if annotations file exists
    try {
      await fs.access(ANNOTATIONS_FILE);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Create empty annotations file
        await fs.writeFile(ANNOTATIONS_FILE, '[]', 'utf8');
        console.error('Created empty annotations.json file');
      }
    }
  } catch (error) {
    console.error('Error ensuring data file:', error);
    throw error;
  }
}

/**
 * Read annotations from the JSON file
 * @returns {Promise<Array>} Array of annotations
 */
export async function readAnnotationsFromFile() {
  try {
    await ensureDataFile();
    const data = await fs.readFile(ANNOTATIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading annotations from file:', error);
    return [];
  }
}

/**
 * Write annotations to the JSON file
 * @param {Array} annotations - Array of annotations to write
 */
export async function writeAnnotationsToFile(annotations) {
  try {
    await ensureDataFile();
    const data = JSON.stringify(annotations, null, 2);
    await fs.writeFile(ANNOTATIONS_FILE, data, 'utf8');
    console.error(`Wrote ${annotations.length} annotations to file`);
  } catch (error) {
    console.error('Error writing annotations to file:', error);
    throw error;
  }
}

/**
 * Update a specific annotation in the file
 * @param {string} id - Annotation ID to update
 * @param {Object} updates - Updates to apply
 * @returns {Promise<boolean>} True if annotation was found and updated
 */
export async function updateAnnotationInFile(id, updates) {
  try {
    const annotations = await readAnnotationsFromFile();
    const index = annotations.findIndex(annotation => annotation.id === id);
    
    if (index === -1) {
      return false;
    }
    
    // Apply updates
    annotations[index] = {
      ...annotations[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    await writeAnnotationsToFile(annotations);
    return true;
  } catch (error) {
    console.error('Error updating annotation in file:', error);
    throw error;
  }
}