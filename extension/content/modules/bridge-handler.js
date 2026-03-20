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
        case 'createStyleAnnotation':
          result = await handleCreateStyle(args);
          break;
        case 'getAnnotations':
          result = handleGetAnnotations();
          break;
        case 'exportAnnotations':
          result = await handleExport(args);
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

  // CSS properties to scan for inline style changes when cssChanges isn't provided
  const DETECT_PROPS = [
    'fontSize','fontWeight','lineHeight','textAlign','color','backgroundColor',
    'paddingTop','paddingRight','paddingBottom','paddingLeft',
    'marginTop','marginRight','marginBottom','marginLeft',
    'display','flexDirection','gap','justifyContent','alignItems',
    'borderWidth','borderRadius','borderColor','borderStyle',
    'width','minWidth','maxWidth','height','minHeight','maxHeight',
    'opacity','transform','letterSpacing','textDecoration','fontFamily',
    'boxShadow','overflow','position','top','right','bottom','left','zIndex'
  ];

  async function handleCreate({ selector, comment, cssChanges, textChange }) {
    if (!selector) throw new Error('selector is required');

    const el = document.querySelector(selector);
    if (!el) throw new Error('Element not found: ' + selector);

    // Generate element context (captures computed styles BEFORE our changes)
    const context = await VibeElementContext.generate(el);

    const pendingChanges = {};
    const computed = window.getComputedStyle(el);

    if (cssChanges && typeof cssChanges === 'object') {
      // Explicit changes passed — apply them and record originals
      for (const [prop, value] of Object.entries(cssChanges)) {
        const original = computed[prop] || '';
        pendingChanges[prop] = { original, value: String(value) };
        el.style[prop] = value;
      }
    } else {
      // No explicit cssChanges — detect inline styles already applied by caller
      for (const prop of DETECT_PROPS) {
        const inline = el.style[prop];
        if (inline) {
          const original = context.styles[prop] || computed[prop] || '';
          if (inline !== original) {
            pendingChanges[prop] = { original, value: inline };
          }
        }
      }
    }

    // Handle text change
    if (textChange !== undefined && textChange !== null) {
      const original = context.text || el.textContent;
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

  async function handleCreateStyle({ css, comment }) {
    if (!css || typeof css !== 'string') throw new Error('css string is required');

    const annotation = {
      id: 'vibe_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      type: 'stylesheet',
      url: window.location.href,
      css,
      comment: comment || '',
      viewport: { width: window.innerWidth, height: window.innerHeight },
      url_path: window.location.pathname,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await VibeAPI.saveAnnotation(annotation);
    VibeEvents.emit('annotation:saved', { annotation });

    return { id: annotation.id, success: true };
  }

  function handleGetAnnotations() {
    const annotations = getAnnotations ? getAnnotations() : [];
    if (!annotations) return [];
    return annotations.map(a => {
      if (a.type === 'stylesheet') {
        return { id: a.id, type: 'stylesheet', css: a.css, comment: a.comment, url_path: a.url_path, status: a.status };
      }
      return {
        id: a.id,
        selector: a.selector,
        comment: a.comment,
        pending_changes: a.pending_changes || null,
        element_context: a.element_context || null,
        source_file_path: a.source_file_path || null,
        url_path: a.url_path || null,
        context_hints: a.context_hints || null,
        status: a.status
      };
    });
  }

  async function handleExport({ scope }) {
    const annotations = scope === 'page'
      ? await VibeAPI.loadAnnotations()
      : await VibeAPI.loadProjectAnnotations();

    const loc = window.location;
    return {
      vibe_annotations_export: true,
      version: '1.0',
      exported_at: new Date().toISOString(),
      source: {
        origin: loc.origin,
        hostname: loc.hostname,
        port: loc.port || ''
      },
      scope: scope || 'project',
      annotations: annotations.map(a => {
        const cleaned = { ...a };
        delete cleaned.screenshot;
        return cleaned;
      })
    };
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
