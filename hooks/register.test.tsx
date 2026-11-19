import { expect, test } from 'claude-code/testing'

import { fmtElapsed, toRun } from './register'

test('fmtElapsed formats seconds, minutes and hours', () => {
  expect(fmtElapsed(5_000)).toBe('5s')
  expect(fmtElapsed(134_000)).toBe('2m 14s')
  expect(fmtElapsed(3_900_000)).toBe('1h 5m')
  expect(fmtElapsed(-1)).toBe('0s')
})

test('toRun maps gh fields and falls back to createdAt', () => {
  const r = toRun({ databaseId: 7, workflowName: 'CI', headBranch: 'main', status: 'queued', createdAt: '2026-11-19T10:00:00Z' })
  expect(r.id).toBe(7)
  expect(r.name).toBe('CI')
  expect(r.startedAt).toBe(Date.parse('2026-11-19T10:00:00Z'))
})
