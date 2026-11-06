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

Terms: an **action** (also *chip*) is one proposed unit of work. The **brief** is your task text. The **mandate** is
the prompt the mod builds from your brief for the started session. The **owner** is the human who decides.

## Lifecycle of an action

| State | Who moves it | What it means |
|---|---|---|
| `proposta` | you, with `suggerisci_azione` | in the panel, waiting for the owner |
| `accodata` | panel | waits for merged dependencies, the Codex lane or a parallel slot |
| `in-avvio` | panel | reserved under a machine mutex, attempt token `az-…` issued |
| `avviata` | panel (or you, only when the panel asks you to start it) | a session is working on it |
| `consegnata` | the started session, with `aggiorna_azione` | branch pushed, report sent |
| `completata` | panel | the branch is merged (registry task closed) or the owner marked it done |
| `fallita` | panel or the starting session | the start failed; the owner retries |
| `scartata` | the proposer or the owner | withdrawn; the owner can undo it |

Rules that follow from it:

- **Delivered is not done.** Dependents start only when the dependency is `completata`, that is merged.
- Review happens inside the started session before delivery (see [Reviewer](#reviewer)); report its outcome.
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
description. Put long specs in a repository file and pass its path in `piano` (`.md`/`.txt`, relative path).

## Choose the options

Set what you know; leave the rest to the balancer. The balancer fills **only** omitted fields, tries every
combination the rules allow and keeps the best score (weights × lane factor × free margin of the provider ÷ sessions
already on that model). Explicit fields always stay.

### Lane (`corsia`): always set it

| Lane | Use for | Enforced by the mod |
|---|---|---|
| R0 | text or docs only, no behaviour change | external models (FreeLLMAPI) allowed when enabled |
| R1 | small, low-risk change with tests | Codex allowed if `routing.json` lists R1 |
| R2 | ordinary feature or fix in a few files | Codex allowed if `routing.json` lists R2 |
| R3 | large or cross-cutting change | Codex at the lane's effort, Claude reviewer from `rivisto_da` |
| R4 | sensitive: auth, permissions, personal data, project terms | Claude author Opus or Fable, effort ≥ high, Claude reviewer, local only, no bypass |
| R5 | highest risk | same guards as R4 |

- The lane drives cost. On R0–R1 the balancer breaks ties toward the lowest-ranked allowed Claude model; with the
  Automatic profile it also scores `high`/`xhigh` effort down. Without a lane, Codex is never chosen (it needs one).
- The mod makes an action R4 when title, brief or background match `auth…`, `login`, `password`, `mfa`, `otp`,
  `csrf`, `permess…`, `PII`, personal-data terms, or the project's own terms. `sensibile: false` does not undo it.
  Matching is by word start: `author`, `authority` and `auth-free` count. Reword when the work is not sensitive.
- Mark real sensitive work yourself: `corsia: "R4"` or `sensibile: true`.

### Executor (`esecutore`) and model (`modello`)

| Situation | Choose |
|---|---|
| Well-specified R1–R3 coding task, tests exist, Codex enabled | `codex` (cost spread to another plan; one run per machine) |
| Design-heavy, ambiguous, or needs this repo's tools and skills | `claude` |
| R0–R1 pure text (rewording, summaries) and FreeLLMAPI enabled | `freellmapi` (effort `low`, Claude reviewer, ≤ 1,500 chars of title + brief) |
| Sensitive (R4–R5) | `claude` with Opus or Fable (enforced) |
| Not sure | leave both out |

Allowed models come from `routing.json` (listed in the `modello` schema and in `risorse_agenti`). On R2–R3 with
equal scores the balancer keeps the first allowed model, often the most capable: name a lighter model when the task
is well specified. Describe the outcome, not the steps: Anthropic says so for Fable
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

- Omitted effort: the mod uses `high` for Claude and the lane's `corsia_codex` effort for Codex (a minimum).
  Set `medium` yourself on well-specified R1–R2 work to save cost.
- `max` is never offered. Each model has a cap (`tetto_per_modello`).

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
| `api-claude` | plan near its limit and the owner set a monthly API budget | Claude only; fresh; own worktree; not sensitive; capped per run; headless: commits, never pushes |

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
| `politica.soglie` | over `critica`, do not name that provider: leave the engine out |
| `alLavoro`, `contesto` | sessions per model·effort now; prefer a less loaded model |
| `destinazioni` | where this project's chips can run, budget and API lane state |
| `chiavi` | `set` / `missing` only; keys are never shown |

## Chains and dependencies

- Call `suggerisci_azione` once per action, **in start order**. Keep each returned id.
- `dipende`: ids of actions that must be **merged** first. Only real data or file dependencies; independent work
  runs in parallel.
- Ids must exist and not be discarded (up to 20). Never invent an id.
- `ordine` (1–999) moves an action in the queue; default is last.
- If the result says `Warning, as it is it cannot start: …`, fix the cause: withdraw it with
  `aggiorna_azione { id, stato: "scartata" }` and propose it again corrected, or tell the owner what to change.

## Report from a started session

The mandate ends with the action id and the attempt token. Use them exactly.

```jsonc
// work delivered: branch pushed, report sent to the coordinator
{ "id": "a-…", "stato": "consegnata", "tentativo": "az-…" }
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
- `proponi_impostazioni` accepts only `motivo`, `profilo`, `soglie`, `board`, `consigliere`, `apiClaude`, `lingua`.
  Any other field (keys, guards, permissions, providers, destinations) rejects the whole proposal.

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
