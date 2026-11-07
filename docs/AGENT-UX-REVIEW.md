# Agent UX review of the chipManager tools

Scope: what an agent sees and receives — tool descriptions, input schemas, refusals, results, and the mandate a
started session gets. Read on `main` at `f196d1b` (plugin 2.6.0). No code was changed. Proposals are ordered by
gain over cost. Sizes are characters measured in the source; tokens are estimated as characters ÷ 4.

## Status after review (2.2.0)

| Proposal | Status |
|---|---|
| 1, 3, 6, 7, 8, 9, 11 | implemented, each with a test that failed before |
| 2 (Codex write sandbox), 5 (default effort) | waiting for the owner's decision |
| 4 (sensitive regex) | discarded: record only, see below |
| 10 (proposer edits) | deferred |

Sizes in characters, from the source, with the test routing (Codex lanes R1, R2, R3):

| Text | Before | After |
|---|---|---|
| `suggerisci_azione` description + properties | 300 + 964 = 1,264 | 375 + 1,029 = 1,404 |
| `aggiorna_azione` description | 479 | 306 |
| Both always-loaded tools | 1,743 | 1,710 (−33) |
| `proponi_pesi` description (deferred) | 196 | 228 |

The sections below describe the state before the change.

## Current footprint

| Text | Loaded | Size |
|---|---|---|
| `suggerisci_azione` description | every session (`isDeferred: false`) | 300 chars ≈ 75 tokens |
| `suggerisci_azione` property descriptions (19) | every session | 964 chars ≈ 240 tokens, plus model lists from `routing.json` |
| `aggiorna_azione` description | every session (no `isDeferred`) | 479 chars ≈ 120 tokens |
| `risorse_agenti` description | on demand (`isDeferred: true`) | 212 chars |
| `proponi_pesi` description | on demand | 196 chars |
| `proponi_impostazioni` description | on demand | 340 chars |
| `risorse_agenti` answer | per call | capped at 4,000 chars (`TETTO_RISORSE`, `hooks/bilanciamento.ts`) |
| Mandate fixed lines (footer, review, Codex engine) | per started session | ≈ 450 + 300 + 380 chars, plus project background |

The texts are already short and in English (2.4.2 cut the `suggerisci_azione` description and property texts from
2,021 to 1,268 characters). The
main gaps are missing meaning, not excess length.

## Proposals, by gain over cost

### 1. Explain the lanes in the `corsia` schema — high gain, ~120 chars

- Where: `schemaSuggerisci`, `hooks/register.tsx:1642`.
- Now: `'Missing: R4 if the text touches sensitive surfaces.'` (52 chars). The lane is the input that most drives cost
  (lane factor and tie-break in `bilancia`, `hooks/logica.ts:324-331`; Codex eligibility in `violazioni`), yet an
  agent gets no meaning for R0–R5. Agents that never read the README guess or omit it; an omitted lane silently
  removes Codex from the balancer (`v.codexCorsia`).
- Proposal: `'Set it. R0 text, R1 small+tests, R2 ordinary, R3 large, R4-R5 sensitive (Claude Opus/Fable, local). Missing: R4 if the text is sensitive, else none.'` (≈ 170 chars).
- Anthropic: tool definitions are the main lever on agent behaviour; describe them as for a new hire
  ([Writing tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)).

### 2. Codex executor without an explicit sandbox — high gain, one flag (verify first)

- Where: `mandato`, `hooks/logica.ts:1031`: `codex exec -m <model> -c model_reasoning_effort="<effort>" -C <worktree> -`.
  The helper `corsia-codex` (`strumenti/disco.cjs`) passes the command through and adds no sandbox flag.
- OpenAI documents that `codex exec` runs in a **read-only sandbox by default**
  ([Non-interactive mode](https://developers.openai.com/codex/noninteractive)). Unless the user's `config.toml`
  sets `sandbox_mode`, the executor cannot write, and the coordinator either fails or writes the code itself
  (the opposite of what the mandate asks).
- Proposal: add `-s workspace-write` to the executor command (the review command already passes `-s read-only`,
  `hooks/logica.ts:1009`). +20 chars.
- Not verified: the owner's Codex configuration on a real machine.

### 3. Say what the balancer chose in the `suggerisci_azione` result — high gain, ~80 chars

- Where: `hooks/register.tsx:2091`. Now: `Action a-… in the panel (position N, claude → review codex).`
- The agent does not learn the model and effort the balancer filled (`bilancia` fills executor, model, effort and
  reviewer, never the destination), the effective lane, or why the action became sensitive. It cannot tell the
  owner the cost, nor fix an accidental R4.
- Proposal, effective values only: `Action a-… in the panel (position 3, lane R2, claude-sonnet-5-5 · medium →
  review codex; runs: local).` Lane from `corsiaDi`, model and effort from `modelloDi` / `effortDi`, where it runs
  from `modalitaDi` (`local`, `cloud`, `api-claude`, `esterno`): an omitted destination is `local`, or `esterno`
  for FreeLLMAPI. Show that effective mode as it is now; the destination advisor in `applica` mode may change it
  later, like the owner.
- When `sensibile()` is true, name **one cause**, checked in this order: explicit `sensibile: true`; lane R4/R5 set
  by the proposer; a built-in term (`SENSIBILE_RE.exec`, `hooks/logica.ts:389`); the project term list does not
  compile, so all text counts as sensitive (`terminiRe` returned `TUTTO`, fail-closed; test this by identity
  **before** any project match, since `TUTTO.exec` matches every text); a project term (the compiled `terminiRe`
  list, `exec`). Needs a small `causaSensibile` helper beside `sensibile`, with one test per cause.

### 4. Sensitive-term false positives — known, record only; no regex change without full tests

- Where: `SENSIBILE_RE`, `hooks/logica.ts:389`: `\b(auth\w*|login|…|permess\w*|…)\b`, matched on title, brief and
  backgrounds (`sensibile`).
- Known false positives: `author`, `authored`, `authority`. Each forces R4: Opus or Fable author, effort ≥ high,
  Claude adversarial reviewer, local only (`violazioni`), the most expensive configuration the mod has.
- Known gaps: English `permissions` and `personal data` do not match (only Italian `permess…` and `dati personali`).
- No regex proposal here. Narrowing `auth\w*` easily drops true positives such as `authMiddleware`, `authGuard` or
  `auth_controller`. Change it only together with a full positive and negative test table (identifiers in
  camelCase, snake_case and kebab-case, English and Italian prose), and keep it fail-closed.
- Mitigation already in the docs: the guide and the snippet tell agents to mark sensitive work explicitly
  (`corsia: "R4"` and `sensibile: true`) and to reword known false matches. Proposal 3 makes the cause visible.

### 5. Default effort when omitted — medium gain, owner decision

- Where: `effortDi`, `hooks/logica.ts:384`: the starting preference for an omitted Claude effort is `high`;
  `bilancia` tries it first and keeps it on equal scores. Only the Automatic profile on R0–R1 scores `high` down
  (so R1 can end at `medium`, `tests/pesi.test.tsx`); elsewhere `high` stays unless weights change the scores.
- Anthropic's defaults are lower for the current models: Opus 5.5 and Haiku 5.5 default to `medium`; Sonnet 5.5
  starts at `medium` for well-specified agentic tasks; lower effort means fewer, terser tool calls
  ([Effort](https://platform.claude.com/docs/en/build-with-claude/effort)).
- Proposal: prefer `medium` on R0–R2 when the agent leaves effort out, keep `high` on R3 and the R4 minimum.
  Behaviour change: needs the owner's choice and updated balancing tests.

### 6. Trim the always-loaded `aggiorna_azione` description — medium gain, ~250 chars saved per session

- Where: `hooks/register.tsx:2018`. 479 chars loaded in every session of the project, including sessions that never
  deliver an action. The mandate footer (`hooks/logica.ts:1039`) already repeats the delivery and review steps.
- Proposal: `'Reports an action of the chipManager panel: "consegnata" with the tentativo from your mandate, the review in revisione, "scartata" by the proposer. A start asked of this session: "presa", then "avviata" with sessione, or "fallita".'` (≈ 230 chars).
- Keep it non-deferred: the mandate says "if you have the tool", and a deferred tool may read as absent.

### 7. Return every validation error at once — medium gain, small change

- Where: `valida`, `hooks/register.tsx:1565`. It returns the first problem only; an agent that sets several fields
  wrong needs one round trip per field. The `deny` text is already actionable.
- Proposal: collect the messages and join them with `; ` (cap at ~600 chars).

### 8. Align "only when the user asks" on `proponi_pesi` — low cost

- Where: `hooks/register.tsx:1961`. `proponi_impostazioni` says "Only when the user explicitly asks for it";
  `proponi_pesi` does not, so an agent may propose weights unasked, which adds a panel prompt for the owner.
- Proposal: prefix `'Only when the user asks: '` (+25 chars, deferred tool).

### 9. Interpolate the Codex lanes in the `esecutore` description — low cost

- Where: `hooks/register.tsx:1638`: `'Codex only for non-sensitive R1-R3.'` is hard-coded, while the real lanes come
  from `routing.json` (`corsia_codex.esegue.corsie`), as the `modello` description already does for models.
- Proposal: `` `Default claude. Codex on lanes ${r.corsiaCodex.corsie.join(', ')}, never sensitive.` ``

### 10. Let the proposer correct its own proposal — medium gain, larger change

- Now: a proposal can only be withdrawn (`aggiorna_azione` with `scartata`) and proposed again; the new one gets a
  new id, so actions that depend on the old id must be re-proposed too.
- Proposal: accept `brief`, `titolo`, `corsia`, `dipende` changes from the proposer while the action is
  `proposta`, through the same CAS update and `valida`. Needs a design decision and tests; until then the guide
  documents withdraw-and-repropose.

### 11. Point to the guide from the tool text — low cost, optional

- `suggerisci_azione` could end with `Guide: github.com/Elite9400/chipManager/blob/main/docs/GUIDE-FOR-AGENTS.md`
  (+70 chars always loaded). Useful for models that do not read the README; the snippet covers projects that paste
  it. Lower priority than 1–3.

## Checked and fine

- Refusals name the field and the allowed values (`valida`, `propostaDa`, `aggiorna_azione`); `proponi_impostazioni`
  names the invalid field, never its value.
- `risorse_agenti` is deferred, capped and trimmed by steps with a `nota`; keys appear only as set/missing;
  `percentuale` is explained as "used".
- Identity comes from the session, never from arguments (`aggiorna_azione`, `proponi_*`).
- The API mandate (`mandatoApi`) drops coordinator steps and says what a headless run may do.

## Not verified

- Proposal 2 on a real Codex install (depends on the owner's `config.toml`).
- Token counts: estimated from characters, not measured with a tokenizer.
- Whether hosts other than Claude Code desktop and CLI expose the deferred tools through `ToolSearch`.
