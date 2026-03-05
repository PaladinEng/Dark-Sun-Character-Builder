# Codex Prompt Runner

This repository includes a local non-interactive overnight runner for queued Codex prompts.

Script:
- `scripts/codex-prompt-runner.mjs`

## What the runner does

- Reads prompt files from `codex/prompts/` in lexical order.
- Runs matching prompts one at a time via `codex exec` with stdin prompt input (`-`).
- Writes per-run logs under `codex/runs/<NNN>_<timestamp>_<prompt-base>/`.
- Stops immediately on first failure.
- Success requires:
  - Codex exit code `0`
  - `last_message.txt` contains `=== ALL_PASS ===`

## Prompt naming rules

Only files matching this pattern are executed:

- `^\d{3}[_-].+\.(md|txt)$`

Examples:
- `001_sprint.md`
- `012-fix-validation.txt`
- `000_smoke_test.md`

## Log files per run

- `events.jsonl` (stdout from `codex --json`)
- `stderr.txt` (stderr from Codex)
- `last_message.txt` (from `--output-last-message`)

## Key options

- `--start`, `--end` sprint range filter by numeric prefix
- `--auto-commit` commit after each successful sprint
- `--require-clean` / `--no-require-clean`
- `--auto-branch <name>` create/switch branch before running
- `--tag-checkpoints` create annotated tag after each successful sprint
- `--tag-prefix <prefix>` checkpoint tag prefix (default `codex-sprint`)
- `--auto-resume` compute start sprint from latest matching checkpoint tag (unless `--start` explicitly set)

## Usage examples

Overnight run with branch+commits+tags+resume:

```bash
node scripts/codex-prompt-runner.mjs \
  --start 1 --end 20 \
  --auto-branch codex/overnight \
  --auto-commit \
  --tag-checkpoints \
  --tag-prefix codex-sprint \
  --auto-resume
```

Resume from sprint 9 manually:

```bash
node scripts/codex-prompt-runner.mjs --start 9 --end 20 --auto-commit
```

Run smoke prompt only:

```bash
node scripts/codex-prompt-runner.mjs --start 0 --end 0 --no-auto-commit --no-require-clean
```

Rollback to a checkpoint tag:

```bash
git checkout <tag-name>
# or reset a branch:
# git checkout <branch>
# git reset --hard <tag-name>
```

## Notes

- The runner uses only Node built-ins (`fs`, `path`, `child_process`).
- If your Codex CLI version does not support `--ask-for-approval`, the runner falls back to config-based approval policy forwarding.
