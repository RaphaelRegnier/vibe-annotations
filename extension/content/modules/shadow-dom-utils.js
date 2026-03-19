// Shadow DOM helpers — deep querying, parent traversal, shadow-aware selectors.
// Works with open shadow roots only (closed roots return null for .shadowRoot).
// Performance: avoids full-tree walks where possible; caches nothing (DOM is mutable).

var VibeShadowDOMUtils = (() => {

  // --- Predicates ---

  function isShadowRoot(node) {
    return node && node.nodeType === Node.DOCUMENT_FRAGMENT_NODE && !!node.host;
  }

  function isInShadowDOM(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    const root = element.getRootNode();
    return isShadowRoot(root);
  }

  // --- Parent traversal (crosses shadow boundaries) ---

  function getParentElement(node) {
    if (!node) return null;
    if (node.parentElement) return node.parentElement;
    const parent = node.parentNode;
    return isShadowRoot(parent) ? parent.host : null;
  }

  // --- Deep querying ---

  function querySelectorDeep(root, selector) {
    const base = root || document;
    try {
      const hit = base.querySelector(selector);
      if (hit) return hit;
    } catch { /* invalid selector */ }
    return _walkShadowRoots(base, selector, true);
  }

  function querySelectorAllDeep(root, selector) {
    const base = root || document;
    const results = [];
    try {
      results.push(...base.querySelectorAll(selector));
    } catch { /* invalid selector */ }
    _walkShadowRoots(base, selector, false, results);
    return results;
  }

  // Walk shadow roots breadth-first.  When `firstOnly` is true, return as soon
  // as we find one match (avoids scanning the entire tree for isUnique-style
  // checks that only need count <= 1 — see querySelectorCountDeep).
  function _walkShadowRoots(root, selector, firstOnly, out) {
    // Collect shadow hosts from this root
    let hosts;
    try { hosts = root.querySelectorAll('*'); } catch { return firstOnly ? null : undefined; }

    for (const el of hosts) {
      if (!el.shadowRoot) continue;
      try {
        if (firstOnly) {
          const hit = el.shadowRoot.querySelector(selector);
          if (hit) return hit;
        } else {
          out.push(...el.shadowRoot.querySelectorAll(selector));
        }
      } catch { /* skip */ }
      // Recurse into nested shadow roots
      const nested = firstOnly
        ? _walkShadowRoots(el.shadowRoot, selector, true)
        : _walkShadowRoots(el.shadowRoot, selector, false, out);
      if (firstOnly && nested) return nested;
    }
    return firstOnly ? null : undefined;
  }

  // Optimised uniqueness check: stops as soon as count > 1 instead of collecting all matches.
  function querySelectorCountDeep(root, selector, limit) {
    const base = root || document;
    let count = 0;
    try { count += base.querySelectorAll(selector).length; } catch { /* skip */ }
    if (count > limit) return count;
    count += _countInShadowRoots(base, selector, limit - count);
    return Math.min(count, limit + 1); // clamp — caller only cares about <= limit
  }

  function _countInShadowRoots(root, selector, remaining) {
    let count = 0;
    let hosts;
    try { hosts = root.querySelectorAll('*'); } catch { return 0; }
    for (const el of hosts) {
      if (!el.shadowRoot) continue;
      try { count += el.shadowRoot.querySelectorAll(selector).length; } catch { /* skip */ }
      if (count > remaining) return count;
      count += _countInShadowRoots(el.shadowRoot, selector, remaining - count);
      if (count > remaining) return count;
    }
    return count;
  }

  // --- Shadow path / host chain ---

  function getShadowPath(element) {
    const hosts = [];
    let current = element;
    while (current) {
      const root = current.getRootNode();
      if (!isShadowRoot(root)) break;
      hosts.unshift(root.host);
      current = root.host;
    }
    return hosts;
  }

  // --- Compound shadow selector resolution ---
  // Format: "hostSelector >> hostSelector >> innerSelector"

  const SHADOW_SEPARATOR = ' >> ';

  function buildShadowSelector(hostSelectors, innerSelector) {
    return [...hostSelectors, innerSelector].join(SHADOW_SEPARATOR);
  }

  function findByShadowSelector(root, selector) {
    if (!selector || !selector.includes(SHADOW_SEPARATOR)) return null;
    const parts = selector.split(SHADOW_SEPARATOR).map(s => s.trim()).filter(Boolean);
    if (!parts.length) return null;

    let currentRoot = root || document;

    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      try {
        const el = currentRoot.querySelector(parts[i]);
        if (!el) return null;
        if (isLast) return el;
        if (!el.shadowRoot) return null;
        currentRoot = el.shadowRoot;
      } catch { return null; }
    }
    return null;
  }

  function isShadowSelector(selector) {
    return selector && selector.includes(SHADOW_SEPARATOR);
  }

  // --- Deep elementFromPoint (drills into shadow roots) ---

  function elementFromPointDeep(clientX, clientY) {
    let current = document.elementFromPoint(clientX, clientY);
    let depth = 0;
    while (current && current.shadowRoot && depth < 10) {
      const next = current.shadowRoot.elementFromPoint(clientX, clientY);
      if (!next || next === current) break;
      current = next;
      depth++;
    }
    return current;
  }

  return {
    isShadowRoot,
    isInShadowDOM,
    getParentElement,
    querySelectorDeep,
    querySelectorAllDeep,
    querySelectorCountDeep,
    getShadowPath,
    buildShadowSelector,
    findByShadowSelector,
    isShadowSelector,
    elementFromPointDeep,
    SHADOW_SEPARATOR
  };
})();
