import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { VibeAnnotation } from '../types'

// Vibe Annotations for Claude Code (prototype).
//
// Polls the local Vibe server's REST API in the background (free: no model
// turn, unlike the watch_annotations MCP loop), shows new annotations in a band
// above the prompt, and hands them to Claude as one prompt when you press
// Implement or run /vibe. With /vibe auto on it sends them as soon as they land.

const SERVER = 'http://127.0.0.1:3846'
const POLL_MS = 4000
const PANE = 'vibe-annotations'

const pending = atom({ plugin: 'vibe-annotations', key: 'pending' } as const, [])
const sentIds = atom({ plugin: 'vibe-annotations', key: 'sentIds' } as const, [])
const autoSend = atom({ plugin: 'vibe-annotations', key: 'autoSend' } as const, false)
const isOnline = atom({ plugin: 'vibe-annotations', key: 'isOnline' } as const, true)

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

async function poll($: EngineInterface) {
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
  } catch {
    await update($, isOnline, () => false)
  }
}

async function fresh($: EngineInterface): Promise<VibeAnnotation[]> {
  const sent = new Set(await read($, sentIds))
  return (await read($, pending)).filter(a => !sent.has(a.id))
}

// $.prompt.submit can't run inside a command.run hook (it would wait on the
// turn that hook holds), so hand-offs always go out on the next clock tick.
async function sendNew($: EngineInterface, why: 'auto' | 'press'): Promise<number> {
  const list = await fresh($)
  if (list.length === 0) return 0
  await update($, sentIds, ids => [...ids, ...list.map(a => a.id)])
  if (why === 'auto') $.ui.toast(`Sending ${list.length} annotation${list.length === 1 ? '' : 's'} to Claude`)
  const text = buildPrompt(list)
  $.clock.after(0, () => { void $.prompt.submit({ text }) })
  return list.length
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
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
    const list = await read($, pending)
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
