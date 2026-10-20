# Create a note, driven in T3 Code

This is pstack's [create-note example](../../../../skills/create-verification-skill/references/feature-map-example/create-note.md) rewritten for a verification skill that runs in T3 Code. Browser steps use T3's `preview_*` tools. The doctor check and terminal steps stay shell commands. The [example's README](../../../../skills/create-verification-skill/references/feature-map-example/README.md) holds, with two changes to its driving conventions:

- Run browser actions with the `preview_*` tools, not `control-notes browser`. Open one tab per run with `preview_open` and `reuseExistingTab: false`, keep the returned `tabId`, and pass it on every later `preview_*` call. Parallel lanes can share a browser session, and a call without `tabId` drives that session's current tab, which may be another lane's.
- Run terminal actions directly in the shell, not through `control-notes cli`.

## Sub-features

- `create-open` opens a blank editor from each browser entry point.
- `create-save` persists a title and body.
- `create-cancel` discards an unfinished browser draft.
- `create-cli` creates the same note shape from the terminal.

## How to get to it (user POV)

- Choose the `New note` button in the browser toolbar.
- Press `n` in the browser while focus is outside an editable field.
- Run `notes create --title <title> --body <body>` in a terminal.

## Driving it with `preview_*`

Preconditions:

- `control-notes doctor` reports the expected port, disposable data directory, and build revision.
- No note is titled `Release checklist`.
- `preview_open` with `reuseExistingTab: false` returned the `tabId` that every call below passes.

- **Load the app.** Call `preview_navigate` with `target: {"kind": "environment-port", "port": 4173}`, then `preview_wait_for` with locator `role=button[name='New note']`. The port target follows the run's own environment, so a worktree lane reaches its own server.
- **Open editor.** Choose `New note`. Call `preview_click` with locator `role=button[name='New note']`, then `preview_wait_for` with locator `role=form[name='Note editor']`. Focus is in the `Title` textbox.
- **Enter content.** Type the title and body. Call `preview_type` with locator `role=textbox[name='Title']` and text `Release checklist`, then with locator `role=textbox[name='Body']` and text `Tag and publish`. The `Save note` button becomes enabled.
- **Save note.** Choose `Save note`. Call `preview_click` with locator `role=button[name='Save note']`, then `preview_wait_for` with locator `role=status[name='Note saved']`. The heading reads `Release checklist`.
- **Confirm persistence.** Return to the note list and reopen the note. Call `preview_click` with locator `role=link[name='All notes']`, then with locator `role=link[name='Release checklist']`. The editor shows both saved values.
- **Keyboard entry and cancel.** Open a draft with `n`, enter `Discard me`, and choose `Cancel`. Call `preview_click` with locator `role=link[name='All notes']`, `preview_press` with key `n`, `preview_type` with locator `role=textbox[name='Title']` and text `Discard me`, and `preview_click` with locator `role=button[name='Cancel']`. The note list returns and has no `Discard me` link.
- **CLI entry.** Create a second note. Run `notes create --title "CLI note" --body "Created from terminal" --format json`. Exit code `0` and stdout contain the new note ID and title.
- **Proof.** Show both saved notes in `All notes`. Call `preview_click` with locator `role=link[name='All notes']`. Call `preview_snapshot` and write its accessibility tree to `artifacts/create-note/list.aria.txt`. Then call `preview_snapshot` with `save: true` and copy the returned `screenshotPath` to `artifacts/create-note/list.png`. Both show `Release checklist` and `CLI note`.

## Gotchas

- Pressing `n` while a textbox has focus types the character instead of opening a new editor.
- Titles are trimmed on save. Assert the rendered title, not the draft input value.
- A save status alone is insufficient proof. Reopen the note from the list.
- `preview_snapshot` with `save: true` returns only the URL and `screenshotPath`. Take the accessibility tree from a call without `save`.
- An `aria-ref=` locator from a snapshot expires on navigation and on the next snapshot. Role locators survive both, so recipes use them.
- Wait with `preview_wait_for` on the element or status the step expects, never a fixed sleep.
- Remove `Release checklist` and `CLI note` during fixture cleanup, but retain their proof artifacts.
