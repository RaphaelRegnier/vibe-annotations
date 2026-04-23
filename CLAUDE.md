# Vibe Annotations — Monorepo

Visual annotations for localhost dev projects. Send feedback to AI coding agents via MCP.

## Repo structure

```
packages/
  extension/     Chrome extension — vanilla JS, no build step
  server/        MCP server — npm package (vibe-annotations-server)
  website/       Marketing site & docs — Next.js, deployed on Vercel
```

This is a **pnpm workspace**. One `pnpm install` at the root resolves everything.

## Quick commands

```bash
pnpm install              # install all deps
pnpm dev:web              # run website dev server (Next.js)
pnpm build:web            # build website for production
```

The extension has no build step — load `packages/extension/` as an unpacked extension in Chrome.

## How the pieces relate

1. The **Chrome extension** injects a toolbar overlay on localhost pages. Users click elements to annotate them with comments and design changes.
2. Annotations sync to the **vibe-annotations-server** (npm package, runs locally on port 3846), which exposes an MCP endpoint.
3. AI coding agents (Claude Code, Cursor, etc.) connect via MCP to read annotations and implement fixes.
4. The **website** hosts docs and marketing at vibeannotations.com.

## Package-specific context

Each package has its own CLAUDE.md with detailed architecture, file layout, and dev commands. Start there when working on a specific package.
