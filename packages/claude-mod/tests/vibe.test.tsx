import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

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

test('reports when the Vibe server is down', { options: { autoStartServer: false } }, async ($, on) => {
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

// A server that is down until a start command ran. `startWorks` decides
// whether running a command brings it up.
function downServer(on: Parameters<TestBody>[1], startWorks: (argv: readonly string[]) => boolean) {
  let up = false
  const runs: string[][] = []
  const toasts: string[] = []
  on('http.fetch', async () => {
    if (!up) throw new Error('ECONNREFUSED')
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ annotations: ANNOTATIONS, sends: [] }) } } as never
  })
  on('process.run', async ($, e) => {
    runs.push([...e.argv])
    if (!startWorks(e.argv)) throw new Error('ENOENT')
    up = true
    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })
  on('env.get', async () => ({ value: '/bin/zsh' }) as never)
  on('ui.render', async ($, e) => { const { Text } = $.ui.resolve(e); return <Text>engine</Text> })
  on('ui.toast', async ($, e) => { toasts.push(String(e.text ?? e)); return { value: undefined } as never })
  on('command.register', async () => ({ value: undefined }) as never)
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  return { runs, toasts }
}

test('starts the server detached when a session starts and it is down', async ($, on) => {
  const { runs, toasts } = downServer(on, () => true)
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  await clock.advance(1)
  expect(runs).toEqual([['vibe-annotations-server', 'start', '--daemon']])
  expect(toasts.some(t => t.includes('Started the Vibe Annotations server'))).toBe(true)
  const ui = await $.ui.mount({ plugin: 'vibe-annotations', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: /2 new annotations/ })).toBeDefined()
  await ui.unmount()
})

test('falls back to a login shell when neither a global install nor npx is on PATH', async ($, on) => {
  const { runs } = downServer(on, argv => argv[0] === '/bin/zsh')
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  await clock.advance(1)
  expect(runs.map(r => r[0])).toEqual(['vibe-annotations-server', 'npx', '/bin/zsh'])
  expect(runs[2]).toEqual(['/bin/zsh', '-lc', 'command -v vibe-annotations-server >/dev/null && vibe-annotations-server start --daemon || npx -y vibe-annotations-server@latest start --daemon'])
})

test('says so in the band when it cannot start the server, and Retry tries again', async ($, on) => {
  const { runs } = downServer(on, () => false)
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  await clock.advance(1)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'vibe-annotations', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: /couldn't start the annotations server/ })).toBeDefined()
    await ui.unmount()
  }
  expect(runs.length).toBe(3)
  const ui = await $.ui.mount({ plugin: 'vibe-annotations', surface: 'terminal', ...BAND })
  await ui.press({ key: 'start' })
  await clock.advance(1)
  expect(runs.length).toBe(6)
  await ui.unmount()
})

test('leaves the server alone when auto-start is off', { options: { autoStartServer: false } }, async ($, on) => {
  const { runs } = downServer(on, () => true)
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  await clock.advance(5000)
  expect(runs.length).toBe(0)
  const r = await $.command.run({ command: 'vibe', args: '' } as never)
  expect(r.text).toContain('/vibe start')
})

// A running server that predates the inbox route (it answers 404) until a
// start brings up the new release. `hasPidFile` false: started by hand, so
// `stop` can't reach it.
function oldServer(on: Parameters<TestBody>[1], { hasPidFile }: { hasPidFile: boolean }) {
  let up = true
  let isNew = false
  const runs: string[] = []
  const toasts: string[] = []
  on('http.fetch', async ($, e) => {
    if (!up) throw new Error('ECONNREFUSED')
    const isInbox = e.url.includes('/api/claude/inbox')
    if (isInbox && !isNew) return { value: { status: 404, ok: false, headers: {}, text: 'Cannot GET' } } as never
    const body = isInbox ? { sends: [], sites: ['http://localhost:3000'] } : { annotations: ANNOTATIONS }
    return { value: { status: 200, ok: true, headers: {}, text: JSON.stringify(body) } } as never
  })
  on('process.run', async ($, e) => {
    const argv = e.argv.join(' ')
    runs.push(argv)
    if (argv.endsWith(' stop') && hasPidFile) up = false
    if (argv.endsWith('start --daemon')) { up = true; isNew = true }
    return { value: { exitCode: 0, stdout: '', stderr: '' } } as never
  })
  on('env.get', async () => ({ value: undefined }) as never)
  on('ui.render', async ($, e) => { const { Text } = $.ui.resolve(e); return <Text>engine</Text> })
  on('ui.toast', async ($, e) => { toasts.push(String(e.text ?? e)); return { value: undefined } as never })
  on('command.register', async () => ({ value: undefined }) as never)
  on('session.start', async ($, e) => ({ cwd: e.cwd }) as never)
  return { runs, toasts }
}

test('flags an outdated server, and Update installs, stops and restarts it', async ($, on) => {
  const { runs, toasts } = oldServer(on, { hasPidFile: true })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)

  let ui = await $.ui.mount({ plugin: 'vibe-annotations', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: /annotations server is out of date/ })).toBeDefined()
  // The old server still serves annotations: the band keeps working meanwhile.
  expect(await ui.find({ type: 'Text', text: /2 new annotations/ })).toBeDefined()
  await ui.press({ key: 'update' })
  await clock.advance(1)
  await ui.unmount()

  expect(runs).toEqual([
    'vibe-annotations-server --version',
    'npm install -g vibe-annotations-server@latest',
    'vibe-annotations-server stop',
    'vibe-annotations-server start --daemon',
  ])
  expect(toasts.some(t => t.includes('Updated the Vibe Annotations server'))).toBe(true)
  ui = await $.ui.mount({ plugin: 'vibe-annotations', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: /out of date/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /2 new annotations on localhost:3000/ })).toBeDefined()
  await ui.unmount()
})

test('asks to stop a server started by hand instead of starting a second one', async ($, on) => {
  const { runs } = oldServer(on, { hasPidFile: false })
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  const ui = await $.ui.mount({ plugin: 'vibe-annotations', surface: 'terminal', ...BAND })
  await ui.press({ key: 'update' })
  await clock.advance(10_000)
  await ui.unmount()
  expect(runs.some(r => r.includes('start --daemon'))).toBe(false)
  const desktop = await $.ui.mount({ plugin: 'vibe-annotations', surface: 'desktop', ...BAND })
  expect(await desktop.find({ type: 'Text', text: /stop the annotations server you started by hand/ })).toBeDefined()
  await desktop.unmount()
})
