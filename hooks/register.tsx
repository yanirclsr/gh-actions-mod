import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Run, Scope } from '../types'

const runsAtom = atom({ plugin: 'gh-actions', key: 'runs' } as const, [])
const scopeAtom = atom({ plugin: 'gh-actions', key: 'scope' } as const, 'branch')
const nowAtom = atom({ plugin: 'gh-actions', key: 'now' } as const, 0)

const FAST_MS = 20_000
const SLOW_MS = 30_000
const TICK_MS = 5_000
const LINGER_MS = 30_000
const MAX_ROWS = 3
const FIELDS = 'databaseId,workflowName,headBranch,status,conclusion,startedAt,createdAt,updatedAt'

type Raw = {
  databaseId: number
  workflowName?: string
  headBranch?: string
  status?: string
  conclusion?: string
  startedAt?: string
  createdAt?: string
  updatedAt?: string
}

const ACTIVE = new Set(['in_progress', 'queued'])
const BAD = new Set(['failure', 'timed_out'])

const ms = (s?: string) => (s ? Date.parse(s) || 0 : 0)

export const toRun = (r: Raw): Run => ({
  id: r.databaseId,
  name: r.workflowName || 'workflow',
  branch: r.headBranch || '',
  status: r.status || '',
  conclusion: r.conclusion || '',
  startedAt: ms(r.startedAt) || ms(r.createdAt),
  finishedAt: ms(r.updatedAt),
})

export const fmtElapsed = (msec: number): string => {
  const s = Math.max(0, Math.floor(msec / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`
  return `${sec}s`
}

const parse = (text: string): Raw[] | null => {
  try {
    const v = JSON.parse(text)
    return Array.isArray(v) ? v : null
  } catch {
    return null
  }
}

export const register: Register = (on) => {
  let repo: string | null = null
  let lastPoll = 0
  let polling = false
  // Runs seen active, by id; finished ones carry finishedAt = when we noticed.
  let tracked = new Map<number, Run & { seenDone: number }>()
  const toasted = new Set<number>()

  on('session.start', async ($, e, next) => {
    // DEBUG (temporary): say that the mod loaded and what each poll did.
    const note = (t: string) => {
      $.ui.status(`gh-actions: ${t}`)
    }
    $.ui.toast('gh-actions loaded')

    const poll = async () => {
      if (polling) return
      polling = true
      try {
        await pollOnce()
      } catch (err) {
        note(`poll error: ${String(err).slice(0, 80)}`)
        // gh missing, not signed in, not a repo: stay silent in the band.
      } finally {
        polling = false
      }
    }

    const pollOnce = async () => {
      const now: number = await $.clock.now()
      const scope = (await read($, scopeAtom)) as Scope
      const active = [...tracked.values()].some((r) => ACTIVE.has(r.status))
      if (lastPoll && now - lastPoll < (active ? FAST_MS : SLOW_MS)) {
        await update($, nowAtom, () => now)
        return
      }
      lastPoll = now

      if (!repo) {
        const r = await $.process.run(['gh', 'repo', 'view', '--json', 'nameWithOwner'])
        if (r.exitCode !== 0) {
          note(`gh repo view failed (exit ${r.exitCode}): ${r.stderr.trim().slice(0, 60)}`)
          return clear()
        }
        try {
          repo = JSON.parse(r.stdout).nameWithOwner || null
        } catch {
          repo = null
        }
        if (!repo) return clear()
      }

      const args = ['gh', 'run', 'list', '--repo', repo, '--limit', '30', '--json', FIELDS]
      if (scope === 'branch') {
        const b = await $.process.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'])
        const branch = b.stdout.trim()
        if (b.exitCode !== 0 || !branch || branch === 'HEAD') {
          note(`no branch (exit ${b.exitCode}): ${b.stderr.trim().slice(0, 60)}`)
          return clear()
        }
        args.push('--branch', branch)
      }
      const res = await $.process.run(args)
      const list = res.exitCode === 0 ? parse(res.stdout) : null
      if (!list) {
        note(`gh run list failed (exit ${res.exitCode}): ${res.stderr.trim().slice(0, 60)}`)
        return clear()
      }
      note(`${list.length} runs seen on ${scope === 'branch' ? 'this branch' : 'all branches'}, repo ${repo}`)

      const byId = new Map(list.map((r) => [r.databaseId, toRun(r)]))
      const fresh = new Map<number, Run & { seenDone: number }>()

      for (const r of byId.values()) {
        if (ACTIVE.has(r.status)) fresh.set(r.id, { ...r, seenDone: 0 })
      }
      for (const old of tracked.values()) {
        if (fresh.has(old.id)) continue
        if (old.seenDone) {
          if (now - old.seenDone < LINGER_MS) fresh.set(old.id, old)
          continue
        }
        // Was active, no longer in the active list: find its conclusion.
        let done = byId.get(old.id)
        if (!done || done.status !== 'completed') {
          const v = await $.process.run(['gh', 'run', 'view', String(old.id), '--repo', repo, '--json', FIELDS])
          const raw = v.exitCode === 0 ? parse(`[${v.stdout}]`) : null
          done = raw && raw[0] ? toRun(raw[0]) : undefined
        }
        if (!done || ACTIVE.has(done.status)) {
          fresh.set(old.id, old)
          continue
        }
        fresh.set(old.id, { ...done, seenDone: now })
        if (BAD.has(done.conclusion) && !toasted.has(done.id)) {
          toasted.add(done.id)
          $.ui.toast(`Run failed: ${done.name} on ${done.branch}`)
        }
      }
      tracked = fresh
      await publish(now)
    }

    const publish = async (now: number) => {
      await update($, runsAtom, () => [...tracked.values()].map(({ seenDone, ...r }) => (seenDone ? { ...r, finishedAt: seenDone } : { ...r, finishedAt: 0 })))
      await update($, nowAtom, () => now)
    }

    const clear = async () => {
      tracked = new Map()
      await update($, runsAtom, () => [])
    }

    $.clock.every(TICK_MS, poll)
    void poll()
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const runs = (await read($, runsAtom)) as Run[]
    const below = await next(e)
    if (runs.length === 0 || e.props.hasSurvey) return below

    const scope = (await read($, scopeAtom)) as Scope
    const now = (await read($, nowAtom)) as number
    const ordered = [...runs].sort((a, b) => Number(!!a.finishedAt) - Number(!!b.finishedAt))
    const shown = ordered.slice(0, MAX_ROWS)
    const more = ordered.length - shown.length
    const { Box, Button, Text } = $.ui.resolve(e)

    const line = (r: Run) => {
      const done = r.finishedAt > 0
      const elapsed = done ? r.finishedAt - r.startedAt : now - r.startedAt
      const status = done ? r.conclusion || 'completed' : r.status
      const color = !done ? undefined : r.conclusion === 'success' ? 'green' : BAD.has(r.conclusion) ? 'red' : undefined
      return (
        <Text key={String(r.id)} color={color}>
          {r.name} · {r.branch} · {fmtElapsed(elapsed)} · {status}
        </Text>
      )
    }

    return (
      <Box flexDirection="column">
        <Box>
          <Text dimColor>Actions </Text>
          <Button
            key="scope"
            label={scope === 'branch' ? 'this branch' : 'all branches'}
            onPress={async () => {
              tracked = new Map()
              lastPoll = 0
              await update($, runsAtom, () => [])
              await update($, scopeAtom, () => (scope === 'branch' ? 'all' : 'branch'))
            }}
          />
        </Box>
        {shown.map(line)}
        {more > 0 ? <Text dimColor>+{more} more</Text> : null}
        {below}
      </Box>
    )
  })
}
