# Changelog

All notable changes to chipManager are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/Elite9400/chipManager/compare/v2.1.1...HEAD
[2.1.1]: https://github.com/Elite9400/chipManager/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/Elite9400/chipManager/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/Elite9400/chipManager/releases/tag/v2.0.0
