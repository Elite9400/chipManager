# chipManager: guide for agents

Read this before you call any `chip-manager` tool. It tells you how to turn work into **actions** the owner can
review and start, so the work gets done well at the lowest cost. Short version: [`AGENTS-SNIPPET.md`](AGENTS-SNIPPET.md).

## What the mod is

- A Claude Code mod that adds a panel beside the conversation.
- You **propose** work with `suggerisci_azione`; you never start it yourself. The owner reviews, edits and starts it.
- Each started action runs as its own session: Claude, Codex (through a Claude coordinator) or an external model,
  locally, in the Claude cloud or headless on API credits.
- Every start passes the project rules (`routing.json`) and fixed guards: lanes R0–R5, allowed models and efforts,
  reviewer matrix, one Codex run per machine, sensitive work kept local and reviewed.
- Fields you leave out are filled by the panel's balancer, using live plan limits and the project's weights.
- Settings have two layers. **Account** (all projects): thresholds, API credits budget, manual limits, FreeLLMAPI
  endpoint. **Project** (the repository of the session): allowed providers, profile and weights, board, destination
  advisor, and restrictions that can only be stricter than the account.
- Installing the mod for one project or for all (`--scope project|local|user`) changes where it is active, not how
  it behaves: accounts and keys are always the user's, chips always belong to the session's project.

Terms: an **action** (also *chip*) is one proposed unit of work. The **brief** is your task text. The **mandate** is
the prompt the mod builds from your brief for the started session. The **owner** is the human who decides.

## Lifecycle of an action

| State | Who moves it | What it means |
|---|---|---|
| `proposta` | you, with `suggerisci_azione` | in the panel, waiting for the owner |
| `accodata` | panel | waits for merged dependencies, the Codex lane or a parallel slot |
| `in-avvio` | panel | reserved under a machine mutex, attempt token `az-…` issued |
| `avviata` | panel (or you, only when the panel asks you to start it) | a session is working on it |
| `consegnata` | the started session, with `aggiorna_azione`; for `api-claude`, the launcher | branch pushed, report sent (`api-claude`: committed in its worktree, not pushed) |
| `completata` | panel | the branch is merged (registry task closed) or the owner marked it done |
| `fallita` | panel or the starting session | the start failed; the owner retries |
| `scartata` | the proposer or the owner | withdrawn; the owner can undo it |
| `attesa-figli` | a director chip, with `aggiorna_azione` | waiting for its child chips; not counted against parallel sessions |

Rules that follow from it:

- **Delivered is not done.** Dependents start only when the dependency is `completata`, that is merged.
- Review happens inside the started session before delivery (see [Reviewer](#reviewer)); report its outcome.
  Exception, `api-claude`: the headless run commits without pushing and the review happens after delivery.
- The owner can change every field before the start. Your presets are a proposal.

## When to propose an action, and when not

Propose when **all** hold:

- The work ends in its own reviewable result: one branch, one PR, or one document.
- A fresh session can do it from your brief alone.
- It is worth a separate session: more than a few tool calls, or it must run in parallel, on another engine, or later.

Do it yourself instead when it is a question, a single edit, a lookup, or a step whose result you need in this turn.
Use a subagent instead when you only need a summary back (search, read-through, review of your own diff).

Size each action to **one merge**. Split where a reviewer would want a separate diff, or where another action must
wait for the merge. Merge two actions when neither can be reviewed without the other.

## Write a self-contained brief

The started session sees only the mandate: your brief plus lines the mod adds. It does not see this conversation
(unless `contesto: "fork"`). Write the brief as a task for a skilled engineer new to the repository.

The mod already adds: the lane, the sensitive-module warning, the Codex command, the review instruction, the
reporting instruction with id and attempt token, and the project background. **Do not repeat them.**

### Template

```text
Goal: <one sentence: the outcome, not the steps>.
Context: <why; what exists; the files, plan or issue to read first>.
Scope: <files or areas to change>. Out of scope: <what not to touch>.
Constraints: <conventions, no new dependencies, compatibility, language of texts>.
Done when: <checkable criteria: tests that pass, output that appears, docs updated>.
Verify: <exact commands to run, and which output proves it>.
```

### Good and bad

| Bad | Why | Good |
|---|---|---|
| `Improve performance of the parser.` | no target, no measure, no end | `Goal: parse 10k-line files under 200 ms. Context: src/parser.ts re-tokenises each line twice (see parseLine). Scope: src/parser.ts, tests/parser.test.ts. Done when: new benchmark test passes under 200 ms and all parser tests pass. Verify: npm test -- parser.` |
| `As discussed above, do the second option.` | refers to a conversation the session cannot see | state the option in full, with the file names you found |
| `Refactor the settings and also add the export button and fix the date bug.` | three merges in one | three actions; `dipende` only where one needs the other merged |
| `Fix the bug the author reported in the auth-free page.` | `author` and `auth-free` trigger the sensitive lane (R4) | `Fix the bug reported in the public page …` |
| `Run all tests and make sure everything is perfect.` | no criterion | `Done when: npm test passes and the new case for empty input is covered.` |

Keep every word that changes what the session does; cut the rest. Name files and commands; they are cheaper than
description. Put long specs in a repository file and write its path **in the brief**: the mandate is built from
the brief only. `piano` (`.md`/`.txt`, relative path) shows the same file on the board; it does not reach the session.

## Choose the options

Set what you know; leave the rest to the balancer. It fills **only** omitted executor, model, effort and reviewer,
among combinations the rules allow ([Defaults and balancing](#defaults-and-balancing)). It never sets the
destination. Explicit fields always stay.

### Lane (`corsia`): always set it

| Lane | Use for | Enforced by the mod |
|---|---|---|
| R0 | text or docs only, no behaviour change | external models (FreeLLMAPI) allowed when enabled |
| R1 | small, low-risk change with tests | Codex allowed if `routing.json` lists R1 |
| R2 | ordinary feature or fix in a few files | Codex allowed if `routing.json` lists R2 |
| R3 | large or cross-cutting change | Codex at the lane's effort, Claude reviewer from `rivisto_da` |
| R4 | sensitive: auth, permissions, personal data, project terms | Claude author Opus or Fable, effort ≥ high, Claude reviewer, local only, no bypass |
| R5 | highest risk | same guards as R4 |

- The lane drives cost (see [Defaults and balancing](#defaults-and-balancing)). Without a lane, Codex is never
  chosen (it needs one).
- **Mark sensitive work yourself, always:** `corsia: "R4"` (or `"R5"`) **and** `sensibile: true`. Do not rely on
  text detection: it is a safety net with a short, partly Italian word list.
- The safety net makes an action R4 when title, brief or a background contains one of these words (case-insensitive,
  whole word): `auth` and every word starting with it, `login`, `password`, `passwd`, `mfa`, `otp`, `csrf`, words
  starting with `permess` (Italian), `PII`, `dati personali`, `codice fiscale`, or a term from the project's
  `sensibili` list. English `permissions` or `personal data` do **not** trigger it. `sensibile: false` never undoes it.
- Known false positives: `author`, `authority`, `auth-free`. Reword them when the work is not sensitive.

### Executor (`esecutore`) and model (`modello`)

| Situation | Choose |
|---|---|
| Well-specified R1–R3 coding task, tests exist, Codex enabled | `codex` (cost spread to another plan; one run per machine) |
| Design-heavy, ambiguous, or needs this repo's tools and skills | `claude` |
| R0–R1 pure text (rewording, summaries) and FreeLLMAPI enabled | `freellmapi` (effort `low`, Claude reviewer, ≤ 1,500 chars of title + brief) |
| Same kind of text task, and the project opted in an OpenAI-compatible provider | `compatibile` with `provider` (`deepseek`, `openrouter`, `qwen`, `mistral`, `groq`, `ollama`, `lmstudio`, `vllm`) and the model id from its catalogue; same guards as `freellmapi`; never chosen by the balancer |
| Sensitive (R4–R5) | `claude` with Opus or Fable (enforced) |
| Not sure | leave both out |

A provider must be **allowed** by the project and **connected**. Claude and Codex always count as connected;
DeepSeek and FreeLLMAPI only with their key (mod options or `DEEPSEEK_API_KEY` / `FREELLMAPI_KEY`). A provider that
is not connected is left out of automatic choices, and an explicit choice of it does not start.

Allowed models come from `routing.json` (listed in the `modello` schema and in `risorse_agenti`). Name a lighter
model yourself when the task is well specified and the balancer might keep a heavier one (see
[Defaults and balancing](#defaults-and-balancing)). Describe the outcome, not the steps: Anthropic says so for Fable
([model configuration](https://code.claude.com/docs/en/model-config)), OpenAI for Codex
([prompting](https://learn.chatgpt.com/codex/prompting)).

### Effort (`effort`)

Effort is a behavioural signal, not a token budget; lower effort means fewer and terser tool calls
([Anthropic, effort](https://platform.claude.com/docs/en/build-with-claude/effort)).

| Task | Start at |
|---|---|
| Mechanical edit, docs, a subagent-sized job | `low` |
| Well-specified change with tests (Anthropic's start for Sonnet 5.5 and Haiku 5.5) | `medium` |
| Ambiguous design, hard bug, sensitive lane (minimum, enforced) | `high` |
| Long agentic run over ~30 minutes | `xhigh` |

- `max` is never offered. Each model has a cap (`tetto_per_modello`).
- An omitted effort follows the owner's work mode: by default `medium` on R0–R2 and `high` on R3–R5; lane, Codex
  and sensitive minimums still raise it.

### Defaults and balancing

Two steps fill an omitted field. Keep them apart when you predict the result.

**Starting preference** (`effortDi`, `modelloDi`):

- Effort: the work mode's default for the lane (configurable; `medium` on R0–R2, `high` on R3–R5), raised to the
  lane's `corsia_codex` effort for Codex and to `high` on R4/R5 or sensitive work; FreeLLMAPI `low`.
- Model: the first allowed model of the executor in `routing.json`.

**Balancing result** (`bilancia`): every allowed combination of the omitted fields is scored (weights × lane factor
× free margin ÷ sessions on that model) and the best wins. On equal scores:

- the starting preference stays, unless one of the rules below applies;
- Saving profile (*Risparmio*): Codex wins over Claude when allowed;
- lanes R0–R1, or the Saving and Speed (*Velocità*) profiles, with no model named: the lowest-ranked allowed
  Claude model wins.

With the Automatic profile on R0–R1, `high` and `xhigh` score lower, so an omitted effort usually ends at `medium`.
With weights or a provider over its critical threshold, scores differ and any allowed combination can win. Explicit
fields always stay.

### Reviewer

- `revisore` defaults to the other engine: Claude work is reviewed by Codex, Codex work by Claude.
- The concrete reviewer must be allowed for the author in `revisori_ammessi_per_autore` and never be the author.
- R4–R5: reviewer must be Claude; the mod names an adversarial Fable reviewer (Opus when Fable is the author).
- `nessuno` only for trivial R0 text you will read yourself.

### Destination (`destinazione`)

| Value | Use when | Enforced |
|---|---|---|
| omit | normally | the owner, or the destination advisor (*consigliere*) when enabled, decides |
| `local` | needs this machine, local data, Codex, or is sensitive | — |
| `cloud` | long or parallel work on a GitHub repository, plan below critical | fresh only; title + brief ≤ 1,500 chars; no emails, IPs, keys, `.env`, `storage/`, `NAME=value` lines; no Codex; not sensitive; background never sent; model chosen by the cloud |
| `api-claude` | plan near its limit and an API credits budget is set | needs the account budget and the key in the mod's own option (an `ANTHROPIC_API_KEY` in the environment blocks it); Claude only; fresh; own worktree; not sensitive; a run is booked only if its cap fits both the account's and the project's month limit, but the real cost can exceed the cap (budget 10, spent 9, a booking of 1 can end at 10.10): the hard limit is the spend limit of the API key's workspace in the Anthropic Console; headless: commits, never pushes |

### Context, worktree, permissions

- `contesto`: keep `fresh` (default). Use `fork` only when the work leans on this conversation and the brief would
  have to retell it; a fork inherits the starting session's model and effort, and cannot go to cloud or API.
  Fresh, small context gives better results ([Anthropic, context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)).
- `worktree`: keep `true` (default). Without a worktree the registry cannot link the branch, so nothing auto-closes.
- `ramo` names the branch (`[a-z0-9-]`, ≤ 40); `base` the local starting branch.
- `permessi`: omit (same as the starter; `acceptEdits` on sensitive work). Never `bypassPermissions` on R4–R5;
  the terminal launcher refuses `auto` and bypass.

### Auditor

The auditor is Claude Code's advisor: a stronger model consulted at decision points
([advisor](https://code.claude.com/docs/en/advisor)). You cannot set it: the owner picks it per chip. It applies
automatically only on `api-claude` (`--advisor`); elsewhere the owner types `/advisor`. If a long R3 task would
benefit, say so in your reply to the owner.

## Read the margins with `risorse_agenti`

Call it once before proposing a batch, or any action where you set engine, model or destination. In Claude Code it
is deferred: load it with `ToolSearch` (`select:mcp__chip-manager__risorse_agenti`). The answer is JSON under 4,000
characters; when trimmed, `nota` says what was cut.

| Field | Read it as |
|---|---|
| `regole.lette` | `false` = nothing can start; tell the owner (`fonte` says why) |
| `regole.modelli`, `regole.effort`, `regole.corsieCodex` | the only values you may set |
| `limiti[].percentuale` | plan **used**, 0–100, never "left" |
| `limiti[].letto` | older than 5 minutes = not current; unknown is not free |
| `politica.soglie` | effective thresholds (account and project combined); over `critica`, leave the engine out |
| `politica.fornitori` | providers this project allows |
| `chiavi` | `true` / `false` per key; a `false` DeepSeek or FreeLLMAPI key usually means not connected; values never shown |
| `alLavoro`, `contesto` | sessions per model·effort now; prefer a less loaded model |
| `destinazioni` | where this project's chips can run; `api-claude` shows the account budget and spend (all projects), the project spend, cap per run and month limit, and the API lane state |
| `impostazioni` | `project` and `account` layers as written (absent = inherits), `effective` values, `lingua` |

## Chains and dependencies

- Call `suggerisci_azione` once per action, **in start order**. Keep each returned id.
- `dipende`: ids of actions that must be **merged** first. Only real data or file dependencies; independent work
  runs in parallel.
- Ids must exist and not be discarded (up to 20). Never invent an id.
- `ordine` (1–999) moves an action in the queue; default is last.
- Read the result. It gives what the panel filled:
  `Action a-… in the panel (position 3, lane R2, claude claude-sonnet-5-5 · high → review codex; runs: local).`
  A sensitive action adds `Sensitive (lane R4): <cause>`; if the cause is a false match such as `"author"`, withdraw
  and reword.
- A refusal lists every problem at once, separated by `;`. Fix them all, then call again.
- If the result says `Warning, as it is it cannot start: …`, fix the cause: withdraw it with
  `aggiorna_azione { id, stato: "scartata" }` and propose it again corrected, or tell the owner what to change.

## Director chips and work chains

- **Director.** From lane R3 (configurable), a chip becomes a director on Fable 5.2: its mandate says so. It plans and
  splits the work into child chips with `suggerisci_azione` and `padre: { "id": "a-…", "tentativo": "az-…" }` from its
  own mandate. Children keep the director's constraints (sensitivity, R4/R5 floor, LAN data, providers), get the lane's
  worker model unless you set one, and each still needs the owner's start. Depth is one: a child is never a director.
- **Waiting and re-planning.** The director reports `attesa-figli` with its `tentativo` and waits; `avviata` again is a
  re-plan. Limits: at most `maxFigli` children (default 8) and `maxRipiani` re-plans (default 2). Over a limit the call
  is refused: stop and report to the owner. An optional money cap per director tree or chain applies on the API lane;
  it is soft (the last chip can go over it by what it spends in its turn), and once it is used up no other chip of the
  group starts.
- **Work chain.** For a text deliverable, `catena: true` on `suggerisci_azione` creates writer → reviewer → rewrite
  (1–3 rounds) → applier from the project's pipeline. Each step starts after the previous one delivers its artefact.
  Writer and reviewer steps change no files: they deliver the whole text in `artefatto` (up to 60,000 characters). Only
  the applier, always Claude, applies the final draft to the repository. Never for sensitive work.

## Report from a started session

The mandate ends with the action id and the attempt token. Use them exactly.

```jsonc
// work delivered: branch pushed, report sent to the coordinator
{ "id": "a-…", "stato": "consegnata", "tentativo": "az-…" }
// chain step (writer or reviewer): the whole text in artefatto
{ "id": "a-…", "stato": "consegnata", "tentativo": "az-…", "artefatto": "…" }
// review outcome, with or without stato
{ "id": "a-…", "tentativo": "az-…", "revisione": { "esito": "approvata", "nota": "2 findings fixed" } }
```

- `esito`: `in-corso`, `approvata`, `da-correggere`; `nota` ≤ 300 characters.
- Report `in-corso` when the review starts and the final outcome when it ends. Address or justify every finding.
- A refusal `the tentativo is not the current one` means a newer attempt exists: stop and tell the coordinator.
- When the panel asks **this** session to start an action, follow its message exactly: `presa`, then
  `start_session` with the given arguments, then `avviata` with `sessione`, or `fallita`.
- As proposer you may report a review without `tentativo`, and withdraw with `scartata`.

## Settings and weights: only when the user asks

- `proponi_pesi` (profile and/or weights 0–4 with `motivo`) and `proponi_impostazioni` change nothing: they fill a
  draft the owner applies or discards. Weight proposals expire after 24 hours.
- Call them only when the user explicitly asks. Read current values in `risorse_agenti` first.
- `proponi_impostazioni` takes `motivo` and patches by layer:
  - `progetto`: `profilo`, `board`, `consigliere`, `restrizioni` (`soglie`, `apiLimiteMeseUsd`, `apiTetto`), which
    may only be stricter than the account;
  - `account`: `soglie`, `apiClaude` (`budgetUsd`, `tetto`). An account patch changes **all projects**: say so to
    the user;
  - `modoLavoro` in either layer: `effortPredefinito` per lane (R4/R5 never below `high`), `codexSandbox`,
    `parallelo` (1–8), `auditorSuggerito`, `revisioneIncrociata` (R0–R2 only); a project value replaces the account one;
  - `lingua`.
- `/chipmanager --setup` opens a guided setup; with a proposal in the draft it opens on the summary, so ask the user to
  run it to review. `/chipmanager --doctor` checks and repairs, only on the user's confirmation.
- Profile and weights are a pair: proposing `progetto.profilo` also sets that profile's weights (model weights
  stay). The API values are never derived: a cap proposed alone creates no budget, and a budget creates no cap.
  Any other field (keys, guards, permissions, providers, destinations) rejects the whole proposal.

## Help improve chipManager

Only when the user agrees, draft an issue for `Elite9400/chipManager`: a bug, a confusing text, a missing feature, a
cost or quality problem.

- It may contain: mod version, surface, host version, the shape of the mod's settings (field names and types, no
  values), the mod's error and doctor finding codes, and the steps in general terms.
- It must never contain: project names, paths, file contents, briefs, branch names, session titles, code, keys or
  account data.
- Show the full text first. File it with `gh issue create --repo Elite9400/chipManager` only after an explicit yes;
  without `gh`, give the text and the new-issue URL. The doctor's «Report to chipManager» builds the same text from
  codes only.

## Hard rules

- Propose; never start, merge or close an action on your own.
- Sensitive work stays R4–R5, local, Claude-authored and Claude-reviewed. Never lower a lane to save cost.
- Never put secrets, tokens, `.env` content, personal data, emails or internal IPs in a title, brief or background.
- Cloud and external models get only title and brief: write them as if public.
- Use only models, efforts and lanes that `routing.json` allows.
- Report delivery and review through `aggiorna_azione`; the merge decides the closing.

## Common mistakes

| Mistake | Effect | Fix |
|---|---|---|
| Brief points to "above" or "as discussed" | session guesses | restate the facts and files |
| One action for three changes | big diff, slow review, blocked chain | one action per merge |
| No `corsia` | no Codex, no lane-based savings | always set the lane |
| `opus` + `xhigh` on a small fix | high cost, no gain | omit model; `effort: "medium"` |
| Words like `author`, `login` in a non-sensitive brief | forced R4: Opus/Fable, high, local | reword |
| Sensitive work left to text detection | `permissions`, `personal data` do not trigger R4 | `corsia: "R4"` + `sensibile: true` |
| Spec path only in `piano` | the session never sees it | write the path in the brief |
| `dipende` on everything | serial queue | depend only on what must be merged first |
| Naming a provider over its critical threshold | slow or blocked start | read `risorse_agenti`, leave the engine out |
| Delivered but not reported | panel stays `avviata` | `aggiorna_azione` with `consegnata` and `tentativo` |
| Review done, outcome not reported | board shows no review | report `revisione` |
| Settings proposed unasked | noise for the owner | only on explicit request |

## Platforms

| Platform | What you see | Differences |
|---|---|---|
| Claude Code desktop | `suggerisci_azione`, `aggiorna_azione` loaded; `risorse_agenti`, `proponi_pesi`, `proponi_impostazioni` deferred | starts via the app's sessions; fork, cloud, worktree, wake-on-done available |
| Claude Code CLI | same tools | starts via a terminal worker: `claude -p` in its own worktree, permissions `default`, `acceptEdits` or `plan`; no fork, cloud or shared folder |
| Codex | no mod tools | a Claude coordinator pipes your brief to `codex exec` on stdin; Codex also reads `AGENTS.md` ([AGENTS.md](https://developers.openai.com/codex/guides/agents-md), 32 KiB default); write the brief for Codex alone |
| API Claude (`api-claude`) | a mandate without panel steps | headless `claude -p` on credits with a spending cap: commit only, end with a short report; the launcher records the outcome |
| External models (FreeLLMAPI gateway) | no tools | text in, text out; R0–R1 (R2 if enabled); Claude reviews the result |
| Any other model driving Claude Code | the same tools as Claude | the same rules apply; the tool schemas are the contract |

Other agents that read `AGENTS.md`, such as Gemini CLI through `context.fileName`
([Gemini CLI context files](https://geminicli.com/docs/cli/gemini-md)), get the project rules from the snippet but
cannot call the mod's tools outside Claude Code.

## Sources

- Anthropic: [Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents),
  [Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents),
  [Claude Code best practices](https://code.claude.com/docs/en/best-practices),
  [Model configuration](https://code.claude.com/docs/en/model-config),
  [Effort](https://platform.claude.com/docs/en/build-with-claude/effort),
  [Advisor](https://code.claude.com/docs/en/advisor).
- OpenAI: [AGENTS.md for Codex](https://developers.openai.com/codex/guides/agents-md),
  [Non-interactive mode](https://developers.openai.com/codex/noninteractive),
  [Prompting](https://learn.chatgpt.com/codex/prompting).
- Others: [AGENTS.md](https://agents.md), [Gemini CLI context files](https://geminicli.com/docs/cli/gemini-md),
  [llms.txt](https://llmstxt.org).
