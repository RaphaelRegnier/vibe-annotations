# Vibe Annotations for Claude Code (prototype)

A Claude Code mod that turns Vibe Annotations into a hands-free loop without the
`watch_annotations` MCP tool. It polls the local Vibe server in the background
(no model turns, no tokens), shows new annotations in a band above the prompt,
and hands them to Claude as one prompt when you press **Implement**.

```
● 2 new annotations on localhost:3000  [Implement] [View] [Auto-send: off]
> _
```

- **Implement** sends every new annotation (URL, selector, comment, id) as one
  prompt. Claude implements them and deletes each one when done.
- **View** opens a side pane listing open annotations.
- **Auto-send** sends new annotations as soon as they land, once the session is idle.
- After each turn, a toast flags annotations Claude was given but left open.
- `/vibe` sends new annotations, `/vibe list` opens the pane, `/vibe auto on|off`
  toggles auto-send.

Claude Code only. MCP stays the base for every other agent; the prompt still
tells Claude to use the MCP `delete_annotation` tool when it's connected.

## Try it

```bash
npx vibe-annotations-server start          # or node packages/server/lib/server.js
claude --plugin-dir /path/to/vibe-annotations/packages/claude-mod
```

Annotate something in the browser; the band appears within a few seconds.

## Develop

```bash
claude plugin validate packages/claude-mod
claude plugin test packages/claude-mod     # tests/vibe.test.tsx
```

Needs Claude Code 2.1.288 or newer (the mod API is early access and may change).

## Not done yet

- A "Send to Claude" button in the extension toolbar. The mod already picks up
  anything new, so the button would only add an explicit hand-off flag on the server.
- Shipping it with `vibe-annotations-server init` as a Claude Code plugin.
- Scoping to the current project's localhost port (today it shows all open annotations).
