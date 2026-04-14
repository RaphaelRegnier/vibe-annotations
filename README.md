# Vibe Annotations

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-6K+_users-green?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/gkofobaeeepjopdpahbicefmljcmpeof)
[![Server Package](https://img.shields.io/badge/Server-NPM-blue)](https://www.npmjs.com/package/vibe-annotations-server)
[![License: PolyForm Shield](https://img.shields.io/badge/License-PolyForm%20Shield-blue)](https://polyformproject.org/licenses/shield/1.0.0)

Visual feedback tool for web development. Annotate elements on your pages, make design tweaks, and share with AI coding agents or teammates.

## Get started

1. Install the [browser extension](https://chromewebstore.google.com/detail/gkofobaeeepjopdpahbicefmljcmpeof)
2. Open a localhost page, click **Annotate**, click any element
3. Copy & paste into any AI chat — or install the MCP server for auto-sync:

```bash
npm install -g vibe-annotations-server
vibe-annotations-server start
claude mcp add --transport http vibe-annotations http://127.0.0.1:3846/mcp
```

## Features

- **Annotate** — Click elements to add comments and design change requests
- **Design tweaks** — Edit font, spacing, layout, colors, and raw CSS with live preview
- **Copy / Export** — Paste into any AI chat or share `.json` files with teammates
- **MCP integration** — AI agents read and resolve annotations automatically
- **Watch mode** — Hands-free loop: drop annotations, agent implements them live
- **Import with remap** — Import annotations from staging/production into localhost

## Documentation

Full docs at [vibe-annotations.com/docs](https://vibe-annotations.com/docs)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs welcome.

## License

[PolyForm Shield 1.0.0](https://polyformproject.org/licenses/shield/1.0.0) — see [LICENSE](LICENSE) and [NOTICE](NOTICE).
