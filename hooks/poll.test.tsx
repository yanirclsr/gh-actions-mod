import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'gh-actions',
  component: 'AbovePrompt',
  surface: 'terminal',
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

const ok = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })

test('a queued run found by gh run list reaches the band', async ($, on) => {
  const calls: string[] = []
  on('process.run', (_, e: { argv: readonly string[] }) => {
    calls.push(e.argv.slice(0, 3).join(' '))
    if (e.argv[0] === 'git') return ok('feature\n')
    if (e.argv[1] === 'repo') return ok('{"nameWithOwner":"o/r"}')
    return ok(
      JSON.stringify([
        { databaseId: 9, workflowName: 'test', headBranch: 'feature', status: 'queued', conclusion: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ]),
    )
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: Date.now() }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await new Promise((r) => (globalThis as unknown as { setTimeout: (f: () => void, n: number) => void }).setTimeout(() => r(null), 50))
  const ui = await $.ui.mount(BAND)

  expect(calls).toContain('gh repo view')
  expect((await ui.find({ type: 'Text', text: /test · feature · .* · queued/ }))?.text).toBeTruthy()
  await ui.unmount()
})

test('gh missing draws nothing and does not throw', async ($, on) => {
  on('process.run', () => {
    throw new Error('spawn gh ENOENT')
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: Date.now() }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount(BAND)

  expect(await ui.find({ type: 'Text', text: /Actions/ })).toBeFalsy()
  await ui.unmount()
})
