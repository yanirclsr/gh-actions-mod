# gh-actions-mod

A Claude Code mod that shows your GitHub Actions runs in the band above the prompt.

- Shows only `in_progress` and `queued` runs for the current repo, one line each: workflow, branch, elapsed time, status. Up to 3 lines, then "+N more".
- Filters to the current branch by default. A button in the band switches between "this branch" and "all branches in this repo".
- Draws nothing in the band when no run is active.
- Also opens a side pane, "GitHub Actions", at session start with the same runs and the scope button ("No active runs." when idle). Reopen it with the `/gh-actions` command.
- Polls every 20 seconds while a run is active and every 30 seconds otherwise.
- A finished run stays for 30 seconds with its conclusion. A failed run (failure or timed out) raises a toast with the workflow and branch. Success does not.
- Read-only: it runs only `gh repo view`, `gh run list`, `gh run view` and `git rev-parse`. It never cancels or reruns anything.
- If `gh` is missing or not logged in, or the directory is not a git repo, it draws nothing and stays silent.

## Install

Desktop app: click + next to the prompt box, then Plugins, Add marketplace with `yanirclsr/gh-actions-mod`, then Add plugin `gh-actions`.

Terminal session:

```
/plugin install gh-actions --marketplace yanirclsr/gh-actions-mod
```

Or from a shell: `claude plugin install gh-actions --marketplace yanirclsr/gh-actions-mod`.

Or load it from a folder:

```bash
git clone --depth 1 https://github.com/yanirclsr/gh-actions-mod ~/.claude/mods/gh-actions
```

Add the absolute path to `CLAUDE_CODE_PLUGIN_DIRS` in the `env` block of `~/.claude/settings.json`, keeping any paths already there (separated by `:`), then restart Claude Code.

Allow the four commands in your settings:

```json
{
  "permissions": {
    "allow": [
      "Bash(gh run list:*)",
      "Bash(gh run view:*)",
      "Bash(gh repo view:*)",
      "Bash(git rev-parse:*)"
    ]
  }
}
```

Needs the GitHub CLI (`gh`), logged in with access to the repo.

## Cloud environments

In the environment's setup script:

```bash
git clone --depth 1 https://github.com/yanirclsr/gh-actions-mod /opt/mods/gh-actions
```

and set the environment variable `CLAUDE_CODE_PLUGIN_DIRS=/opt/mods/gh-actions` in the environment's settings.

## License

MIT
