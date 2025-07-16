#!/usr/bin/env node

/**
 * Manual script to export annotations from Chrome extension to MCP server
 * Run this when you want to sync your Chrome extension annotations
 */

import { writeAnnotationsToFile } from './src/storage/annotations.js';

console.log('Chrome Annotations Export Tool');
console.log('================================');
console.log('');
console.log('To use this tool:');
console.log('1. Open Chrome DevTools');
console.log('2. Go to Application > Storage > Extension');
console.log('3. Find "annotations" key and copy the value');
console.log('4. Run: node export-chrome-annotations.js \'[your-annotations-json]\'');
console.log('');

const annotationsJson = process.argv[2];

if (!annotationsJson) {
  console.log('Usage: node export-chrome-annotations.js \'[annotations-json]\'');
  console.log('');
  console.log('Example:');
  console.log('node export-chrome-annotations.js \'[{"id":"claude_123","url":"http://localhost:3000","comment":"Fix this"}]\'');
  process.exit(1);
}

try {
  const annotations = JSON.parse(annotationsJson);
  
  if (!Array.isArray(annotations)) {
    throw new Error('Annotations must be an array');
  }
  
  await writeAnnotationsToFile(annotations);
  
  console.log(`✅ Successfully exported ${annotations.length} annotations to MCP server`);
  console.log('');
  console.log('Annotations exported:');
  annotations.forEach((annotation, index) => {
    console.log(`${index + 1}. ${annotation.url} - "${annotation.comment}"`);
  });
  
} catch (error) {
  console.error('❌ Error exporting annotations:', error.message);
  process.exit(1);
}