# Changelog

All notable changes to chipManager are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
  usage turned off) disappears; Claude API spend is tracked on its own.

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
