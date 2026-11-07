# chipManager snippet for CLAUDE.md / AGENTS.md

Paste the block below into the instructions file of a project that uses the mod. Full guide:
[`GUIDE-FOR-AGENTS.md`](GUIDE-FOR-AGENTS.md).

```markdown
## chipManager actions

Work that deserves its own session (one branch, one review) goes to the chipManager panel, not into chat.

- Propose with `suggerisci_azione`, one call per action, in start order. Never start, merge or close it yourself.
- One action = one merge. Keep questions, single edits and lookups in this session.
- Brief = the only thing the new session sees. Write: Goal, Context (files to read), Scope and out of scope,
  Constraints, Done when (checkable), Verify (exact commands). No "as discussed above".
- Do not repeat what the mod adds: lane, review step, reporting step, project background.
- Always set `corsia`: R0 text, R1 small with tests, R2 ordinary, R3 large, R4–R5 sensitive.
- Leave `esecutore`, `modello`, `effort` out unless you have a reason: the panel balances them within
  `routing.json` and live limits, among allowed and connected providers (DeepSeek and FreeLLMAPI need their key).
  An omitted effort follows the owner's work mode (default `medium` on R0–R2).
- Leave `destinazione` out unless the work needs one place: it runs locally unless the owner or the destination
  advisor changes it; the balancer never sets it.
- Sensitive work (auth, permissions, personal data): always set `corsia: "R4"` and `sensibile: true` yourself.
- Text detection also forces R4 (Opus/Fable, effort high, local, Claude review) on: words starting with `auth`
  (also `author`), `login`, `password`, `passwd`, `mfa`, `otp`, `csrf`, `permess…`, `PII`, `dati personali`,
  `codice fiscale`, project terms. Reword false matches in non-sensitive briefs.
- Put spec paths in the brief: `piano` shows a file on the board but never reaches the session.
- Before a batch, load and call `risorse_agenti`: `regole.lette: false` means nothing starts; `percentuale` is
  plan used; data older than 5 minutes is not current; skip providers over their critical threshold.
- `dipende`: only ids that must be merged first. Independent actions run in parallel.
- Cloud and external models receive only title and brief: no secrets, `.env`, emails, IPs or personal data.
- In a started session: when the branch is pushed and reported, call `aggiorna_azione` with the id, the
  `tentativo` from the mandate and `stato: "consegnata"`; report the review with `revisione.esito`
  (`in-corso`, `approvata`, `da-correggere`).
- Exception, `api-claude` runs: commit in the worktree, never push; the review comes after delivery.
- Call `proponi_pesi` or `proponi_impostazioni` only when the user asks. In `proponi_impostazioni`, a `progetto`
  patch changes this project; an `account` patch changes all projects: tell the user.
- Point the user to `/chipmanager --setup` (guided) and `--doctor` (repairs on confirmation). Issues to
  `Elite9400/chipManager` only with the user's yes, codes only.
```
