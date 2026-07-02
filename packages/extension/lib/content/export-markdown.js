// Single source of truth for the annotation markdown format — used by both
// "Copy all" (clipboard) and the .md export. Rendered entirely client-side so it
// works with no server running; image paths are derived from the attachment
// metadata (the server-side filename convention) using ~ so an agent can open
// them without us knowing the absolute home dir.

const EXT_BY_MIME = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif' };

function camelToKebab(s) {
  return String(s).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n) + '…' : s;
}
function attachmentPath(annotationId, att) {
  const ext = EXT_BY_MIME[att.mime] || 'bin';
  return `~/.vibe-annotations/attachments/${annotationId}__${att.id}.${ext}`;
}

export function renderAnnotationsMarkdown(annotations, host) {
  const count = annotations.length;
  let md = `# Vibe Annotations — ${host} · ${count} annotation${count === 1 ? '' : 's'}\n\n`;
  md += `Follow my instructions on these elements. When applying design changes, map values to the project design system (Tailwind classes, CSS variables, or design tokens).\n\n---\n\n`;

  const sorted = [...annotations].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  sorted.forEach((a, i) => {
    if (a.type === 'stylesheet') {
      md += `## ${i + 1}. Stylesheet change\n\n`;
      if (a.comment) md += `- **Comment:** ${a.comment}\n`;
      if (a.css) md += `- **CSS:**\n\`\`\`css\n${a.css}\n\`\`\`\n`;
      md += `\n`;
      return;
    }

    const ec = a.element_context || {};
    const componentHint = (a.context_hints || []).find(h => typeof h === 'string' && h.startsWith('Component:'));

    md += `## ${i + 1}. ${a.comment || '_(no comment)_'}\n\n`;
    if (componentHint) md += `- **Component:** \`${componentHint.replace('Component:', '').trim()}\`\n`;
    if (a.source_file_path) md += `- **Source:** \`${a.source_file_path}${a.source_line_range ? ` (lines ${a.source_line_range})` : ''}\`\n`;
    if (a.url_path) md += `- **Page:** ${a.url_path}\n`;
    if (a.selector) md += `- **Selector:** \`${a.selector}\`\n`;
    if (ec.tag || ec.text) md += `- **Element:** \`${ec.tag || ''}\` "${truncate(ec.text, 60)}"\n`;

    const changes = [];
    for (const [prop, v] of Object.entries(a.pending_changes || {})) {
      if (!v || v.value == null) continue;
      const label = prop === 'copyChange' ? 'text' : camelToKebab(prop);
      const to = v.variable ? `var(${v.variable})` : v.value;
      changes.push(`\`${label}\`: ${v.original ?? '—'} → **${to}**`);
    }
    if (changes.length) {
      md += `- **Design changes:**\n`;
      for (const c of changes) md += `    - ${c}\n`;
    }

    if (a.css) md += `- **CSS:**\n\`\`\`css\n${a.css}\n\`\`\`\n`;

    for (const att of (a.attachments || [])) {
      const label = att.kind === 'capture' ? 'Screenshot' : 'Reference';
      md += `- **${label}:** ![${label}](${attachmentPath(a.id, att)})\n`;
    }

    md += `\n`;
  });

  return md;
}

export default { renderAnnotationsMarkdown };
