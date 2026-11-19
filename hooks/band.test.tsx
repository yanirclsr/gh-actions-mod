import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'gh-actions',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const run = (id: number, extra = {}) => ({
  id,
  name: 'test',
  branch: 'main',
  status: 'in_progress',
  conclusion: '',
  startedAt: 1_000,
  finishedAt: 0,
  ...extra,
})

const seed = (runs: unknown[]) => (_: unknown, e: { key: string }) => ({
  value: { value: e.key === 'runs' ? runs : e.key === 'scope' ? 'branch' : 61_000, version: 1 },
})

for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
  test(`the band lists an active run on ${surface}`, async ($, on) => {
    on('state.get', seed([run(1)]))

    const ui = await $.ui.mount({ ...BAND, surface })

    expect((await ui.find({ type: 'Text', text: /test · main · 1m 00s · in_progress/ }))?.text).toBeTruthy()
    expect(await ui.find({ key: 'scope' })).toBeTruthy()
    await ui.unmount()
  })
}

test('the band shows three runs and a counter', async ($, on) => {
  on('state.get', seed([run(1), run(2), run(3), run(4), run(5)]))

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect((await ui.find({ type: 'Text', text: /\+2 more/ }))?.text).toBeTruthy()
  await ui.unmount()
})

test('the band draws nothing with no runs', async ($, on) => {
  on('state.get', seed([]))

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })

  expect(await ui.find({ type: 'Text', text: /Actions/ })).toBeFalsy()
  await ui.unmount()
})
