# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

La superficie non è una pagina web: è un pannello (`Pane`) di una mod di Claude Code, disegnato con gli
elementi che l'host mette a disposizione (`Box`, `Text`, `Button`, `Input`, `Select`, più `Svg` sul desktop).
Gira su due superfici con lo stesso albero: l'app desktop di Claude Code e il terminale (Ink). Il tema,
i caratteri e i colori di base sono quelli dell'host.

## Users

Chi coordina lavoro di sviluppo affidato a più agenti in parallelo (sessioni Claude e Codex) sullo stesso
progetto: di solito una persona sola, con una sessione «master» che pianifica e propone e altre sessioni
che eseguono. Tiene il pannello aperto accanto alla chat per ore; lo guarda a colpo d'occhio decine di
volte e ci lavora davvero quando deve decidere (avviare, riordinare, sbloccare, fondere).

## Product Purpose

Una dashboard di gestione del lavoro degli agenti: chi sta facendo cosa, con quale modello ed effort,
quanto carico c'è e dove resta margine, cosa aspetta una decisione. Gli agenti mettono il lavoro proposto
nel pannello (chip) invece che in chat; la persona lo rivede e lo avvia in ordine di dipendenza.
Successo = meno decisioni ripetitive, nessun limite esaurito per sorpresa, ogni avvio tracciabile.

## Positioning

Il pannello vive dentro l'host, accanto alla conversazione che propone il lavoro: legge le sessioni e i
limiti reali dell'account, applica le regole del progetto (routing, corsie, termini sensibili) prima di
ogni avvio e rifiuta per difetto quando un dato manca, invece di indovinare.

## Operating Context

- Sessioni desktop o CLI, ciascuna nel proprio worktree; una sessione master coordina e fonde.
- Limiti dei fornitori: piani Claude (finestre a 5 ore e settimanali, per modello), piano Codex, saldi e
  budget manuali; ogni dato ha fonte ed età.
- Configurazione locale per progetto in `~/.claude/chipmanager/config.json`, regole in un `routing.json`
  del repository.

## Capabilities and Constraints

- Strumenti MCP: `suggerisci_azione`, `aggiorna_azione`, `risorse_agenti`; comando `/chipmanager`.
- Guardie che non si allentano: lavoro sensibile mai delegato in autonomia né al cloud, configurazione
  illeggibile = nessun avvio, chiavi solo nei campi segreti del plugin.
- Nessuna dipendenza nuova, nessun dato che esca dalla macchina oltre ai fornitori già abilitati.
- Ogni progetto vede solo le proprie chip.

## Brand Commitments

Nome «chipManager» (plugin `chip-manager`), icona a chip azzurro `#00BFFF`. Interfaccia in italiano.

## Evidence on Hand

Immagini in `docs/img/` (illustrazioni con dati d'esempio, dichiarate come tali). Nessun dato reale di
progetti o persone nelle immagini, nei test o nei documenti pubblici.

## Product Principles

1. Prima la risposta a «chi fa cosa adesso», poi il resto.
2. Un numero senza fonte ed età non è disponibilità.
3. Il colore marca dati e stati, non decora.
4. Le decisioni automatiche propongono; la persona conferma ciò che cambia le regole.
5. Stesse informazioni sul desktop e nel terminale, ognuna nella forma che la superficie sa disegnare.
