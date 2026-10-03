import { expect, mock, test } from 'claude-code/testing'

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
