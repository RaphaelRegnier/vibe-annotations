// Read-only framework source inspection. No annotation API is exposed to page scripts.
export default defineContentScript({
  matches: [
    'http://localhost/*',
    'https://localhost/*',
    'http://127.0.0.1/*',
    'https://127.0.0.1/*',
    'http://0.0.0.0/*',
    'https://0.0.0.0/*',
    'http://*.local/*',
    'https://*.local/*',
    'http://*.test/*',
    'https://*.test/*',
    'http://*.localhost/*',
    'https://*.localhost/*',
    'file:///*',
  ],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    // --- Reverse bridge: isolated world → MAIN world ---
    // The isolated-world content script cannot see page-set JS expando properties
    // (e.g. React's __reactFiber$… or Vue's __vueParentComponent). This MAIN-world
    // listener reads framework source/identity info off a node the isolated world
    // tags with a temporary probe attribute, then returns the result across the bridge.

    const PROBE_ATTR = 'data-vibe-fiber-probe';

    document.addEventListener('vibe-bridge:main-request', (e) => {
      const { id, method, args } = e.detail || {};
      if (!id || !method) return;

      let result = null;
      let error = null;
      try {
        if (method === 'readSource') result = readSourceInfo(args || {});
        else throw new Error('Unknown main-world method: ' + method);
      } catch (err) {
        error = err && err.message ? err.message : String(err);
      }

      document.dispatchEvent(new CustomEvent('vibe-bridge:main-response', {
        detail: error ? { id, error } : { id, result },
      }));
    });

    function readSourceInfo({ marker }) {
      if (!marker) return null;
      const sel = '[' + PROBE_ATTR + '="' + (window.CSS && CSS.escape ? CSS.escape(marker) : marker) + '"]';
      const el = deepQuery(sel);
      if (!el) return null;

      return readReactSource(el) || readVueSource(el) || null;
    }

    // Walk up across shadow boundaries (MAIN world has no shared util for this).
    function parentDeep(node) {
      if (node.parentElement) return node.parentElement;
      const root = node.getRootNode && node.getRootNode();
      if (root && root instanceof ShadowRoot) return root.host;
      return null;
    }

    function deepQuery(selector) {
      const direct = document.querySelector(selector);
      if (direct) return direct;
      const walk = (root) => {
        const hosts = root.querySelectorAll('*');
        for (const h of hosts) {
          if (h.shadowRoot) {
            const found = h.shadowRoot.querySelector(selector) || walk(h.shadowRoot);
            if (found) return found;
          }
        }
        return null;
      };
      try { return walk(document); } catch { return null; }
    }

    // --- React ---

    function readReactSource(element) {
      let current = element;
      let depth = 0;
      while (current && depth < 10) {
        const fiberKey = Object.keys(current).find(k =>
          k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance') || k.startsWith('_reactInternalFiber')
        );
        if (fiberKey) return readFromFiber(current[fiberKey]);
        current = parentDeep(current);
        depth++;
      }
      return null;
    }

    function readFromFiber(startFiber) {
      // Find the first _debugSource on the fiber or its owner chain (React ≤18 dev).
      let fiber = startFiber;
      let fd = 0;
      let source = null;
      while (fiber && fd < 30) {
        const s = fiber._debugSource || fiber._source ||
          (fiber.elementType && fiber.elementType._source) || (fiber.type && fiber.type._source);
        if (s && s.fileName) { source = s; break; }
        if (fiber._debugOwner) {
          const os = fiber._debugOwner._debugSource || fiber._debugOwner._source;
          if (os && os.fileName) { source = os; break; }
        }
        fiber = fiber.return || fiber._debugOwner;
        fd++;
      }

      const identity = readReactIdentity(startFiber);

      if (source && source.fileName) {
        return {
          filePath: source.fileName,
          lineRange: source.lineNumber ? (source.lineNumber + '-' + (source.lineNumber + 10)) : null,
          hasSourceMap: true,
          componentName: identity.name,
          ownerChain: identity.chain,
        };
      }

      // No _debugSource (React 19, or dev transform stripped) → identity only, never a path.
      if (identity.name) {
        return {
          filePath: null,
          lineRange: null,
          hasSourceMap: false,
          componentName: identity.name,
          ownerChain: identity.chain,
        };
      }

      return null;
    }

    // Raw component name for a fiber, or null if it isn't a component
    // (host element string type, Fragment, etc.).
    function rawComponentName(fiber) {
      const t = fiber && fiber.type;
      if (!t || typeof t === 'string') return null;
      return t.displayName || t.name ||
        (t.render && (t.render.displayName || t.render.name)) || null;
    }

    // Real React component names are PascalCase and ≥3 chars; minifier output is
    // short / lowercase-led (`sD`, `xe`, `t`, `n2`). Reporting those as `Component:`
    // is noise that sends the agent chasing a meaningless symbol.
    function isMinifiedName(name) {
      return !name || name.length <= 2 || !/^[A-Z]/.test(name);
    }

    // Filtered name — used for the owner chain (real names only).
    function reactFiberName(fiber) {
      const name = rawComponentName(fiber);
      return isMinifiedName(name) ? null : name;
    }

    function readReactIdentity(startFiber) {
      // Primary name = the NEAREST component this node belongs to. If that
      // component's name is minified, report no name rather than climbing to a
      // distant library ancestor (e.g. Router) and misattributing the element.
      let name = null;
      let fiber = startFiber;
      let fd = 0;
      while (fiber && fd < 30) {
        if (typeof fiber.type === 'function') { // nearest function/class component
          const raw = rawComponentName(fiber);
          name = isMinifiedName(raw) ? null : raw;
          break;
        }
        fiber = fiber.return;
        fd++;
      }

      // Ownership chain (who rendered whom) via _debugOwner — real names only.
      const chain = [];
      let owner = startFiber;
      let od = 0;
      while (owner && od < 12) {
        const n = reactFiberName(owner);
        if (n && !chain.includes(n)) chain.unshift(n);
        owner = owner._debugOwner;
        od++;
      }
      return { name, chain: chain.length ? chain : null };
    }

    // --- Vue 3 ---

    function readVueSource(element) {
      let current = element;
      let depth = 0;
      while (current && depth < 10) {
        const inst = current.__vueParentComponent || current.__vue__;
        if (inst) {
          const type = inst.type || inst.$options || {};
          const file = type.__file || (inst.$options && inst.$options.__file);
          const name = type.name || type.__name || (inst.$options && inst.$options.name) || null;
          if (file) {
            return { filePath: file, lineRange: null, hasSourceMap: true, componentName: name, ownerChain: name ? [name] : null };
          }
          if (name) {
            return { filePath: null, lineRange: null, hasSourceMap: false, componentName: name, ownerChain: [name] };
          }
        }
        current = parentDeep(current);
        depth++;
      }
      return null;
    }
  },
});
