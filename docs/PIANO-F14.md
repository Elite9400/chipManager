# F14 — More baseline skills: caveman, the full Matt Pocock set, per-repository setup (2.2.0) — v2

Builds on F13.7 **as it will be after branch claude/rc-fix is merged** (prerequisite): the integrity fingerprint is the
sha256 of the whole plugin tree on raw bytes (every file, scripts and local dependencies included, additions/removals
change it), host markers only in the host's exact form, executable bit on POSIX, unknown components refused. F14 starts
only after that merge and its tests. Every F13.7 guard stays as is. Install scope stays **user** only (project scope: 2.3).

## F14.1 caveman
- Source `JuliusBrussee/caveman`, plugin `caveman`. Channel: the mod's local marketplace `chipmanager-base` (existing F13.7
  path), entry `source: { source: 'github', repo, sha }`, `defaultEnabled: false`, `--scope user`.
- Pin by tag: expected commit `1e91f1306d602d4ca23618701b1185575ae1869b` and expected tag object
  `5831edc2f57b6c4a274dcc9e2e433988d97eb23d` (annotated tag `v4.1.0`). New resolver kind `tag`: `git ls-remote` of the exact
  refs `refs/tags/v4.1.0` and `refs/tags/v4.1.0^{}`; annotated: tag object and peeled commit must both match; lightweight:
  the simple ref must equal the commit. Absent, ambiguous or mismatching refs refuse. Re-checked right before install;
  the download is always the pinned commit, never the tag name.
- Flow class: **external** (its `caveman-compress` skill sends file text to the configured model provider, rewrites the
  file and stores backups outside the repository). Therefore blocked in `soloLocale` projects at install and at enable,
  re-checked after the consent, exactly like other non-local entries.
- Self-running: four `command` hooks (SessionStart, SubagentStart, UserPromptSubmit, SessionEnd → `node src/hooks/…`).
  They change the answer style for every session once enabled, whatever the mandate says. So: installed disabled;
  enabling asks an explicit consent that says it runs Node at every session/prompt and changes the style everywhere in
  the user scope. Requirements shown: `node` plus any shell/utility the hook commands need (implementer: read them at the
  pinned sha). Work mode's `skillBase` stays a boolean per skill (recommendation in mandates); no per-role style switch.
- Never the caveman CLI (`@caveman-ai/cli`, telemetry with IP) nor its curl/irm installers.

## F14.2 The full Matt Pocock set
- The official marketplace entry decides the pin (`source.sha`, today `49dd158d1076134a641b33efb035946536778336`); the mod
  installs only `mattpocock-skills@chipmanager-base` from its own marketplace with `source: { source: 'url', url, sha }` and
  `defaultEnabled: false` (existing F13.7 path). At that sha `.claude-plugin/plugin.json` lists 27 skills: the consent
  shows the actual list read from the approved revision (names), not a hard-coded one.
- Never `npx skills`.

## F14.3 Per-repository setup («configured for every project»)
- When `mattpocock-skills` is installed **and enabled and loaded** (verified), the mod proposes in each repository, once,
  a chip «Set up Matt Pocock skills» that runs `/mattpocock-skills:setup-matt-pocock-skills`. It is an ordinary chip under
  the normal rules: lane from the risk detector (it edits CLAUDE.md/AGENTS.md, writes docs/agents/*, may create GitHub or
  GitLab labels: at least R2, interactive, never cloud/API by default), the user starts it. Also proposed in a new
  repository when the plugin is already installed. Per-repository record with states proposed / dismissed / done; a
  manual «propose again» in the doctor.

## F14.4 Registry
- Entries keep identity fields (id, plugin, repo, pin kind incl. the new `tag`, pinned commit and tag object, marketplace,
  channel, flow class, notes). A future entry is «registry + tests» only if it uses channels and component kinds already
  supported; otherwise it is new work. TS/CJS parity extended to behaviour, types, validators and six languages.

## Out of scope (2.3 issues)
Project install scope; user-defined custom entries; entries for another project of the owner until the owner provides the list.

## Exit gate
Tests failing before and passing after: tag resolver (annotated, lightweight, moved during consent, re-annotated on the
same commit, absent, ambiguous); caveman blocked in soloLocale at install and enable, re-check after consent; enable
consent text; script tampering at the pinned sha changes the fingerprint (relies on the prerequisite); Pocock list read
from the approved revision; setup chip proposed only when installed+enabled+loaded, once per repo, dismissed/done states,
new repo with existing install, setup chip lane ≥ R2 and local; registry parity. Four checks green (kit, Node, validate,
tsc 0). CHANGELOG [2.2.0], README (en + it), docs/site (settings/models: baseline skills). No real network or installs.

## Corrections, round 2 (override the text above)
1. F14.1 tag: an entry with an expected tag object refuses when the peeled ref `^{}` is absent (no lightweight fallback,
   even on the same commit). Lightweight is accepted only for entries without an expected tag object. Test «annotated →
   lightweight, same commit» refuses.
2. F14.3 start constraints are mandatory and re-checked at start, also after the user edits the chip: executor Claude,
   destination local and interactive, lane ≥ R2. At start, re-check that `mattpocock-skills` is installed, enabled and the
   command is available; otherwise the chip is blocked with a reason. Tests: plugin disabled after the proposal; executor
   or destination changed by the user.
3. F14.3 record: tied to the chip id and to the repository identity the project already uses; created atomically (no
   duplicate proposals from concurrent sessions). `done` only when the chip is actually completed (not on start or on
   delivery in the worktree); failed or discarded chips allow recovery (propose again). Exit gate covers these cases.
