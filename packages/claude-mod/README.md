# Vibe Annotations for Claude Code

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
- **Auto-send** sends new annotations as soon as they land, even mid-turn.
- **Send to Claude** in the extension toolbar sends that site's new annotations
  right away. The button only shows while the server is up and this mod is
  polling it (the mod checks in at `/api/claude/inbox` every 2s).
- Several Claude sessions can run at once, each on its own app. The server
  routes each site to one session: the session whose folder holds the dev
  server on that port (found with `lsof`, macOS/Linux), else the session it was
  last sent to, else the only session. If none of those settles it, Send asks
  which session. Each band only shows its own sites.
- After each turn, a toast flags annotations Claude was given but left open.
- `/vibe` sends new annotations, `/vibe list` opens the pane, `/vibe auto on|off`
  toggles auto-send.

- When a session starts and the Vibe server isn't running, the mod starts it in
  the background (`vibe-annotations-server start --daemon`, or the latest
  release through npx). Turn this off with the `autoStartServer` option in
  `/plugin`. `/vibe start` starts it by hand.

Claude Code only. MCP stays the base for every other agent; the prompt still
tells Claude to use the MCP `delete_annotation` tool when it's connected.

## Install

`npx vibe-annotations-server init` offers it when you pick Claude Code. Or install
it on its own, from a shell:

```bash
claude plugin install vibe-annotations --marketplace RaphaelRegnier/vibe-annotations
```

or at the prompt of a terminal session:

```
/plugin install vibe-annotations --marketplace RaphaelRegnier/vibe-annotations
```

In the desktop app, where `/plugin` doesn't run: click **+** next to the prompt
box, then **Plugins**, **Add marketplace** with `RaphaelRegnier/vibe-annotations`,
then **Add plugin**. A plugin installed from a terminal also loads in the
desktop app's local sessions.

Then install the [browser extension](https://chromewebstore.google.com/detail/gkofobaeeepjopdpahbicefmljcmpeof),
open your localhost app and annotate: the band appears within a few seconds.
Needs Claude Code 2.1.287 or newer, and Node.js for the server.

## Develop

```bash
node packages/server/lib/server.js                       # this checkout's server
claude --plugin-dir /path/to/vibe-annotations/packages/claude-mod
claude plugin validate packages/claude-mod
claude plugin test packages/claude-mod                   # tests/vibe.test.tsx
```

The repo root's `.claude-plugin/marketplace.json` is what `--marketplace
RaphaelRegnier/vibe-annotations` reads, from the default branch.

## Not done yet

- Port matching needs the dev server to run locally; sites behind Docker or a
  proxy route by Send instead.
