// Pure logic module — selector generation, element context collection,
// screenshot capture, source mapping, parent chain.
// Operates on host page DOM. No UI.

var VibeElementContext = (() => {

  // --- Main entry point ---

  async function generate(element) {
    const selector = generateSelector(element);
    const computedStyle = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    const context = {
      selector,
      tag: element.tagName.toLowerCase(),
      classes: Array.from(element.classList),
      text: element.textContent.substring(0, 100).trim(),
      styles: {
        display: computedStyle.display,
        position: computedStyle.position,
        fontSize: computedStyle.fontSize,
        fontWeight: computedStyle.fontWeight,
        lineHeight: computedStyle.lineHeight,
        textAlign: computedStyle.textAlign,
        color: computedStyle.color,
        backgroundColor: computedStyle.backgroundColor,
        margin: computedStyle.margin,
        padding: computedStyle.padding,
        paddingTop: computedStyle.paddingTop,
        paddingRight: computedStyle.paddingRight,
        paddingBottom: computedStyle.paddingBottom,
        paddingLeft: computedStyle.paddingLeft,
        marginTop: computedStyle.marginTop,
        marginRight: computedStyle.marginRight,
        marginBottom: computedStyle.marginBottom,
        marginLeft: computedStyle.marginLeft,
        flexDirection: computedStyle.flexDirection,
        flexWrap: computedStyle.flexWrap,
        justifyContent: computedStyle.justifyContent,
        alignItems: computedStyle.alignItems,
        gap: computedStyle.gap,
        columnGap: computedStyle.columnGap,
        rowGap: computedStyle.rowGap,
        gridTemplateColumns: computedStyle.gridTemplateColumns,
        gridTemplateRows: computedStyle.gridTemplateRows,
        borderTopWidth: computedStyle.borderTopWidth,
        borderRadius: computedStyle.borderRadius,
        borderStyle: computedStyle.borderStyle,
        borderColor: computedStyle.borderColor,
        width: computedStyle.width,
        minWidth: computedStyle.minWidth,
        maxWidth: computedStyle.maxWidth,
        height: computedStyle.height,
        minHeight: computedStyle.minHeight,
        maxHeight: computedStyle.maxHeight
      },
      position: {
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      source_mapping: generateSourceMapping(element),
      screenshot: null,
      parent_chain: getParentChainContext(element)
    };

    // Screenshot
    try {
      const enabled = await VibeAPI.getScreenshotEnabled();
      if (enabled) context.screenshot = captureElementScreenshot(element);
    } catch { /* skip */ }

    return context;
  }

  // --- Selector generation (multi-strategy fallback) ---

  function generateSelector(element) {
    if (element.id) return `#${CSS.escape(element.id)}`;

    const unique = findUniqueAttributeSelector(element);
    if (unique) return unique;

    const textSel = generateTextBasedSelector(element);
    if (textSel && isUnique(textSel)) return textSel;

    const classSel = generateClassSelector(element);
    if (classSel && isUnique(classSel)) return classSel;

    const ctxSel = generateLimitedContextSelector(element);
    if (ctxSel && isUnique(ctxSel)) return ctxSel;

    const fallSel = generateFallbackSelector(element);
    if (fallSel && isUnique(fallSel)) return fallSel;

    const pathSel = generateRobustPathSelector(element);
    if (pathSel && isUnique(pathSel)) return pathSel;

    return generateDataAttributeSelector(element);
  }

  function findUniqueAttributeSelector(element) {
    // Priority order: stable test/identity attributes first, then semantic
    const stableAttrs = [
      'data-testid', 'data-test', 'data-test-id', 'data-cy', 'data-qa',
      'data-e2e', 'data-automation-id', 'data-component',
      'aria-label', 'title', 'name', 'role'
    ];
    const tag = element.tagName.toLowerCase();

    // First pass: check the element itself
    for (const attr of stableAttrs) {
      const value = element.getAttribute(attr);
      if (value) {
        const sel = `${tag}[${attr}="${CSS.escape(value)}"]`;
        if (isUnique(sel)) return sel;
      }
    }

    // Second pass: check nearest ancestor with a stable attribute (scoped selector)
    let parent = element.parentElement;
    let depth = 0;
    while (parent && parent.tagName !== 'BODY' && depth < 5) {
      for (const attr of stableAttrs.slice(0, 8)) { // test attrs only
        const value = parent.getAttribute(attr);
        if (value) {
          const parentSel = `${parent.tagName.toLowerCase()}[${attr}="${CSS.escape(value)}"]`;
          // Build child selector relative to this stable parent
          const childTag = tag;
          // Check if element is a direct child — use child combinator only if so
          const isDirectChild = element.parentElement === parent;
          if (isDirectChild) {
            const directChildren = Array.from(parent.querySelectorAll(`:scope > ${childTag}`));
            if (directChildren.length === 1 && directChildren[0] === element) {
              const sel = `${parentSel} > ${childTag}`;
              if (isUnique(sel)) return sel;
            }
          }
          // Descendant selector with nth-of-type
          const allOfType = Array.from(parent.querySelectorAll(childTag));
          const idx = allOfType.indexOf(element);
          if (idx !== -1) {
            const sel = `${parentSel} ${childTag}:nth-of-type(${idx + 1})`;
            if (isUnique(sel)) return sel;
          }
        }
      }
      parent = parent.parentElement;
      depth++;
    }

    return null;
  }

  function generateTextBasedSelector(element) {
    const text = element.textContent?.trim();
    if (!text || text.length > 100) return null;
    const tag = element.tagName.toLowerCase();
    if (!['button', 'a', 'span', 'div'].includes(tag)) return null;

    const sanitized = text.replace(/[^\w\s]/g, '').trim();
    if (!sanitized || sanitized.length >= 50) return null;

    const candidates = Array.from(document.querySelectorAll(tag));
    const matches = candidates.filter(el =>
      el.textContent?.trim().replace(/[^\w\s]/g, '').trim() === sanitized
    );
    if (matches.length === 1) {
      element.setAttribute('data-text-content', sanitized);
      return `${tag}[data-text-content="${CSS.escape(sanitized)}"]`;
    }
    return null;
  }

  function generateClassSelector(element) {
    if (!element.className) return null;
    const classes = Array.from(element.classList)
      .filter(c => !c.startsWith('vibe-'))
      .filter(isStableClass)
      .slice(0, 4);
    if (!classes.length) return null;
    return `${element.tagName.toLowerCase()}.${classes.map(c => CSS.escape(c)).join('.')}`;
  }

  function generateLimitedContextSelector(element) {
    const classSel = generateClassSelector(element);
    if (!classSel) return null;
    const parent = element.parentElement;
    if (!parent || parent.tagName === 'BODY') return null;
    const pClasses = Array.from(parent.classList)
      .filter(c => !c.startsWith('vibe-'))
      .filter(isStableClass)
      .slice(0, 2);
    if (!pClasses.length) return null;
    return `${parent.tagName.toLowerCase()}.${pClasses.map(c => CSS.escape(c)).join('.')} > ${classSel}`;
  }

  function generateFallbackSelector(element) {
    const tag = element.tagName.toLowerCase();
    const parent = element.parentElement;
    if (!parent) return null;

    // Build qualified parent selector — require classes or ID to avoid fragile bare-tag selectors
    let parentSel = parent.tagName.toLowerCase();
    if (parent.id) {
      parentSel += `#${CSS.escape(parent.id)}`;
    } else {
      const pClasses = Array.from(parent.classList)
        .filter(c => !c.startsWith('vibe-'))
        .filter(isStableClass)
        .slice(0, 3);
      if (pClasses.length) {
        parentSel += `.${pClasses.map(c => CSS.escape(c)).join('.')}`;
      }
    }

    // If parent has no qualifying info, selector is too fragile — skip
    if (parentSel === parent.tagName.toLowerCase()) return null;

    const siblings = Array.from(parent.children).filter(el => el.tagName.toLowerCase() === tag);
    const index = siblings.indexOf(element) + 1;
    const attrs = [];
    if (element.type) attrs.push(`[type="${element.type}"]`);
    if (element.role) attrs.push(`[role="${element.role}"]`);

    return `${parentSel} > ${tag}${attrs.join('')}:nth-of-type(${index})`;
  }

  function generateRobustPathSelector(element) {
    const path = [];
    let current = element;
    let depth = 0;
    while (current && current.tagName !== 'BODY' && depth < 4) {
      const tag = current.tagName.toLowerCase();
      let id = tag;

      const stable = Array.from(current.classList)
        .filter(c => !c.startsWith('vibe-'))
        .filter(isStableClass)
        .slice(0, 2);

      if (stable.length) {
        id = `${tag}.${stable.map(c => CSS.escape(c)).join('.')}`;
      } else if (current.id) {
        id = `${tag}#${CSS.escape(current.id)}`;
      } else if (current.getAttribute('role')) {
        id = `${tag}[role="${current.getAttribute('role')}"]`;
      } else {
        const siblings = Array.from(current.parentElement?.children || []);
        const same = siblings.filter(s => s.tagName.toLowerCase() === tag);
        if (same.length > 1) {
          id = `${tag}:nth-of-type(${same.indexOf(current) + 1})`;
        }
      }

      path.unshift(id);
      current = current.parentElement;
      depth++;
    }
    return path.length ? path.join(' > ') : null;
  }

  function generateDataAttributeSelector(element) {
    const id = `vibe-annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    element.setAttribute('data-vibe-id', id);
    return `[data-vibe-id="${id}"]`;
  }

  function isStableClass(cls) {
    return ![
      /^hover:/, /^focus:/, /^active:/, /^disabled:/,
      /^transition/, /^duration/, /^ease/,
      /^[a-z0-9]{8,}$/,
      /--/,
      /\[.*\]/
    ].some(p => p.test(cls));
  }

  function isUnique(selector) {
    try { return document.querySelectorAll(selector).length === 1; }
    catch { return false; }
  }

  // --- Source mapping ---

  function generateSourceMapping(element) {
    try {
      const srcInfo = extractSourceInfo(element);
      const projectArea = getProjectAreaFromURL();
      const urlPath = new URL(window.location.href).pathname;
      const hints = generateContextHints(element);
      return {
        source_file_path: srcInfo.filePath || null,
        source_line_range: srcInfo.lineRange || null,
        project_area: projectArea,
        url_path: urlPath,
        source_map_available: srcInfo.hasSourceMap || false,
        context_hints: hints
      };
    } catch {
      return {
        source_file_path: null,
        source_line_range: null,
        project_area: 'unknown',
        url_path: window.location.pathname || '/',
        source_map_available: false,
        context_hints: generateContextHints(element)
      };
    }
  }

  function extractSourceInfo(element) {
    let info = { filePath: null, lineRange: null, hasSourceMap: false };
    try {
      const react = getReactFiberInfo(element);
      if (react) return { ...info, ...react };
    } catch { /* continue */ }

    try {
      const data = getDataAttributeInfo(element);
      if (data) return { ...info, ...data };
    } catch { /* continue */ }

    return info;
  }

  function getReactFiberInfo(element) {
    let current = element;
    let depth = 0;
    while (current && depth < 10) {
      const fiberKey = Object.keys(current).find(k =>
        k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance') || k.startsWith('_reactInternalFiber')
      );
      if (fiberKey) {
        let fiber = current[fiberKey];
        let fd = 0;
        while (fiber && fd < 20) {
          const source = fiber._debugSource || fiber._source ||
            fiber.elementType?._source || fiber.type?._source;
          if (source?.fileName) {
            return {
              filePath: normalizeSourcePath(source.fileName),
              lineRange: source.lineNumber ? `${source.lineNumber}-${source.lineNumber + 10}` : null,
              hasSourceMap: true
            };
          }
          if (fiber._debugOwner) {
            const os = fiber._debugOwner._debugSource || fiber._debugOwner._source;
            if (os?.fileName) {
              return {
                filePath: normalizeSourcePath(os.fileName),
                lineRange: os.lineNumber ? `${os.lineNumber}-${os.lineNumber + 10}` : null,
                hasSourceMap: true
              };
            }
          }
          fiber = fiber.return || fiber._debugOwner;
          fd++;
        }
      }
      current = current.parentElement;
      depth++;
    }
    return null;
  }

  function getDataAttributeInfo(element) {
    let current = element;
    let depth = 0;
    while (current && depth < 5) {
      const f = current.getAttribute('data-source-file') ||
        current.getAttribute('data-component-file') ||
        current.getAttribute('data-file');
      const l = current.getAttribute('data-source-line') || current.getAttribute('data-line');
      if (f) {
        return {
          filePath: normalizeSourcePath(f),
          lineRange: l ? `${l}-${parseInt(l) + 10}` : null,
          hasSourceMap: true
        };
      }
      const np = current.getAttribute('data-nextjs-path');
      if (np) return { filePath: normalizeSourcePath(np), lineRange: null, hasSourceMap: true };

      current = current.parentElement;
      depth++;
    }
    return null;
  }

  function normalizeSourcePath(fp) {
    let n = fp
      .replace(/^\[project\]\//, '')
      .replace(/^\[turbopack\]\//, '')
      .replace(/^\[next\]\//, '')
      .replace(/^.*\/(app\/.*?)$/, '$1')
      .replace(/^.*\/src\//, 'src/')
      .replace(/^.*\/components\//, 'components/')
      .replace(/^.*\/pages\//, 'pages/')
      .replace(/^.*\/app\/views\//, 'app/views/')
      .replace(/^.*\/app\/assets\//, 'app/assets/')
      .replace(/^.*\/app\/controllers\//, 'app/controllers/')
      .replace(/^.*\/app\/models\//, 'app/models/')
      .replace(/^.*\/app\/helpers\//, 'app/helpers/')
      .replace(/^.*\/templates\//, 'templates/')
      .replace(/^.*\/static\//, 'static/')
      .replace(/^.*\/public\//, 'public/')
      .replace(/^.*\/assets\//, 'assets/')
      .replace(/^.*\/js\//, 'js/')
      .replace(/^.*\/css\//, 'css/')
      .replace(/^.*\/scss\//, 'scss/')
      .replace(/^.*\/styles\//, 'styles/')
      .replace(/\?.*$/, '')
      .replace(/#.*$/, '');

    if (!n.startsWith('app/') && n.includes('/app/')) {
      n = 'app/' + n.split('/app/')[1];
    }
    return n;
  }

  function getProjectAreaFromURL() {
    const pathname = new URL(window.location.href).pathname;
    const segs = pathname.substring(1).split('/').filter(s => s);
    if (!segs.length) return 'home';
    const area = segs[0].toLowerCase();
    const map = {
      admin: 'admin', dashboard: 'dashboard', 'control-panel': 'admin', cp: 'admin',
      users: 'users', user: 'users', profile: 'users', profiles: 'users', account: 'users', accounts: 'users',
      products: 'products', product: 'products', items: 'products', item: 'products', catalog: 'products',
      orders: 'orders', order: 'orders', checkout: 'orders', cart: 'orders', shopping: 'orders',
      posts: 'content', post: 'content', articles: 'content', article: 'content', blog: 'content', news: 'content',
      settings: 'settings', config: 'settings', configuration: 'settings', preferences: 'settings',
      login: 'auth', signin: 'auth', signup: 'auth', register: 'auth', auth: 'auth', authentication: 'auth'
    };
    return map[area] || area;
  }

  // --- Context hints ---

  function generateContextHints(element) {
    const hints = [];
    const role = inferSemanticRole(element);
    if (role) hints.push(`UI section: ${role}`);

    const depth = getComponentDepth(element);
    if (depth > 1) hints.push(`Nested ${depth} levels deep in component hierarchy`);

    const fw = detectFrameworkPatterns(element);
    if (fw.length) hints.push(...fw);

    const loc = inferFileLocation(element, role);
    if (loc) hints.push(`Likely file: ${loc}`);

    return hints.length ? hints : null;
  }

  function inferSemanticRole(el) {
    if (el.closest('nav, [role="navigation"]')) return 'navigation';
    if (el.closest('header, [role="banner"]')) return 'header';
    if (el.closest('footer, [role="contentinfo"]')) return 'footer';
    if (el.closest('aside, [role="complementary"]')) return 'sidebar';
    if (el.closest('main, [role="main"]')) return 'main-content';
    if (el.closest('form, [role="form"]')) return 'form';
    if (el.closest('[role="dialog"], .modal, .popup, .overlay')) return 'modal';
    if (el.closest('.card, .item, .post, .article, [role="article"]')) return 'content-card';
    if (el.closest('li, [role="listitem"], .list-item')) return 'list-item';
    if (el.matches('button, [role="button"], .btn, .button')) return 'button';
    if (el.matches('input, select, textarea, [role="textbox"]')) return 'form-input';
    if (el.closest('table, [role="table"], [role="grid"]')) return 'table';
    return null;
  }

  function getComponentDepth(el) {
    let depth = 0, current = el.parentElement;
    while (current && depth < 10 && current.tagName !== 'BODY') {
      const cls = Array.from(current.classList);
      if (cls.some(c => /^[A-Z][a-zA-Z0-9]*/.test(c) || c.includes('component') || c.includes('container') || c.includes('wrapper'))) {
        depth++;
      }
      current = current.parentElement;
    }
    return depth;
  }

  function detectFrameworkPatterns(el) {
    const p = [];
    if (el.hasAttribute('data-testid')) p.push(`React test ID: ${el.getAttribute('data-testid')}`);
    if (el.closest('[data-nextjs-scroll-focus-boundary]') || document.querySelector('script[src*="_next"]')) {
      p.push('Next.js app detected');
    }
    const cls = Array.from(el.classList);
    if (cls.some(c => /^[a-z0-9]{6,}$/.test(c) || c.startsWith('css-') || c.startsWith('emotion-'))) {
      p.push('CSS-in-JS styling detected');
    }
    return p;
  }

  function inferFileLocation(el, role) {
    const segs = window.location.pathname.split('/').filter(s => s);
    if (segs.length > 0) {
      const last = segs[segs.length - 1];
      if (role === 'header') return 'components/Header.tsx or app/layout.tsx';
      if (role === 'footer') return 'components/Footer.tsx or app/layout.tsx';
      if (role === 'navigation') return 'components/Navigation.tsx';
      if (role === 'main-content') return `app/${segs.join('/')}/page.tsx`;
      if (role === 'modal') return 'components/Modal.tsx or components/dialogs/';
      if (last) return `app/${segs.join('/')}/page.tsx or components/${last.charAt(0).toUpperCase() + last.slice(1)}Page.tsx`;
    }
    if (role === 'main-content') return 'app/page.tsx or pages/index.tsx';
    return null;
  }

  // --- Screenshot ---

  function captureElementScreenshot(element) {
    try {
      const rect = element.getBoundingClientRect();
      const pad = 20;
      const crop = {
        x: Math.max(0, rect.left - pad),
        y: Math.max(0, rect.top - pad),
        width: Math.min(window.innerWidth - Math.max(0, rect.left - pad), rect.width + pad * 2),
        height: Math.min(window.innerHeight - Math.max(0, rect.top - pad), rect.height + pad * 2)
      };
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = crop.width;
      canvas.height = crop.height;

      const style = window.getComputedStyle(element);
      ctx.fillStyle = style.backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#d97757';
      ctx.lineWidth = 2;
      ctx.strokeRect(Math.max(0, rect.left - crop.x), Math.max(0, rect.top - crop.y), rect.width, rect.height);

      const text = element.textContent.trim().substring(0, 50);
      if (text) {
        ctx.fillStyle = style.color || '#000000';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText(text + (element.textContent.length > 50 ? '...' : ''), Math.max(0, rect.left - crop.x) + 5, Math.max(0, rect.top - crop.y) + 15);
      }

      return {
        data_url: canvas.toDataURL('image/webp', 0.8),
        crop_area: crop,
        element_bounds: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        timestamp: new Date().toISOString(),
        compression: 'webp_80'
      };
    } catch {
      return null;
    }
  }

  // --- Parent chain ---

  function getParentChainContext(element, maxDepth = 3) {
    const chain = [];
    let current = element.parentElement;
    let depth = 0;
    while (current && depth < maxDepth && current.tagName !== 'BODY') {
      const info = {
        tag: current.tagName.toLowerCase(),
        classes: Array.from(current.classList),
        id: current.id || null,
        role: current.getAttribute('role') || null,
        text_sample: current.textContent.substring(0, 50).trim()
      };
      if (info.classes.length || info.id || info.role ||
        ['nav', 'header', 'footer', 'main', 'section', 'article', 'aside'].includes(info.tag)) {
        chain.push(info);
      }
      current = current.parentElement;
      depth++;
    }
    return chain.length ? chain : null;
  }

  // --- Element finding (for badge re-rendering) ---

  function findElementBySelector(annotation) {
    try {
      const el = document.querySelector(annotation.selector);
      if (el) {
        // Verify text content to catch drifted selectors
        const expectedText = annotation.element_context?.text;
        if (expectedText) {
          const actualText = el.textContent?.substring(0, 100).trim();
          const changedText = annotation.pending_changes?.copyChange?.value?.substring(0, 100).trim();
          if (actualText === expectedText || (changedText && actualText === changedText)) return el;
          // Selector matched wrong element — fall through to fallbacks
        } else {
          return el;
        }
      }
    } catch { /* invalid selector */ }

    // Fallback: text matching
    if (annotation.element_context?.text && annotation.element_context?.tag) {
      const tag = annotation.element_context.tag;
      const sanitized = annotation.element_context.text.replace(/[^\w\s]/g, '').trim();
      const candidates = Array.from(document.querySelectorAll(tag));
      let matches = candidates.filter(el =>
        el.textContent?.trim().replace(/[^\w\s]/g, '').trim() === sanitized
      );
      // If original text doesn't match, try the edited copy change value
      if (matches.length === 0 && annotation.pending_changes?.copyChange?.value) {
        const changedSanitized = annotation.pending_changes.copyChange.value.substring(0, 100).replace(/[^\w\s]/g, '').trim();
        matches = candidates.filter(el =>
          el.textContent?.trim().replace(/[^\w\s]/g, '').trim() === changedSanitized
        );
      }
      if (matches.length === 1) return matches[0];

      // Narrow by classes
      if (matches.length > 1 && annotation.element_context.classes?.length) {
        const best = matches.find(el => {
          const cls = Array.from(el.classList);
          return annotation.element_context.classes.some(c => cls.includes(c));
        });
        if (best) return best;
      }

      // Narrow by position
      if (matches.length > 1 && annotation.element_context.position) {
        const pos = annotation.element_context.position;
        const best = matches.find(el => {
          const r = el.getBoundingClientRect();
          return Math.abs((r.left + window.scrollX) - pos.x) < 50 &&
            Math.abs((r.top + window.scrollY) - pos.y) < 50;
        });
        if (best) return best;
      }
    }

    // Fallback: class matching
    if (annotation.element_context?.tag && annotation.element_context?.classes?.length) {
      const stableClasses = annotation.element_context.classes.filter(isStableClass);
      if (stableClasses.length) {
        try {
          const sel = `${annotation.element_context.tag}.${stableClasses.map(c => CSS.escape(c)).join('.')}`;
          const candidates = document.querySelectorAll(sel);
          if (candidates.length === 1) return candidates[0];
        } catch { /* continue */ }
      }
    }

    // Fallback: data-vibe-id
    if (annotation.selector.includes('data-vibe-id')) {
      const m = annotation.selector.match(/data-vibe-id="([^"]+)"/);
      if (m) {
        const el = document.querySelector(`[data-vibe-id="${m[1]}"]`);
        if (el) return el;
      }
    }

    return null;
  }

  // --- CSS variable scanner ---

  let cachedColorVars = null;

  function scanPageColorVariables() {
    if (cachedColorVars) return cachedColorVars;
    const vars = [];
    const seen = new Set();
    try {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.style) {
              for (const prop of rule.style) {
                if (prop.startsWith('--') && !seen.has(prop)) {
                  seen.add(prop);
                  const val = rule.style.getPropertyValue(prop).trim();
                  if (isColorValue(val)) {
                    const resolved = resolveColor(val);
                    if (resolved) vars.push({ name: prop, value: resolved });
                  }
                }
              }
            }
          }
        } catch (e) { /* CORS-blocked stylesheet, skip */ }
      }
    } catch (e) {}
    // Dedupe by resolved color value
    const uniqueMap = new Map();
    for (const v of vars) {
      if (!uniqueMap.has(v.value)) uniqueMap.set(v.value, v);
    }
    cachedColorVars = Array.from(uniqueMap.values());
    return cachedColorVars;
  }

  function isColorValue(val) {
    if (!val || val === 'inherit' || val === 'initial' || val === 'unset') return false;
    if (/^#([0-9a-f]{3,8})$/i.test(val)) return true;
    if (/^(rgb|hsl)a?\s*\(/.test(val)) return true;
    // Test via temp element
    const el = document.createElement('span');
    el.style.color = '';
    el.style.color = val;
    return el.style.color !== '';
  }

  function resolveColor(val) {
    try {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.fillStyle = val;
      const resolved = ctx.fillStyle;
      // Canvas returns '#000000' for invalid colors — only accept if input wasn't obviously wrong
      if (resolved === '#000000' && !/^#0{3,6}$/i.test(val) && !/rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)/.test(val)) {
        return null;
      }
      return resolved;
    } catch (e) {
      return null;
    }
  }

  return {
    generate,
    generateSelector,
    findElementBySelector,
    scanPageColorVariables
  };
})();
