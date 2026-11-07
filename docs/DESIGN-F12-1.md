# F12.1 layout pass

Presentation only, following F12. References below are to the pre-pass source.

| Problem | Evidence | Correction |
|---|---|---|
| Group, card and control gaps all use `sm`; compact cards have different insets. | `hooks/ui.tsx:230`, `:356`; `hooks/vista-lavoro.tsx:1160` | Separate the four spacing roles; use the same card inset. |
| Pills form one undifferentiated run; expanded editors add padding and a margin to their parent's gap. | `hooks/vista-lavoro.tsx:125`, `:279`, `:515` | Wrap execution and review/context attributes in separate groups; remove redundant editor insets. |
| Session actions precede state and attributes; compact card utilities crowd the main actions. | `hooks/vista-lavoro.tsx:904`, `:1028` | Put session actions after metadata; let trailing utilities consume remaining row space. |
| Section titles are as far from their first card as cards are from each other. | `hooks/vista-lavoro.tsx:1160`, `:1184` | Keep title and list close; apply card spacing inside the list. |
| Load records lack internal rhythm; tables mix numeric gutters with named spacing. | `hooks/vista-carico.tsx:54`, `:91`, `:185`; `hooks/pannello.tsx:257` | Compact label/value/bar groups, aligned table gutters, separate measurement groups. |
| Settings fields and providers have equal spacing; navigation choices have extra outlines around native buttons. | `hooks/vista-impostazioni.tsx:428`, `:511`, `:1298`; `hooks/ui.tsx:75` | Group related fields and evidence; retain selection tint but let native buttons own their outline and size. |
| Pending actions follow the count without an aligned action group; setup/doctor tertiary actions are crowded; reports add an inner border. | `hooks/vista-impostazioni.tsx:633`, `:672`, `:681`, `:1329` | One wrapping footer row with trailing tertiary group; borderless graphical inset reports. Keep corrective actions beside their finding. |
| Header tools compete with the brand; summary and notices use the same rhythm. | `hooks/pannello.tsx:453` | Give brand/tools a stable column, group navigation separately, keep summary close to its context. |
| Board uses browser-default prose margins, section rules plus card outlines, and equal pill/card gaps. | `hooks/board.ts:200`–`:209` | Explicit four-level CSS spacing, grouped pills, one outline per card, aligned definition lists and compact narrow stacking. |

Rules applied:

- `xs`: inside a group (label/value, related pills, buttons); `sm`: between groups; `md`: between cards and the matching card inset; `lg`: between sections. Board equivalents: 4/8/16/24px. Host pixel mapping stays host-owned.
- Reading order: title → state → attributes → explanation → actions. Keep related evidence with its field/check. Execution attributes and review/context attributes wrap as groups; long text may wrap inside a group at 60 columns.
- One wrapping action row per card or independently actionable subgroup: primary, secondary, then separated trailing tertiary/destructive controls. Native button sizing and existing variants remain authoritative. No extra border/padding around native choice buttons; no empty action containers.
- Frozen control order wins over visual sorting: title/open controls remain first, setup Back precedes Next, and inline correction/preset controls stay with their fields. No CSS visual reordering. A single disclosure/correction button is its own meaningful group, never a full-width orphan.
- Graphical cards use one veil and one outer border. Insets use spacing, not another surface. Keep all existing hover eligibility and colours; never add hover to usage bars or headings.
- Terminal remains compact: zero vertical spacing inside a group, one blank line between groups/cards/sections; no stacked margin plus gap. Preserve the existing wide session table; 60 columns use wrapping single-column content.
- Scope: shared UI, Work, Load, Settings (both navigation groups and all sections), setup, doctor, header/summary, static board, affected presentation assertions and one changelog line. No handlers, keys, labels, hotkeys, variants, translations, colour tokens or data changes. Freeze `tests/f9-prima.ts`, `tests/f11-nuovi.ts` and `tests/f9.ts` byte-for-byte.
- Proof: targeted Node checks only, including syntax, frozen source/control contracts, layout trees and board output. No full suite, commit or `.git` modification. Real host pixel sizing, focus retention and clipping require host captures; simulated trees are not captures.

Validation completed: 2,016 before/after tree comparisons (six languages, four surfaces, 60/100/120 columns), unchanged native control expressions/callbacks and hover rules, frozen F9/F11 files and colour source, no increase in calculated terminal minimum width, and three existing board checks for layout/contrast, escaping/CSP and token masking. Used a lightweight Node renderer with the cached TypeScript compiler; the host SDK/test runner was unavailable. No full suites or real host captures.
