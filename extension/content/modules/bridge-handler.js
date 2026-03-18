// Content-world handler for the bridge API
// Listens for CustomEvents from the page-world bridge-api.js
// Uses existing internal modules to create/read/delete annotations

var VibeBridgeHandler = (() => {
  let getAnnotations = null; // Getter function for content.js annotations array

  function init(annotationsGetter) {
    getAnnotations = annotationsGetter;
    document.addEventListener('vibe-bridge:request', handleRequest);
  }

  async function handleRequest(e) {
    const { id, method, args } = e.detail || {};
    if (!id || !method) return;

    try {
      let result;
      switch (method) {
        case 'createAnnotation':
          result = await handleCreate(args);
          break;
        case 'getAnnotations':
          result = handleGetAnnotations();
          break;
        case 'deleteAnnotation':
          result = await handleDelete(args);
          break;
        case 'status':
          result = await handleStatus();
          break;
        default:
          throw new Error('Unknown method: ' + method);
      }
      respond(id, result);
    } catch (err) {
      respond(id, null, err.message);
    }
  }

  function respond(id, result, error) {
    document.dispatchEvent(new CustomEvent('vibe-bridge:response', {
      detail: error ? { id, error } : { id, result }
    }));
  }

  // --- Handlers ---

  async function handleCreate({ selector, comment, cssChanges, textChange }) {
    if (!selector) throw new Error('selector is required');

    const el = document.querySelector(selector);
    if (!el) throw new Error('Element not found: ' + selector);

    // Generate element context
    const context = await VibeElementContext.generate(el);

    // Build pending_changes from cssChanges
    const pendingChanges = {};
    if (cssChanges && typeof cssChanges === 'object') {
      const computed = window.getComputedStyle(el);
      for (const [prop, value] of Object.entries(cssChanges)) {
        const original = computed[prop] || '';
        pendingChanges[prop] = { original, value };
        el.style[prop] = value;
      }
    }

    // Handle text change
    if (textChange !== undefined && textChange !== null) {
      const original = el.textContent;
      pendingChanges.copyChange = { original, value: String(textChange) };
      el.textContent = String(textChange);
    }

    const hasPending = Object.keys(pendingChanges).length > 0;

    // Build annotation
    const annotation = {
      id: 'vibe_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      url: window.location.href,
      selector: context.selector,
      comment: comment || '',
      viewport: context.viewport,
      element_context: {
        tag: context.tag,
        classes: context.classes,
        text: context.text,
        styles: context.styles,
        position: context.position
      },
      source_file_path: context.source_mapping?.source_file_path || null,
      source_line_range: context.source_mapping?.source_line_range || null,
      project_area: context.source_mapping?.project_area || 'unknown',
      url_path: context.source_mapping?.url_path || window.location.pathname,
      source_map_available: context.source_mapping?.source_map_available || false,
      context_hints: context.source_mapping?.context_hints || null,
      parent_chain: context.parent_chain || null,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (hasPending) annotation.pending_changes = pendingChanges;

    await VibeAPI.saveAnnotation(annotation);
    VibeEvents.emit('annotation:saved', { annotation, element: el });

    return { id: annotation.id, success: true };
  }

  function handleGetAnnotations() {
    const annotations = getAnnotations ? getAnnotations() : [];
    if (!annotations) return [];
    return annotations.map(a => ({
      id: a.id,
      selector: a.selector,
      comment: a.comment,
      pending_changes: a.pending_changes || null,
      element_context: a.element_context || null,
      source_file_path: a.source_file_path || null,
      url_path: a.url_path || null,
      context_hints: a.context_hints || null,
      status: a.status
    }));
  }

  async function handleDelete({ id }) {
    if (!id) throw new Error('id is required');
    await VibeAPI.deleteAnnotation(id);
    VibeEvents.emit('annotation:deleted', { id });
    return { success: true };
  }

  async function handleStatus() {
    const server = await VibeAPI.checkServerStatus();
    return { extension: true, server: server.connected };
  }

  return { init };
})();
