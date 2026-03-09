# v1.2.2

## Selector Anchoring Fixes

Annotations on repeated elements (e.g. 4 identical buttons) could drift to the wrong element or fail to anchor. Three fixes:

- **Text-based selector** now actually works — the `data-text-content` attribute is set on the element so the selector can match it on re-find.
- **Fallback selector** no longer accepts bare parent tags like `div > button:nth-of-type(2)`. Requires the parent to have stable classes or an ID, preventing false-unique matches.
- **Drift detection** — when re-finding an element by selector, text content is verified before accepting the match. Mismatches fall through to text/position fallbacks.
