# F13 — Fable 5.2 as director, local models, documentation site, full error sweep (before 2.2.0)

Owner's request (11 Nov 2026):
- integrate the new Claude Fable 5.2 as the **director** model: it plans, writes the prompts and assigns work to Opus 5.5 or Sonnet 5.5 by task, or to local models (Qwen and others);
- find and fix every possible error so 2.2.0 is complete;
- replace the in-panel Legend with graphical HTML pages explaining every function, lanes and how to use the AI models best, hosted on the project's GitHub (wiki or Pages), with the panel linking to them;
- split all of this by model per task, and analyse each objective as the best expert would.

## 0. Facts (Anthropic docs bundled with Claude Code 2.1.321, cached 3 Nov 2026)

- **Model.** `claude-fable-5-2`: most capable widely released model, 1M context, 128K output.
  - **Price:** $8/$40 per MTok, cheaper than Fable 5.1 ($10/$50). Opus 5.5 is $4/$20; Sonnet 5.5 is $2/$10.
  - **Thinking** is always on and effort goes from `low` to `max`. Start at `high`; use `xhigh` only where a gain is measured.
- **Advisor.** A Fable 5.2 executor accepts only `claude-fable-5-2` or `claude-mythos-5-2` as advisor. Which executors accept Fable 5.2 as advisor: check the pairing table in the official docs before coding.
- **Claude Code.** Uses it as `--model claude-fable-5-2` / `/model fable` (alias resolution to verify) and as advisor `fable`.
- **Local models.** Non-Anthropic models inside Claude Code through gateways are **not supported**. Local models can therefore be used only as the mod's separate **external executor**, which today is FreeLLMAPI, on an OpenAI-compatible local endpoint such as Ollama or LM Studio. They are limited to text tasks R0–R1, as today.

## F13.1 — Fable 5.2 support (models, routing, advisor)

- **Model lists.** Add `claude-fable-5-2` to the Claude model list, rank, display name, family colour (Fable), the `tetto` map, and to `AUTORI_R4` next to Fable 5.1.
  - **Fable alias.** The `fable` alias resolves to `claude-fable-5-2`.
  - **Fable 5.1** stays selectable.
- **Advisor pairing table.** Update it with the 5.2 rows from the official table (dated source). An executor on Fable 5.2 only gets Fable 5.2 / Mythos 5.2 advisors.
- **Effort.** The default for Fable 5.2 work is `high`. `xhigh` only by explicit choice.
- **Texts.** Tool descriptions (`suggerisci_azione.modello`), the guide and the snippet list the new id, within the text budgets.

## F13.2 — Director mode («dirigente»), configurable (F11 rule)

- **What it is.** A new `modoLavoro.dirigente`:
  - `modello`: default `claude-fable-5-2`;
  - `quando`: `off` | `R3+` | `sempre`, default `R3+`;
  - `lavoratori`: per lane, the default worker model. R0 = local if configured, otherwise Haiku 5.5; R1–R2 = Sonnet 5.5; R3 = Opus 5.5; R4–R5 = Opus 5.5 with Fable as reviewer, as today.
- **How it works.**
  - **The director chip.** When a chip falls under `quando`, it starts as a **director chip**: a session on the director model whose mandate (English, short) asks it to:
    1. analyse the goal;
    2. write a plan;
    3. split it into worker chips through `suggerisci_azione`, with `corsia`, `dipende` and a self-contained brief each. It leaves `modello` and `effort` empty so the mod's balancing applies the worker defaults, or sets them explicitly only when the task needs it;
    4. track and review deliveries (`aggiorna_azione`).

    The director writes no code itself unless the task is tiny.
  - **Workers** are ordinary chips: every existing guard applies (lanes, sensitive R4/R5 on Opus/Fable with a reviewer, Codex rules, API/cloud guards, the owner's approval to start).
- **Cost.**
  - **Cost of the director.** The panel shows the director's share as its own line.
  - **Small tasks.** `quando: R3+` keeps director cost off them.
  - **Cheaper option.** The guide explains when a single Opus session is cheaper.
- **Limits.** If Fable 5.2 is not available on the account (no access, or a plan without consent), the director falls back to Opus 5.5 and says so. Never silently.
- **Configurability.** Settings → Work mode, `--setup` step 6, `proponi_impostazioni` (account/project), `risorse_agenti` summary.

## F13.3 — Local models (Qwen and others)

- **The executor is generalised.** The external executor becomes «local / OpenAI-compatible»: endpoint (default `http://localhost:11434/v1` for Ollama, or LM Studio) and model list (for example `qwen3-coder`, `qwen3`, `llama`). The existing FreeLLMAPI configuration keeps working as one preset.
- **Where it runs.**
  - **Endpoint.** Only on localhost or LAN private addresses (existing `endpointLocale` check); no key required for localhost.
  - **Lanes.** Allowed lanes R0–R1, as today. A project may restrict further.
- **The work it gets.** Text tasks only: summaries, docs, triage, test ideas. The director can assign R0 work to it.
- **In the wizard.** `--setup`'s Providers step detects a local endpoint: it calls `GET /v1/models` with a short timeout, localhost only, and lists its models.

## F13.4 — Documentation site (replaces the in-panel Legend)

- **Where.** Static HTML pages in `docs/site/`, built for **GitHub Pages** (served from `/docs/site` on `main`), with one shared CSS file using the same tokens as `tema.ts`. The design is by Codex astra, matching F12.
- **Pages:**
  - **Overview:** what the mod is.
  - **Quick start:** `--setup`.
  - **The panel:** Work, Load, Settings.
  - **Chips and their life cycle.**
  - **Lanes R0–R5.**
  - **Models and how to use them best:** director and workers, effort, advisor, cost per task, local models.
  - **Where to run:** local, cloud, API credits.
  - **Work mode and settings:** Account and Project.
  - **Doctor and reports.**
  - **Board.**
  - **For agents:** links to GUIDE-FOR-AGENTS.
  - **FAQ / troubleshooting.**
- **Writing.** English (technical files rule), concise. Every claim is checked against the code. No real data, demo screenshots only, light pages.
- **The panel's Legend section.** It is replaced by a compact «Help» section: a one-line meaning per lane, needed in the panel to read chips, plus links that open the relevant site page with the system opener (fixed URLs on `elite9400.github.io/chipManager/...`, validated like the report URL). The Legend README sections become links too. The legend text leaves the six dictionaries except the short lane lines, so the mod gets lighter.
- **Publishing.** Pages needs the repository setting «Pages: deploy from branch main /docs/site». That is a repository setting change: the **owner's explicit yes** is needed at release time. Until then the links point to the files on GitHub (`github.com/Elite9400/chipManager/blob/main/docs/site/...`) as a fallback.
- **No GitHub wiki:** it is a separate repository, not versioned with the code.

## F13.5 — Full error sweep (release gate)

- **Audits.** Run read-only, as **independent** reviewers in parallel where RAM allows, otherwise one after the other:
  - **Codex `gpt-6.1-sol`: code correctness and regression audit** of the whole mod at main HEAD:
    - every helper command;
    - concurrency (mutex/CAS);
    - error paths;
    - i18n completeness;
    - dead code.
  - **Claude Opus 5.5 with the `security-review` skill: security audit**:
    - secrets;
    - path checks;
    - process spawning (argv, no shell);
    - URL opening;
    - report redaction;
    - prompt-injection surfaces in briefs and tool inputs.
  - **Doctor on a demo config:** run with fixtures for every finding code.
- **Fixes.** Every High/Medium finding is fixed by Opus 5.5 with a test. Low findings are fixed or listed in the CHANGELOG as known limits.
- **Gate.** The full checks are green (kit, Node, tsc, validate), plus a final review of the fixes by the other engine.

## Model per task (the owner's «divide by model»)

| Task | Model | Why |
|---|---|---|
| F13 plan | Opus 5.5 (master) | coordination |
| Plan review | Codex gpt-6-astra | independent competitor |
| F13.1–F13.3 code | Opus 5.5 session | guards, concurrency, tests |
| F13.4 site design and HTML | Codex gpt-6-astra | the owner asked for a strong designer |
| F13.4 content check | Sonnet 5.5 | factual check against the code, cheaper |
| F13.5 correctness audit | Codex gpt-6.1-sol | competitor engine, whole codebase |
| F13.5 security audit | Opus 5.5 + security-review | sensitive surface |
| Fixes | Opus 5.5 | |
| Fix review | Codex gpt-6-astra | other engine |

(Fable 5.2 cannot be chosen for these sessions: session starts here accept only the same tier as the master or a cheaper one. The mod's director mode is where it is used.)

## Tests

- **Fable 5.2:** ids, alias, rank, advisor pairs, R4 authors.
- **Director:**
  - `quando` thresholds;
  - mandate text within budget;
  - worker defaults per lane;
  - fallback to Opus with notice;
  - guards unchanged for worker chips;
  - TS/CJS parity;
  - wizard and `proponi_impostazioni` fields.
- **Local executor:**
  - endpoint validation (localhost or LAN only);
  - model discovery with a fake server;
  - lanes R0–R1 only;
  - the FreeLLMAPI preset still works.
- **Help:**
  - lane lines in six languages;
  - links validated, with fixed host and path list;
  - Legend keys removed except the lane lines.
- **Site:**
  - links between pages;
  - no external scripts;
  - an accessibility check (headings, contrast via the shared tokens).
- **Checks** run one at a time.

## Owner's additions (11 Nov 2026) — they extend F13

**Goal for beginners: "I install it and it does everything".** Every problem a beginner can hit must be solvable from `--setup` or `--doctor`, in the terminal or the GUI, without editing files or typing commands.

### F13.0 — Path check too strict (bug, fixed first in its own branch)

Real case: the user's `.claude` folder is a junction to another drive, and F10's chain check refuses any link among the ancestors. New rule:
- links are allowed **above** the data root;
- the **real** path must not be inside a git tree or the project repository;
- no links **inside** the data root.

`--doctor` offers to move data to the safe default folder in one click, with confirmation. This is handled in the branch `claude/fix-percorsi`.

### F13.3b — More providers, connected with one click

- **Provider registry.** It is one table, the same in TS and CJS. Each entry has: id, display name, base URL (OpenAI-compatible), how the key is obtained (key page URL), whether it is local, and which models it lists. Entries:
  - DeepSeek (existing);
  - **OpenRouter**;
  - **Qwen API**: Alibaba Cloud Model Studio, OpenAI-compatible endpoint — check the official URL;
  - Mistral;
  - Groq;
  - **local**: Ollama, LM Studio, vLLM — any OpenAI-compatible localhost or LAN server;
  - FreeLLMAPI (existing preset).
- **Connecting.** «Connect» on each provider:
  1. opens its key page in the browser (system opener, fixed URLs from the registry only);
  2. shows where to put the key: the native sensitive option of that provider;
  3. checks the key with one cheap `GET /models` call, only on click.

  Keys never pass through the panel.
- **OpenRouter.** If the official PKCE flow can be used with a localhost callback inside the host limits, do it. Otherwise use the key page.
- **Local servers** are detected automatically (`GET /v1/models`, short timeout, localhost only). Their models are listed with no key.
- **New `userConfig` fields** in `plugin.json`: one sensitive option per provider key.
- **Guards for every external provider:**
  - they are never used for sensitive chips (R4/R5);
  - they get the same LAN-data filter and text limit as the cloud;
  - they need explicit opt-in per project;
  - text tasks only (no repository access): these models write text; they do not run tools.
- **Local servers.** They run on this machine or the LAN, so the LAN-data filter does not apply. Sensitive chips are still not allowed by default; a project may allow R4 text on a local model only with explicit consent.

### F13.6 — Configurable work pipelines (director → writer → reviewer → rewrite)

- **Pipeline field.** It sits in `modoLavoro.pipeline`, configurable by user or AI (F11 rule):

  ```
  pipeline: {
    regista: 'claude-fable-5-2' | 'claude-opus-5-5' | …,
    scrittore: { provider, modello },    // e.g. local Ollama qwen3, OpenRouter model, or a Claude model
    revisore: 'claude-fable-5-2' | 'claude-opus-5-5' | 'codex',
    giri: 1..3                           // review → rewrite rounds
  }
  ```

  The examples above are a sketch, not the final field names.
- **What the director does.** It turns a goal into a chain of chips:
  1. write (writer);
  2. review (reviewer);
  3. rewrite (writer), using `dipende`;
  4. up to `giri` rounds.

  Each chip is an ordinary chip with all guards, and starts only with the owner's approval. «Start all» starts a ready chain in order, with the existing confirmations.
- **Writer chips on external or local models:**
  - they produce text (docs, drafts, translations, test ideas);
  - the review chip runs on Claude or Codex in a worktree and applies or rejects the text;
  - external models never get repository access.
- **Presets in Settings/`--setup`:**
  - «Director + local writer»: Fable 5.2 → Ollama → Opus review;
  - «Economy»: Sonnet writer, Opus review;
  - «Quality»: Opus writer, Fable review.
- **Cost.** The panel shows each role's cost: plan, API money, or local free.

## Corrections, round 1 (they prevail over everything above, the owner's additions included)

1. **Director launch.**
   - **Where it runs.** A director chip runs on `claude-fable-5-2` only through a path that can start it:
     - the desktop `start_session` when the launching session's tier allows it;
     - otherwise the existing **CLI lane** (`claude --model claude-fable-5-2` in the chip's worktree, subscription credentials).
   - **When it cannot start.** The chip says why and names the two ways. It is never diverted automatically to API or cloud, and after an uncertain outcome there is no second start on Opus.
   - **Fallback to Opus.** It is only an explicit owner choice («Run director on Opus»).
2. **No recursion, no deadlock.**
   - **Persisted fields:** `ruolo: 'dirigente' | 'lavoro'` and `padre: <id>`.
   - **Children are never directors.** Depth is 1.
   - **Limits, configurable:** at most `maxFigli` children per director (default 8) and `maxRipiani` re-plans (default 2). Beyond them the helper refuses and the director stops with the reason.
   - **Capacity.** A director waiting for its children is in the state `attesa-figli`, which does **not** count against `parallelo`.
   - **Tests:** `parallelo=1` with a director and children; restart and idempotency; cancelling the director.
3. **Inherited constraints, outside the text.**
   - **Child record.** It stores `vincoliPadre`: the parent's sensitivity, lane minimum, LAN-data flag and allowed providers. These are copied by the helper from the parent record, never from the brief.
   - **Validation.** `valida`/`sensibile` take the stricter of the child's own text and `vincoliPadre`, so rewording cannot drop R4 or LAN indicators.
   - **Untrusted data.** Writer outputs, local or external, are untrusted.
   - **Approval.** The director's approval never authorises its children, settings or direct starts: each child still needs the owner's start.
4. **Reviewer matrix.**
   - **`routing.json` and `revisoreConcreto`** are updated for Fable 5.2: author Fable 5.2 → reviewer Opus 5.5 and vice versa. The reviewer is always different from the author. R4/R5 keep human review. The Codex reviewer stays read-only.
   - **The director never reviews** the work it planned. An independent reviewer is required.
5. **Ids and compatibility.**
   - **Explicit ids** everywhere. The alias `fable` resolves to `claude-fable-5-2` in the mod's own table, not by relying on `/model fable`, which maps to Fable 5 in the Claude apps gateway.
   - **Doctor check:** Fable 5.2 needs Claude Code ≥ 2.1.321.
   - **Advisor pairs.** Fully updated from the official table, which allows Fable 5.2 as advisor for every listed executor; Fable/Mythos 5.2 executors accept only those two. The parser accepts the Mythos ids.
6. **Enforced cost limits.**
   - **Limits the orchestrator enforces:** max children, max re-plans, max pipeline rounds. Where money is measurable (API lane) there is also a money cap per director chain.
   - **Cost display** distinguishes *estimated*, *observed* and *unknown*. The host's `session.usage()` gives only the current session's cost, so child costs come from their own records or are «unknown».
   - **Fable consent.** The panel states that Fable usage may bill extra usage where the plan requires it.
7. **Local endpoints.**
   - **Loopback only** for 2.2.0. LAN trust is not added and goes to a 2.3 issue.
   - **Allowed levels** are as today (`niente`/`R1`/`R2`); no restriction is introduced.
   - **No data is assumed local because of the URL.** An Ollama server can proxy cloud models, so the LAN-data filter and the text limit apply to **every** non-Claude provider, local included.
8. **Generic OpenAI-compatible executor.**
   - **It is a separate contract next to FreeLLMAPI**, with FreeLLMAPI's protections kept:
     - optional key;
     - model ids matching `^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$`, colons allowed;
     - catalogue check against `/v1/models`;
     - fixed timeout;
     - redirects refused;
     - tool calls in responses refused;
     - the key-leak check only when a key is set.
   - **LM Studio.** Optional auth header; a model listed but not loaded is reported as «not loaded».
9. **Precedence.**
   - **Order, highest first:**
     1. explicit chip choices;
     2. pipeline/director worker defaults;
     3. `modoLavoro` defaults;
     4. balancing weights.

     Guards always win.
   - **Nested values.** A nested `null` removes that override (F11 rule).
   - **Code.** Both twins (TS and CJS) and the deep whitelists are extended.
   - **`proponi_impostazioni`** stays request → draft → Apply/CAS. It cannot enable a provider, add a key or widen a guard.
10. **Pages.**
    - **Publishing source.** Pages publishes from `/docs` on `main`, so the site is under `docs/site/` and served at `https://elite9400.github.io/chipManager/site/`. The repository setting needs the owner's yes at release.
    - **Help links** use a dedicated whitelist of exact URLs, separate from the report URL check, which stays unchanged.
    - **Before Pages is on**, Help shows the URL as copyable text (no `blob/` HTML source links).
11. **Gate.**
    - **Tests:** every case above, plus restart and idempotency, cancellation, uncertain attempts and concurrent edits.
    - **Translations:** all new controls and errors in six languages; 60 columns.
    - **Text budgets:** tool-description budgets kept; `risorse_agenti` ≤ 4,000 characters; director mandate ≤ 1,500 characters.
    - **Audits** run on the final F12 + F13 candidate, serially. No real local model is loaded in tests.
    - **No promise of «every possible error»:** the CHANGELOG lists the verified scope.
12. **Owner's additions (F13.0, F13.3b, F13.6).**
    - **F13.0** is in progress separately.
    - **F13.3b and F13.6** follow the rules above:
      - every external provider is opt-in per project and never sensitive;
      - the LAN-data filter applies;
      - text only;
      - keys only in native sensitive options;
      - fixed URLs from the registry;
      - pipelines are chips with `dipende`, `padre` and inherited constraints, with the limits of points 2 and 6.

## Corrections, round 2 (they prevail over round 1 where they differ)

- **N1 — CLI lane billing.**
  - **Before every CLI-lane start** (director or not), the helper runs the same source check as `api-claude` (§6/§7 of F6), in reverse.
  - **What blocks the start.** Any of these makes the start refuse, naming the source but never the value:
    - an inherited `ANTHROPIC_API_KEY`;
    - an inherited `ANTHROPIC_AUTH_TOKEN`;
    - an `apiKeyHelper`;
    - a gateway or provider selector, in env or in any settings source (user, project, local or managed).
  - **Environment.** The child environment drops those variables explicitly. It runs only on subscription credentials. Test with each source.
- **N2 — Pipelines with real hand-off.**
  - **Dependency type.** Pipeline steps use a new dependency type, `dopoConsegna`, which advances when the predecessor is `consegnata` **with an artefact**. The existing `dipende` keeps waiting for `completata`.
  - **Artefacts.** They are versioned files in the data folder, `artefatti/<catena>/<giro>-<ruolo>.md`, written by the helper (size cap) and checked with the path rules.
  - **Hand-off to the next step.** The next mandate receives the predecessor's artefact **content**. External or local writers get it in their prompt after the LAN-data filter and the text limit are applied to the **whole** resent text. Claude steps get it as a file path in their worktree.
  - **Who applies the text.** The step that applies text to the repository is always a **Claude** chip, the «applier». With a Codex reviewer, Codex writes a feedback artefact (read-only) and the applier or the next writer round uses it. Codex never applies.
  - **Rounds.** The `giri` limit and the money cap stop the chain, and the panel shows each artefact.
- **N3 — Advisor matrix for Claude Code.** The mod uses the **Claude Code** advisor table, not the Messages API one. A Fable 5.2 executor accepts only `claude-fable-5-2`. Mythos ids are recognised but **not enabled**. The table carries its source URL and date.
- **N4 — Key check separate from discovery.**
  - **Registry entries** carry `verificaChiave`, for example OpenRouter `GET /api/v1/key`, and `catalogo`, the model list, separately.
  - **OpenRouter PKCE** only if the obtained key can be written into the provider's native sensitive option through the host. Otherwise the key page.
- **N6 — Qwen region.**
  - **Region option.** The Qwen entry has an explicit region choice from a validated host list taken from Alibaba's documentation: international, US and China endpoints. A workspace-specific host is accepted only if it matches the documented pattern.
  - **Default** is international.
  - **Endpoints.** Mistral `https://api.mistral.ai/v1` and Groq `https://api.groq.com/openai/v1` are confirmed.
- **N5 — Mutex identity under junctions.** Every mutex, lock and register key is canonicalised with `realpath`, and there is a concurrent test on the two aliases. This is part of the F13.0 branch.

## Corrections, round 3

- **N1 — All the child's settings sources, fail-closed.**
  - **Sources read.** The credential check (CLI lane and `api-claude`) reads the sources the child will really use:
    - the four files;
    - **every** managed source the host exposes through `$.settings.read({ source })`: policy, meaning OS-level managed settings and server-managed settings.
  - **Who reads them.** The panel reads them right before the start and passes the facts, not the values, to the helper. The helper re-reads the files it can read.
  - **Fail-closed.** A source that cannot be read or verified **blocks** the start, with its name.
  - **Shared code.** The same function serves both lanes, so `api-claude` gets the extension too.
  - **Tests.** A blocking value in each source type; an unreadable policy source.
- **N2 — Rewrite gets draft + feedback.**
  - **What a rewrite step receives:** the **draft artefact of version N** plus the **feedback artefact referring to version N**, by id. The helper checks that the reference matches.
  - **Limits.** The LAN-data filter and the text limit apply to the combined text.
  - **If the combined text is over the limit,** the step stops with the reason. Nothing is truncated silently.
  - **Test.** Feedback «fix the second paragraph» without repeating the draft: the writer's prompt contains draft v1 and the feedback, and the output is v2.

## F13.7 — Baseline skills installed and configured by the mod (owner's request, 11 Nov 2026)

The mod sets up a **baseline of working skills** if they are missing, and makes the models use them:
- **TokenEconomizer**: `microsoft/TokenEconomizer`, launched 8 Nov 2026. It cuts tokens through repository-level learning, micro-skills, tool pruning and failure-loop intervention.
- **ponytail**: `DietrichGebert/ponytail`.
- **superpowers**: `claude-plugins-official`.
- **handoff**.
- **grill-me / grilling**.
- the others named in the previous version.

**List.** One registry in the mod, `skillBase`, the same in TS and CJS. Each entry has: id, marketplace source (`owner/repo`), plugin name, what it does in one line, data flow (local only / sends data, verified from its docs), and the instruction text the mandate adds when it is installed.

**Install, in `--setup` («Baseline skills») and `--doctor`.**
- **Detection.** The mod detects what is installed with `claude plugin list`, exit code plus parsed names, and never stores raw output.
- **Proposal.** It lists what is missing, with source and data flow.
- **«Install» one click per skill, or «Install all».** It runs `claude plugin marketplace add <owner/repo>`, then `claude plugin install <name>@<marketplace> --scope user`: argv with no shell, sources only from the registry, a confirmation listing exactly what will run, and progress and outcome shown.
- **Never silent.** Installing third-party code always needs the owner's click.
- **Afterwards.** «Reload» or `/reload-plugins` is offered.

**Use.**
- **Mandate instruction.** The mandate of every chip adds a short English line for each installed baseline skill, ≤ 200 characters in total, for example «Use ponytail and TokenEconomizer». The guide and snippet say the same.
- **«Obliges».** The mod cannot enforce what a model does inside a session. It enforces the **setup** and the **instruction**, and `--doctor` flags missing baseline skills.

**Configurable (F11 rule).**
- **Field.** `modoLavoro.skillBase`: list on/off per skill, in account settings with an optional project override. Default: all on.
- **Who changes it.** It is editable by the user or proposed by an AI through `proponi_impostazioni`, request → draft → Apply only.
- **What a proposal cannot do.** It cannot add a source outside the registry.

**Safety.**
- **Sources.** Registry sources are fixed `owner/repo` strings validated by pattern. No URL from settings or from an agent.
- **Data flow.** If a skill's docs show it sends data off the machine, the setup says so before installing. That skill is **off by default** in projects that set `soloLocale`.
- **Failures.** A failed install or an unknown marketplace stops with the reason; no retries loop.

**Tests.**
- Detection parse.
- Install argv exact and no shell.
- Confirmation required.
- Mandate line within budget and only for installed skills.
- `soloLocale` keeps skills that send data off the machine disabled.
- Registry parity TS/CJS.
- Six languages.

### F13.7 — Corrections, round 1 (they prevail over F13.7)

**Scope.** For 2.2.0 the mod **recommends, explains and installs on the owner's click**. It does not claim to enforce skill use, and it does not toggle global plugins per chip.

1. **TokenEconomizer: dedicated procedure, experimental.**
   - **Install steps.** Follow the official quick start:
     1. a persistent clone in the mod's data folder;
     2. `claude plugin marketplace add <absolute path>`;
     3. `claude plugin install tokeneconomizer@tokeneconomizer`;
     4. the `status` check.
   - **Prerequisites.** Python ≥ 3.10 and, on Windows, Git `sh`. Both are checked before the install, with the reason if missing.
   - **Compatibility.** Its declared compatibility stops at Claude Code 2.1.310, and the target is ≥ 2.1.321. It is therefore labelled «experimental — not verified on your Claude Code version» and is **off by default**.
   - **Pruning.** Tool pruning (`toolprune`) stays at propose/off. The mod never lets it change deny-lists.
   - **Dates.** No launch date is shown.
2. **Registry with full identity, deduplicated.** Each entry records: source repository, marketplace name, plugin id, and the skills it contains.
   - **Entries:**
     - `ponytail@ponytail` from `DietrichGebert/ponytail`;
     - `superpowers@claude-plugins-official` from the official marketplace;
     - `mattpocock-skills@claude-plugins-official`, one bundle with handoff, grill-me and grilling, declared as a bundle;
     - TokenEconomizer as in point 1.
   - **Unlisted skills.** «Others from the previous version» is removed until it is listed by name.
3. **On/off is honest.**
   - **What «off» means.** «Off» in the mod means: not installed by the mod, not proposed, and not named in mandates. It does **not** disable a plugin the user installed globally.
   - **Doctor.** It shows installed baseline plugins and offers `claude plugin disable <id>` or `enable` on click, respecting managed policy (locked → shown as locked).
   - **soloLocale.** It **blocks** installing or enabling, from the mod, any plugin whose data flow is not local-only, and the doctor flags enabled ones.
   - **Consent.** Turning on a plugin with external effects needs its own consent, separate from the install.
4. **Data flows and costs declared before install.** Per entry: what data goes where, how long it persists, and the cost.
   - **TokenEconomizer:** extra `claude -p` calls, normally Haiku, with digests of commands, errors and file names, billed to the user.
   - **Superpowers:** the visual-companion telemetry, as documented.

   An unknown flow means the entry cannot be enabled automatically.
5. **Supply chain.**
   - **What the owner approves.** The install confirmation shows the source and the exact commit: the mod resolves the default branch head with `git ls-remote` before installing and records it. The owner approves that commit.
   - **Updates.** The mod never updates plugins. A later change of the installed commit is shown by the doctor as «changed since you approved it».
   - **Hooks.** The confirmation lists the hooks declared in the plugin manifest and warns that hooks run with the user's privileges.
6. **Use by role, never bypassing chips.**
   - **Mandate lines.** They name only skills that are **enabled and relevant to that role**:
     - ponytail and TokenEconomizer for workers writing code;
     - superpowers review/plan skills for directors and reviewers.

     They never name user-invoked skills such as handoff and grill-me, which are offered to the owner in the panel as commands.
   - **Delegation.** A mandate line never authorises a skill to delegate, create worktrees or start sessions outside chips, approvals and the independent reviewer. The director mandate says so explicitly.
   - **Scope.** The lines are Claude-only: Codex and external writers get none.
7. **Detection and budget.**
   - **Detection.** It uses `claude plugin list --json`, validated, with full identity, scope, enabled state and availability. A command error means «unknown», never «absent».
   - **Mandate line.** ≤ 200 characters, **inside** the director's 1,500 cap and the workers' existing budgets.
   - **Measurement.** The tokens the enabled plugins load (skills and hooks) are measured separately and shown in the Load view as «plugin overhead» when measurable.
   - **Tests.**
     - disable/enable;
     - managed policy;
     - reload;
     - conflicting duplicates;
     - JSON errors.

### F13.7 — Corrections, round 2

1. **Install exactly the approved revision.**
   - **Local marketplace.** The mod writes its **own local marketplace** (`marketplace.json` in the data folder). Each entry points to the plugin's real source repository with `source.sha` set to the approved revision. Pinning by `sha` is a documented marketplace feature.
   - **Which revision.** It is the plugin source's own revision, resolved from the upstream marketplace entry when there is one (e.g. the official marketplace's `source.sha` for superpowers and mattpocock-skills), otherwise from `git ls-remote` of the plugin repository. That revision is what the owner approves.
   - **Install.** From that local marketplace only.
   - **Before enabling.** The installed revision is checked against the approved sha. If it differs, the plugin is disabled and reported.
2. **All hooks, read from the approved revision.** The confirmation lists the hooks from:
   - the manifest;
   - the conventional `hooks/hooks.json`;
   - any extra hook configuration the manifest declares.

   All of them are read from the approved revision (fetched read-only into the data folder), before install. An unreadable hook file blocks the install.
3. **TokenEconomizer: consent and safe config before any hook loads.** Sequence:
   1. **consent** to its external effects (extra Haiku calls, digests of commands, errors and file names);
   2. clone at the approved sha;
   3. install from the local marketplace;
   4. **immediately `claude plugin disable tokeneconomizer@…`**, before any reload or new session;
   5. write its configuration with `toolprune` = `propose` (or off) and loop guard off;
   6. run `status` through its own CLI, not via hooks, and verify the configuration took effect;
   7. **second consent** to enable;
   8. `claude plugin enable` and reload.

   A failure at any step leaves it disabled, with the reason. Tests use fake commands for each step and the failure branches.

### F13.7 — Corrections, round 3 (TokenEconomizer only; prevails)

1. **Default enabled and scope.**
   - **Plugins from the mod's local marketplace** (ponytail, superpowers, mattpocock-skills) get `defaultEnabled: false` in their entries. They are installed with `--scope user`, and `disable` and `enable` always pass `--scope user`. They are enabled only after the sha check and, where relevant, the configuration step.
   - **Already enabled.** If a plugin is already enabled in any scope before the mod acts, this is shown and nothing is changed without the owner's click.
2. **TokenEconomizer keeps its upstream packaging.** Its runtime lives outside `./plugin` and its bootstrap finds it through the registered marketplace, so it is installed exactly the way upstream documents it:
   - the approved clone, pinned at the approved sha, is registered **itself** as the marketplace (`claude plugin marketplace add <clone path>`);
   - then `claude plugin install tokeneconomizer@tokeneconomizer --scope user`;
   - then **immediately** `claude plugin disable tokeneconomizer@tokeneconomizer --scope user`.

   Hooks load only in a new session or on reload, never during these steps.
   - **Residual risk.** If the process dies between install and disable, the plugin could be enabled at the next session start.
   - **How the mod covers it.** At every `session.start` the mod checks: if TokenEconomizer is enabled without a matching approval record (sha plus «enable» consent), it disables it with `--scope user` and tells the owner. The record is written only at the final «enable» consent.
   - **Status check.** It runs **from the installed copy** (the path resolved by the plugin's own bootstrap), not from the clone. If that path cannot be resolved, it stays disabled with the reason.
   - **Label.** It stays «experimental, off by default».

### F13.7 — Correction, round 4 (TokenEconomizer preventive block)

Before registering the approved clone as a marketplace, the mod edits **only the clone's own marketplace manifest** (`.claude-plugin/marketplace.json` in the local working copy) to add `defaultEnabled: false` to the `tokeneconomizer` entry. The plugin code stays exactly at the approved sha: the sha check covers the `plugin/` tree, and the mod verifies that `git diff --stat` touches only that manifest. The install then arrives **disabled by construction**, so a crash between install and any later step cannot leave hooks enabled. The `session.start` approval-record check stays as a second belt. Test: install from a fake marketplace with the edited manifest leaves the plugin disabled with no `disable` call.

## Interface F13a↔F13b

F13a (Fable 5.2, director, chains) and F13b (provider registry, local/OpenAI-compatible executor, skills, Help) meet only
here. Either side may extend it; a change to an existing item is agreed first.

- **Writer.** `{ provider: string; modello: string }`. `provider: 'claude'` is a Claude chip (F13a). Any other value is
  an executor id owned by F13b (its registry), plus the existing `freellmapi`.
- **F13b exports**, in TS and in its CJS twin:
  - `ESECUTORI_TESTO: readonly string[]`: the non-Claude executor ids that may write (text only, lanes R0–R1, never
    sensitive);
  - `scrittoreAmmesso(scrittore, regole): Msg | undefined`: `undefined` when the provider is enabled for the project,
    connected, and the model id is valid for it; otherwise the reason. F13a refuses a chain whose writer has a reason.
- **Writer chips** are created by F13a as ordinary actions: `esecutore` = `'claude'` or the provider id, `modello`,
  `corsia` from the chain (R0/R1 for non-Claude writers), `catena: { id, giro, ruolo }`, `padre`, `vincoliPadre`, and
  `dopoConsegna: [<predecessor id>]`.
- **Input to a non-Claude writer.** F13a composes the full text (`testoScrittore`): brief + draft vN + feedback vN, with
  the LAN-data filter and the text limit applied to the whole text; over the limit the step stops with the reason.
  F13b's executor sends exactly that text as the prompt and nothing else from the repository.
- **Output.** F13b's executor stores the produced text as today, in the record's `risultato`, and reports
  `consegnata`. F13a's helper copies it into `artefatti/<catena>/<giro>-<ruolo>.md` (command `artefatto`, owned by
  F13a) under the data-folder lock, with the size cap and the path rules.
- **Cost.** A record may carry `costo: { tipo: 'stimato' | 'osservato' | 'ignoto' | 'gratuito'; usd?: number }`. F13b
  sets it for its executors; F13a sums it per chain and per director, keeping the kinds apart.
