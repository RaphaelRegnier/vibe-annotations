# Vibe Annotations

[![Chrome Web Store](https://img.shields.io/badge/Chrome_Web_Store-6K+_users-green?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/gkofobaeeepjopdpahbicefmljcmpeof) [![Server Package](https://img.shields.io/badge/Server-NPM-blue)](https://www.npmjs.com/package/vibe-annotations-server) [![License: PolyForm Shield](https://img.shields.io/badge/License-PolyForm%20Shield-blue)](https://polyformproject.org/licenses/shield/1.0.0)

Visual feedback tool for web development. Annotate elements on your pages, make design tweaks, and share with AI coding agents or teammates.

https://github.com/user-attachments/assets/6946733e-eea6-4d38-8386-c493f90d36f4

For more features explanations (like collaboration via file sharing, AI-assisted annotations, watch mode...) please read the docs.

## Get started

**1.** Install the [browser extension](https://chromewebstore.google.com/detail/gkofobaeeepjopdpahbicefmljcmpeof)

**2.** Run the setup wizard

```bash
npx vibe-annotations-server init
```

One interactive command installs the global server, starts it in the background, and configures your AI coding agent (Claude Code, Cursor, Windsurf, Codex, OpenClaw, VS Code). For Claude Code it also offers the [Vibe Annotations mod](packages/claude-mod): new annotations show above the prompt and go to Claude in one press. Prefer manual? See [Installation](https://vibe-annotations.com/docs/installation).

Using only Claude Code? The mod alone is enough, since it starts the server for you:

```bash
claude plugin install vibe-annotations --marketplace RaphaelRegnier/vibe-annotations
```

**3.** Open a localhost page, click **Annotate**. You can annotate multiple pages on your web app. Then:

A (recommended) - [Use the MCP](https://vibe-annotations.com/docs/mcp-setup) to implement your Annotations

B - Copy to your clipboard: **View all** > **Copy** and send to your AI coding agent.

## Documentation

Full docs at [**vibe-annotations.com/docs**](https://vibe-annotations.com/docs) — including [installation](https://vibe-annotations.com/docs/installation), [MCP setup](https://vibe-annotations.com/docs/mcp-setup), [workflows](https://vibe-annotations.com/docs/workflows), [architecture](https://vibe-annotations.com/docs/architecture), and [troubleshooting](https://vibe-annotations.com/docs/troubleshooting).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs welcome.

## License

[PolyForm Shield 1.0.0](https://polyformproject.org/licenses/shield/1.0.0) — see [LICENSE](LICENSE) and [NOTICE](NOTICE).
