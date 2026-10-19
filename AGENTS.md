# p3-stack contributor guide

p3-stack is pstack, unchanged, plus one adapter that maps its Cursor names to T3 Code. Read [README.md](README.md) for the layout.

## Rules

- Never edit `skills/`. `scripts/generate.mjs` writes it. A change you want in a skill belongs upstream in [cursor/plugins](https://github.com/cursor/plugins/tree/main/pstack), or in the adapter when it is about T3.
- The adapter, `docs/harness/t3-code.md`, is the only hand-written skill text. It mirrors pstack's `docs/harness/claude-code.md`, so keep its sections, table shape, and voice: terse, declarative, one fact per sentence.
- Every adapter row names a T3 tool exactly as the tool calls itself (`delegate_task`, `watch_pull_request`, `schedule_task`, `link_pull_request`, `t3_thread_read`, `preview_*`, `device_*`), or says to skip with the line.
- `TERMS` in `scripts/generate.mjs` lists the Cursor names the generator looks for. Each `key` must appear verbatim in the first cell of an adapter table row, or in a heading. When pstack starts using a new Cursor feature, add its term and its row together.
- After any change, run `node scripts/generate.mjs` and commit `skills/` with it. CI runs `node scripts/generate.mjs --check`.

## Updating pstack

Run `node scripts/generate.mjs --bump`. It pins pstack's `main` in `pstack.lock.json` and regenerates. A `FAIL` line names the term or link to fix. Read the upstream diff for new mechanics the term list cannot see, such as a new kind of wake or a new subagent field, and map them before you commit.
