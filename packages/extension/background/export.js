// Annotation export formatters
import { fetchAnnotations } from './api-sync.js';

function toCSV(annotations) {
  const headers = ['ID', 'URL', 'Comment', 'Status', 'Element', 'Created', 'Updated'];
  const rows = annotations.map(a => [
    a.id, a.url, `"${a.comment.replace(/"/g, '""')}"`, a.status, a.selector, a.created_at, a.updated_at
  ]);
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

function toMCP(annotations) {
  return {
    version: '1.0',
    exported_at: new Date().toISOString(),
    total_annotations: annotations.length,
    annotations: annotations.map(a => ({ ...a, mcp_ready: true }))
  };
}

export async function formatExport(fmt) {
  const annotations = await fetchAnnotations();
  switch (fmt) {
    case 'json': return JSON.stringify(annotations, null, 2);
    case 'csv': return toCSV(annotations);
    case 'mcp': return toMCP(annotations);
    default: throw new Error('Unsupported export format');
  }
}
