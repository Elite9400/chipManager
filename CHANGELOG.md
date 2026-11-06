# Changelog

All notable changes to chipManager are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.6.0] - 2026-11-06

### Changed

- **Settings, rebuilt by section.** Six sections are chosen from a chip row: Connections, Thresholds, Balancing,
  Project, Board and Advanced. Every control saves on its own and shows a "Saved" toast; an error appears inline.
- **Connections.** Allowed providers are filter chips, and every provider shows its state. **Connect…** opens a
  guided pop-up, with an inline fallback when the pop-up is declined.
- **Thresholds.** Preset chips plus two `−`/`+` steppers. Existing values, `null` and off-step values stay as they
  are, and "warning < critical" is checked on every path.
- **Balancing.**
  - Profiles: Automatic, Saving, Quality, Speed, Custom. They touch only engines and effort, never models, and
    are saved together with the weights in a single write.
  - The simulation is declared as such, validated against the start rules, and says when no combination can
    start.
  - Manual tuning uses a five-step scale; custom weights are shown in full.
- **Project.** Network, milestones, data folder, sensitive terms and manual budgets: budgets are removable chips,
  with a guided **Add…**.

### Fixed

- A malformed `profilo` counts as absent instead of breaking the view.
- Decimal thresholds can be adjusted.
- Preset buttons carry the provider in their label, so no two controls share a name.

## [2.5.0] - 2026-11-06

### Changed

- **Work and Load views follow the real pane width** (`bodyColumns`) on every surface, desktop included, in three
  width classes. Titles wrap, and actions move below when space runs out.
- **One compact card for every chip**:
  - state;
  - who works on it, with model, effort and reviewer;
  - the first line of the brief;
  - the actions.

  No action of the previous layout is lost.
- **▶ Start** sits in the same place on every ready chip.
- **Start next** (`n`) starts the first chip the real plan (dependencies, slots, Codex lane) would start now.
- A blocked chip shows its first reason and a **Why** list.
- **Colours come only from `tema.ts`**: the per-model and per-effort colour maps are gone, and limits take the
  colour of their level.
- Button labels are short and unique: they carry the chip's order number.

### Fixed

- **Mark done** is available on started chips directly from the row.
- Error marks no longer sit on a tint that lowered their contrast.

## [2.4.2] - 2026-11-06

### Changed

- **Lighter with many sessions open.**
  - One 20-second heartbeat replaces the four timers.
  - The orchestration round stays fast while work is pending (proposed, queued, starting, started, delivered
    actions, CLI runs) and slows to 60 s otherwise.
  - The session list is read every 20 s only while the panel is on screen, every 2 minutes otherwise, and at
    once when it comes back or on **Refresh**.
- **Incremental Codex reading.** The helper keeps a cache of the local Codex session files.
  - Unchanged files are not opened.
  - Only appended bytes are read: incomplete lines wait, rewritten or truncated files are read again, and a
    backlog over 512 KB is skipped with the state recomputed from the tail.
  - Plan limits are kept per id with a chunked scan.
  - Only allowed metadata fields are stored; a broken cache entry is rebuilt.
- The Codex lane is queried only when an action would really start on Codex.
- Actions are re-read only when their file changes, in full every 5 minutes and after a write conflict.
- Shorter tool descriptions; `risorse_agenti` is now loaded on demand.

### Added

- A grey line in the Load view with this session's own footprint: helper processes, app calls, bytes read and
  skipped backlogs in the last 10 minutes.

### Fixed

- A Codex session whose state cannot be read is shown as `—` instead of "stopped".
- The Codex-lane disk tests use their own lock, so they no longer fail while real Codex work runs on the machine.

## [2.4.1] - 2026-11-06

### Changed

- The panel code is split into one file per view (`vista-lavoro.tsx`, `vista-carico.tsx`,
  `vista-impostazioni.tsx`); behaviour and rendering are unchanged.

### Added

- `hooks/tema.ts`: semantic colour tokens. The interface accent (`#0A86C9`) keeps at least 3:1 contrast on light
  and dark backgrounds, also over its own tint; `#00BFFF` stays the icon colour.
- `hooks/ui.tsx`: shared building blocks (chip, chip group, stepper with `−`/`+`, section, wrapping row) for the
  coming layout and settings redesign. They are not used by the views yet.

### Fixed

- The test that keeps every action state change behind `transizione()` now scans every `hooks` source file.

## [2.4.0] - 2026-11-05

### Added

- **Project board**: a static, self-contained HTML file (`<data folder>/board/<project>-<hash>/index.html`), off by
  default and switched on per project in Settings. It shows the line of work in four groups (waiting for you, in
  progress, next, done, with the last 15 commits of the base branch) and, for each task, an expandable card with its
  plan, the brief rebuilt with the current rules, the process (lane, execution → review → merge, registry phase),
  who works on it with which model and effort, the expected reviewer and the reported review outcome, dates, links
  and errors. It is generated without any model, has no scripts, no links built from data and a strict
  Content-Security-Policy; attempt tokens are masked in the whole file.
- **Open board** in the panel header (and **In the board** on each task card) opens the file with the system
  opener, with a fixed argument list and no shell; the path is shown in plain text as a fallback.
- **Optional summaries with the lightest model** (`haiku`, effort low, 120 output tokens): one sentence per task,
  only when its text changes, at most 5 per minute and 100 per day, reserved under the helper lock so two panels
  never pay twice. Off by default; never with `soloLocale` or with Claude disabled for the project.
- `piano` on an action: a `.md` or `.txt` file relative to the repository root, set by `suggerisci_azione` or in
  the editor and read by the helper (real path under the repository, regular file, 200 KB).
- `aggiorna_azione` takes a `revisione` (`in-corso` | `approvata` | `da-correggere`, note up to 300
  characters), with or without a state. Only the session holding the current attempt token, or the proposer, may
  write it; the author is the calling session, never an argument. A new attempt clears it.
- Actions record `consegnataIl` and `completataIl`; every state change goes through a single transition function.

### Security

- The board is refused when the data folder is inside a git working tree, when any folder on its path is a link or
  junction, or when the identity marker in its folder belongs to another project. Turning it off deletes only the
  HTML and the summaries, never folders; the daily summary budget survives off → on.
- Every `board-*` helper command runs under the configuration lock and re-reads mode and generation: work started
  before a mode change (even off → on) is never published.

## [2.3.1] - 2026-11-05

### Changed

- The working views show only configured limits. **Carico** lists a provider only when the project allows it and it
  has a measurement or a manual limit, and for each provider only the limits with a measurement: a bar when fresh,
  a grey row with its age and no bar when old. Placeholder rows (*not available*, *provider not enabled*) and the
  FreeLLMAPI proxy line are gone; with nothing to show, the view says *Nessun limite collegato* and points to
  **Impostazioni**, which still lists every provider.
- **Impostazioni** shows, for each allowed provider, one grey line with the state of the current reading: the error
  of each probe, when it was read, and the proxy state with the key presence for FreeLLMAPI.
- The summary line counts only allowed providers and fresh measurements; any visible provider whose measurement
  went stale adds one grey note such as *Claude: limiti non letti da 12 min*. The percentage margin stays on plan
  quotas (Claude, Codex).
- The last measurement of each limit is kept for the session, so a failed reading no longer empties the view. A
  successful reading replaces the provider's previous measurements, so a limit the source no longer reports (extra
  usage turned off) disappears, even when the plan answers with no window at all; Claude API spend is tracked on
  its own.

### Fixed

- A successful DeepSeek balance reading made the panel reject the whole limits reading, because its id carried the
  currency in upper case; the id is now lower case (`deepseek-usd`, `deepseek-cny`).

## [2.3.0] - 2026-11-05

### Added

- **Carico (load) view**: a model × effort matrix with sessions at work and queued actions, limits grouped by
  provider with a bar at the true ratio and both ends labelled, the context window used by each working session with
  the token total per model, and the weights in use in plain words with the launches of the last 24 hours per
  provider.
- **Thresholds per provider** (`soglie` in the project configuration): a warning and a critical percentage for each
  provider, 70/90 by default, or none. They drive the bar colours, the summary line and the bulk-launch
  confirmation.

### Changed

- Above a provider's critical threshold its margin drops to a thousandth, so the choices the proposer left open go
  to another allowed provider; when every provider is above, the margins still rank them. Explicit choices are
  kept. Manual limits above a threshold are flagged as declarations and do not change the choices.
- **Avvia tutte** (launch all) names the providers above their critical threshold in its confirmation and asks to
  launch anyway, also for actions that would only be queued. Closing the confirmation without a choice now cancels
  instead of showing an error.
- The context reading of a session also keeps its token count.

## [2.2.0] - 2026-11-05

### Added

- **Who is doing what, right now.** The panel opens on a new **Lavoro** (work) view: a table of every session of the
  project, including sessions opened by hand and Codex sessions, with engine, model, effort, status, context window
  used and last activity. Claude sessions come from the desktop app, Codex sessions from the local
  `~/.codex/sessions` files (metadata only, never conversation text). Context is read only for working sessions and
  never when the project is local-only.
- A summary line under the title: sessions at work, actions waiting for you, actions ready, and the tightest fresh
  plan margin for Claude and Codex.
- Three views, **Lavoro**, **Carico** (load: limits and budgets) and **Impostazioni** (settings), on keys `1` `2` `3`.
- On opening, a one-time popup offers to assign the actions saved without a project to the current project or to
  discard them; discarding can be undone. If the popup cannot be shown, the same request stays in the panel.

### Changed

- **Each project has its own data folder**: `CHIPMANAGER_DIR`, then `progetti[repo].cartella`, then the global
  `cartella` (kept for compatibility), then `~/.claude/chipmanager/progetti/<owner>__<repo>`. Actions saved in the
  old default folder `~/.claude/chipmanager/azioni` are not moved: to keep them, set that folder as `cartella`.
  An unreadable configuration or a `cartella` that is not an absolute or `~` path stops reading and writing actions
  instead of falling back to another folder. Without a GitHub remote, a worktree and its checkout are one project.
- Actions are compact rows instead of cards: title and dependency on the first line, engine, model, effort and
  reviewer on a grey second line, **Dettagli** opens the full editor in place. Only rows waiting for a decision keep
  a coloured border, and an uncertain launch that can be cancelled now waits in **Aspettano te**.
- In the terminal, below 80 columns, the sessions table drops context and activity and merges model and effort.

### Removed

- The per-card "Associa a questo progetto" button, replaced by the one-time request above.

## [2.1.1] - 2026-11-05

### Fixed

- **Claude plan limits show again on the desktop app.** The panel reads the current shape of
  `ccd_session_mgmt.get_usage`: one limit per plan window (5-hour, weekly, weekly per model) with its reset time,
  plus extra usage when it is enabled. When plan limits do not apply or cannot be read, the panel says so with the
  reason instead of an unexplained "not available". The previous format is still accepted.
- **Actions from other projects no longer appear.** Actions saved without a project by an earlier version are no
  longer shown in any project.

## [2.1.0] - 2026-11-05

### Changed

- **The plugin is now called `chip-manager`** (lowercase with hyphens, as the Claude Code plugin directory
  requires). The MCP tools become `mcp__chip-manager__suggerisci_azione`, `mcp__chip-manager__aggiorna_azione`
  and `mcp__chip-manager__risorse_agenti`. To upgrade, uninstall `chipManager@chipmanager` and install
  `chip-manager@chipmanager`; the local configuration in `~/.claude/chipmanager/` and the saved actions are kept,
  while API keys set in the plugin settings must be entered again.

### Added

- Plugin icon.
- Animated illustration of the panel in the README.

### Fixed

- The disk tests no longer leave symbolic links in `.cache/`, which made `claude plugin install` from the folder
  fail.

## [2.0.0] - 2026-11-05

First public release.

### Added

- **Suggested-actions panel** for Claude Code, on the desktop app and in the terminal: agents put proposed work
  in the panel instead of the chat, and you review order, executor (Claude or Codex), reviewer, model, effort and
  session options before launching.
- **Single or bulk launch** in dependency order, each action in its own worktree, with live status and milestone
  progress.
- **MCP tools** `suggerisci_azione`, `aggiorna_azione` and `risorse_agenti`, plus the `/chipmanager` command.
- **Agent limits** at a glance: Claude and Codex plan usage, API spend, DeepSeek balance, FreeLLMAPI usage and
  manual budgets, each with its source and age.
- **Load weights** by provider, model or effort, as a percentage or an absolute value, used to fill the choices
  the agent leaves open.
- **FreeLLMAPI integration**, opt-in per project, with a guided local install and a usage level.
- **Per-project configuration** in `~/.claude/chipmanager/config.json`: routing rules, sensitive terms, allowed
  providers, background, local-only mode.
- **CLI launcher** for the terminal, without the desktop app.

### Security

- Fail-closed guards: sensitive work is never delegated autonomously or sent to the cloud, an unreadable
  configuration blocks instead of guessing, and API keys are stored as sensitive plugin settings.

[Unreleased]: https://github.com/Elite9400/chipManager/compare/v2.3.0...HEAD
[2.3.0]: https://github.com/Elite9400/chipManager/compare/v2.2.0...v2.3.0
[2.2.0]: https://github.com/Elite9400/chipManager/compare/v2.1.1...v2.2.0
[2.1.1]: https://github.com/Elite9400/chipManager/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/Elite9400/chipManager/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/Elite9400/chipManager/releases/tag/v2.0.0
