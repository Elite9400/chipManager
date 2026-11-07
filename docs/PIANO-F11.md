# F11 — Work mode fully configurable, `--setup`, `--doctor`, improvement reports (before 2.2.0)

Owner's request (7 Nov 2026):
- Codex executor gets write permission;
- the effort default becomes `medium` on R0–R2;
- both choices — and the whole way of working — must be configurable by whoever installs the mod, or by the AI they use;
- a `--doctor` command that fully repairs settings;
- a `--setup` command that guides the whole configuration step by step:
  - models;
  - logins and the permissions needed to read quotas and use them;
  - API keys and limits;
  - way of working;

  with a graphical interface: guided chat/terminal flow or a local web page;
- the agent guide gets an opt-in section for improving the mod through GitHub issues/reports with no project data;
- technical files in English, precise, light on tokens.

## F11.1 — «Work mode» settings (one place, user- and AI-configurable)

A new `modoLavoro` object at **account** level (default for every project), with an optional per-project override in `progetti[repo].modoLavoro`. For these fields the project override **replaces** the account value; they are preferences, not guards, so the F10 «only restrict» rule does not apply.

| Field | Values | Default |
|---|---|---|
| `effortPredefinito` | per lane R0–R5: `low/medium/high/xhigh` | R0–R2 `medium`, R3 `high`, R4–R5 from `routing.json` (never lower than the lane minimum) |
| `codexSandbox` | `workspace-write` \| `read-only` | `workspace-write`, passed as `-s <value>` to the executor; the reviewer stays `read-only` always |
| `profilo` | F4 profiles | unchanged |
| `parallelo` | max sessions started at once, 1–8 | from `routing.json` |
| `consigliere` | off / suggest / apply | off |
| `auditorSuggerito` | off / on | off |
| `revisioneIncrociata` | on / off for R0–R2 (R3+ always on) | on |

Rules:
- **Guards keep priority:**
  - lane minimums from `routing.json`, R4/R5 rules, sensitive detection, permissions and the API/cloud guards always win over `modoLavoro`;
  - a value that would violate them is refused on write, with the reason, and ignored on read.
- **Where it is read:** `regoleEfficaci` and its CJS twin; the parity test is extended.
- **Settings UI:** section «Work mode» in the Account group, with the project override shown as «this project».
- **AI configuration:** `proponi_impostazioni` gets `modoLavoro` in both `account` and `progetto` patches (whitelist, user click to apply, as F7.1/F10).
- **Backward compatibility:** with no `modoLavoro`, behaviour equals today's except the two owner-approved changes:
  - effort `medium` on R0–R2;
  - Codex executor `-s workspace-write`.

  Both are declared in the CHANGELOG.

## F11.2 — `/chipmanager --setup` (guided configuration)

- **Command.** `/chipmanager` takes arguments: `--setup`, `--doctor`, `--web`. Bare `/chipmanager` still opens the panel.
- **Wizard in the panel (default).** It is graphical on desktop and step-by-step in the terminal. Steps, each skippable, with live ✓/✗ from the F6.7 checks:
  1. Language.
  2. Providers to use: Claude, Codex, DeepSeek, FreeLLMAPI, API Claude.
  3. Logins and quota permissions: Claude login, Codex login, GitHub (`gh`), each with one-click «Sign in» (F6.7) and an explanation of **what it reads and why**. Plan quotas come from `get_usage`/statusline for Claude and from local Codex sessions for Codex.
  4. API keys: only the native sensitive options. The wizard opens `/config` on the mod's row when the host allows it, otherwise shows the exact path; a key never passes through the panel.
  5. Limits: thresholds, budgets, API budget and cap.
  6. Work mode: the F11.1 fields, with presets Recommended / Economy / Quality.
  7. Summary and **Apply**: one CAS as in F10, with conflicts handled.
- **Draft rules.** The wizard writes through the F5.9 draft (epoch, freeze, conflicts).
- **Agent-run setup.** `--setup` can also be run by the AI on the user's request. The agent reads `risorse_agenti`, proposes a full configuration with `proponi_impostazioni`, and the wizard opens on the summary step with the proposal pre-filled. The user always confirms.
- **`--web` (optional local page).**
  - **Server.** `/chipmanager --setup --web` starts a helper (Node, no new dependencies) bound to **127.0.0.1** only, on a free port, with a random one-time token in the URL and an `Origin`/`Host` check. It stops after 15 minutes idle or when the setup is applied.
  - **Behaviour.** The page shows the same steps and live status by polling the helper, and writes **only** through the same CAS command.
  - **Keys.** Never accepted by the page: same rule as the panel.
  - **Opening.** The panel shows the URL and opens it with the system opener.
  - **If it cannot start:** the panel wizard is used.

## F11.3 — `/chipmanager --doctor` (repair)

Checks, then fixes **only with confirmation**, then re-checks. Each finding has a cause, a fix and an «apply» button.
- **Config.**
  - Unreadable JSON: offers to restore the last valid backup kept by the helper. **The helper keeps the last 3 valid versions on every write.**
  - Unknown or invalid fields are reported, never deleted silently.
  - Restrictions looser than the account.
  - Invalid `modoLavoro` values.
- **Paths:**
  - data folders, spend register or config inside a git tree or through links;
  - dev-build per-folder registers, offered to archive.
- **Locks:** stale API lock, Codex lane lock, mutex leftovers (same safety conditions as F6 §10/§11).
- **Connections:** providers allowed but not connected; logins missing; `gh` not authenticated when milestones are on.
- **Host:**
  - mod loaded from a stale version (a session not reloaded);
  - settings sources that block `api-claude` (named, never edited);
  - `CLAUDE_CODE_DISABLE_ADVISOR_TOOL` conflicts.
- **Actions:** orphan records, records of unknown projects.
- **Rules.** Never edits files of the user outside the mod's data folder. Never touches keys. Every fix is one CAS write. The report can be copied as text.

## F11.4 — Improvement reports to GitHub (opt-in)

- **Guide.** `docs/GUIDE-FOR-AGENTS.md` gets a short section «Help improve chipManager».
  - **When.** Only if the user agrees, the agent drafts an issue for `Elite9400/chipManager` (bug, confusing text, missing feature, cost or quality problem).
  - **What it may contain:** mod version, surface, host version, the mod's own settings shape (values redacted), error codes and messages of the mod, steps.
  - **What it must never contain:** project names, paths, file contents, briefs, branch names, session titles, code, keys, account data.
  - **Flow.** The agent shows the full text to the user and files it with `gh issue create` only after an explicit yes. Without `gh`, it gives the text and the URL.
- **`--doctor` report.** It gets «Report to chipManager». It builds the same redacted text with a **whitelist redactor**: only known fields, everything else dropped. It shows it in full and opens the prefilled GitHub new-issue URL in the browser, without sending anything itself.
- **Repository.** An issue template `.github/ISSUE_TEMPLATE/report.md` with the same fields.

## F11.5 — Docs

- English, concise, token-light, for every new technical file.
- **Guide and snippet:** updated with `modoLavoro`, `--setup`, `--doctor` and reports.
- **README (EN/IT):** new sections «Set up» and «Doctor».

## Tests

- `modoLavoro` read and write:
  - guard precedence;
  - parity TS/CJS;
  - account vs project override;
  - defaults equal today's apart from the two declared changes.
- Codex executor command has `-s workspace-write` by default and `-s read-only` when configured; the reviewer is always read-only.
- Wizard:
  - steps, skip, summary;
  - one CAS on Apply;
  - a proposal pre-fill from `proponi_impostazioni`;
  - no key ever in the panel, draft or page.
- Web helper:
  - binds 127.0.0.1 only;
  - token required;
  - foreign `Origin` refused;
  - idle stop;
  - writes only through the CAS command;
  - no key field accepted.
- Doctor:
  - each finding with a fake fixture;
  - fixes only on confirmation;
  - backup restore;
  - never edits outside the data folder.
- Report redactor: whitelist output on adversarial input (paths, names, code, keys, emails) contains none of them.
- Six languages, 60 columns.
- Checks one at a time; Codex reviews plan and diff.

## Corrections, round 1 (they prevail over everything above)

**Scope cut.** The `--web` local page is **removed from 2.2.0**: the host gives no safe lifecycle for a long-lived server (`process.run` waits ≤ 10 min, `spawn` needs a kept stream). It also adds a security surface (token exchange, Origin/Host, rebinding, CSRF) and has to stay in sync with the per-session draft/epoch. The panel wizard is graphical on desktop and step-by-step in the terminal, and it covers the request. `--web` becomes a 2.3 issue that carries these requirements.

1. **Compatibility.**
   - **Review.** `revisioneIncrociata` only controls R0–R2. R3+ keeps **today's** behaviour, including `revisore: nessuno` when chosen explicitly: no new guard.
   - **Parallel limit.** `parallelo` overrides the existing host option. Precedence: `modoLavoro.parallelo` > host option `paralleli` > default 3.
   - **Changes.** The only behaviour changes are the two the owner approved, and they are declared.
2. **Precedence.**
   - **`profilo`** is **not** copied into `modoLavoro`: it stays the existing field, paired with weights as in F4/F10.
   - **Effective effort default** = the highest of: `modoLavoro.effortPredefinito[lane]`, the lane minimum from `routing.json`, the engine/model constraints (Codex minimum, R4 ≥ high). FreeLLMAPI stays `low`. An explicit chip value keeps winning as today, within the guards.
   - **Inheritance.** Per field: absent = inherit (project → account → built-in default); `null` in a project = remove the override.
   - **Where it lives.** `regoleEfficaci` and its CJS twin, plus every consumer (`bilancia`, mandate, panel, `risorse_agenti`, advisor). The parity test covers all fields.
3. **Host contract.**
   - **Arguments.** `/chipmanager --setup` and `/chipmanager --doctor` arrive as command arguments.
   - **Opening `/config` on the mod's row.** It is not possible: the wizard shows the exact path (a copyable text) instead.
   - **Login.** «Sign in» reuses the F6.7 detached login helper. Opener: fixed argv, no shell, with a copyable URL as fallback.
   - **No `command.run`** from hooks the turn is waiting on.
4. **Web security.** Not applicable: `--web` is removed.
5. **Wizard and draft.**
   - **Draft rules.** The wizard is a view of the F5.9 draft with the same epoch/freeze/conflict rules, so it needs no extra sync.
   - **Agent-run setup.** It can pre-fill **only** fields that `proponi_impostazioni` already accepts. Everything else, such as the allowed providers (`progetto.fornitori`) and the logins, stays a user step in the wizard, marked «you».
   - **Models.** Models are chosen through the existing per-model weights (Balancing) and the providers' model lists from the rules. The wizard step says so.
   - **Codex login.** Added as a check: `codex login status`, exit code only, output never stored. «Sign in» uses `codex login` through the same detached helper.
6. **Restore.**
   - **Dedicated command.** A `ripristina-config` helper command runs under the same `configura` mutex. CAS is on the **raw bytes** observed (works on corrupt JSON).
   - **Order of operations:**
     1. copy the current file to `config.json.corrotto-<timestamp>`;
     2. validate the backup;
     3. replace atomically (write temp + rename).
   - **Backup rotation.** On every successful write, the helper keeps 3 rotated backups (`config.json.bak1..3`), each written temp + rename, with user-only permissions and unknown fields kept.
   - **No backup available.** Report it and do nothing.
   - **Spend register.** The restore never touches the spend register: config and register are separate files.
7. **Doctor without side effects.**
   - **Diagnosis is read-only.** It uses dedicated `diagnosi-*` read paths that never free locks or delete files. In particular it does not call `statoApi`/`verificaLock`, which can clean up.
   - **Each repair is a separate, existing recovery command** under its correct lock:
     - API lock: `liberaApi`, with the F6 §10/§11 conditions;
     - key-file cleanup: only through the existing safe cleanup, declared as such;
     - dev-build register: archive by rename to `.archiviato-<timestamp>`, never overwrite, reversible.
   - **Report only, never delete:**
     - forbidden paths;
     - unknown projects;
     - orphan records.
8. **Report redactor.**
   - **Contents.** Only fixed codes and enums from a closed list: mod version, surface, host version, settings **shape** (field names and types, no values), error **codes** (never message text), and the doctor finding codes. Free text is never interpolated; there are no dynamic names or paths.
   - **Before sending.** The prefilled new-issue URL **sends the body when opened**, so the panel shows the full text and asks for confirmation **before** opening it.
   - **Sending.** With `gh`: `gh issue create --repo Elite9400/chipManager --title … --body-file <temp>`, temp file deleted after. Over the URL length limit (≈ 7,000 characters), copyable text only.
   - **Guide.** The agent-facing section says the same: codes only, user confirmation first.
9. **Sandbox and texts.**
   - **Sandbox.** `-s workspace-write` allows edits but `.git` stays protected and the network is usually off. The mandate gives **commit and push to the coordinating Claude session**; Codex edits only. The reviewer stays `read-only`.
   - **Tests.** Added for:
     - the concurrency cases above;
     - the API/cloud/LAN guards;
     - nested secrets.
   - **Text budgets:**
     - `risorse_agenti` keeps its 4,000-character cap;
     - additions to the guide ≤ 250 words;
     - additions to the snippet ≤ 40 words;
     - new tool-description text ≤ 300 characters in total.

## Corrections, round 2

- **N1 — `consigliere` compatibility.** `consigliere` is **not** moved into `modoLavoro`. It stays where it is today (`progetti[repo].consigliere`, F6.5), with the same proposals path. The wizard edits it in place. `modoLavoro` has no `consigliere` field, so there is no double source and no precedence to define.
- **N2 — Restore must not revive stale identities.** `ripristina-config`, after restoring a backup:
  - sets every monotonic counter to **max(current-observed, backup) + 1**, never back to an older value. The current values come from the corrupt bytes when parseable per field, otherwise from a counter file kept beside the backups on every write. The counters are `board.generazione` per project, `pesiRevisione` per project and the config `versione`;
  - sets `pesiOrigine` to `{ tipo: 'manuale' }`, so earlier weight proposals cannot be undone against restored values;
  - marks pending board work as stale through the generation bump, so it is never published.

  Test: work started at generation 3 → change to 4 → corruption → restore of backup 3 → the old work is refused and the generation is 5. Same pattern for `pesiRevisione` with an «Undo» on an applied proposal.
