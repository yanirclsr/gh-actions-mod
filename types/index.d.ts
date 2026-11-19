export type Run = {
  id: number
  name: string
  branch: string
  status: string
  conclusion: string
  startedAt: number
  finishedAt: number
}

export type Scope = 'branch' | 'all'

declare module 'claude-code' {
  interface PluginState {
    'gh-actions': { runs: Run[]; scope: Scope; now: number }
  }
}
