import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { VibeAnnotation } from '../types'

// Vibe Annotations for Claude Code (prototype).
//
// Polls the local Vibe server's REST API in the background (free: no model
// turn, unlike the watch_annotations MCP loop), shows new annotations in a band
// above the prompt, and hands them to Claude as one prompt when you press
// Implement or run /vibe. With /vibe auto on it sends them as soon as they land.
// Each poll also checks in at /api/claude/inbox, so the extension can show its
// "Send to Claude" button and hand annotations over from the browser. Several
// Claude sessions can run at once: the server routes each site to one session
// (by the project serving its port, or where it was last sent), and the band,
// Implement, auto-send and the pane only cover this session's sites.
// When a session starts and the server is down, the mod starts it in the
// background (off with the autoStartServer option), so installing the mod and
// the extension is all the setup there is.

const SERVER = 'http://127.0.0.1:3846'
const POLL_MS = 2000
const PANE = 'vibe-annotations'

const pending = atom({ plugin: 'vibe-annotations', key: 'pending' } as const, [])
const sentIds = atom({ plugin: 'vibe-annotations', key: 'sentIds' } as const, [])
const autoSend = atom({ plugin: 'vibe-annotations', key: 'autoSend' } as const, false)
const isOnline = atom({ plugin: 'vibe-annotations', key: 'isOnline' } as const, true)
const sites = atom({ plugin: 'vibe-annotations', key: 'sites' } as const, [])
const isScoped = atom({ plugin: 'vibe-annotations', key: 'isScoped' } as const, false)
const sessionId = atom({ plugin: 'vibe-annotations', key: 'sessionId' } as const, '')
const cwd = atom({ plugin: 'vibe-annotations', key: 'cwd' } as const, '')
const serverStart = atom({ plugin: 'vibe-annotations', key: 'serverStart' } as const, 'idle')
const inProgress = atom({ plugin: 'vibe-annotations', key: 'inProgress' } as const, [])
const revised = atom({ plugin: 'vibe-annotations', key: 'revised' } as const, [])
const isOutdated = atom({ plugin: 'vibe-annotations', key: 'isOutdated' } as const, false)
const serverUpdate = atom({ plugin: 'vibe-annotations', key: 'serverUpdate' } as const, 'idle')

type Raw = {
  id?: string
  url?: string
  comment?: string
  selector?: string
  status?: string
  type?: string
  mode?: string
}

export function toAnnotations(raw: Raw[]): VibeAnnotation[] {
  return raw
    .filter(a => a.id && a.status === 'pending' && a.type !== 'stylesheet' && a.mode !== 'variants')
    .map(a => ({
      id: String(a.id),
      url: a.url ?? '',
      comment: (a.comment ?? '').trim(),
      selector: a.selector ?? '',
    }))
}

export function hostOf(list: VibeAnnotation[]): string {
  const hosts = [...new Set(list.map(a => {
    try { return new URL(a.url).host } catch { return a.url }
  }))]
  return hosts.length === 1 ? (hosts[0] ?? '') : `${hosts.length} sites`
}

export function buildPrompt(list: VibeAnnotation[], updated: ReadonlySet<string> = new Set()): string {
  const lines = list.map((a, i) =>
    `${i + 1}. [${a.id}] ${a.url}${updated.has(a.id) ? '\n   UPDATED: you were sent an earlier version; apply it as now written' : ''}\n   element: ${a.selector}\n   feedback: ${a.comment || '(design edit, see read_annotations)'}`,
  )
  return [
    `Implement these ${list.length} Vibe Annotation${list.length === 1 ? '' : 's'} left in the browser:`,
    '',
    ...lines,
    '',
    'Find the source for each element, make the change, then delete the annotation:',
    'use the vibe-annotations MCP tool delete_annotation, or',
    `curl -X DELETE ${SERVER}/api/annotations/<id> if the MCP tools are not connected.`,
    'If an annotation is unclear, skip it and say why.',
  ].join('\n')
}

export function originOf(url: string): string {
  try { return new URL(url).origin } catch { return '' }
}

// Origins the extension asked to send to this session since the last poll, and
// the sites routed to it. An older server without the inbox route just means
// no browser sends and no scoping (every site shows).
async function takeSends($: EngineInterface): Promise<string[]> {
  try {
    const qs = `session=${encodeURIComponent(await read($, sessionId))}&cwd=${encodeURIComponent(await read($, cwd))}`
    const res = await $.http.fetch(`${SERVER}/api/claude/inbox?${qs}`)
    // A server older than the inbox route answers 404: it runs, but can't route
    // sites or take sends from the extension until it's updated.
    await update($, isOutdated, () => res.status === 404)
    if (!res.ok) throw new Error(String(res.status))
    const body: { sends?: { origin?: string }[], sites?: string[], inProgress?: string[], revised?: string[] } = JSON.parse(res.text)
    await update($, isScoped, () => Array.isArray(body.sites))
    await update($, sites, () => body.sites ?? [])
    // What's being worked on comes from the server, so it survives a restart of
    // this session and drops an annotation as soon as it's edited.
    await update($, inProgress, () => body.inProgress ?? [])
    await update($, revised, () => body.revised ?? [])
    return (body.sends ?? []).map(s => s.origin ?? '').filter(Boolean)
  } catch {
    await update($, isScoped, () => false)
    return []
  }
}

// Open annotations on this session's sites.
async function onSite($: EngineInterface): Promise<VibeAnnotation[]> {
  const list = await read($, pending)
  if (!(await read($, isScoped))) return list
  const mine = new Set(await read($, sites))
  return list.filter(a => mine.has(originOf(a.url)))
}

async function poll($: EngineInterface) {
  // Inbox first: the extension syncs before it queues a send, so annotations
  // fetched after this include everything the send covers.
  const origins = await takeSends($)
  try {
    const res = await $.http.fetch(`${SERVER}/api/annotations?status=pending&limit=200`)
    if (!res.ok) throw new Error(String(res.status))
    const list = toAnnotations(JSON.parse(res.text).annotations ?? [])
    await update($, isOnline, () => true)
    await update($, pending, () => list)
    // Forget sent ids that are gone from the server: Claude finished them.
    const live = new Set(list.map(a => a.id))
    await update($, sentIds, ids => ids.filter(id => live.has(id)))
    if (await read($, autoSend)) await sendNew($, 'auto')
    else if (origins.length > 0) {
      const n = await sendNew($, 'browser', origins)
      if (n === 0) $.ui.toast('Nothing new to send from the browser')
    }
  } catch {
    await update($, isOnline, () => false)
  }
}

async function isServerUp($: EngineInterface): Promise<boolean> {
  try { return (await $.http.fetch(`${SERVER}/health`)).ok } catch { return false }
}

const wait = ($: EngineInterface, ms: number) => new Promise<void>(resolve => { $.clock.after(ms, () => resolve()) })

// Starts the server detached (`start --daemon`), so it outlives this session
// and serves every other one. The global install `vibe-annotations-server
// init` set up first, else the latest release through npx, then both again
// through a login shell: an app opened from the Dock (the desktop app) doesn't
// get the PATH where nvm & co put Node.
async function vibeCli($: EngineInterface, args: string[]): Promise<string[][]> {
  const global = ['vibe-annotations-server', ...args]
  const npx = ['npx', '-y', 'vibe-annotations-server@latest', ...args]
  const attempts = [global, npx]
  const shell = await $.env.get('SHELL')
  if (shell) attempts.push([shell, '-lc', `command -v vibe-annotations-server >/dev/null && ${global.join(' ')} || ${npx.join(' ')}`])
  return attempts
}

// Runs the first of `attempts` that starts and exits 0.
async function runFirst($: EngineInterface, attempts: string[][], timeoutMs = 120_000): Promise<boolean> {
  for (const argv of attempts) {
    try {
      if ((await $.process.run(argv, { timeoutMs })).exitCode === 0) return true
    } catch { /* not on PATH: try the next */ }
  }
  return false
}

// The same command directly, then through a login shell (see above).
async function withShell($: EngineInterface, argv: string[]): Promise<string[][]> {
  const shell = await $.env.get('SHELL')
  return shell ? [argv, [shell, '-lc', argv.join(' ')]] : [argv]
}

let starting: Promise<boolean> | null = null

function startServer($: EngineInterface): Promise<boolean> {
  starting ??= (async () => {
    await update($, serverStart, () => 'starting')
    for (const argv of await vibeCli($, ['start', '--daemon'])) {
      try { await $.process.run(argv, { timeoutMs: 120_000 }) } catch { continue }
      for (let i = 0; i < 6; i++) {
        if (await isServerUp($)) {
          await update($, serverStart, () => 'idle')
          $.ui.toast('Started the Vibe Annotations server')
          await poll($)
          return true
        }
        await wait($, 500)
      }
    }
    await update($, serverStart, () => 'failed')
    return false
  })().finally(() => { starting = null })
  return starting
}

// Brings an outdated server up to the latest release: updates the global
// install if there is one (npx fetches the latest by itself), stops the old
// server through its pid file, then starts the new one. A server started by
// hand (`node server.js`) has no pid file: the band asks to stop it instead.
let updating: Promise<void> | null = null

function updateServer($: EngineInterface): Promise<void> {
  updating ??= (async () => {
    await update($, serverUpdate, () => 'updating')
    const hasGlobal = await runFirst($, await withShell($, ['vibe-annotations-server', '--version']), 30_000)
    if (hasGlobal) await runFirst($, await withShell($, ['npm', 'install', '-g', 'vibe-annotations-server@latest']), 300_000)
    await runFirst($, await vibeCli($, ['stop']), 60_000)
    for (let i = 0; i < 10 && await isServerUp($); i++) await wait($, 500)
    if (await isServerUp($)) {
      await update($, serverUpdate, () => 'stop-by-hand')
      return
    }
    await update($, isOnline, () => false)
    const started = await startServer($)
    await poll($)
    const ok = started && !(await read($, isOutdated))
    await update($, serverUpdate, () => ok ? 'idle' : 'failed')
    if (ok) $.ui.toast('Updated the Vibe Annotations server')
  })().finally(() => { updating = null })
  return updating
}

// Not handed to Claude yet: the server's in-progress list where it keeps one,
// else (an older server) what this session sent.
async function fresh($: EngineInterface): Promise<VibeAnnotation[]> {
  const busy = new Set((await read($, isScoped)) ? await read($, inProgress) : await read($, sentIds))
  return (await onSite($)).filter(a => !busy.has(a.id))
}

// Tell the server, so the extension shows them in progress and the next
// session doesn't send them again.
async function markSent($: EngineInterface, ids: string[]) {
  try {
    await $.http.fetch(`${SERVER}/api/claude/sent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: await read($, sessionId), ids }),
    })
  } catch { /* older server or offline: this session's own list still holds them */ }
}

// $.prompt.submit can't run inside a command.run hook (it would wait on the
// turn that hook holds), so hand-offs always go out on the next clock tick.
async function sendNew($: EngineInterface, why: 'auto' | 'press' | 'browser', origins?: string[]): Promise<number> {
  const list = (await fresh($)).filter(a => !origins || origins.includes(originOf(a.url)))
  if (list.length === 0) return 0
  const ids = list.map(a => a.id)
  await update($, sentIds, prev => [...prev, ...ids])
  await update($, inProgress, prev => [...prev, ...ids]) // until the next poll confirms
  if (why !== 'press') $.ui.toast(`Sending ${list.length} annotation${list.length === 1 ? '' : 's'} to Claude`)
  const text = buildPrompt(list, new Set(await read($, revised)))
  void markSent($, ids)
  $.clock.after(0, () => { void $.prompt.submit({ text }) })
  return list.length
}

// The band's row about an outdated server, or null when it's current.
async function outdatedRow($: EngineInterface, e: Parameters<EngineInterface['ui']['resolve']>[0]) {
  const state = await read($, serverUpdate)
  if (!(await read($, isOutdated)) && state !== 'updating') return null
  const { Box, Button, Text } = $.ui.resolve(e)
  if (state === 'updating') return <Text dimColor>Vibe: updating the annotations server…</Text>
  const text = state === 'stop-by-hand'
    ? 'Vibe: stop the annotations server you started by hand, then press Update again'
    : state === 'failed'
      ? "Vibe: couldn't update the server. Run npm install -g vibe-annotations-server@latest, then vibe-annotations-server restart"
      : 'Vibe: the annotations server is out of date. Update it to send from the browser'
  return (
    <Box flexDirection="row" gap={1}>
      <Text color="yellow">{text}</Text>
      <Button key="update" label="Update" onPress={() => { void updateServer($) }} />
    </Box>
  )
}

export const register: Register = (on, options) => {
  const autoStart = options.autoStartServer !== false

  on('session.start', async ($, e, next) => {
    if (!(await read($, sessionId))) {
      await update($, sessionId, () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`)
    }
    await update($, cwd, () => e.cwd ?? '')
    await $.command.register({
      name: 'vibe',
      description: 'Vibe Annotations: implement new ones, list them (/vibe list), auto-send (/vibe auto on|off), start the server (/vibe start)',
    })
    await poll($)
    $.clock.every(POLL_MS, () => poll($))
    // Once per session start, not on every drop: someone who stops the server
    // on purpose shouldn't see it come back two seconds later.
    if (autoStart && !(await read($, isOnline))) void startServer($)
    return next(e)
  })

  on('command.run', { command: 'vibe' }, async ($, e) => {
    const args = (e.args ?? '').trim().toLowerCase()
    if (args === 'auto on' || args === 'auto off') {
      const isOn = args === 'auto on'
      await update($, autoSend, () => isOn)
      if (isOn) await sendNew($, 'auto')
      return { text: `Vibe auto-send is ${isOn ? 'on: new annotations go to Claude as they arrive' : 'off'}.` }
    }
    if (args === 'start') {
      if (await isServerUp($)) return { text: `Vibe server is already running at ${SERVER}.` }
      void startServer($)
      return { text: 'Starting the Vibe server…' }
    }
    if (args === 'list') {
      await $.ui.open({ id: PANE, title: 'Vibe Annotations' })
      return { text: 'Opened the Vibe Annotations pane.' }
    }
    await poll($)
    const n = await sendNew($, 'press')
    if (!(await read($, isOnline))) return { text: `Vibe server is not reachable at ${SERVER}. Run /vibe start to start it.` }
    return { text: n === 0 ? 'No new Vibe annotations.' : `Sent ${n} annotation${n === 1 ? '' : 's'} to Claude.` }
  })

  // After each turn, flag annotations Claude was given but left open.
  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    await poll($)
    const sent = new Set(await read($, sentIds))
    const open = (await read($, pending)).filter(a => sent.has(a.id)).length
    if (open > 0) $.ui.toast(`${open} sent annotation${open === 1 ? ' is' : 's are'} still open in Vibe`)
    return ran
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const start = await read($, serverStart)
    if (start !== 'idle' && !(await read($, isOnline))) {
      const { Box, Button, Text } = $.ui.resolve(e)
      return start === 'starting'
        ? <Text dimColor>Vibe: starting the annotations server…</Text>
        : (
          <Box flexDirection="row" gap={1}>
            <Text color="yellow">Vibe: couldn't start the annotations server (it needs Node.js)</Text>
            <Button key="start" label="Retry" onPress={() => { void startServer($) }} />
          </Box>
        )
    }
    const list = await fresh($)
    const auto = await read($, autoSend)
    const outdated = await outdatedRow($, e)
    if (list.length === 0 && !auto) return outdated ?? next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const label = list.length === 0
      ? 'Vibe: watching for annotations'
      : `● ${list.length} new annotation${list.length === 1 ? '' : 's'} on ${hostOf(list)}`

    const row = (
      <Box flexDirection="row" gap={1}>
        <Text color={list.length ? 'magenta' : undefined} dimColor={list.length === 0}>{label}</Text>
        {list.length > 0 && (
          <Button key="implement" label="Implement" onPress={() => { void sendNew($, 'press') }} />
        )}
        {list.length > 0 && (
          <Button key="view" label="View" onPress={() => { void $.ui.open({ id: PANE, title: 'Vibe Annotations' }) }} />
        )}
        <Button
          key="auto"
          label={auto ? 'Auto-send: on' : 'Auto-send: off'}
          onPress={() => update($, autoSend, v => !v)}
        />
      </Box>
    )
    return outdated ? <Box flexDirection="column">{outdated}{row}</Box> : row
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await onSite($)
    const sent = new Set(await read($, sentIds))
    return (
      <Box flexDirection="column">
        {list.length === 0 && <Text dimColor>No open annotations.</Text>}
        {list.map(a => (
          <Box key={a.id} flexDirection="column">
            <Text bold>{sent.has(a.id) ? 'sent' : 'new'} · {a.selector}</Text>
            <Text>{a.comment || '(design edit)'}</Text>
            <Text dimColor>{a.url}</Text>
          </Box>
        ))}
      </Box>
    )
  })
}
