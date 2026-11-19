import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'gh-actions',
  component: 'Pane',
  requestId: 'gh-actions',
  props: {
    title: 'GitHub Actions',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

const run = (id: number) => ({
  id,
  name: 'test',
  branch: 'main',
  status: 'in_progress',
  conclusion: '',
  startedAt: 1_000,
  finishedAt: 0,
})

const seed = (runs: unknown[]) => (_: unknown, e: { key: string }) => ({
  value: { value: e.key === 'runs' ? runs : e.key === 'scope' ? 'branch' : 61_000, version: 1 },
})

for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
  test(`the pane lists a run and the scope button on ${surface}`, async ($, on) => {
    on('state.get', seed([run(1)]))

    const ui = await $.ui.mount({ ...PANE, surface })

    expect((await ui.find({ type: 'Text', text: /test · main · 1m 00s · in_progress/ }))?.text).toBeTruthy()
    expect(await ui.find({ key: 'scope' })).toBeTruthy()
    await ui.unmount()
  })

  test(`the pane says no active runs on ${surface}`, async ($, on) => {
    on('state.get', seed([]))

    const ui = await $.ui.mount({ ...PANE, surface })

    expect((await ui.find({ type: 'Text', text: /No active runs/ }))?.text).toBeTruthy()
    await ui.unmount()
  })
}
