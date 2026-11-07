**F12 visual specification — chipManager, `main` at `9ec197b`**

Design only. Based on the requested source files, F9’s final **Attuazione** decisions, both reference images, and the supplied host types. The images define composition and richness; the final F9 decisions define colour and behaviour.

**1. Principles and hierarchy**

- Desktop uses distinct cards, tinted attributes, generous internal spacing, and a clearly filled Start action.
- Terminal uses compact, readable records, restrained graphics, and predictable keyboard navigation.
- Titles identify work; state explains urgency; attributes explain execution; actions follow.
- Words retain host ink; colour reinforces labelled signs, borders, fills, and the declared Manager brand.
- Presentation never changes control identity, order, availability, data, or callback effects.

| View | Reading order, retained from the implementation |
|---|---|
| Common header | Brand and project → existing header controls → summary → notices |
| Work | Settings/weight proposals and project notices → filter → Waiting for you → Working now → To start and queued → To merge → milestones |
| Load | Model × effort → Limits and budget → Context windows → Weights and recent distribution → diagnostic footer |
| Settings | Account navigation → Project navigation → proposals → selected section → pending changes → application errors |
| F11 setup | Scope and progress → current step → explanation/input → result/error → existing step actions |
| F11 doctor | Overall result and check time → individual checks with evidence → existing corrective actions |
| Board | Brand and generation details → summary → waiting → running → upcoming → completed/commits → milestones → legend |

Do not move Limits into Work to reproduce the older screenshot. Do not reorder sessions or controls to achieve visual balance.

**2. Tokens and dimensions**

**Colour decisions**

Retain all semantic hex colours, `ACCENTO`, `MARCHIO`, and board theme colours. Do not introduce a brighter cyan UI accent.

Only two opacity values change:

| Token | Current → F12 | Purpose |
|---|---|---|
| `VELO.traccia` | `4D` → `14` | Gamma’s preceding steps: the solid position marker must contrast with its track |
| `VELO.vuoto` | `33` → `14` | Gamma’s unfilled steps: same contrast requirement |

These tokens currently occur only in `Gamma`. Retain:

- Card: `GRIGIO #808080`, alpha `0A` = 10/255.
- Attribute pill and hover: alpha `14` = 20/255.
- Selection and pending-change veil: `1F` = 31/255.
- Empty usage-bar segment: `GRIGIO`, alpha `14`.
- Load matrix intensity scale: existing `VELO.carico`; numbers remain the authoritative information.
- `ICONA #00BFFF`: manifest artwork only.

**Contrast calculation**

Use the existing `sopra`, `luminanza`, and `contrasto` calculation, including channel rounding:

```text
over(F, a, B) = round(a × F + (1 − a) × B), per RGB channel
a = hexadecimal alpha / 255

Card(B) = over(#808080, 10/255, B)
Hover(B) = over(#0A86C9, 20/255, Card(B))
Pill(C, X) = over(C, 20/255, X)

s = channel / 255
linear(s) = s/12.92                         if s ≤ 0.03928
            ((s + 0.055)/1.055)^2.4        otherwise
L = 0.2126R + 0.7152G + 0.0722B
contrast = (max(L1,L2) + 0.05)/(min(L1,L2) + 0.05)
```

Formula inputs and resulting bases:

| Reference background | Card | Card plus hover |
|---|---|---|
| `#FFFFFF` | `#FAFAFA` | `#E7F1F6` |
| `#FAF9F5` | `#F5F4F0` | `#E3EBED` |
| `#000000` | `#050505` | `#050F14` |
| `#262624` | `#2A2A28` | `#273135` |

Each following number is the minimum of **bare background, pill over card, and pill over hovered card**, for that reference background. Rounded to three decimals; evaluate the unrounded value against 3:1.

| Sign token | Hex | White | Warm light | Black | Warm dark |
|---|---|---:|---:|---:|---:|
| Accent | `#0A86C9` | 3.190 | 3.022 | 4.539 | 3.061 |
| Neutral | `#808080` | 3.179 | 3.032 | 4.553 | 3.081 |
| Running | `#189245` | 3.213 | 3.045 | 4.514 | 3.043 |
| Waiting | `#B46F09` | 3.220 | 3.053 | 4.500 | 3.053 |
| Failed / sensitive | `#E14444` | 3.238 | 3.089 | 4.482 | 3.068 |
| Ready / queued | `#6C80A1` | 3.218 | 3.077 | 4.488 | 3.045 |
| Delivered | `#8277B4` | 3.209 | 3.062 | 4.504 | 3.058 |
| Claude | `#C06547` | 3.231 | 3.063 | 4.486 | 3.049 |
| Codex | `#0D9070` | 3.190 | 3.043 | 4.507 | 3.073 |
| FreeLLMAPI | `#B662A1` | 3.206 | 3.038 | 4.518 | 3.067 |
| Opus | `#BE682F` | 3.217 | 3.070 | 4.507 | 3.063 |
| Sonnet | `#1B8B9E` | 3.208 | 3.040 | 4.481 | 3.051 |
| Haiku | `#5D8C23` | 3.211 | 3.065 | 4.497 | 3.051 |
| Fable | `#A662CA` | 3.226 | 3.056 | 4.487 | 3.042 |
| GPT | `#3282D1` | 3.198 | 3.051 | 4.500 | 3.064 |
| Effort low | `#4982C2` | 3.204 | 3.057 | 4.505 | 3.057 |
| Effort medium | `#487CE2` | 3.207 | 3.040 | 4.497 | 3.046 |
| Effort high | `#6775E4` | 3.210 | 3.060 | 4.499 | 3.055 |
| Effort xhigh | `#806FDF` | 3.210 | 3.042 | 4.500 | 3.052 |
| Effort max | `#9469D3` | 3.215 | 3.073 | 4.496 | 3.051 |

Example: error sign `#E14444`, over its pill over hover over the warm-dark card:

```text
Pill = #363236
L(sign) = 0.205591511
L(pill) = 0.033318158
ratio = (0.205591511 + .05)/(.033318158 + .05)
      = 3.067657:1
```

The host describes hover as a background override. Also test that interpretation: pill over accent `14` directly over each reference background. Its minimum across this palette is **3.149:1**. Neither interpretation permits additional nested veils.

**Changed Gamma tokens: computed contrasts**

Solid `ACCENTO` position marker against the preceding track and empty track, both over one card:

| Background | Accent track `14` | Neutral empty track `14` |
|---|---:|---:|
| White | 3.477 | 3.499 |
| Warm light | 3.299 | 3.343 |
| Black | 4.854 | 4.807 |
| Warm dark | 3.339 | 3.269 |

Formula inputs are respectively `over(#0A86C9,20/255,Card(B))` and `over(#808080,20/255,Card(B))`. Current values can fall to **2.514** and **2.812**, respectively.

Usage-bar minimum contrasts against their empty segment, over bare backgrounds or one card: accent **3.269**, warning **3.239**, critical **3.173**, queue/milestone **3.253**, completed **3.250**.

**Usage-bar cards must not acquire hover tint:** the critical bar would reach only **2.962:1** under the conservative stacked-hover composition.

**Spacing, type, corners, bars**

Host spacing names are supported; their pixel mapping is host-owned. These are exact primitive choices, with pixel targets only for standalone board HTML.

| Element | Graphical host | Terminal | Board HTML |
|---|---|---|---|
| Small inline gap | `xs` | 1 column | 4px |
| Pills/actions gap | `sm` | 1 column; wrap | 8px |
| Card padding | `md` | No compact-card padding | 16px |
| Compact session padding | `sm` | No card | 8px |
| Inside card | `sm`; metadata pairs `xs` | No empty line between attributes | 8px |
| Between cards | `sm` | 1 empty line | 8px |
| Between sections | `lg` | 1 empty line | 24px |
| Card corners | `borderStyle="round"` | None for compact records | 12px |
| Pill corners | `borderStyle="round"` | No capsule border | 6px |
| Usage/progress bar | Existing one-caption-line Box fill; no vertical padding | 1 character row | 12px thick, 6px radius |
| Gamma | One-caption-line track | Existing textual track | Not applicable |

Brand: `title`, chip semibold, Manager bold. Card titles (including Load and Settings `Sezione` cards): `body`, semibold, title case as supplied by the translation; never force uppercase. Section labels outside cards (including Settings navigation groups): `caption`, semibold; uppercase only on the `desktop` surface, using the current locale, with translated casing on vscode, mobile, and terminal. Explanations: `caption`, host dim ink. Operational warnings and missing-data labels use normal ink. Use monospace for model IDs, paths, commands, and percentages; within a session's context fragment only the percentage is monospace, not its translated label. Use tabular digits for changing counts.

Do not prescribe unsupported `borderRadius`, `fontSize`, CSS shadows, custom focus props, or Button background props in the host tree.

**3. Shared components and interaction**

**Header and summary**

Keep the existing `MARCHIO` glyph and split wordmark. Put project/version in a subordinate text run that may wrap beneath the brand. Never truncate the brand. Preserve the existing header control sequence: Open board, Refresh, Work, Load, Settings.

Desktop:

```text
<> chipManager  acme/chipManager - 2.2.0
Open board   Refresh 11:22   [Work]  Load  Settings

[o 2 working] [! 1 waiting for you] [o 3 to start]
[! Claude 70% used, at warning]
```

`<>`, `o`, `!`, and `#` in these ASCII drawings stand for existing graphical signs. Brackets around data represent pills; they are not additional buttons. `[[action]]` means a filled graphical primary.

Summary values, freshness rules, and conditional visibility remain unchanged. A stale measurement is written as stale, never presented as current headroom.

**Buttons**

| Role | Rendering and application |
|---|---|
| Primary action | Graphical `Button variant="primary"`: ready **Start**, existing Start all, existing Settings Apply |
| Secondary action | Existing `variant="secondary"`: Queue, Retry, Open, Start next, preset Apply, connection/setup actions |
| Tertiary action | Existing `plain`: Details, Do it here, destination, selection, reorder, discard, cancel, refresh |
| Selected choice | Existing choice-chip variant retained, inside a visibly labelled choice group |

The owner’s Start decision supersedes the old “only one primary in the panel” comment. Each ready card has one primary; the section retains Start all. Queue and Retry do not become primary.

On terminal, preserve current variants and bracketed Start. Filling the desktop button must not introduce new coloured terminal label text.

Use native primary chrome and native foreground. Do not fake a filled button with a clickable Box. The API cannot force a particular fill colour: exact accent appearance needs a real capture. In particular, white text on raw `#0A86C9` is only **3.988:1**; do not impose that pairing.

**Pills and cards**

- State pills: sign + state; engine: diamond + name; model: dot + model; effort: existing blocks + level; reviewer/auditor: labelled role.
- Preserve `barreEffort()` output. Do not add selectable effort levels because a colour token exists.
- Unknown family uses neutral; unknown data stays explicitly unknown.
- Desktop “Who works” uses these same pills, including auditor, reviewer, lane, and changed-by-hand status.
- Preset preview retains its visible “nothing is saved until Apply” explanation.
- Normal cards have a neutral outline. Failed, blocked, and sensitive cards retain the current red outline priority; waiting cards use amber.
- An expanded editor is an inset region of the same card, **without another card veil**.

**Hover and focus**

Hover changes only `backgroundColor` on a stable, uniquely keyed Box. Apply to actionable work/session records and existing interactive rows. No hover on heading bars (including the common header and To start, even when they contain buttons), passive Load cards, milestone cards, usage bars, or Gamma tracks.

Keep native keyboard focus, control keys, hotkeys, and traversal order. Do not add autofocus or make the whole card clickable. Focus must survive refresh without moving to Start. All controls remain visible without hover.

**4. Views, widths, and states**

Retain `classeDi`: **60 = narrow**, **100 = medium**, **120 = wide**. Graphical surfaces remain a single card column at all three classes; terminal sessions retain their wide table.

The mockups show representative content; conditional controls must still follow the current code. Full accessible labels remain unchanged even where the drawing abbreviates a visible label.

**Work — desktop**

```text
WAITING FOR YOU                                      1
+----------------------------------------------------+
| Review authentication flow     [! Waiting for you]  |
| [<> Claude] [o Opus 5.5] [###. high]                 |
| Waiting for your decision                          |
| [Open]  Mark completed  Details                     |
+----------------------------------------------------+

WORKING NOW                                         2
+----------------------------------------------------+
| Update the API reference     Mark completed Details |
| [o Running] [<> Claude] [o Sonnet 5.5] [##.. medium] |
| context 38% - now - docs/api-reference              |
+----------------------------------------------------+

TO START AND QUEUED                                  3
[Start next: Fix the search filter] [[Start all - 2]]
+----------------------------------------------------+
| 1  Fix the search filter bug           [o To start] |
| [<> Codex] [o GPT-6 Astra] [#### xhigh]              |
| [review Claude] R2                                 |
| Preserve case-insensitive matching.                |
| [[Start]] Do it here Details                        |
| Where: local  Select  Up  Down  Discard             |
+----------------------------------------------------+
+----------------------------------------------------+
| 2  Add tests for the search filter       [o Queued] |
| [<> Codex] [o GPT-6.1 Sol] [##.. medium]             |
| ! Waiting for merge: Fix the search filter bug      |
| Remove from queue  Details                         |
| Where: local  Select  Up  Down  Discard             |
+----------------------------------------------------+
```

Desktop narrow: state moves below the title; action groups wrap. Medium/wide: state can align right. Session cards stay compact at wide widths; do not restore their desktop table.

Preserve the current first-six-session limit and Show all behaviour. A session’s existing title button remains its opening action; do not add a duplicate Open button.

Expanded “Who works”:

```text
Who works
[<> Claude] [o Opus 5.5] [###. high]
[auditor Sonnet 5.5] [rev Codex] [R4]
[! changed by hand]  Restore recommended
Preset: Recommended  Thrifty  Quality
Details
```

When previewing, replace the displayed attributes with the existing preview values and show its explanation, Apply, and Cancel in their existing order. Keep all cost and manual-auditor notices.

**Work — terminal, 60 columns**

```text
<> chipManager - acme/chipManager - 2.2.0
Open board  r: Refresh 11:22
1: Work  2: Load  3: Settings
2 working - 1 waiting for you - 3 to start

Waiting for you - 1
! Review authentication flow
  Claude - Opus 5.5 - ###. high
  Waiting for you
  [Open] Mark completed Details

Working now - 2
Update the API reference
o Running  Mark completed  Details
<> Claude - Sonnet 5.5 - ##.. medium
context 38% - now
docs/api-reference

To start and queued - 3
[Start next: Fix the search filter] [Start all - 2]
1 Fix the search filter bug
o To start
<> Codex - GPT-6 Astra - #### xhigh
review Claude - R2
[Start] Do it here Details
Where: local Select Up Down Discard
```

At 60 columns, attributes wrap by fragment; title, status, and explanation may occupy additional lines. No column-count-based removal of information or controls.

**Work — terminal, 100 columns**

```text
<> chipManager - acme/chipManager - 2.2.0
Open board  r: Refresh 11:22  1: Work  2: Load  3: Settings
2 working - 1 waiting for you - 3 to start - Claude 70% used, at warning

Working now - 2
Update the API reference              o Running  Mark completed  Details
<> Claude - Sonnet 5.5 - ##.. medium - context 38% - now - docs/api-reference

To start and queued - 3              [Start next: Fix filter] [Start all - 2]
1 Fix the search filter bug                                      o To start
<> Codex - GPT-6 Astra - #### xhigh - review Claude - R2
[Start] Do it here Details  Where: local Select Up Down Discard
```

**Work — terminal, 120 columns**

```text
Working now - 2
Work                         Who        Model          Effort          State       Context  Activity
Update the API reference     Claude     Sonnet 5.5     ##.. medium     Running         38%  now
docs/api-reference  Mark completed Details

To start and queued - 3                       [Start next: Fix filter] [Start all - 2]
1 Fix the search filter bug                                                   o To start
<> Codex - GPT-6 Astra - #### xhigh - review Claude - R2
[Start] Do it here Details  Where: local Select Up Down Discard
```

Keep the existing session-table column proportions. Long titles/models wrap within their cells; long branch paths may use the existing middle truncation.

**Work state contract — all widths**

| State | Desktop | Terminal | Action rule |
|---|---|---|---|
| Ready | Neutral card; “To start” pill | `o To start` | Start filled on graphical surfaces only when existing guards permit |
| Queued | Queue pill; amber explanation strip | `o Queued`, reason on following line | Existing remove-from-queue/details controls |
| Running | Compact session card; running pill | Compact record or 120-column table | Existing title/open, completion, details; no new Stop |
| Waiting for you | Amber outline unless higher-priority red applies; explicit state | `! Waiting for you` | Existing decision-related controls remain visible |
| Failed | Red outline; failed pill; error in normal ink | `x Failed`, reason below | Existing Retry/Ask here or blocking explanation |
| Sensitive R4 | Red outline and `! R4 sensitive` pill alongside actual state | `! R4 sensitive` beside attributes | R4 does not imply failure or bypass existing confirmation |
| Delivered | Delivered pill; remains in To merge | `v Delivered` | Open/completion/details as currently available; no new Merge action |

Empty Work keeps the existing introductory explanation. Empty sessions distinguish “no sessions” from “sessions could not be read.” Empty filtered results retain the existing clear-filter control. Do not add empty-state action buttons.

**Load — desktop**

Each existing section becomes a neutral `Sezione` card with a title-case title. Matrix first; no new dashboard tiles or charts.

```text
+-----------------------------------------------------------+
| Model x effort                                            |
| Model              low       medium      high      xhigh  |
| Sonnet 5.5           0          2 +1        0          0   |
| GPT-6 Astra          0          0           0          1   |
| Working count; + queued                                   |
+-----------------------------------------------------------+
+-----------------------------------------------------------+
| Limits and budget                                         |
| Claude - warning 70%, critical 90%                         |
| Claude plan - 5 h: 70% used, at warning                    |
| [#####################.........] 70% used                  |
| source - 2 min ago - reset 16:00                           |
| API spend: account 18 USD / 200 USD; project 6 USD         |
| [###...........................]                          |
+-----------------------------------------------------------+
+-----------------------------------------------------------+
| Context windows                                           |
| Update the API reference [###########................] 38% |
+-----------------------------------------------------------+
```

Use thick bars only where existing data supports a ratio. A balance or unmeasured budget must not acquire an invented progress bar. Preserve freshness, source, manual-entry, reset, account/project, and estimated-spend distinctions.

**Load — terminal**

```text
60 columns
Model x effort
Sonnet 5.5: medium 2 +1 queued
GPT-6 Astra: xhigh 1

Limits and budget
Claude plan - 5 h: 70% used, at warning
[#######...] 70% used
source - 2 min ago - reset 16:00

Context windows
Update the API reference
[####......] 38% used
```

```text
100 columns
Model x effort
Model                         low       medium       high       xhigh
Sonnet 5.5                      0         2 +1          0           0
GPT-6 Astra                     0          0            0           1

Claude plan - 5 h: 70% used, at warning
[##############......] 70% used
source - 2 min ago - reset 16:00
Update the API reference       [####......] 38% used             38%
```

```text
120 columns
Model x effort
Model                               low          medium          high          xhigh
Sonnet 5.5                            0            2 +1             0              0
GPT-6 Astra                           0             0               0              1

Claude plan - 5 h: 70% used, at warning
[##############......] 70% used
source - 2 min ago - reset 16:00
Update the API reference             [####......] 38% used                         38%
```

Retain 10-cell narrow bars and 20-cell standard bars; context bars retain their existing short form. Unknown values use words or `-`, never a zero-length “0%” bar. Preserve existing empty messages for matrix, limits, context, and recent starts.

**Settings — desktop**

Keep both navigation groups above the selected section. A sidebar would unnecessarily alter reading geometry and control traversal.

```text
ACCOUNT - ALL PROJECTS
Connections  [Thresholds]  Language  Execution

PROJECT - ACME/CHIPMANAGER
Balancing  Project  Board  Advanced  Legend

+--------------------------------------------------------+
| Thresholds                          2 providers        |
| Applies to all projects                                |
| Claude                                                 |
| Preset: [70/90]  80/95  Custom                          |
| Warning from      [-] =======|.... [+] 70%              |
| Critical from     [-] =========|.. [+] 90%              |
| Project restriction: warning 50%, critical 60%          |
| Remove restriction - Claude                            |
| Manual budgets                                         |
| [API budget - 200 USD]  [Add budget]                    |
+--------------------------------------------------------+

+--------------------------------------------------------+
| 2 unsaved changes       [[Apply]]  Discard changes      |
+--------------------------------------------------------+
```

Preset names above are illustrative; render the actual existing options. Account order is exactly **Connections, Thresholds, Language, Execution**. Project order is exactly **Balancing, Project, Board, Advanced, Legend**.

| Section | Visual organization |
|---|---|
| Connections | Allowed-provider choices → provider rows with status, evidence, key-presence text, existing connection action |
| Thresholds | Account scope → provider preset/Gamma groups → project restriction immediately beneath affected provider → manual budgets |
| Language | Language names in their own language; existing draft/save explanation |
| Execution | Readiness checks → current guided step → API credentials/budget explanation → project restrictions → cloud → advisor |
| Balancing | Proposals → profile choices and explanations → simulation → existing manual-adjustment disclosure |
| Project | Network policy → milestones → paths → sensitive terms |
| Board | Mode choices → cost/status explanation → generated-file path |
| Advanced | Task eligibility → endpoint and its scope/exception → installation actions |
| Legend | Lane definitions, then terminology; compact prose, no decorative cards per term |

Group membership is navigation, not a promise that every setting has that scope. Keep project permission text in Connections, account endpoint text in Advanced, and project restrictions in Execution/Thresholds.

Pending changes stay in normal document flow. No sticky footer, duplicated Apply, or new save semantics. Manual budgets and guided actions retain their immediate-write behaviour.

**Settings — terminal**

```text
60 columns
Account - all projects
Connections [Thresholds] Language Execution
Project - acme/chipManager
Balancing Project Board Advanced Legend

Thresholds
Applies to all projects
Claude
Preset: [70/90] 80/95 Custom
Warning from   [-] -------|---- [+] 70%
Critical from  [-] ---------|-- [+] 90%
Project restriction: warning 50%, critical 60%
Remove restriction - Claude

2 unsaved changes
[Apply] Discard changes
```

```text
100 columns
Account - all projects: Connections [Thresholds] Language Execution
Project - acme/chipManager: Balancing Project Board Advanced Legend

Thresholds
2 providers - applies to all projects
Claude
Preset: [70/90] 80/95 Custom
Warning from [-] -------|---- [+] 70%
Critical from [-] ---------|-- [+] 90%
2 unsaved changes  [Apply] Discard changes
```

```text
120 columns
Account - all projects: Connections [Thresholds] Language Execution
Project - acme/chipManager: Balancing Project Board Advanced Legend

Thresholds
2 providers - applies to all projects
Claude
Preset: [70/90] 80/95 Custom
Warning from [-] -------|---- [+] 70%
Critical from [-] ---------|-- [+] 90%
Project restriction: warning 50%, critical 60%  Remove restriction - Claude
2 unsaved changes  [Apply] Discard changes
```

No second column of form controls at 120. Allow translated navigation and action labels to wrap. Validation errors remain directly beneath their field; application errors remain after the pending-change bar. Empty thresholds explain the lack of configured measurements; clean drafts have no pending-change bar.

**F11 setup and doctor visual patterns**

F11 setup and doctor are implemented in `vista-impostazioni.tsx`. Apply these presentation contracts to their existing steps, controls, and behaviour. F11 owns the step count, action names, ordering, and completion rules; the drawings below are illustrative. On graphical surfaces, setup places its existing “Step n of m” at the right of the card header. The execution guide is an inset of its enclosing card, with no second border or card veil; terminal keeps its existing step outline.

Desktop setup:

```text
<> chipManager
Setup - Account                          Step 2 of 3
+----------------------------------------------------+
| Connect GitHub                                     |
| Claude sign-in is ready.                           |
| GitHub authentication is required for this step.    |
| [Connect GitHub]                                   |
| Skip this step   Close setup                       |
+----------------------------------------------------+
```

Desktop doctor:

```text
<> chipManager
Doctor                                  Checked 11:22
[! Needs attention]
+----------------------------------------------------+
| v Claude       Signed in                           |
| ! GitHub       Not signed in                       |
|   [Connect GitHub]                                 |
| - API credits  Not configured                      |
| v Configuration  Read successfully                  |
+----------------------------------------------------+
Recheck
```

Use one card, not a card for every check. The overall-result pill uses sign + words: `! Needs attention`, `✓ All checks passed`, or `— Not checked` (reusing the translated not-checked label). Checking and failed diagnostics replace that result with their existing explicit status. Keep the finding count and last-check time in the header; evidence and correction sit beneath the relevant check. Optional/unconfigured is distinct from failed. Never show credential values. A missing result cannot contribute to “All checks passed.”

Terminal versions:

```text
60 columns
chipManager setup - Account
Step 2 of 3
Connect GitHub
! GitHub is not signed in
[Connect GitHub]
Skip this step  Close setup

chipManager doctor
Needs attention - checked 11:22
v Claude: signed in
! GitHub: not signed in
  [Connect GitHub]
- API credits: not configured
v Configuration: read successfully
Recheck
```

```text
100 columns
chipManager setup - Account - Step 2 of 3
Connect GitHub
! GitHub is not signed in
[Connect GitHub]  Skip this step  Close setup

chipManager doctor - Needs attention - checked 11:22
v Claude: signed in
! GitHub: not signed in
  [Connect GitHub]
- API credits: not configured
v Configuration: read successfully
Recheck
```

```text
120 columns
chipManager setup - Account - Step 2 of 3
Connect GitHub
! GitHub is not signed in
[Connect GitHub]  Skip this step  Close setup

chipManager doctor - Needs attention - checked 11:22
v Claude: signed in
! GitHub: not signed in
  [Connect GitHub]
- API credits: not configured
v Configuration: read successfully
Recheck
```

Wide terminal output deliberately stays a simple list. During checks, show the supplied checking status in place; do not shift controls or invent progress percentages. Completed setup uses a short result summary in the same region.

**Board HTML**

Keep it static, script-free, and read-only. Retain native `<details>/<summary>`, IDs, section order, generation time, escaping, token masking, and CSP.

Use the same brand, card hierarchy, tinted attribute treatment, and 12px progress bars. Extend `cssVariabiliBoard()` with semantic colour/veil variables from `tema.ts`; never duplicate hex values in `board.ts`.

```text
Desktop / approximately 120 columns
<> chipManager - acme/chipManager
Generated 7 Nov 2026, 11:22 - 2.2.0
2 working - 1 waiting - 3 to start

WAITING FOR THE OWNER                                    1
+---------------------------------------------------------+
| > Review authentication flow                            |
|   [! Waiting] [<> Claude] [o Opus 5.5] [###. high]       |
+---------------------------------------------------------+
IN PROGRESS                                              2
+---------------------------------------------------------+
| > Update the API reference                              |
|   [o Running] [<> Claude] [o Sonnet 5.5] [##.. medium]   |
+---------------------------------------------------------+
```

```text
Approximately 100 columns
> Update the API reference
  [o Running] [<> Claude] [o Sonnet 5.5] [##.. medium]
  Expanded: Process / Who works / Review / Times / Links
```

```text
Approximately 60 columns
> Update the API reference
  [o Running] [<> Claude]
  [o Sonnet 5.5] [##.. medium]

  Process
  Lane
  R2
  Who works
  Executor
  Claude
```

These widths describe browser layout, not a new terminal board renderer. At narrow widths, definition lists stack label/value; long paths and preformatted content wrap within the card.

Keep native disclosure markers. Hover may change summary background only; keyboard focus retains a visible outline. Error prose uses `--testo`, with the error colour restricted to its sign. Do not add launch, retry, or merge controls.

For a neutral card, existing board text contrast is **14.762/16.996:1** for dark/light body ink and **7.199/4.632:1** for muted ink. Attribute-sign minima under the tested stacked composition are **3.845/3.179:1**. These measurements do not certify muted text placed inside an additional tinted pill; pill words use body ink.

**5. Exact implementation scope and snapshot exceptions**

| File | Required presentation changes |
|---|---|
| `hooks/tema.ts` | Change only `VELO.traccia` and `VELO.vuoto` to `14`. Export additional board CSS variables from existing semantic tokens. Document the single-card-layer and no-hover-on-bars constraints. |
| `hooks/ui.tsx` | Apply the spacing contract to `Scheda`, `Sezione`, `Pillola`, `Pillole`, `Riga`, `Intestazione`. Give desktop attribute pills rounded outlines. Make noninteractive status `Chip` styling match `Pillola`, preserving its key and text. Preserve interactive/removable Chip branches. `Gamma` consumes the changed tokens. Retain `Barra`’s distinct renderings. |
| `hooks/pannello.tsx` | Adjust brand/project wrapping and header spacing. Preserve summary computation, header control sequence, active navigation variants, notices, and conditional board visibility. Correct the obsolete single-primary comment. |
| `hooks/vista-lavoro.tsx` | Consolidate graphical work-card styling through `Scheda`; remove nested editor veil. Convert desktop `riepilogo` and changed-by-hand display to pills. Add desktop compact session-card rendering using the existing `titoloSessione` controls in their original sequence. Keep terminal session branches. Promote eligible graphical Start buttons in both `scheda` and `schedaCompatta`. |
| `hooks/vista-carico.tsx` | Give its four existing sections neutral `Sezione` shells with no hover. Retain matrix/list switching, counts, bar eligibility, freshness, monetary semantics, and ordering. |
| `hooks/vista-impostazioni.tsx` | Apply grouped-navigation spacing, consistent section shells, field spacing, restriction notices, and pending-change-bar layout. Restyle existing guided/readiness regions with the F11 pattern without changing their control contract. |
| `hooks/board.ts` | Update CSS dimensions and native summary/card markup; add semantic attribute spans from existing data. Preserve disclosure structure, security properties, grouping, and all existing information. |
| `tests/ui.test.tsx` | Verify Gamma contrast, rounded pills, spacing/surface distinctions, neutral/accent signs, actual hover compositions, and non-hovered bars. |
| `tests/lavoro.test.tsx` | Verify desktop session cards, Who works pills, launch-versus-queue variants, unchanged order/handlers, and width/language cases. |
| `tests/impostazioni.test.tsx` | Verify visual grouping, scope notices, and unchanged draft/immediate-write behaviour. |
| `tests/board.test.tsx` | Verify generated token variables, static disclosure markup, escaping/masking/CSP, semantic states, and responsive styling. |
| `tests/f9-prima.ts` | Only the six variant-field edits listed below. |
| `tests/f9.ts` | No normalization or comparison relaxation. |

No `Pulsante` wrapper is needed: native `Button.variant` already owns the required behaviour. Reuse translations; add the two doctor result labels in all six dictionaries, with no existing control label changes. Preserve the F11 control baseline in `tests/f11-nuovi.ts`.

**Intentional control snapshot changes — exhaustive**

For control **`avvia-a-avviab01`**, change only `variant: "secondary"` to `"primary"` in:

1. `controlli:desktop:lavoro`
2. `controlli:desktop:lavoro-dettagli`
3. `controlli:vscode:lavoro`
4. `controlli:vscode:lavoro-dettagli`
5. `controlli:mobile:lavoro`
6. `controlli:mobile:lavoro-dettagli`

General rendering rule: an existing `avvia-${id}` becomes primary only on a graphical surface when it represents **Start**, not Queue. Keep its existing visibility guards and callback.

No terminal variant changes. No Retry, Queue, Start next, preset, navigation, or Settings variant changes. No changes to keys, labels, hotkeys, values, options, handler presence, control order, or callback-effect snapshots. Keep surface-specific Input/Select availability.

**6. Acceptance and real-capture risks**

Implementation verification must include existing behaviour tests plus focused visual assertions; do not regenerate the entire baseline to absorb differences.

Capture **English, Italian, Spanish, French, German, and Brazilian Portuguese**, both themes:

- Desktop at narrow and wide panel sizes; terminal at **60, 100, and 120 columns**.
- Every listed work state, including sensitive-and-waiting together, blocked Start, queued dependencies, and delivered work.
- Long titles, model IDs, paths, translated buttons, and expanded Who works.
- Settings clean/dirty/saving/error/conflict states, Account/Project restrictions, and immediate-write budget controls.
- Fresh, stale, manual, unavailable, zero, and full usage; unknown context.
- Pointer rest/hover and complete keyboard traversal, including redraw while focused.
- Board collapsed/expanded/focused, narrow definition lists, and long content.

The critical capture questions are: whether native Start is visibly filled; whether its native foreground is readable; whether `round` produces pleasant pills; whether named spacing and caption-line bars are too tall; whether host dim ink and matrix tints remain legible; and whether long translated controls fit without clipping.

The palette has little spare contrast margin. Extra card layers, stronger tints, dimmed semantic signs, or hover behind critical bars require recalculation. Preview HTML and textual simulations must be labelled as previews, never as host captures.

No files were modified; contrast calculations were performed, but implementation tests and real host captures were not run. Native button colour, focus appearance, and final spacing remain capture-dependent acceptance risks.
