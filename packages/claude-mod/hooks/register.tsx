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

export function buildPrompt(list: VibeAnnotation[]): string {
  const lines = list.map((a, i) =>
    `${i + 1}. [${a.id}] ${a.url}\n   element: ${a.selector}\n   feedback: ${a.comment || '(design edit, see read_annotations)'}`,
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
    if (!res.ok) throw new Error(String(res.status))
    const body: { sends?: { origin?: string }[], sites?: string[] } = JSON.parse(res.text)
    await update($, isScoped, () => Array.isArray(body.sites))
    await update($, sites, () => body.sites ?? [])
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

async function fresh($: EngineInterface): Promise<VibeAnnotation[]> {
  const sent = new Set(await read($, sentIds))
  return (await onSite($)).filter(a => !sent.has(a.id))
}

// $.prompt.submit can't run inside a command.run hook (it would wait on the
// turn that hook holds), so hand-offs always go out on the next clock tick.
async function sendNew($: EngineInterface, why: 'auto' | 'press' | 'browser', origins?: string[]): Promise<number> {
  const list = (await fresh($)).filter(a => !origins || origins.includes(originOf(a.url)))
  if (list.length === 0) return 0
  await update($, sentIds, ids => [...ids, ...list.map(a => a.id)])
  if (why !== 'press') $.ui.toast(`Sending ${list.length} annotation${list.length === 1 ? '' : 's'} to Claude`)
  const text = buildPrompt(list)
  $.clock.after(0, () => { void $.prompt.submit({ text }) })
  return list.length
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    if (!(await read($, sessionId))) {
      await update($, sessionId, () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`)
    }
    await update($, cwd, () => e.cwd ?? '')
    await $.command.register({
      name: 'vibe',
      description: 'Vibe Annotations: implement new ones, list them, or turn auto-send on/off (/vibe auto on)',
    })
    await poll($)
    $.clock.every(POLL_MS, () => poll($))
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
    if (args === 'list') {
      await $.ui.open({ id: PANE, title: 'Vibe Annotations' })
      return { text: 'Opened the Vibe Annotations pane.' }
    }
    await poll($)
    const n = await sendNew($, 'press')
    if (!(await read($, isOnline))) return { text: `Vibe server is not reachable at ${SERVER}.` }
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
    const list = await fresh($)
    const auto = await read($, autoSend)
    if (list.length === 0 && !auto) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const label = list.length === 0
      ? 'Vibe: watching for annotations'
      : `● ${list.length} new annotation${list.length === 1 ? '' : 's'} on ${hostOf(list)}`

    return (
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
