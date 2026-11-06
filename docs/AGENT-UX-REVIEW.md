# Agent UX review of the chipManager tools

Scope: what an agent sees and receives — tool descriptions, input schemas, refusals, results, and the mandate a
started session gets. Read on `main` at `f196d1b` (plugin 2.6.0). No code was changed. Proposals are ordered by
gain over cost. Sizes are characters measured in the source; tokens are estimated as characters ÷ 4.

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
- The agent does not learn the model, effort, lane or destination the balancer filled, nor that its text made the
  action R4. It cannot tell the owner the cost, nor fix an accidental R4.
- Proposal: `Action a-… in the panel (position 3, R2, claude-sonnet-5-5 · medium → review codex; local).` and, when
  `sensibile()` matched text, `R4 because the text matches "<term>"`. Cost: one `corsiaDi` / `modelloDi` /
  `effortDi` call each; the matching term needs `SENSIBILE_RE.exec` instead of `test`.

### 4. Sensitive-term false positives — high gain on cost, small regex change

- Where: `SENSIBILE_RE`, `hooks/logica.ts:389`: `\b(auth\w*|login|…|permess\w*|…)\b`, matched on title, brief and
  backgrounds (`sensibile`).
- `auth\w*` matches `author`, `authored`, `authority`, `authentic` (art provenance); `login` also matches a
  "login page copy" text change. Each match forces R4: Opus or Fable author, effort ≥ high, Claude adversarial
  reviewer, local only (`violazioni`). That is the most expensive configuration the mod has.
- Proposal: `auth(?:n|z|entic\w*|ori[sz]\w*|-?token)?` or an explicit list (`auth`, `authn`, `authz`,
  `authenticat\w*`, `authoriz\w*`). Keep fail-closed for the real terms; add a test with `author`.
- Pair with proposal 3 so an agent can see and reword a false match.

### 5. Default effort when omitted — medium gain, owner decision

- Where: `effortDi`, `hooks/logica.ts:384`: an omitted Claude effort becomes `high`; `bilancia` tries it first and
  keeps it on ties (R2–R5, or any lane without weights outside Automatic R0–R1).
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
  it. Lower priority than 1–4.

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
