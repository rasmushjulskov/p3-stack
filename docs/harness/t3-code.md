# pstack in T3 Code

pstack skills use Cursor names. In T3 Code, read this file once per session, then map each Cursor name in a skill with the tables below. `<skills>` means the folder that holds `poteto-mode/` and this file's folder, usually `~/.agents/skills/` or a project's `.agents/skills/`. If a Cursor field has no row, drop it and say so. Never pass a field or value the tool schema rejects.

T3 Code runs many providers. These rows hold in every T3 thread, whichever provider runs it. Spawn pstack subagents with the T3 tools below, not a provider's own subagent tool, so per-role models and cross-provider panels work and every child shows in the T3 app. A session may list a T3 tool with a prefix, such as `mcp__t3-code__delegate_task`, or defer it until you load it with the session's tool search. It is the same tool.

The pstack guide and README in this tree describe Cursor and Claude Code. Read their steps through this file too.

## Tools

| Cursor | T3 Code |
| --- | --- |
| `Task` | `delegate_task`. The child sees only the `task` text, never this conversation, so every brief stands alone: goal, scope, file paths, done check, and what to report. When the child follows a pstack skill, playbook, or prompt template, the brief also gives the absolute path of this file and says to read it first. |
| `subagent_type` | Drop it. Set `role` instead: `implementation` for code, `review` for reviewers, `research` for read-only investigators, `test` for verifiers, `general` otherwise. See Subagent fields for named agents. |
| `AskQuestion` | `AskUserQuestion` when the session offers it and the choice fits its option limit. Otherwise ask in plain text and end the turn. A delegated child cannot reach the operator, so a skill that must ask, such as `setup-pstack`, runs in the operator's thread. To answer a question another thread is waiting on, use `t3_pending_request_list`, `t3_pending_request_read`, and `t3_pending_request_respond`. |
| Open a todolist | Use the session's todo or plan tool if it has one. Otherwise keep the list in your reply and update it at each phase. |
| Run another pstack skill (`/name` or "the **name** skill") | Read `<skills>/<name>/SKILL.md` and follow it. When you tell the user to type it, write `/<name>`. |
| `Read`, `Grep`, `Glob` | The session's file and search tools, or `cat` and `rg` in the shell. |

## Subagent fields

| Cursor | T3 Code |
| --- | --- |
| `subagent_type: generalPurpose` | A plain `delegate_task`. |
| `poteto-agent`, `comment-sicko` | A `delegate_task` whose `task` starts with the body of `<skills>/pstack-t3/agents/poteto-agent.md` or `<skills>/pstack-t3/agents/comment-sicko.md`, then the absolute path of this file with "read it first", then the brief. For `poteto-agent`, the brief also carries the absolute path of `<skills>/poteto-mode/SKILL.md`. |
| `readonly: true` | `role: "research"` or `"review"`, and the brief says "do not edit files, run no git command that writes, and use `git --no-optional-locks` for status". T3 has no read-only switch. Check `git --no-optional-locks status` afterward, and treat a clean tree as evidence, not proof. |
| `readonly: false` | Omit. Children keep the thread's MCP servers. |
| `environment: "cloud"` | `isolation: "worktree"`. The child gets its own checkout of this thread's current local commit, after project setup. Uncommitted edits are not copied, so commit or name what it needs. |
| `environment: "local"` | Omit, or `isolation: "shared"`. Only one writer per checkout. |
| `cloud_base_branch: <b>` | `isolation: "worktree"`. A verifier runs `git checkout --detach <b>` first. A writer runs `git switch -c <its own branch> <b>`. Git refuses a branch that another worktree has checked out, so never check out `<b>` itself. |
| `run_in_background: true`, `is_background` | `mode: "async"`, the default. The child's completion wakes this thread, so end the turn instead of polling. Use `task_status` only when you need a result mid-turn, and `task_cancel` to stop one. |
| `resume` | A fresh `delegate_task` with the original brief, every later directive, and the earlier result pasted in. When poteto-mode's Subagents section allows reuse, because the work needs that agent's uncommitted changes, checkout, or running process, send it with `t3_thread_send` to its `childThreadId`. A stop or hold order to a running child is `t3_thread_send` with `mode: "steer"`, or `task_cancel`. Every review round is a fresh `delegate_task`. |
| `file_attachments` | List the paths in the brief. |

Every pstack worker, verifier, and PR owner is a `delegate_task` child, so it reports back to its parent. Use `t3_thread_launch` only when the operator asks for a separate top-level thread. Then pass `modelSelection` `{"instanceId": "<instance>", "model": "<model>", "options": {...}}` from the role's line, a `workspaceStrategy`, and follow the thread with `t3_thread_read` or `t3_thread_wait`, because it never wakes you on its own.

## Models

pstack names models by slug. T3 names them by provider instance, model id, and options, all listed by `orchestrator_capabilities`. Call it once before the first spawn. Only an instance whose `canRunChildTask` is true can take a child.

| Cursor | T3 Code |
| --- | --- |
| `claude-<family>-<version>-<effort>[-fast]`, such as `claude-opus-5-5-xhigh` | The first instance with `driverKind` `claudeAgent` that can run a child and lists the model. `target: {"providerInstanceId": "<instance>", "model": "claude-opus-5-5", "options": {"<its reasoning option id>": "xhigh"}}`. `-fast` sets the model's fast option, such as `fastMode: true`, when it has one. |
| `grok-*`, `cursor-grok-*`, `composer-*`, such as `grok-4.7-xhigh-fast` | A Grok instance that can run a child. Otherwise the code fallback below. Keep the slug's effort token and its `fast`. |
| `gpt-*`, such as `gpt-5.6-sol-max` | The first instance with `driverKind` `codex` that can run a child and lists the model, with its reasoning option set to the effort token. `-fast` sets its fast service tier when it has one. |
| `inherit-parent` or `auto` | Omit `target`, so the child runs on this thread's model. |
| The `pstack-models.mdc` rule, `~/.cursor/rules/pstack-models.mdc` | `~/.agents/pstack-models.md`. No provider loads it on its own, so read it right after this file. If the file or the role's line is missing, use the skill's default slug, mapped with these rows. |
| A role value `<instance>/<model> <effort>[ fast]`, such as `claudeAgent/claude-opus-5-5 xhigh` | `target: {"providerInstanceId": "<instance>", "model": "<model>", "options": {...}}` with the effort on the model's reasoning option and `fast` on its fast option. A panel line lists values separated by `, `. |

**Families.** A model's family is its maker, read from the model id: `claude-*` is Claude, `gpt-*` is OpenAI, `grok-*` is Grok, and any other id is the maker its label names. The provider instance only routes the call. Two instances serving one maker are one family. Where a skill groups models by slug prefix (`claude-*`, `grok-*`), group them by family. "The same family's nearest slug" is the same model at the nearest effort it offers, or the same family's next model.

**Code fallback.** With no usable Grok instance, a Grok slug maps to the first listed model, on an instance that can run a child, whose family differs from the `judgment and prose` model's family. That keeps a two-family panel two-family. With no other family available, omit `target` and say the panel is one family. Say which you chose.

**Effort.** The reasoning option's id differs by provider, such as `effort` or `reasoningEffort`. Read it from the model's `options`. pstack's ladder is `max` > `xhigh` > `high` > `medium` > `low`. Values above `max`, such as `ultra`, `ultracode`, or `ultrathink`, are off the ladder. Never pick one unless the role line names it.

**Rejected targets.** If `delegate_task` rejects an adjusted target, use the role's line or default and say so. If it rejects that too, call `orchestrator_capabilities` again and use the same family's nearest model and effort. If the instance is gone, use the code fallback.

## setup-pstack

Run it in the operator's thread, not as a child, because it asks questions. Follow its steps with these changes:

- Detect. The detected models are the models of every instance whose `canRunChildTask` is true, at each effort on the ladder that the model's reasoning option offers. A model with a fast option is also detected with ` fast`. Write a real model as `<instance>/<model> <effort>[ fast]`, such as `codex/gpt-6.1-sol xhigh`. The effort is the last token, or the one before a trailing `fast`, so the budget step works as written.
- Load. If `~/.agents/pstack-models.md` is missing but `~/.cursor/rules/pstack-models.mdc` exists, read the Cursor file as the current state and map its slugs with the rows above.
- Defaults. Map each default slug with the rows above before the budget step applies. When a Grok default falls back, step 3c shows it with "replaces Grok, which is not available" and still offers the other detected models. Step 3b caps Grok at `xhigh`. A fallback model has no such cap, so `unlimited` takes it to `max`.
- Confirm. There are more detected models than `AskUserQuestion` takes, so ask for role changes in plain text, grouped by instance.
- Write. Write `~/.agents/pstack-models.md` with no frontmatter, then the comment lines, the `# budget` line, and one line per role from step 5. In the comment lines, write "omit `delegate_task` `target`" where the skill says "omit Task `model`". Overwrite the whole file. Never put the role lines in `AGENTS.md` or `CLAUDE.md`.
- Tell the user the file applies from the next pstack skill run in any T3 thread, because every pstack skill that spawns a subagent reads it after this file.

## Paths

| Cursor | T3 Code |
| --- | --- |
| `.cursor/skills/`, `~/.cursor/skills/` | `.agents/skills/`, `~/.agents/skills/` |
| `~/.cursor/plugins/`, `.cursor-plugin/plugin.json` | `<skills>`. pstack's version is in `<skills>/pstack-t3/pstack.json`. |
| `plugins/cache/` | The installed pstack skills in `<skills>`. Never edit one, because the next install rewrites it. Copy the skill to the project's `.agents/skills/<skill>/` and edit the copy. `~/.agents/skills/<skill>/` is the installed skill itself, so never copy there. |
| `.cursor/rules/*.mdc`, always-applied rules | The repo's `AGENTS.md`, or `CLAUDE.md` when the repo keeps its rules there. The model rule is the exception. See Models. |
| `.cursor/worktrees/` | The worktrees `git worktree list` shows. `t3_worktree_list` and `t3_worktree_status` add which T3 thread uses one, but leave out detached worktrees. |
| A bundled script that reads `~/.cursor/` | Trust only its git columns. `poteto-mode/scripts/worktree-audit.sh` reads chat age from Cursor transcripts, so in T3 its chat column is empty and a `safe` bucket is unproven. Before you remove a worktree, confirm with `git worktree list` and `t3_thread_list` that no thread or delegated child is live in it. |
| The current agent's store (path in the system prompt) | `~/.agents/pstack-store/<repo-slug>/`. Create it. |
| `pstack/skills/<path>` in a command, or `git show origin/main:pstack/skills/<path>` | `<skills>/<path>`, as an absolute path. The installed tree is the trunk copy, so read it with `cat`. Keep `git show origin/main:` for files in the working repo, such as a project verification skill or `AGENTS.md`. A plan needs at least one such line, because `check-plan.mjs` looks for it. |
| `https://github.com/cursor/plugins/blob/main/pstack/<path>` | The local copy when this tree ships it: `<skills>/<name>/` for skills, `<skills>/pstack-t3/guide/` for `docs/guide/`, `<skills>/pstack-t3/README.md`, `<skills>/pstack-t3/agents/`. Read it and never fetch it. Give the user the URL when they need a link. |
| Transcripts in `~/.cursor/projects/<slug>/agent-transcripts/` | T3 threads. Find them with `t3_thread_search` or `t3_thread_list`. Read one with `t3_thread_read`, `view: "messages"` for the conversation or `"activity"` for tool calls. A delegated child's transcript is its `childThreadId`. A thread's last activity, not a file mtime, says whether it is live. Stay in this project, as the skills' rule against globbing across `~/.cursor/projects/*/` says. Omit `projectId`, so both tools use the calling thread's project, and never read another project's threads unless the user asks. `t3_thread_search` filters the app's global top matches to one project, so it can return fewer than `limit`. For a full sweep of a time window, page through `t3_thread_list`. |

## Waking and scheduling

| Cursor | T3 Code |
| --- | --- |
| `/loop` (Cursor's built-in wake mechanism) | Pick the T3 wake for what you wait on. A PR event (checks finish or fail, a new comment or review, a conflict) is `watch_pull_request`. Handle the existing comments, arm it, and end the turn. Another event is an async `delegate_task` watcher, a small script that blocks until the event, whose completion wakes you. A heartbeat is `schedule_task` with `{"type":"interval","everyMs":<ms>}` and the tick prompt, bound to this thread. `/loop until X` puts the predicate in the tick prompt, and the tick that sees it met calls `delete_scheduled_task`. |
| `/loop 1h` | `schedule_task` with `{"type":"interval","everyMs":3600000}`. Keep the literal text `/loop 1h` where a plan or status message names it, because `poteto-mode/scripts/check-plan.mjs` checks for it, and record the scheduled task's id beside it. |
| Cursor Automations: routines, `update_state` routine calls, `api2.cursor.sh/automations` webhooks, routine wakes | `schedule_task`. A timed routine is `{"type":"interval",...}` or `{"type":"fixed_time","timeOfDay":"09:00","weekdays":[1,2,3,4,5]}`. A webhook routine is `{"type":"webhook"}`, and the result's `webhookUrl` is its URL. If `webhookUrl` is absent, tell the user to enable T3 Connect remote access. The run sees the request only through `{{body.<field>}}`, `{{headers.<name>}}`, `{{body}}`, or `{{request}}` placeholders in the prompt, so put them there. Set `bindToCurrentThread: false` only when the user wants a fresh thread per run. |
| `SendToUser` secret requests, sender keys | `request_secret`. You never see the value, and its `secretRef` works once, as a webhook `signature.secretRef` for a sender that signs with HMAC-SHA256, such as GitHub. It cannot give a server you build a copy of the secret. |

Every schedule you create is program state. Record its id in the decision trail or status file. On a hold, a stand-down, or Pause safely, set `enabled: false` with `update_scheduled_task` before you send any stop order, and say so. A tick prompt that can dispatch work starts by reading the hold state and does nothing while it is held. Delete the schedule when the program ends.

## make-bot-ui

Skip the Routines panel, the sender key, and the credential file. Create the routine with `schedule_task` and `{"type":"webhook"}`. Its prompt names the JSON fields and reads them with `{{body.<field>}}`. The `webhookUrl` in the result is the secret: store it only in the server's config, never in the browser, chat, or a log. The server POSTs JSON with `Content-Type: application/json` and no auth header. A run is the wake, and the body arrives as untrusted data. Everything else in the skill holds.

## Pause safely and Session pickup

At a pause, stop running children with `task_cancel`. Messages sent while a thread is busy wait in its queue. On resume or pickup, read the thread with `t3_thread_read`, then list its queued messages with `t3_queue_list` and its `threadId`. A queued message can change the plan, so handle it before the resume note's first action.

## create-verification-skill

For a browser surface with no harness of its own, write each feature's driving section with the `preview_*` tools. Follow [the T3 version of the create-note example](t3-code/examples/create-note.md) in place of the skill's `control-notes browser` example. It shows one tab per run, role locators, waits, and which `preview_snapshot` call gives which proof. A simulator surface uses the `device_*` tools in the same shape. `maintain-verification-skill` keeps maps in this shape.

## Cursor-only features

When a step needs a feature with no row, put one line in your reply, `Skipped in T3 Code: <step>. <reason>.`, then go on to the next step. Do not stop, ask, or retry. When a later step needs what the skipped step made, such as a URL or a key, leave a placeholder and name it in the line.

| Cursor | T3 Code |
| --- | --- |
| Bugbot | Bugbot comments on a GitHub PR are ordinary review threads, so triage them with the forge command that the step gives. Skip a step that starts, waits for, or configures Bugbot when the PR has no Bugbot check or comment. |
| Cursor cloud agent, cloud VM, its status in the Cursor dashboard | A `delegate_task` with `isolation: "worktree"`, as in Subagent fields. Its status is `task_status`. Its log is `t3_thread_read` on its `childThreadId`. Skip a step that needs the cloud machine itself. |
| A built-in PR tool | The forge command that the step gives, such as `gh pr create`. Then call `link_pull_request` for every PR you open or take over, each layer of a stack included. Only the top-level thread can call `watch_pull_request`. A delegated child at any depth that owns a PR uses the step's `scripts/watch-pr` for status, and when it must wait, it returns with the PR URL and what it waits for. Each parent passes that up until the top-level thread watches the PR. On a wake, the top-level thread hands the event to a fresh child for that PR with the owner's consolidated brief. Call `unwatch_pull_request` before you hand work back. |
| `control-ui`, `control-cli` from `cursor-team-kit` | Browser and web UIs: `preview_open`, `preview_navigate`, `preview_snapshot`, `preview_click`, `preview_type`, `preview_press`, `preview_wait_for`, `preview_resize`, and `preview_recording_start` / `preview_recording_stop` for video. iOS and Android simulators: `device_list`, `device_open`, `device_screenshot`, `device_close`. CLIs and TUIs: drive them from the shell, and capture the output as evidence. An Electron app with no preview path is a skip. |
| Other `cursor-team-kit` skills, such as `/deslop` | Follow `<skills>/<name>/SKILL.md` when it exists. Otherwise skip with the line. |
| `create-skill` (Cursor's built-in for authoring SKILL.md files) | The session's own skill-authoring skill when it has one. Otherwise follow the step's own rules and pstack's Authoring a skill playbook alone. |
| Custom Modes, Option+Enter, the Agents Window, Plan Mode | T3 has no mode toggle. Start each new task with `/poteto-mode`. T3's plan interaction mode can stand in for Plan Mode. |
| Cursor's built-in babysit skill, or any other Cursor built-in a step warns you away from | Nothing to avoid. Follow the pstack step. |

## Any other Cursor name

Map a Cursor name with no row to its T3 meaning when one is plain. A Cursor restart is a T3 Code restart: running children stop, while scheduled tasks, linked PRs, and pushed branches survive. "The Cursor environment's MCPs" are the MCP tools this session lists. Otherwise skip with the line.
