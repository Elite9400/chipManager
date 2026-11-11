# F13a↔F13b interface: writer chips on OpenAI-compatible providers

Amends the item «Writer chips» of the section «Interface F13a↔F13b» in `docs/PIANO-F13.md` (on `claude/f13a`), as
agreed with the master on 11 Nov 2026. When the two branches are merged, this text replaces that item and this file
is removed.

- **Writer chips.** F13a creates them as ordinary actions. The executor comes from the writer's `provider`:
  - `'claude'` → `esecutore: 'claude'`;
  - `'freellmapi'` → `esecutore: 'freellmapi'`;
  - any other registry id → `esecutore: 'compatibile'` and `provider: <registry id>`.

  Then `modello`, `corsia` from the chain (R0/R1 for non-Claude writers), `catena: { id, giro, ruolo }`, `padre`,
  `vincoliPadre` and `dopoConsegna: [<predecessor id>]`, as before.
- **Constraint 1: `provider` is validated at the boundary against the registry**, in TS (`suggerisci_azione`'s `valida`,
  `normalizza` for records) and in CJS (`scrittoreAmmesso` in `strumenti/compatibili.cjs`). A missing, empty or unknown
  `provider` with `esecutore: 'compatibile'` refuses the chip; there is never a default provider. `provider` with any
  other executor is refused too.
- **Constraint 2: `compatibile` inherits every FreeLLMAPI guard** (one shared block in `violazioni`): never on R3–R5 or on
  sensitive text, project levels off/R1/R2, the LAN-data filter, the 1500-character text limit, isolation (no fork,
  cloud or shared folder), effort low, and a Claude reviewer (the other engine) is mandatory. Plus its own: the project
  opt-in for that provider, «connected» (key set, or none needed), a valid base URL from the registry, and an explicit
  catalogue model id.
- **Constraint 3: `regole.modelli.compatibile` stays empty**, whatever `routing.json` lists, so `bilancia` never picks
  `compatibile` by itself; only an explicit choice (an agent, the owner, or a F13a writer chip) uses it.

Tests: `2.0/F13.3b (freellmapi|compatibile): terzi vietati…` (the sensitive and lane guards run on both executors),
`F13.3b suggerisci_azione: provider solo con compatibile…` and `F13.3b parità: … scrittoreAmmesso …` (constraint 1),
`F13.3b il bilanciamento non sceglie mai un fornitore esterno…` (constraint 3, every lane and profile).
