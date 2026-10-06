import { expect, mock, test } from 'claude-code/testing'

import { buildPrompt, toAnnotations } from '../hooks/register.tsx'

const ANNOTATIONS = [
  { id: 'a1', url: 'http://localhost:3000/', comment: 'Make the Users card blue', selector: '#c2', status: 'pending' },
  { id: 'a2', url: 'http://localhost:3000/', comment: 'Rename Upgrade to Go Pro', selector: '#cta', status: 'pending' },
  { id: 'a3', url: 'http://localhost:3000/', comment: 'done already', selector: '#c1', status: 'completed' },
]

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

test('band lists new annotations and Implement sends them as one prompt', async ($, on) => {
  let served = ANNOTATIONS
  const prompts: string[] = []
  on('http.fetch', async () => ({
    value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ annotations: served }) },
  }) as never)
  on('ui.render', async ($, e) => { const { Text } = $.ui.resolve(e); return <Text>engine</Text> })
  on('prompt.submit', async ($, e) => {
    prompts.push(e.text)
    return { text: e.text }
  })

  on('command.register', async () => ({ value: undefined }) as never)
  const clock = mock.clock(on)
  on('ui.toast', async () => ({ value: undefined }) as never)
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'vibe-annotations', surface, ...BAND })
    if (surface === 'terminal') {
      expect(await ui.find({ type: 'Text', text: /2 new annotations on localhost:3000/ })).toBeDefined()
      await ui.press({ key: 'implement' })
      await clock.advance(1)
      expect(prompts.length).toBe(1)
      expect(prompts[0]).toContain('[a1]')
      expect(prompts[0]).toContain('Rename Upgrade to Go Pro')
      expect(prompts[0]).not.toContain('done already')
    }
    // Sent annotations leave the band: nothing new to show.
    expect(await ui.find({ type: 'Text', text: /new annotation/ })).toBeUndefined()
    await ui.unmount()
  }

  // A second press with nothing new sends nothing.
  const r = await $.command.run({ command: 'vibe', args: '' } as never)
  await clock.advance(1)
  expect(r.text).toContain('No new Vibe annotations')
  expect(prompts.length).toBe(1)

  // Auto-send: a new annotation goes out on its own.
  await $.command.run({ command: 'vibe', args: 'auto on' } as never)
  served = [...ANNOTATIONS, { id: 'a4', url: 'http://localhost:3000/', comment: 'Bigger title', selector: '#title', status: 'pending' }]
  await $.command.run({ command: 'vibe', args: '' } as never)
  await clock.advance(1)
  expect(prompts.length).toBe(2)
  expect(prompts[1]).toContain('[a4]')
  expect(prompts[1]).not.toContain('[a1]')
})

test('reports when the Vibe server is down', async ($, on) => {
  const clock = mock.clock(on)
  on('http.fetch', async () => { throw new Error('ECONNREFUSED') })
  const r = await $.command.run({ command: 'vibe', args: '' } as never)
  await clock.advance(1)
  expect(r.text).toContain('not reachable')
})

test('a send from the extension hands over only that page origin', async ($, on) => {
  const annotations = [
    ...ANNOTATIONS,
    { id: 'b1', url: 'http://localhost:4000/', comment: 'Other app', selector: '#x', status: 'pending' },
  ]
  let sends = [{ origin: 'http://localhost:3000' }]
  const prompts: string[] = []
  on('http.fetch', async ($, e) => {
    const body = e.url.includes('/api/claude/inbox')
      ? (() => { const r = { sends }; sends = []; return r })()
      : { annotations }
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(body) } } as never
  })
  on('prompt.submit', async ($, e) => {
    prompts.push(e.text)
    return { text: e.text }
  })
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
  const clock = mock.clock(on)
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  await clock.advance(1)

  expect(prompts.length).toBe(1)
  expect(prompts[0]).toContain('[a1]')
  expect(prompts[0]).toContain('[a2]')
  expect(prompts[0]).not.toContain('[b1]')

  // The send was taken: later polls send nothing more.
  await clock.advance(5000)
  expect(prompts.length).toBe(1)
})

test('band and Implement only cover the sites the server routes to this session', async ($, on) => {
  const annotations = [
    ...ANNOTATIONS,
    { id: 'b1', url: 'http://localhost:4000/', comment: 'Other app', selector: '#x', status: 'pending' },
    { id: 'b2', url: 'http://localhost:5000/', comment: 'Third app', selector: '#y', status: 'pending' },
  ]
  let routed: string[] = []
  const inboxUrls: string[] = []
  const prompts: string[] = []
  on('http.fetch', async ($, e) => {
    const isInbox = e.url.includes('/api/claude/inbox')
    if (isInbox) inboxUrls.push(e.url)
    const body = isInbox ? { sends: [], sites: routed } : { annotations }
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(body) } } as never
  })
  on('ui.render', async ($, e) => { const { Text } = $.ui.resolve(e); return <Text>engine</Text> })
  on('prompt.submit', async ($, e) => {
    prompts.push(e.text)
    return { text: e.text }
  })
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
  const clock = mock.clock(on)
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  await $.session.start({ cwd: '/work/app', surface: 'terminal', isInteractive: true } as never)

  // The session tells the server who it is and where it works.
  expect(inboxUrls[0]).toMatch(/session=[^&]+&cwd=%2Fwork%2Fapp/)

  // Nothing routed here yet: other apps' annotations stay out of the band.
  let ui = await $.ui.mount({ plugin: 'vibe-annotations', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: /new annotation/ })).toBeUndefined()
  await ui.unmount()

  routed = ['http://localhost:3000']
  await clock.advance(2000)
  ui = await $.ui.mount({ plugin: 'vibe-annotations', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: /2 new annotations on localhost:3000/ })).toBeDefined()
  await ui.press({ key: 'implement' })
  await clock.advance(1)
  expect(prompts.length).toBe(1)
  expect(prompts[0]).toContain('[a1]')
  expect(prompts[0]).not.toContain('[b1]')
  expect(prompts[0]).not.toContain('[b2]')
  await ui.unmount()
})

test('a send with ids hands over just those, and a thread waits on the user', async ($, on) => {
  let annotations: Record<string, unknown>[] = [
    ...ANNOTATIONS,
    { id: 'c1', url: 'http://localhost:3000/', comment: 'Swap the icon', selector: '#i', status: 'pending', thread: [{ author: 'agent', body: 'Which icon?' }] },
  ]
  let sends: Record<string, unknown>[] = [{ origin: 'http://localhost:3000', ids: ['a2'] }]
  const prompts: string[] = []
  on('http.fetch', async ($, e) => {
    const body = e.url.includes('/api/claude/inbox')
      ? (() => { const r = { sends }; sends = []; return r })()
      : { annotations }
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(body) } } as never
  })
  on('prompt.submit', async ($, e) => {
    prompts.push(e.text)
    return { text: e.text }
  })
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.toast', async () => ({ value: undefined }) as never)
  const clock = mock.clock(on)
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  await clock.advance(1)

  // Only the annotation sent from the popover goes out.
  expect(prompts.length).toBe(1)
  expect(prompts[0]).toContain('[a2]')
  expect(prompts[0]).not.toContain('[a1]')
  expect(prompts[0]).toContain('reply_to_annotation')

  // Implement leaves out c1: Claude asked a question, the user hasn't answered.
  await $.command.run({ command: 'vibe', args: '' } as never)
  await clock.advance(1)
  expect(prompts[1]).toContain('[a1]')
  expect(prompts[1]).not.toContain('[c1]')

  // The user answers: c1 is new again, with the conversation in the prompt.
  annotations = annotations.map(a => a.id === 'c1'
    ? { ...a, thread: [{ author: 'agent', body: 'Which icon?' }, { author: 'user', body: 'The rocket' }] }
    : a)
  await $.command.run({ command: 'vibe', args: '' } as never)
  await clock.advance(1)
  expect(prompts.length).toBe(3)
  expect(prompts[2]).toContain('[c1]')
  expect(prompts[2]).toContain('user replied: The rocket')
})

test('a text edit reads as the copy change', async () => {
  const [a] = toAnnotations([
    { id: 't1', url: 'http://localhost:3000/', comment: '', selector: 'h1', status: 'pending', kind: 'text', pending_changes: { copyChange: { original: 'Hello', value: 'Hi there' } } },
  ])
  expect(buildPrompt([a!])).toContain('change the text "Hello" to "Hi there"')
})
