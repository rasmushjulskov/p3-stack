# p3-stack

p3-stack is [pstack](https://github.com/cursor/plugins/tree/main/pstack) for T3 Code. Same engineering discipline, native T3 orchestration.

pstack is poteto's answer to AI slop code. It turns an agent into an engineering team: one mode skill that routes to playbooks, principles that ground every decision, and verification strict enough that you can parallelize with confidence.

p3-stack ships pstack's skills unchanged, plus one adapter, [`docs/harness/t3-code.md`](docs/harness/t3-code.md), that maps every Cursor name in them to T3 Code's tools. This is the same shape pstack uses for Claude Code. Following pstack is a version bump, not a rewrite.

- **Delegation.** `delegate_task` replaces Cursor's Task tool, with per-role providers and models resolved from `orchestrator_capabilities`. Cross-model panels are native.
- **Worktrees.** `isolation: "worktree"` gives every worker, verifier, and PR owner its own checkout, and each still reports back to its parent.
- **Watching.** `watch_pull_request` wakes the thread when checks finish, someone comments, or the branch conflicts. No polling loops.
- **Scheduling.** `schedule_task` replaces `/loop` heartbeats and Cursor Automations, webhooks included.
- **Memory.** `t3_thread_search` and `t3_thread_read` replace mining Cursor transcript files.
- **Proof.** `preview_*` browser tools and `device_*` simulators replace `control-ui`. Screenshots and recordings land in the thread.

## Install

```bash
git clone https://github.com/uzairansaruzi/p3-stack.git
cd p3-stack
./install.sh
```

`install.sh` links every `skills/*` directory into `~/.agents/skills/`, where T3 Code reads skills for every provider. Use `./install.sh --project /path/to/repo` to install into a project's `.agents/skills/` instead. Re-run it after you pull. It also removes links to skills that no longer exist.

## Get started

1. Run `/setup-pstack`. It reads `orchestrator_capabilities` and writes `~/.agents/pstack-models.md`, mapping each role (code, judgment, the review panels) to a provider and model you have.
2. Use `/poteto-mode` whenever you want rigorous work. It reads the request, picks a playbook, and runs the other skills as the steps need them.
3. Stuck or unsure which skill fits? Ask `/poteto-help`. The [pstack guide](skills/pstack-t3/guide/README.md) walks through a first real task.

The commands keep pstack's names. Earlier versions of p3-stack renamed them (`/p3-mode`, `/setup-p3`, `/p3-help`). Those names are gone, and `install.sh` removes their links.

## How it works

```
pstack.lock.json          the pstack commit this repo builds from
docs/harness/t3-code.md   the T3 adapter, the only hand-written skill text
docs/harness/t3-code/     T3 versions of pstack examples, linked from the adapter
scripts/generate.mjs      builds skills/ from those
skills/                   generated, committed so install needs no build step
```

`scripts/generate.mjs` fetches pstack at the pinned commit and copies its skills, agent briefs, guide, and README into `skills/`. Every skill that uses a Cursor name gets one line under its heading pointing at the adapter, which lands at `skills/pstack-t3/SKILL.md`. The files in `docs/harness/t3-code/` land beside it in `skills/pstack-t3/`. Links between pstack files are rewritten to work in the installed tree, and links to files the tree leaves out point at the pinned commit on GitHub.

The generator fails when a skill uses a Cursor name the adapter has no row for, when a skill's name differs from its folder, or when a link breaks. So a new pstack feature cannot slip through unmapped.

## Update pstack

```bash
node scripts/generate.mjs --bump    # pin pstack main, regenerate skills/
node scripts/generate.mjs --check   # what CI runs
```

If `--bump` reports a missing row, add it to `docs/harness/t3-code.md` and run it again. A weekly workflow opens the bump as a PR.

## Credits

p3-stack adapts [pstack](https://github.com/cursor/plugins/tree/main/pstack) by [poteto](https://x.com/poteto). The skills, principles, and language are hers; the T3 Code adapter is this repo's. MIT, see [LICENSE](LICENSE).
