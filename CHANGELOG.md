# Changelog

All notable changes to chipManager are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.2.0] - 2026-11-07

### Added

- **Install for one project or globally.** `claude plugin install chip-manager@chipmanager --scope user` for all
  your projects, `--scope project` for one repository shared with the team (`.claude/settings.json`), `--scope local`
  for one project only for you (`.claude/settings.local.json`). The mod behaves the same at every scope: accounts,
  keys and the API budget stay personal, and the chips belong to the project of the session that starts them.
  **After updating, reload every open session (`/reload-plugins`)**: until then a session keeps the old code, applies
  only the project settings and ignores the account ones.
- **Account and project.** A new `account` field at the root of the configuration holds what belongs to your
  accounts and applies to every project: thresholds, manual budgets, API Claude credits (monthly budget and cap per
  run) and the FreeLLMAPI endpoint. Each project keeps its own providers, network, milestones, balancing, board,
  advisor, FreeLLMAPI level, data folder and sensitive terms, and can only be stricter than the account
  (`restrizioni`: lower thresholds, a lower API month limit or cap per run). Settings shows the sections in two
  groups, **Account · all projects** and **Project · owner/repo**; a stricter project value reads «Stricter in
  owner/repo», with **Remove restriction**.
- **One API spend log for the account**, next to the machine lock: every run is recorded with its project, and a run
  starts only if its cap fits both in the account's monthly budget and in the project's month limit. The Load view
  shows both: "3.20 USD this project · 7.80 USD of 20 USD account".
- **Work view: who is doing what, right now.** The panel opens on **Work**, a table of every session of the project,
  including sessions opened by hand and Codex sessions, with engine, model, effort, status, context window used and
  last activity. Claude sessions come from the desktop app, Codex sessions from the local `~/.codex/sessions` files
  (metadata only, never conversation text). A summary line counts sessions at work, actions waiting for you and
  actions ready, with the tightest fresh plan usage.
- **Three views**, **Work**, **Load** and **Settings**, on keys `1` `2` `3`.
- **Load view**: a model × effort matrix with sessions at work and queued actions, limits grouped by provider with a
  bar at the true ratio and both ends labelled, the context used by each working session with the token total per
  model, the weights in use in plain words, and this session's own footprint (helper processes, app calls, bytes
  read) in a grey line.
- **Thresholds per provider** (`soglie`): a warning and a critical percentage, 70/90 by default, or none. They drive
  the bar colours, the summary line and the **Start all** confirmation. Above the critical threshold the choices left
  open go to another allowed provider; explicit choices are kept.
- **Where a chip runs.** Each chip has a destination: **On this computer**, **In the cloud** (new session only) or
  **Here on API credits (Claude)**, chosen in **Details**, on the row, or for several chips at once.
  - **API Claude lane**: `claude -p` on this computer, in its own worktree, on a dedicated key kept in the plugin
    options (**Anthropic API (credits)**). A monthly budget and a cap per run in USD; each run reserves its cap
    before it starts and stops at it (`--max-budget-usd`). The Load view shows the month's estimated spend against
    the budget. One run per machine, with **Release** and **End processes** when a run leaves something behind.
  - **Claude cloud**: for eligible plans with the repository connected on claude.ai/code; each cloud chip asks for
    confirmation of its full text.
  - **Destination advisor** (*Off*, *Suggest*, *Apply to chips with no destination*): it picks only where a chip
    runs; weights and profiles still pick model and effort, and explicit choices are never changed.
- **One-click Execution setup.** **Settings → Execution → What is ready** checks by itself Claude sign-in, GitHub,
  the API key, settings sources compatible with API runs, budget and cap, and offers the one action that fixes each
  missing piece: **Sign in** and **Connect GitHub** open the browser login and the panel checks again for up to
  3 minutes; **Enter the key** shows where to paste it; a blocking settings file is named with **Copy path**.
  **Set up Execution** walks through the missing steps one at a time. A command that cannot start is shown with
  **Copy**.
- **Who works.** Every chip shows engine · model · effort, then auditor · reviewer · lane, with the reason for the
  recommended choice. Presets **Recommended**, **Thrifty** and **Quality** show a preview before **Apply**;
  «changed by hand» comes with **Restore recommended**; the full choices are under **Details**, closed by default.
- **Change a running session.** **Change model** and **Change effort** on desktop sessions this panel started with
  Claude, after a confirmation and with the start guards checked again; an unverifiable outcome is shown as
  *uncertain* with **Check again** and is never retried by itself.
- **Auditor (advisor).** A per-chip auditor (Sonnet, Opus, Fable or a full model id), checked against Claude Code's
  documented advisor pairs, stored in one place with source and date; pairs outside the table cannot be chosen.
  On the API lane it is passed with `--advisor` to that run only, and the chip reports what happened (applied,
  inherited, none, turned off), with **Restart without auditor** when it is not available. On desktop and terminal
  sessions the chip tells you to type `/advisor <model>` yourself, with **Copy**.
- **Balancing profiles**: Automatic (the default, adapting to the lane), Saving, Quality, Speed and Custom, with
  manual tuning of providers, models and effort on a five-step scale and a declared simulation. On light lanes, at
  equal score, the lower-rank allowed model wins.
- **Proposals from sessions.**
  - `proponi_pesi`: a session proposes a profile or weight adjustments; the proposal appears in the Work view with
    **Review**, **Apply**, **Reject** and, once applied, **Undo**, and a log of decisions.
  - `proponi_impostazioni`: only when you ask, a session proposes a `progetto` patch (profile, board mode,
    destination advisor, restrictions) and/or an `account` patch (thresholds, API budget and cap), and the language.
    Any other field rejects the whole proposal, and so does a restriction looser than the account. A valid proposal
    fills the Settings draft under «Proposed by a session», which says when it changes the settings of all projects;
    nothing changes until you press **Apply**.
- **Settings with Apply.** Settings are organised in sections (Connections, Thresholds, Balancing, Project, Board,
  Advanced, Execution, Language, Legend). Every change goes into a draft, validated at once, and **Apply** writes it
  — project, account and language — in one compare-and-swap, so nothing is ever saved halfway; **Discard changes** drops it. A change made meanwhile by another session on the same
  field asks before overwriting; leaving Settings with a draft asks Apply, Discard or Stay. Connections are set up
  with guided pop-ups, manual budgets are removable chips with a guided **Add…**.
- **Six languages**: English by default, plus Italian, Spanish, French, German and Brazilian Portuguese, chosen in
  **Settings → Language**. Pop-ups, toasts, notifications, the board and the tools' answers follow the language.
- **Legend** for lanes (R0–R5) and terms, in Settings, on the board and in the READMEs.
- **Project board**: a local, self-contained HTML page, off by default, with the line of work (waiting for you, in
  progress, next, done) and, for each task, plan, brief, process, owner, model, effort, expected reviewer and the
  reported review outcome. **Open board** opens it in the browser. It is built without any model; one-sentence
  summaries with `haiku` are a separate opt-in with a daily cap.
- `piano` on an action (a `.md`/`.txt` path in the repository), and `revisione` on `aggiorna_azione` to report a
  review outcome.
- **Start next** (`n`) starts the first chip the real plan would start now; **▶ Start** sits in the same place on
  every ready chip; a blocked chip shows its first reason and a **Why** list.
- `risorse_agenti` lists the configured destinations with their margins, the sessions at work with their context,
  the pending proposals and the current settings a session may propose.

### Changed

- **Developer style.** States are a glyph and a word, never colour alone; data in monospace, effort as `▰▰▱▱`
  bars and usage as block bars with both ends labelled. Text uses the host's own ink and dim colour; the accent
  `#0A86C9` marks only graphics (borders, bars, glyphs, veils), at least 3:1 on light and dark backgrounds. Every
  colour and opacity comes from one token file, shared with the board as CSS variables; the board follows the
  system's light or dark theme. On desktop the row under the pointer gets a faint veil; nothing is reachable only by
  hovering.
- **Percentages always say what is used** ("76% used"), never what is left.
- **Choice chips and view tabs show only the name**; the chosen one is marked by the accent and is the primary
  button.
- **Each project has its own data folder**: `CHIPMANAGER_DIR`, then `progetti[repo].cartella`, then the global
  `cartella` (kept for compatibility), then `~/.claude/chipmanager/progetti/<owner>__<repo>`. Actions in the old
  default folder are not moved: to keep them, set that folder as `cartella`. An unreadable configuration stops reading
  and writing actions instead of falling back to another folder.
- **One compact card per chip**, following the real pane width on desktop and terminal: state, who works on it, the
  first line of the brief and the actions. Only chips waiting for a decision keep a coloured border.
- **Only configured limits** appear in the working views: a provider shows up in Load and in the summary line only
  when the project allows it and it has a measurement or a manual limit. A stale measurement stays as a grey row with
  its age; Settings shows the state of each provider's reading with its errors.
- **Lighter with many sessions open**: one adaptive heartbeat instead of four timers, an incremental cache of the
  Codex session files, the Codex lane queried only when an action would really start on Codex, actions re-read only
  when their file changes, the session list read less often while the panel is hidden.
- **Start all** names the providers above their critical threshold and asks to start anyway; closing the
  confirmation cancels.
- Tool descriptions are shorter, in English, and `risorse_agenti` is loaded on demand.
- In the terminal, below 80 columns, the sessions table drops context and activity and merges model and effort.

### Fixed

- Claude plan limits show again on the desktop app, from the current shape of `ccd_session_mgmt.get_usage`; when
  they do not apply or cannot be read, the panel says why.
- Actions saved without a project by an earlier version no longer appear in every project: a one-time pop-up offers
  to assign them to the current project or discard them (discarding can be undone).
- A successful DeepSeek balance reading no longer makes the panel reject the whole limits reading.
- A failed limits reading no longer empties the view; a successful one removes limits the source stopped reporting.
- A Codex session whose state cannot be read is shown as `—` instead of "stopped".
- **Mark done** is available on started chips directly from the row.
- A malformed profile counts as absent instead of breaking the view; decimal thresholds can be adjusted.
- Button labels are unique, so no two controls share a name.
- The disk tests use their own locks, so they never contend with a real panel or another run on the same machine.

### Security

- **API key.** The Anthropic API key lives only in the sensitive plugin option, never in a file, a brief or the
  panel. During a run it is handed over through a short-lived `apiKeyHelper` file deleted at the end. During a run
  the key is reachable by the agent and its tools; afterwards Claude's in-memory copy expires within 5 minutes,
  which does not revoke the key. Use a key dedicated to the mod, in a Console workspace with a low monthly spend
  limit: it is the only cap no local process can exceed.
- **Spend is reserved before the start**, and a run whose outcome is uncertain counts its whole cap. Budget and cap
  are read again from the configuration under the machine lock, never taken from the panel; a project can never
  loosen the account. A spend log left in a project data folder by a development build blocks the API lane, with
  its folder, until you archive it.
- **Data outside repositories.** The configuration, the data folders, the API spend log and the board are refused
  when any folder on their path is a link or junction, when their real path differs from the declared one, or when a
  `.git` folder or file sits above them; installed for a project, the mod never writes into the repository.
- **Settings that change who pays** (a gateway, a login method, an `apiKeyHelper`, credentials or base URLs in `env`)
  block the API lane in any settings source; the mod names the file and never edits it.
- **The mod never writes your Claude Code settings**, `advisorModel` included, and never gives the Fable consent.
- **Sign-in checks report only signed in or not**, never an email or an account id.
- **Settings proposals use a closed schema** checked again by the helper; keys, guards, permissions, providers and
  destinations can never be proposed.
- **The board** is refused inside a git working tree, through links or junctions, or with a foreign identity marker;
  it is written under the configuration lock only if mode and generation are still the expected ones. No scripts, no
  remote resources, a strict Content-Security-Policy, attempt tokens masked.

### Removed

- The per-card "assign to this project" button, replaced by the one-time request above.
- Placeholder rows in the Load view (*not available*, *provider not enabled*) and the FreeLLMAPI proxy line.

### Resources

- Memory footprint across sessions: not measured in this release.
- The account and project layers are additive: nothing is moved or deleted from an existing configuration. Thresholds
  or an API budget saved on a project by a development build count as that project's restrictions, and the API Claude
  lane stays off until the monthly budget is set in **Settings → Execution**.
- The auditor is set per session only on the API lane; on desktop and terminal sessions `/advisor` changes your
  default for every session.
- Extra usage credits in the cloud are not documented: check on your account.
- Dimmed text, hover and keyboard focus on the desktop app were verified only in manual testing.

Development history: the plans behind this release, in Italian, are in [`docs/`](docs/).

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

[Unreleased]: https://github.com/Elite9400/chipManager/compare/v2.2.0...HEAD
[2.2.0]: https://github.com/Elite9400/chipManager/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/Elite9400/chipManager/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/Elite9400/chipManager/releases/tag/v2.0.0
