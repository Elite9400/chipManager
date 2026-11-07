// F9: la fotografia «prima» dei controlli e degli effetti, scritta dal codice di 92ff573 (prima di F9) con le prove di
// tests/f9.ts, lavoro.test.tsx e azioni.test.tsx in un worktree temporaneo; non si aggiorna per la grafica.
export const PRIMA: Record<string, unknown> = {
 "controlli:desktop:sessione-al-lavoro": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Aggiorna · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Lavoro",
   "hotkey": "1",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Carico",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Impostazioni",
   "hotkey": "3",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "cambia-mod-a-cmbf9001",
   "label": "Cambia modello",
   "value": "claude-opus-5-5",
   "options": [
    {
     "value": "claude-opus-5-5",
     "label": "Opus 5.5"
    },
    {
     "value": "claude-sonnet-5-5",
     "label": "Sonnet 5.5"
    },
    {
     "value": "claude-haiku-5-5",
     "label": "Haiku 5.5"
    },
    {
     "value": "claude-fable-5-1",
     "label": "Fable 5.1"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "cambia-eff-a-cmbf9001",
   "label": "Cambia effort",
   "value": "high",
   "options": [
    {
     "value": "low",
     "label": "▰▱▱▱  low"
    },
    {
     "value": "medium",
     "label": "▰▰▱▱  medium"
    },
    {
     "value": "high",
     "label": "▰▰▰▱  high"
    },
    {
     "value": "xhigh",
     "label": "▰▰▰▰  xhigh"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vedi-a-cmbf9001",
   "label": "Apri 1 · T a-cmbf9001",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fatta-a-cmbf9001",
   "label": "Segna completata 1 · T a-cmbf9001",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-cmbf9001",
   "label": "Dettagli 1 · T a-cmbf9001",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vedi-a-cmbf9001",
   "label": "Apri la sessione di T a-cmbf9001",
   "gestori": [
    "press"
   ]
  }
 ],
 "effetti:desktop:cambia": {
  "app": [
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "set_session_model",
    "args": {
     "session_id": "local_12345678-1234-1234-1234-123456789abc",
     "model": "claude-sonnet-5-5"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "local_12345678-1234-1234-1234-123456789abc"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "set_session_effort",
    "args": {
     "session_id": "local_12345678-1234-1234-1234-123456789abc",
     "effort": "xhigh"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "local_12345678-1234-1234-1234-123456789abc"
    }
   }
  ],
  "record": {
   "id": "a-cmbf9001",
   "versione": 0,
   "titolo": "T a-cmbf9001",
   "brief": "Fai X.",
   "ordine": 1,
   "dipende": [],
   "esecutore": "claude",
   "revisore": "nessuno",
   "stato": "avviata",
   "creata": "ISTANTE",
   "aggiornata": "ISTANTE",
   "repo": "acme/progetto",
   "sessione": "local_12345678-1234-1234-1234-123456789abc",
   "tentativo": "X",
   "lanciataDa": "sessione-master",
   "avviataIl": "ISTANTE",
   "modello": "claude-sonnet-5-5",
   "effort": "xhigh",
   "cambio": {
    "campo": "effort",
    "valore": "xhigh",
    "esito": "fatto",
    "quando": "ISTANTE"
   }
  }
 },
 "controlli:terminal:sessione-al-lavoro": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Aggiorna · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Lavoro",
   "hotkey": "1",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Carico",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Impostazioni",
   "hotkey": "3",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "cambia-mod-a-cmbf9001",
   "label": "Cambia modello",
   "value": "claude-opus-5-5",
   "options": [
    {
     "value": "claude-opus-5-5",
     "label": "Opus 5.5"
    },
    {
     "value": "claude-sonnet-5-5",
     "label": "Sonnet 5.5"
    },
    {
     "value": "claude-haiku-5-5",
     "label": "Haiku 5.5"
    },
    {
     "value": "claude-fable-5-1",
     "label": "Fable 5.1"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "cambia-eff-a-cmbf9001",
   "label": "Cambia effort",
   "value": "high",
   "options": [
    {
     "value": "low",
     "label": "▰▱▱▱  low"
    },
    {
     "value": "medium",
     "label": "▰▰▱▱  medium"
    },
    {
     "value": "high",
     "label": "▰▰▰▱  high"
    },
    {
     "value": "xhigh",
     "label": "▰▰▰▰  xhigh"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vedi-a-cmbf9001",
   "label": "Apri 1 · T a-cmbf9001",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fatta-a-cmbf9001",
   "label": "Segna completata 1 · T a-cmbf9001",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-cmbf9001",
   "label": "Dettagli 1 · T a-cmbf9001",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vedi-a-cmbf9001",
   "label": "Apri la sessione di T a-cmbf9001",
   "gestori": [
    "press"
   ]
  }
 ],
 "effetti:terminal:cambia": {
  "app": [
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "set_session_model",
    "args": {
     "session_id": "local_12345678-1234-1234-1234-123456789abc",
     "model": "claude-sonnet-5-5"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "local_12345678-1234-1234-1234-123456789abc"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "set_session_effort",
    "args": {
     "session_id": "local_12345678-1234-1234-1234-123456789abc",
     "effort": "xhigh"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "local_12345678-1234-1234-1234-123456789abc"
    }
   }
  ],
  "record": {
   "id": "a-cmbf9001",
   "versione": 0,
   "titolo": "T a-cmbf9001",
   "brief": "Fai X.",
   "ordine": 1,
   "dipende": [],
   "esecutore": "claude",
   "revisore": "nessuno",
   "stato": "avviata",
   "creata": "ISTANTE",
   "aggiornata": "ISTANTE",
   "repo": "acme/progetto",
   "sessione": "local_12345678-1234-1234-1234-123456789abc",
   "tentativo": "X",
   "lanciataDa": "sessione-master",
   "avviataIl": "ISTANTE",
   "modello": "claude-sonnet-5-5",
   "effort": "xhigh",
   "cambio": {
    "campo": "effort",
    "valore": "xhigh",
    "esito": "fatto",
    "quando": "ISTANTE"
   }
  }
 },
 "controlli:vscode:sessione-al-lavoro": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Aggiorna · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Lavoro",
   "hotkey": "1",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Carico",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Impostazioni",
   "hotkey": "3",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "cambia-mod-a-cmbf9001",
   "label": "Cambia modello",
   "value": "claude-opus-5-5",
   "options": [
    {
     "value": "claude-opus-5-5",
     "label": "Opus 5.5"
    },
    {
     "value": "claude-sonnet-5-5",
     "label": "Sonnet 5.5"
    },
    {
     "value": "claude-haiku-5-5",
     "label": "Haiku 5.5"
    },
    {
     "value": "claude-fable-5-1",
     "label": "Fable 5.1"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "cambia-eff-a-cmbf9001",
   "label": "Cambia effort",
   "value": "high",
   "options": [
    {
     "value": "low",
     "label": "▰▱▱▱  low"
    },
    {
     "value": "medium",
     "label": "▰▰▱▱  medium"
    },
    {
     "value": "high",
     "label": "▰▰▰▱  high"
    },
    {
     "value": "xhigh",
     "label": "▰▰▰▰  xhigh"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vedi-a-cmbf9001",
   "label": "Apri 1 · T a-cmbf9001",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fatta-a-cmbf9001",
   "label": "Segna completata 1 · T a-cmbf9001",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-cmbf9001",
   "label": "Dettagli 1 · T a-cmbf9001",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vedi-a-cmbf9001",
   "label": "Apri la sessione di T a-cmbf9001",
   "gestori": [
    "press"
   ]
  }
 ],
 "effetti:vscode:cambia": {
  "app": [
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "set_session_model",
    "args": {
     "session_id": "local_12345678-1234-1234-1234-123456789abc",
     "model": "claude-sonnet-5-5"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "local_12345678-1234-1234-1234-123456789abc"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "set_session_effort",
    "args": {
     "session_id": "local_12345678-1234-1234-1234-123456789abc",
     "effort": "xhigh"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "local_12345678-1234-1234-1234-123456789abc"
    }
   }
  ],
  "record": {
   "id": "a-cmbf9001",
   "versione": 0,
   "titolo": "T a-cmbf9001",
   "brief": "Fai X.",
   "ordine": 1,
   "dipende": [],
   "esecutore": "claude",
   "revisore": "nessuno",
   "stato": "avviata",
   "creata": "ISTANTE",
   "aggiornata": "ISTANTE",
   "repo": "acme/progetto",
   "sessione": "local_12345678-1234-1234-1234-123456789abc",
   "tentativo": "X",
   "lanciataDa": "sessione-master",
   "avviataIl": "ISTANTE",
   "modello": "claude-sonnet-5-5",
   "effort": "xhigh",
   "cambio": {
    "campo": "effort",
    "valore": "xhigh",
    "esito": "fatto",
    "quando": "ISTANTE"
   }
  }
 },
 "controlli:desktop:lavoro": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "riprova-a-fallit01",
   "label": "▶ Retry 4 · Failed sample export",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "chiedi-a-fallit01",
   "label": "Ask this session 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-fallit01",
   "label": "Details 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-fallit01",
   "label": "Select 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-fallit01",
   "label": "↑ 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-fallit01",
   "label": "↓ 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-fallit01",
   "label": "Discard 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "prossima",
   "label": "Start next: Search filter for long lists, w…",
   "hotkey": "n",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "tutte",
   "label": "Start all · 2",
   "hotkey": "a",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "avvia-a-avviab01",
   "label": "▶ Start 1 · Search filter for long …",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "qui-a-avviab01",
   "label": "Do it here 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-avviab01",
   "label": "Details 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-avviab01",
   "label": "Select 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-avviab01",
   "label": "↑ 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-avviab01",
   "label": "↓ 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-avviab01",
   "label": "Discard 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "qui-a-blocca01",
   "label": "Do it here 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "perche-a-blocca01",
   "label": "Why 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-blocca01",
   "label": "Details 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-blocca01",
   "label": "Select 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-blocca01",
   "label": "↑ 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-blocca01",
   "label": "↓ 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-blocca01",
   "label": "Discard 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "annulla-a-coda0001",
   "label": "Remove from queue 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-coda0001",
   "label": "Details 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-coda0001",
   "label": "Select 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-coda0001",
   "label": "↑ 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-coda0001",
   "label": "↓ 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-coda0001",
   "label": "Discard 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vedi-a-conseg01",
   "label": "Open 5 · Delivered sample legend",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fatta-a-conseg01",
   "label": "Mark done 5 · Delivered sample legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-conseg01",
   "label": "Details 5 · Delivered sample legend",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:desktop:lavoro-dettagli": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "riprova-a-fallit01",
   "label": "▶ Retry 4 · Failed sample export",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "chiedi-a-fallit01",
   "label": "Ask this session 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-fallit01",
   "label": "Details 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-fallit01",
   "label": "Select 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-fallit01",
   "label": "↑ 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-fallit01",
   "label": "↓ 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-fallit01",
   "label": "Discard 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "prossima",
   "label": "Start next: Search filter for long lists, w…",
   "hotkey": "n",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "tutte",
   "label": "Start all · 2",
   "hotkey": "a",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "apri-a-avviab01",
   "label": "Close the details of Search filter for long lists, with server-side paging and a result count in the header",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "avvia-a-avviab01",
   "label": "▶ Start 1 · Search filter for long …",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "qui-a-avviab01",
   "label": "Do it here 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-avviab01",
   "label": "Close 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-avviab01",
   "label": "Select 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-avviab01",
   "label": "↑ 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-avviab01",
   "label": "↓ 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-avviab01",
   "label": "Discard 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "preset-a-avviab01-consigliato-premi",
   "label": "Recommended",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "preset-a-avviab01-economico-premi",
   "label": "Thrifty",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "preset-a-avviab01-qualita-premi",
   "label": "Quality",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "chi-dettagli-a-avviab01",
   "label": "Details 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "dest-a-avviab01",
   "label": "Where",
   "value": "local",
   "options": [
    {
     "value": "local",
     "label": "On this computer"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "ctx-a-avviab01",
   "label": "Context",
   "value": "fresh",
   "options": [
    {
     "value": "fresh",
     "label": "New session, brief only"
    },
    {
     "value": "fork",
     "label": "Fork of this conversation"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "wt-a-avviab01",
   "label": "Folder",
   "value": "si",
   "options": [
    {
     "value": "si",
     "label": "Own worktree"
    },
    {
     "value": "no",
     "label": "Shared folder"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "perm-a-avviab01",
   "label": "Permissions",
   "value": "eredita",
   "options": [
    {
     "value": "eredita",
     "label": "Same as this session"
    },
    {
     "value": "default",
     "label": "Ask every time"
    },
    {
     "value": "acceptEdits",
     "label": "Accept edits"
    },
    {
     "value": "plan",
     "label": "Plan"
    },
    {
     "value": "auto",
     "label": "Auto"
    },
    {
     "value": "bypassPermissions",
     "label": "Bypass permissions"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "sv-a-avviab01",
   "label": "Wake-up",
   "value": "no",
   "options": [
    {
     "value": "no",
     "label": "Default: the app wakes me at the end of the turn"
    },
    {
     "value": "si",
     "label": "Even if the brief does not reach the session"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "ramo-a-avviab01",
   "label": "Branch",
   "value": "",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "base-a-avviab01",
   "label": "Starts from",
   "value": "",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "piano-a-avviab01",
   "label": "Plan",
   "value": "",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "tit-a-avviab01",
   "label": "Title",
   "value": "Search filter for long lists, with server-side paging and a result count in the header",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "brief-a-avviab01",
   "label": "Brief",
   "value": "Add the filter to the sample list.",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "qui-a-blocca01",
   "label": "Do it here 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "perche-a-blocca01",
   "label": "Why 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-blocca01",
   "label": "Details 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-blocca01",
   "label": "Select 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-blocca01",
   "label": "↑ 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-blocca01",
   "label": "↓ 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-blocca01",
   "label": "Discard 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "annulla-a-coda0001",
   "label": "Remove from queue 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-coda0001",
   "label": "Details 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-coda0001",
   "label": "Select 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-coda0001",
   "label": "↑ 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-coda0001",
   "label": "↓ 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-coda0001",
   "label": "Discard 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vedi-a-conseg01",
   "label": "Open 5 · Delivered sample legend",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fatta-a-conseg01",
   "label": "Mark done 5 · Delivered sample legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-conseg01",
   "label": "Details 5 · Delivered sample legend",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:desktop:carico": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:desktop:impostazioni-connessioni": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fornitore-claude-premi",
   "label": "Claude",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fornitore-codex-premi",
   "label": "Codex",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fornitore-deepseek-premi",
   "label": "DeepSeek",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fornitore-freellmapi-premi",
   "label": "FreeLLMAPI",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "collega-claude",
   "label": "Connect Claude…",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "collega-codex",
   "label": "Connect Codex…",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:desktop:impostazioni-soglie": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "aggiungi-budget",
   "label": "Add budget…",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:desktop:impostazioni-bilanciamento": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "profilo-automatico-premi",
   "label": "Automatic",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "profilo-risparmio-premi",
   "label": "Saving",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "profilo-qualita-premi",
   "label": "Quality",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "profilo-velocita-premi",
   "label": "Speed",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "profilo-personalizzato-premi",
   "label": "Custom",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "regola-a-mano",
   "label": "Adjust by hand…",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:desktop:impostazioni-progetto": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "rete-abilitati-premi",
   "label": "Providers enabled",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "rete-locale-premi",
   "label": "Local network only",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "milestone-github-premi",
   "label": "Read GitHub milestones",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:desktop:impostazioni-board": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "board-spenta-premi",
   "label": "Off",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "board-accesa-premi",
   "label": "On",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "board-riassunti-premi",
   "label": "With summaries",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:desktop:impostazioni-avanzate": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "free-livello-niente-premi",
   "label": "Nothing",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "free-livello-R1-premi",
   "label": "Only R0–R1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "free-livello-R2-premi",
   "label": "R2 too",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "free-endpoint",
   "label": "FreeLLMAPI endpoint (loopback)",
   "value": "http://localhost:3001/v1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "installa-0",
   "label": "Prepare Docker image…",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "installa-1",
   "label": "Start container…",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:desktop:impostazioni-esecuzione": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "ese-ricontrolla",
   "label": "Check again",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "ese-guida",
   "label": "Set up Execution",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "ese-chiave-vai",
   "label": "Enter the key",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "ese-budget",
   "label": "Monthly budget (USD)",
   "value": "20",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "ese-tetto",
   "label": "Cap per run (USD)",
   "value": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "ese-api-togli",
   "label": "Remove API Claude",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "consigliere-spento-premi",
   "label": "Off",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "consigliere-suggerisci-premi",
   "label": "Suggest",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "consigliere-applica-premi",
   "label": "Apply to chips with no destination",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:desktop:impostazioni-lingua": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-en-premi",
   "label": "English",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-it-premi",
   "label": "Italiano",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-es-premi",
   "label": "Español",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-fr-premi",
   "label": "Français",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-de-premi",
   "label": "Deutsch",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-pt-premi",
   "label": "Português (Brasil)",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:desktop:impostazioni-legenda": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:terminal:lavoro": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "riprova-a-fallit01",
   "label": "▶ Retry 4 · Failed sample export",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "chiedi-a-fallit01",
   "label": "Ask this session 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-fallit01",
   "label": "Details 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-fallit01",
   "label": "Select 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-fallit01",
   "label": "↑ 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-fallit01",
   "label": "↓ 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-fallit01",
   "label": "Discard 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "prossima",
   "label": "Start next: Search filter for long lists, w…",
   "hotkey": "n",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "tutte",
   "label": "Start all · 2",
   "hotkey": "a",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "avvia-a-avviab01",
   "label": "▶ Start 1 · Search filter for long …",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "qui-a-avviab01",
   "label": "Do it here 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-avviab01",
   "label": "Details 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-avviab01",
   "label": "Select 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-avviab01",
   "label": "↑ 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-avviab01",
   "label": "↓ 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-avviab01",
   "label": "Discard 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "qui-a-blocca01",
   "label": "Do it here 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "perche-a-blocca01",
   "label": "Why 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-blocca01",
   "label": "Details 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-blocca01",
   "label": "Select 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-blocca01",
   "label": "↑ 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-blocca01",
   "label": "↓ 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-blocca01",
   "label": "Discard 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "annulla-a-coda0001",
   "label": "Remove from queue 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-coda0001",
   "label": "Details 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-coda0001",
   "label": "Select 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-coda0001",
   "label": "↑ 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-coda0001",
   "label": "↓ 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-coda0001",
   "label": "Discard 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vedi-a-conseg01",
   "label": "Open 5 · Delivered sample legend",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fatta-a-conseg01",
   "label": "Mark done 5 · Delivered sample legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-conseg01",
   "label": "Details 5 · Delivered sample legend",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:terminal:lavoro-dettagli": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "riprova-a-fallit01",
   "label": "▶ Retry 4 · Failed sample export",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "chiedi-a-fallit01",
   "label": "Ask this session 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-fallit01",
   "label": "Details 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-fallit01",
   "label": "Select 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-fallit01",
   "label": "↑ 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-fallit01",
   "label": "↓ 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-fallit01",
   "label": "Discard 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "prossima",
   "label": "Start next: Search filter for long lists, w…",
   "hotkey": "n",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "tutte",
   "label": "Start all · 2",
   "hotkey": "a",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "apri-a-avviab01",
   "label": "Close the details of Search filter for long lists, with server-side paging and a result count in the header",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "avvia-a-avviab01",
   "label": "▶ Start 1 · Search filter for long …",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "qui-a-avviab01",
   "label": "Do it here 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-avviab01",
   "label": "Close 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-avviab01",
   "label": "Select 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-avviab01",
   "label": "↑ 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-avviab01",
   "label": "↓ 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-avviab01",
   "label": "Discard 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "preset-a-avviab01-consigliato-premi",
   "label": "Recommended",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "preset-a-avviab01-economico-premi",
   "label": "Thrifty",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "preset-a-avviab01-qualita-premi",
   "label": "Quality",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "chi-dettagli-a-avviab01",
   "label": "Details 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "dest-a-avviab01",
   "label": "Where",
   "value": "local",
   "options": [
    {
     "value": "local",
     "label": "On this computer"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "ctx-a-avviab01",
   "label": "Context",
   "value": "fresh",
   "options": [
    {
     "value": "fresh",
     "label": "New session, brief only"
    },
    {
     "value": "fork",
     "label": "Fork of this conversation"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "wt-a-avviab01",
   "label": "Folder",
   "value": "si",
   "options": [
    {
     "value": "si",
     "label": "Own worktree"
    },
    {
     "value": "no",
     "label": "Shared folder"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "perm-a-avviab01",
   "label": "Permissions",
   "value": "eredita",
   "options": [
    {
     "value": "eredita",
     "label": "Same as this session"
    },
    {
     "value": "default",
     "label": "Ask every time"
    },
    {
     "value": "acceptEdits",
     "label": "Accept edits"
    },
    {
     "value": "plan",
     "label": "Plan"
    },
    {
     "value": "auto",
     "label": "Auto"
    },
    {
     "value": "bypassPermissions",
     "label": "Bypass permissions"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "sv-a-avviab01",
   "label": "Wake-up",
   "value": "no",
   "options": [
    {
     "value": "no",
     "label": "Default: the app wakes me at the end of the turn"
    },
    {
     "value": "si",
     "label": "Even if the brief does not reach the session"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "ramo-a-avviab01",
   "label": "Branch",
   "value": "",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "base-a-avviab01",
   "label": "Starts from",
   "value": "",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "piano-a-avviab01",
   "label": "Plan",
   "value": "",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "tit-a-avviab01",
   "label": "Title",
   "value": "Search filter for long lists, with server-side paging and a result count in the header",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "brief-a-avviab01",
   "label": "Brief",
   "value": "Add the filter to the sample list.",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "qui-a-blocca01",
   "label": "Do it here 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "perche-a-blocca01",
   "label": "Why 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-blocca01",
   "label": "Details 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-blocca01",
   "label": "Select 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-blocca01",
   "label": "↑ 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-blocca01",
   "label": "↓ 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-blocca01",
   "label": "Discard 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "annulla-a-coda0001",
   "label": "Remove from queue 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-coda0001",
   "label": "Details 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-coda0001",
   "label": "Select 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-coda0001",
   "label": "↑ 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-coda0001",
   "label": "↓ 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-coda0001",
   "label": "Discard 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vedi-a-conseg01",
   "label": "Open 5 · Delivered sample legend",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fatta-a-conseg01",
   "label": "Mark done 5 · Delivered sample legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-conseg01",
   "label": "Details 5 · Delivered sample legend",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:terminal:carico": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:terminal:impostazioni-connessioni": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fornitore-claude-premi",
   "label": "Claude",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fornitore-codex-premi",
   "label": "Codex",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fornitore-deepseek-premi",
   "label": "DeepSeek",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fornitore-freellmapi-premi",
   "label": "FreeLLMAPI",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "collega-claude",
   "label": "Connect Claude…",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "collega-codex",
   "label": "Connect Codex…",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:terminal:impostazioni-soglie": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "aggiungi-budget",
   "label": "Add budget…",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:terminal:impostazioni-bilanciamento": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "profilo-automatico-premi",
   "label": "Automatic",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "profilo-risparmio-premi",
   "label": "Saving",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "profilo-qualita-premi",
   "label": "Quality",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "profilo-velocita-premi",
   "label": "Speed",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "profilo-personalizzato-premi",
   "label": "Custom",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "regola-a-mano",
   "label": "Adjust by hand…",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:terminal:impostazioni-progetto": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "rete-abilitati-premi",
   "label": "Providers enabled",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "rete-locale-premi",
   "label": "Local network only",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "milestone-github-premi",
   "label": "Read GitHub milestones",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:terminal:impostazioni-board": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "board-spenta-premi",
   "label": "Off",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "board-accesa-premi",
   "label": "On",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "board-riassunti-premi",
   "label": "With summaries",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:terminal:impostazioni-avanzate": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "free-livello-niente-premi",
   "label": "Nothing",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "free-livello-R1-premi",
   "label": "Only R0–R1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "free-livello-R2-premi",
   "label": "R2 too",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "free-endpoint",
   "label": "FreeLLMAPI endpoint (loopback)",
   "value": "http://localhost:3001/v1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "installa-0",
   "label": "Prepare Docker image…",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "installa-1",
   "label": "Start container…",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:terminal:impostazioni-esecuzione": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "ese-ricontrolla",
   "label": "Check again",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "ese-guida",
   "label": "Set up Execution",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "ese-chiave-vai",
   "label": "Enter the key",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "ese-budget",
   "label": "Monthly budget (USD)",
   "value": "20",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "ese-tetto",
   "label": "Cap per run (USD)",
   "value": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "ese-api-togli",
   "label": "Remove API Claude",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "consigliere-spento-premi",
   "label": "Off",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "consigliere-suggerisci-premi",
   "label": "Suggest",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "consigliere-applica-premi",
   "label": "Apply to chips with no destination",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:terminal:impostazioni-lingua": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-en-premi",
   "label": "English",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-it-premi",
   "label": "Italiano",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-es-premi",
   "label": "Español",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-fr-premi",
   "label": "Français",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-de-premi",
   "label": "Deutsch",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-pt-premi",
   "label": "Português (Brasil)",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:terminal:impostazioni-legenda": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:vscode:lavoro": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "riprova-a-fallit01",
   "label": "▶ Retry 4 · Failed sample export",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "chiedi-a-fallit01",
   "label": "Ask this session 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-fallit01",
   "label": "Details 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-fallit01",
   "label": "Select 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-fallit01",
   "label": "↑ 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-fallit01",
   "label": "↓ 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-fallit01",
   "label": "Discard 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "prossima",
   "label": "Start next: Search filter for long lists, w…",
   "hotkey": "n",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "tutte",
   "label": "Start all · 2",
   "hotkey": "a",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "avvia-a-avviab01",
   "label": "▶ Start 1 · Search filter for long …",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "qui-a-avviab01",
   "label": "Do it here 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-avviab01",
   "label": "Details 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-avviab01",
   "label": "Select 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-avviab01",
   "label": "↑ 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-avviab01",
   "label": "↓ 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-avviab01",
   "label": "Discard 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "qui-a-blocca01",
   "label": "Do it here 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "perche-a-blocca01",
   "label": "Why 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-blocca01",
   "label": "Details 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-blocca01",
   "label": "Select 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-blocca01",
   "label": "↑ 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-blocca01",
   "label": "↓ 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-blocca01",
   "label": "Discard 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "annulla-a-coda0001",
   "label": "Remove from queue 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-coda0001",
   "label": "Details 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-coda0001",
   "label": "Select 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-coda0001",
   "label": "↑ 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-coda0001",
   "label": "↓ 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-coda0001",
   "label": "Discard 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vedi-a-conseg01",
   "label": "Open 5 · Delivered sample legend",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fatta-a-conseg01",
   "label": "Mark done 5 · Delivered sample legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-conseg01",
   "label": "Details 5 · Delivered sample legend",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:vscode:lavoro-dettagli": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "riprova-a-fallit01",
   "label": "▶ Retry 4 · Failed sample export",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "chiedi-a-fallit01",
   "label": "Ask this session 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-fallit01",
   "label": "Details 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-fallit01",
   "label": "Select 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-fallit01",
   "label": "↑ 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-fallit01",
   "label": "↓ 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-fallit01",
   "label": "Discard 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "prossima",
   "label": "Start next: Search filter for long lists, w…",
   "hotkey": "n",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "tutte",
   "label": "Start all · 2",
   "hotkey": "a",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "apri-a-avviab01",
   "label": "Close the details of Search filter for long lists, with server-side paging and a result count in the header",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "avvia-a-avviab01",
   "label": "▶ Start 1 · Search filter for long …",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "qui-a-avviab01",
   "label": "Do it here 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-avviab01",
   "label": "Close 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-avviab01",
   "label": "Select 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-avviab01",
   "label": "↑ 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-avviab01",
   "label": "↓ 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-avviab01",
   "label": "Discard 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "preset-a-avviab01-consigliato-premi",
   "label": "Recommended",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "preset-a-avviab01-economico-premi",
   "label": "Thrifty",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "preset-a-avviab01-qualita-premi",
   "label": "Quality",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "chi-dettagli-a-avviab01",
   "label": "Details 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "dest-a-avviab01",
   "label": "Where",
   "value": "local",
   "options": [
    {
     "value": "local",
     "label": "On this computer"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "ctx-a-avviab01",
   "label": "Context",
   "value": "fresh",
   "options": [
    {
     "value": "fresh",
     "label": "New session, brief only"
    },
    {
     "value": "fork",
     "label": "Fork of this conversation"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "wt-a-avviab01",
   "label": "Folder",
   "value": "si",
   "options": [
    {
     "value": "si",
     "label": "Own worktree"
    },
    {
     "value": "no",
     "label": "Shared folder"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "perm-a-avviab01",
   "label": "Permissions",
   "value": "eredita",
   "options": [
    {
     "value": "eredita",
     "label": "Same as this session"
    },
    {
     "value": "default",
     "label": "Ask every time"
    },
    {
     "value": "acceptEdits",
     "label": "Accept edits"
    },
    {
     "value": "plan",
     "label": "Plan"
    },
    {
     "value": "auto",
     "label": "Auto"
    },
    {
     "value": "bypassPermissions",
     "label": "Bypass permissions"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "sv-a-avviab01",
   "label": "Wake-up",
   "value": "no",
   "options": [
    {
     "value": "no",
     "label": "Default: the app wakes me at the end of the turn"
    },
    {
     "value": "si",
     "label": "Even if the brief does not reach the session"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "ramo-a-avviab01",
   "label": "Branch",
   "value": "",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "base-a-avviab01",
   "label": "Starts from",
   "value": "",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "piano-a-avviab01",
   "label": "Plan",
   "value": "",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "tit-a-avviab01",
   "label": "Title",
   "value": "Search filter for long lists, with server-side paging and a result count in the header",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "brief-a-avviab01",
   "label": "Brief",
   "value": "Add the filter to the sample list.",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "qui-a-blocca01",
   "label": "Do it here 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "perche-a-blocca01",
   "label": "Why 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-blocca01",
   "label": "Details 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-blocca01",
   "label": "Select 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-blocca01",
   "label": "↑ 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-blocca01",
   "label": "↓ 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-blocca01",
   "label": "Discard 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "annulla-a-coda0001",
   "label": "Remove from queue 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-coda0001",
   "label": "Details 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-coda0001",
   "label": "Select 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-coda0001",
   "label": "↑ 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-coda0001",
   "label": "↓ 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-coda0001",
   "label": "Discard 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vedi-a-conseg01",
   "label": "Open 5 · Delivered sample legend",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fatta-a-conseg01",
   "label": "Mark done 5 · Delivered sample legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-conseg01",
   "label": "Details 5 · Delivered sample legend",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:vscode:carico": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:vscode:impostazioni-connessioni": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fornitore-claude-premi",
   "label": "Claude",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fornitore-codex-premi",
   "label": "Codex",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fornitore-deepseek-premi",
   "label": "DeepSeek",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fornitore-freellmapi-premi",
   "label": "FreeLLMAPI",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "collega-claude",
   "label": "Connect Claude…",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "collega-codex",
   "label": "Connect Codex…",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:vscode:impostazioni-soglie": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "aggiungi-budget",
   "label": "Add budget…",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:vscode:impostazioni-bilanciamento": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "profilo-automatico-premi",
   "label": "Automatic",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "profilo-risparmio-premi",
   "label": "Saving",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "profilo-qualita-premi",
   "label": "Quality",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "profilo-velocita-premi",
   "label": "Speed",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "profilo-personalizzato-premi",
   "label": "Custom",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "regola-a-mano",
   "label": "Adjust by hand…",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:vscode:impostazioni-progetto": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "rete-abilitati-premi",
   "label": "Providers enabled",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "rete-locale-premi",
   "label": "Local network only",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "milestone-github-premi",
   "label": "Read GitHub milestones",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:vscode:impostazioni-board": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "board-spenta-premi",
   "label": "Off",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "board-accesa-premi",
   "label": "On",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "board-riassunti-premi",
   "label": "With summaries",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:vscode:impostazioni-avanzate": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "free-livello-niente-premi",
   "label": "Nothing",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "free-livello-R1-premi",
   "label": "Only R0–R1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "free-livello-R2-premi",
   "label": "R2 too",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "free-endpoint",
   "label": "FreeLLMAPI endpoint (loopback)",
   "value": "http://localhost:3001/v1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "installa-0",
   "label": "Prepare Docker image…",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "installa-1",
   "label": "Start container…",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:vscode:impostazioni-esecuzione": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "ese-ricontrolla",
   "label": "Check again",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "ese-guida",
   "label": "Set up Execution",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "ese-chiave-vai",
   "label": "Enter the key",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "ese-budget",
   "label": "Monthly budget (USD)",
   "value": "20",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "ese-tetto",
   "label": "Cap per run (USD)",
   "value": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "ese-api-togli",
   "label": "Remove API Claude",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "consigliere-spento-premi",
   "label": "Off",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "consigliere-suggerisci-premi",
   "label": "Suggest",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "consigliere-applica-premi",
   "label": "Apply to chips with no destination",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:vscode:impostazioni-lingua": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-en-premi",
   "label": "English",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-it-premi",
   "label": "Italiano",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-es-premi",
   "label": "Español",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-fr-premi",
   "label": "Français",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-de-premi",
   "label": "Deutsch",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-pt-premi",
   "label": "Português (Brasil)",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:vscode:impostazioni-legenda": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:mobile:lavoro": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "riprova-a-fallit01",
   "label": "▶ Retry 4 · Failed sample export",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "chiedi-a-fallit01",
   "label": "Ask this session 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-fallit01",
   "label": "Details 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-fallit01",
   "label": "Select 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-fallit01",
   "label": "↑ 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-fallit01",
   "label": "↓ 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-fallit01",
   "label": "Discard 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "prossima",
   "label": "Start next: Search filter for long lists, w…",
   "hotkey": "n",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "tutte",
   "label": "Start all · 2",
   "hotkey": "a",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "avvia-a-avviab01",
   "label": "▶ Start 1 · Search filter for long …",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "qui-a-avviab01",
   "label": "Do it here 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-avviab01",
   "label": "Details 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-avviab01",
   "label": "Select 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-avviab01",
   "label": "↑ 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-avviab01",
   "label": "↓ 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-avviab01",
   "label": "Discard 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "qui-a-blocca01",
   "label": "Do it here 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "perche-a-blocca01",
   "label": "Why 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-blocca01",
   "label": "Details 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-blocca01",
   "label": "Select 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-blocca01",
   "label": "↑ 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-blocca01",
   "label": "↓ 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-blocca01",
   "label": "Discard 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "annulla-a-coda0001",
   "label": "Remove from queue 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-coda0001",
   "label": "Details 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-coda0001",
   "label": "Select 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-coda0001",
   "label": "↑ 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-coda0001",
   "label": "↓ 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-coda0001",
   "label": "Discard 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vedi-a-conseg01",
   "label": "Open 5 · Delivered sample legend",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fatta-a-conseg01",
   "label": "Mark done 5 · Delivered sample legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-conseg01",
   "label": "Details 5 · Delivered sample legend",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:mobile:lavoro-dettagli": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "riprova-a-fallit01",
   "label": "▶ Retry 4 · Failed sample export",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "chiedi-a-fallit01",
   "label": "Ask this session 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-fallit01",
   "label": "Details 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-fallit01",
   "label": "Select 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-fallit01",
   "label": "↑ 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-fallit01",
   "label": "↓ 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-fallit01",
   "label": "Discard 4 · Failed sample export",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "prossima",
   "label": "Start next: Search filter for long lists, w…",
   "hotkey": "n",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "tutte",
   "label": "Start all · 2",
   "hotkey": "a",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "apri-a-avviab01",
   "label": "Close the details of Search filter for long lists, with server-side paging and a result count in the header",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "avvia-a-avviab01",
   "label": "▶ Start 1 · Search filter for long …",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "qui-a-avviab01",
   "label": "Do it here 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-avviab01",
   "label": "Close 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-avviab01",
   "label": "Select 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-avviab01",
   "label": "↑ 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-avviab01",
   "label": "↓ 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-avviab01",
   "label": "Discard 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "preset-a-avviab01-consigliato-premi",
   "label": "Recommended",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "preset-a-avviab01-economico-premi",
   "label": "Thrifty",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "preset-a-avviab01-qualita-premi",
   "label": "Quality",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "chi-dettagli-a-avviab01",
   "label": "Details 1 · Search filter for long …",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "dest-a-avviab01",
   "label": "Where",
   "value": "local",
   "options": [
    {
     "value": "local",
     "label": "On this computer"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "ctx-a-avviab01",
   "label": "Context",
   "value": "fresh",
   "options": [
    {
     "value": "fresh",
     "label": "New session, brief only"
    },
    {
     "value": "fork",
     "label": "Fork of this conversation"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "wt-a-avviab01",
   "label": "Folder",
   "value": "si",
   "options": [
    {
     "value": "si",
     "label": "Own worktree"
    },
    {
     "value": "no",
     "label": "Shared folder"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "perm-a-avviab01",
   "label": "Permissions",
   "value": "eredita",
   "options": [
    {
     "value": "eredita",
     "label": "Same as this session"
    },
    {
     "value": "default",
     "label": "Ask every time"
    },
    {
     "value": "acceptEdits",
     "label": "Accept edits"
    },
    {
     "value": "plan",
     "label": "Plan"
    },
    {
     "value": "auto",
     "label": "Auto"
    },
    {
     "value": "bypassPermissions",
     "label": "Bypass permissions"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "sv-a-avviab01",
   "label": "Wake-up",
   "value": "no",
   "options": [
    {
     "value": "no",
     "label": "Default: the app wakes me at the end of the turn"
    },
    {
     "value": "si",
     "label": "Even if the brief does not reach the session"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "ramo-a-avviab01",
   "label": "Branch",
   "value": "",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "base-a-avviab01",
   "label": "Starts from",
   "value": "",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "piano-a-avviab01",
   "label": "Plan",
   "value": "",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "tit-a-avviab01",
   "label": "Title",
   "value": "Search filter for long lists, with server-side paging and a result count in the header",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "brief-a-avviab01",
   "label": "Brief",
   "value": "Add the filter to the sample list.",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "qui-a-blocca01",
   "label": "Do it here 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "perche-a-blocca01",
   "label": "Why 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-blocca01",
   "label": "Details 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-blocca01",
   "label": "Select 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-blocca01",
   "label": "↑ 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-blocca01",
   "label": "↓ 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-blocca01",
   "label": "Discard 2 · Draft from another conv…",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "annulla-a-coda0001",
   "label": "Remove from queue 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-coda0001",
   "label": "Details 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sel-a-coda0001",
   "label": "Select 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "su-a-coda0001",
   "label": "↑ 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "giu-a-coda0001",
   "label": "↓ 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "scarta-a-coda0001",
   "label": "Discard 3 · Queued sample guide",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vedi-a-conseg01",
   "label": "Open 5 · Delivered sample legend",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fatta-a-conseg01",
   "label": "Mark done 5 · Delivered sample legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-conseg01",
   "label": "Details 5 · Delivered sample legend",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:mobile:carico": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:mobile:impostazioni-connessioni": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fornitore-claude-premi",
   "label": "Claude",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fornitore-codex-premi",
   "label": "Codex",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fornitore-deepseek-premi",
   "label": "DeepSeek",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fornitore-freellmapi-premi",
   "label": "FreeLLMAPI",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "collega-claude",
   "label": "Connect Claude…",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "collega-codex",
   "label": "Connect Codex…",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:mobile:impostazioni-soglie": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "aggiungi-budget",
   "label": "Add budget…",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:mobile:impostazioni-bilanciamento": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "profilo-automatico-premi",
   "label": "Automatic",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "profilo-risparmio-premi",
   "label": "Saving",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "profilo-qualita-premi",
   "label": "Quality",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "profilo-velocita-premi",
   "label": "Speed",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "profilo-personalizzato-premi",
   "label": "Custom",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "regola-a-mano",
   "label": "Adjust by hand…",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:mobile:impostazioni-progetto": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "rete-abilitati-premi",
   "label": "Providers enabled",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "rete-locale-premi",
   "label": "Local network only",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "milestone-github-premi",
   "label": "Read GitHub milestones",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:mobile:impostazioni-board": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "board-spenta-premi",
   "label": "Off",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "board-accesa-premi",
   "label": "On",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "board-riassunti-premi",
   "label": "With summaries",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:mobile:impostazioni-avanzate": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "free-livello-niente-premi",
   "label": "Nothing",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "free-livello-R1-premi",
   "label": "Only R0–R1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "free-livello-R2-premi",
   "label": "R2 too",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "free-endpoint",
   "label": "FreeLLMAPI endpoint (loopback)",
   "value": "http://localhost:3001/v1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "installa-0",
   "label": "Prepare Docker image…",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "installa-1",
   "label": "Start container…",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:mobile:impostazioni-esecuzione": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "ese-ricontrolla",
   "label": "Check again",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "ese-guida",
   "label": "Set up Execution",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "ese-chiave-vai",
   "label": "Enter the key",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "ese-budget",
   "label": "Monthly budget (USD)",
   "value": "20",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Input",
   "chiave": "ese-tetto",
   "label": "Cap per run (USD)",
   "value": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "ese-api-togli",
   "label": "Remove API Claude",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "consigliere-spento-premi",
   "label": "Off",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "consigliere-suggerisci-premi",
   "label": "Suggest",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "consigliere-applica-premi",
   "label": "Apply to chips with no destination",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:mobile:impostazioni-lingua": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-en-premi",
   "label": "English",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-it-premi",
   "label": "Italiano",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-es-premi",
   "label": "Español",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-fr-premi",
   "label": "Français",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-de-premi",
   "label": "Deutsch",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "lingua-pt-premi",
   "label": "Português (Brasil)",
   "gestori": [
    "press"
   ]
  }
 ],
 "controlli:mobile:impostazioni-legenda": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Refresh · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Work",
   "hotkey": "1",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Load",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Settings",
   "hotkey": "3",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-connessioni-premi",
   "label": "Connections",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-soglie-premi",
   "label": "Thresholds",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-lingua-premi",
   "label": "Language",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-esecuzione-premi",
   "label": "Execution",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-bilanciamento-premi",
   "label": "Balancing",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-progetto-premi",
   "label": "Project",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-board-premi",
   "label": "Board",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-avanzate-premi",
   "label": "Advanced",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "sezione-legenda-premi",
   "label": "Legend",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  }
 ],
 "effetti:desktop:dove": {
  "helper": [
   [
    "cas",
    "X:/orch/azioni/a-dove0001.json",
    "0",
    {
     "id": "a-dove0001",
     "versione": 1,
     "titolo": "Sample move between destinations",
     "brief": "Sample brief.",
     "ordine": 6,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "proposta",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "destinazione": "api-claude"
    }
   ]
  ],
  "app": [],
  "scritti": [
   [
    "X:/orch/azioni/a-dove0001.json",
    {
     "id": "a-dove0001",
     "versione": 1,
     "titolo": "Sample move between destinations",
     "brief": "Sample brief.",
     "ordine": 6,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "proposta",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "destinazione": "api-claude"
    }
   ]
  ]
 },
 "effetti:desktop:avvia": {
  "helper": [
   [
    "prenota",
    "X:/orch/azioni",
    {
     "elenco": [
      "a-avviab01.json",
      "a-blocca01.json",
      "a-coda0001.json",
      "a-fallit01.json",
      "a-conseg01.json",
      "a-dove0001.json"
     ],
     "attese": {
      "a-avviab01.json": 0,
      "a-blocca01.json": 0,
      "a-coda0001.json": 0,
      "a-fallit01.json": 0,
      "a-conseg01.json": 0,
      "a-dove0001.json": 1
     },
     "scrivi": {
      "a-avviab01.json": {
       "id": "a-avviab01",
       "versione": 1,
       "titolo": "Search filter for long lists, with server-side paging and a result count in the header",
       "brief": "Add the filter to the sample list.",
       "ordine": 1,
       "dipende": [],
       "esecutore": "claude",
       "revisore": "codex",
       "modello": "claude-opus-5-5",
       "stato": "in-avvio",
       "creata": "ISTANTE",
       "aggiornata": "ISTANTE",
       "repo": "acme/progetto",
       "issue": 123,
       "tentativo": "X",
       "tentatoIl": "ISTANTE",
       "avvioScade": "ISTANTE",
       "incerto": false,
       "lanciataDa": "sessione-master"
      }
     }
    }
   ],
   [
    "cas",
    "X:/orch/azioni/a-avviab01.json",
    "1",
    {
     "id": "a-avviab01",
     "versione": 2,
     "titolo": "Search filter for long lists, with server-side paging and a result count in the header",
     "brief": "Add the filter to the sample list.",
     "ordine": 1,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "avviata",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "issue": 123,
     "tentativo": "X",
     "tentatoIl": "ISTANTE",
     "avvioScade": "ISTANTE",
     "incerto": false,
     "lanciataDa": "sessione-master",
     "avviataIl": "ISTANTE",
     "sessione": "local_12345678-1234-1234-1234-123456789abc"
    }
   ]
  ],
  "app": [
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session",
    "tool": "start_session",
    "args": {
     "initiation": "user_asked",
     "context": "fresh",
     "title": "Search filter for long lists, with server-side paging and a",
     "prompt": "Add the filter to the sample list.\n\n**Review: Codex.** Before reporting, have Codex review the branch diff read-only, ALWAYS through the machine lane (one Codex run at a time, reviews go first): `node \"PLUGIN/strumenti/disco.cjs\" corsia-codex --revisione -- codex exec -c model_reasoning_effort=\"xhigh\" -s read-only -C <worktree> -` with the review request on stdin. Address or justify every finding in the report.\n\n_Suggested action `a-avviab01`, attempt `az-TENTATIVO`._ When the work is delivered (branch pushed, report to the coordinator), if you have the `mcp__chip-manager__aggiorna_azione` tool, call it with id \"a-avviab01\", stato \"consegnata\" and tentativo \"az-TENTATIVO\". The merge decides the closing. When the review has an outcome, report it with the same tool: id, tentativo and `revisione` ({ esito: \"in-corso\" | \"approvata\" | \"da-correggere\", nota }).",
     "name": "az-TENTATIVO",
     "background": "Follow the project instructions (CLAUDE.md or AGENTS.md): work in your worktree, push the branch and report to whoever proposed the action; do not merge into main.",
     "model": "claude-opus-5-5",
     "effort": "high",
     "use_worktree": true
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "local_12345678-1234-1234-1234-123456789abc"
    }
   }
  ],
  "scritti": [
   [
    "X:/orch/azioni/a-avviab01.json",
    {
     "id": "a-avviab01",
     "versione": 2,
     "titolo": "Search filter for long lists, with server-side paging and a result count in the header",
     "brief": "Add the filter to the sample list.",
     "ordine": 1,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "avviata",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "issue": 123,
     "tentativo": "X",
     "tentatoIl": "ISTANTE",
     "avvioScade": "ISTANTE",
     "incerto": false,
     "lanciataDa": "sessione-master",
     "avviataIl": "ISTANTE",
     "sessione": "local_12345678-1234-1234-1234-123456789abc"
    }
   ]
  ]
 },
 "effetti:desktop:scarta": {
  "helper": [
   [
    "cas",
    "X:/orch/azioni/a-blocca01.json",
    "0",
    {
     "id": "a-blocca01",
     "versione": 1,
     "titolo": "Draft from another conversation",
     "brief": "Sample brief.",
     "ordine": 2,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "scartata",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "contesto": "fork",
     "origineFork": "altra-sessione",
     "origineNome": "Other",
     "statoPrima": "proposta"
    }
   ]
  ],
  "app": [],
  "scritti": [
   [
    "X:/orch/azioni/a-blocca01.json",
    {
     "id": "a-blocca01",
     "versione": 1,
     "titolo": "Draft from another conversation",
     "brief": "Sample brief.",
     "ordine": 2,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "scartata",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "contesto": "fork",
     "origineFork": "altra-sessione",
     "origineNome": "Other",
     "statoPrima": "proposta"
    }
   ]
  ]
 },
 "effetti:desktop:applica": {
  "helper": [
   [
    "configura",
    "X:/casa/.claude/chipmanager/config.json",
    {
     "atteso": "{\"lingua\":\"en\",\"account\":{\"apiClaude\":{\"budgetUsd\":20,\"tetto\":2}},\"progetti\":{\"acme/progetto\":{}}}",
     "repo": "acme/progetto",
     "campi": {
      "profilo": "risparmio",
      "pesi": [
       {
        "tipo": "fornitore",
        "nome": "codex",
        "percentuale": 40,
        "assoluto": 0
       },
       {
        "tipo": "effort",
        "nome": "low",
        "percentuale": 40,
        "assoluto": 0
       },
       {
        "tipo": "effort",
        "nome": "high",
        "percentuale": -40,
        "assoluto": 0
       },
       {
        "tipo": "effort",
        "nome": "xhigh",
        "percentuale": -90,
        "assoluto": 0
       }
      ]
     }
    }
   ]
  ],
  "app": [
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   }
  ],
  "scritti": [
   [
    "X:/casa/.claude/chipmanager/config.json",
    {
     "lingua": "en",
     "account": {
      "apiClaude": {
       "budgetUsd": 20,
       "tetto": 2
      }
     },
     "progetti": {
      "acme/progetto": {
       "profilo": "risparmio",
       "pesi": [
        {
         "tipo": "fornitore",
         "nome": "codex",
         "percentuale": 40,
         "assoluto": 0
        },
        {
         "tipo": "effort",
         "nome": "low",
         "percentuale": 40,
         "assoluto": 0
        },
        {
         "tipo": "effort",
         "nome": "high",
         "percentuale": -40,
         "assoluto": 0
        },
        {
         "tipo": "effort",
         "nome": "xhigh",
         "percentuale": -90,
         "assoluto": 0
        }
       ]
      }
     }
    }
   ]
  ]
 },
 "effetti:terminal:dove": {
  "helper": [
   [
    "cas",
    "X:/orch/azioni/a-dove0001.json",
    "0",
    {
     "id": "a-dove0001",
     "versione": 1,
     "titolo": "Sample move between destinations",
     "brief": "Sample brief.",
     "ordine": 6,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "proposta",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "destinazione": "api-claude"
    }
   ]
  ],
  "app": [],
  "scritti": [
   [
    "X:/orch/azioni/a-dove0001.json",
    {
     "id": "a-dove0001",
     "versione": 1,
     "titolo": "Sample move between destinations",
     "brief": "Sample brief.",
     "ordine": 6,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "proposta",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "destinazione": "api-claude"
    }
   ]
  ]
 },
 "effetti:terminal:avvia": {
  "helper": [
   [
    "prenota",
    "X:/orch/azioni",
    {
     "elenco": [
      "a-avviab01.json",
      "a-blocca01.json",
      "a-coda0001.json",
      "a-fallit01.json",
      "a-conseg01.json",
      "a-dove0001.json"
     ],
     "attese": {
      "a-avviab01.json": 0,
      "a-blocca01.json": 0,
      "a-coda0001.json": 0,
      "a-fallit01.json": 0,
      "a-conseg01.json": 0,
      "a-dove0001.json": 1
     },
     "scrivi": {
      "a-avviab01.json": {
       "id": "a-avviab01",
       "versione": 1,
       "titolo": "Search filter for long lists, with server-side paging and a result count in the header",
       "brief": "Add the filter to the sample list.",
       "ordine": 1,
       "dipende": [],
       "esecutore": "claude",
       "revisore": "codex",
       "modello": "claude-opus-5-5",
       "stato": "in-avvio",
       "creata": "ISTANTE",
       "aggiornata": "ISTANTE",
       "repo": "acme/progetto",
       "issue": 123,
       "tentativo": "X",
       "tentatoIl": "ISTANTE",
       "avvioScade": "ISTANTE",
       "incerto": false,
       "lanciataDa": "sessione-master"
      }
     }
    }
   ],
   [
    "cas",
    "X:/orch/azioni/a-avviab01.json",
    "1",
    {
     "id": "a-avviab01",
     "versione": 2,
     "titolo": "Search filter for long lists, with server-side paging and a result count in the header",
     "brief": "Add the filter to the sample list.",
     "ordine": 1,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "avviata",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "issue": 123,
     "tentativo": "X",
     "tentatoIl": "ISTANTE",
     "avvioScade": "ISTANTE",
     "incerto": false,
     "lanciataDa": "sessione-master",
     "avviataIl": "ISTANTE",
     "sessione": "local_12345678-1234-1234-1234-123456789abc"
    }
   ]
  ],
  "app": [
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session",
    "tool": "start_session",
    "args": {
     "initiation": "user_asked",
     "context": "fresh",
     "title": "Search filter for long lists, with server-side paging and a",
     "prompt": "Add the filter to the sample list.\n\n**Review: Codex.** Before reporting, have Codex review the branch diff read-only, ALWAYS through the machine lane (one Codex run at a time, reviews go first): `node \"PLUGIN/strumenti/disco.cjs\" corsia-codex --revisione -- codex exec -c model_reasoning_effort=\"xhigh\" -s read-only -C <worktree> -` with the review request on stdin. Address or justify every finding in the report.\n\n_Suggested action `a-avviab01`, attempt `az-TENTATIVO`._ When the work is delivered (branch pushed, report to the coordinator), if you have the `mcp__chip-manager__aggiorna_azione` tool, call it with id \"a-avviab01\", stato \"consegnata\" and tentativo \"az-TENTATIVO\". The merge decides the closing. When the review has an outcome, report it with the same tool: id, tentativo and `revisione` ({ esito: \"in-corso\" | \"approvata\" | \"da-correggere\", nota }).",
     "name": "az-TENTATIVO",
     "background": "Follow the project instructions (CLAUDE.md or AGENTS.md): work in your worktree, push the branch and report to whoever proposed the action; do not merge into main.",
     "model": "claude-opus-5-5",
     "effort": "high",
     "use_worktree": true
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "local_12345678-1234-1234-1234-123456789abc"
    }
   }
  ],
  "scritti": [
   [
    "X:/orch/azioni/a-avviab01.json",
    {
     "id": "a-avviab01",
     "versione": 2,
     "titolo": "Search filter for long lists, with server-side paging and a result count in the header",
     "brief": "Add the filter to the sample list.",
     "ordine": 1,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "avviata",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "issue": 123,
     "tentativo": "X",
     "tentatoIl": "ISTANTE",
     "avvioScade": "ISTANTE",
     "incerto": false,
     "lanciataDa": "sessione-master",
     "avviataIl": "ISTANTE",
     "sessione": "local_12345678-1234-1234-1234-123456789abc"
    }
   ]
  ]
 },
 "effetti:terminal:scarta": {
  "helper": [
   [
    "cas",
    "X:/orch/azioni/a-blocca01.json",
    "0",
    {
     "id": "a-blocca01",
     "versione": 1,
     "titolo": "Draft from another conversation",
     "brief": "Sample brief.",
     "ordine": 2,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "scartata",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "contesto": "fork",
     "origineFork": "altra-sessione",
     "origineNome": "Other",
     "statoPrima": "proposta"
    }
   ]
  ],
  "app": [],
  "scritti": [
   [
    "X:/orch/azioni/a-blocca01.json",
    {
     "id": "a-blocca01",
     "versione": 1,
     "titolo": "Draft from another conversation",
     "brief": "Sample brief.",
     "ordine": 2,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "scartata",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "contesto": "fork",
     "origineFork": "altra-sessione",
     "origineNome": "Other",
     "statoPrima": "proposta"
    }
   ]
  ]
 },
 "effetti:terminal:applica": {
  "helper": [
   [
    "configura",
    "X:/casa/.claude/chipmanager/config.json",
    {
     "atteso": "{\"lingua\":\"en\",\"account\":{\"apiClaude\":{\"budgetUsd\":20,\"tetto\":2}},\"progetti\":{\"acme/progetto\":{}}}",
     "repo": "acme/progetto",
     "campi": {
      "profilo": "risparmio",
      "pesi": [
       {
        "tipo": "fornitore",
        "nome": "codex",
        "percentuale": 40,
        "assoluto": 0
       },
       {
        "tipo": "effort",
        "nome": "low",
        "percentuale": 40,
        "assoluto": 0
       },
       {
        "tipo": "effort",
        "nome": "high",
        "percentuale": -40,
        "assoluto": 0
       },
       {
        "tipo": "effort",
        "nome": "xhigh",
        "percentuale": -90,
        "assoluto": 0
       }
      ]
     }
    }
   ]
  ],
  "app": [
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   }
  ],
  "scritti": [
   [
    "X:/casa/.claude/chipmanager/config.json",
    {
     "lingua": "en",
     "account": {
      "apiClaude": {
       "budgetUsd": 20,
       "tetto": 2
      }
     },
     "progetti": {
      "acme/progetto": {
       "profilo": "risparmio",
       "pesi": [
        {
         "tipo": "fornitore",
         "nome": "codex",
         "percentuale": 40,
         "assoluto": 0
        },
        {
         "tipo": "effort",
         "nome": "low",
         "percentuale": 40,
         "assoluto": 0
        },
        {
         "tipo": "effort",
         "nome": "high",
         "percentuale": -40,
         "assoluto": 0
        },
        {
         "tipo": "effort",
         "nome": "xhigh",
         "percentuale": -90,
         "assoluto": 0
        }
       ]
      }
     }
    }
   ]
  ]
 },
 "effetti:vscode:dove": {
  "helper": [
   [
    "cas",
    "X:/orch/azioni/a-dove0001.json",
    "0",
    {
     "id": "a-dove0001",
     "versione": 1,
     "titolo": "Sample move between destinations",
     "brief": "Sample brief.",
     "ordine": 6,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "proposta",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "destinazione": "api-claude"
    }
   ]
  ],
  "app": [],
  "scritti": [
   [
    "X:/orch/azioni/a-dove0001.json",
    {
     "id": "a-dove0001",
     "versione": 1,
     "titolo": "Sample move between destinations",
     "brief": "Sample brief.",
     "ordine": 6,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "proposta",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "destinazione": "api-claude"
    }
   ]
  ]
 },
 "effetti:vscode:avvia": {
  "helper": [
   [
    "prenota",
    "X:/orch/azioni",
    {
     "elenco": [
      "a-avviab01.json",
      "a-blocca01.json",
      "a-coda0001.json",
      "a-fallit01.json",
      "a-conseg01.json",
      "a-dove0001.json"
     ],
     "attese": {
      "a-avviab01.json": 0,
      "a-blocca01.json": 0,
      "a-coda0001.json": 0,
      "a-fallit01.json": 0,
      "a-conseg01.json": 0,
      "a-dove0001.json": 1
     },
     "scrivi": {
      "a-avviab01.json": {
       "id": "a-avviab01",
       "versione": 1,
       "titolo": "Search filter for long lists, with server-side paging and a result count in the header",
       "brief": "Add the filter to the sample list.",
       "ordine": 1,
       "dipende": [],
       "esecutore": "claude",
       "revisore": "codex",
       "modello": "claude-opus-5-5",
       "stato": "in-avvio",
       "creata": "ISTANTE",
       "aggiornata": "ISTANTE",
       "repo": "acme/progetto",
       "issue": 123,
       "tentativo": "X",
       "tentatoIl": "ISTANTE",
       "avvioScade": "ISTANTE",
       "incerto": false,
       "lanciataDa": "sessione-master"
      }
     }
    }
   ],
   [
    "cas",
    "X:/orch/azioni/a-avviab01.json",
    "1",
    {
     "id": "a-avviab01",
     "versione": 2,
     "titolo": "Search filter for long lists, with server-side paging and a result count in the header",
     "brief": "Add the filter to the sample list.",
     "ordine": 1,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "avviata",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "issue": 123,
     "tentativo": "X",
     "tentatoIl": "ISTANTE",
     "avvioScade": "ISTANTE",
     "incerto": false,
     "lanciataDa": "sessione-master",
     "avviataIl": "ISTANTE",
     "sessione": "local_12345678-1234-1234-1234-123456789abc"
    }
   ]
  ],
  "app": [
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session",
    "tool": "start_session",
    "args": {
     "initiation": "user_asked",
     "context": "fresh",
     "title": "Search filter for long lists, with server-side paging and a",
     "prompt": "Add the filter to the sample list.\n\n**Review: Codex.** Before reporting, have Codex review the branch diff read-only, ALWAYS through the machine lane (one Codex run at a time, reviews go first): `node \"PLUGIN/strumenti/disco.cjs\" corsia-codex --revisione -- codex exec -c model_reasoning_effort=\"xhigh\" -s read-only -C <worktree> -` with the review request on stdin. Address or justify every finding in the report.\n\n_Suggested action `a-avviab01`, attempt `az-TENTATIVO`._ When the work is delivered (branch pushed, report to the coordinator), if you have the `mcp__chip-manager__aggiorna_azione` tool, call it with id \"a-avviab01\", stato \"consegnata\" and tentativo \"az-TENTATIVO\". The merge decides the closing. When the review has an outcome, report it with the same tool: id, tentativo and `revisione` ({ esito: \"in-corso\" | \"approvata\" | \"da-correggere\", nota }).",
     "name": "az-TENTATIVO",
     "background": "Follow the project instructions (CLAUDE.md or AGENTS.md): work in your worktree, push the branch and report to whoever proposed the action; do not merge into main.",
     "model": "claude-opus-5-5",
     "effort": "high",
     "use_worktree": true
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "local_12345678-1234-1234-1234-123456789abc"
    }
   }
  ],
  "scritti": [
   [
    "X:/orch/azioni/a-avviab01.json",
    {
     "id": "a-avviab01",
     "versione": 2,
     "titolo": "Search filter for long lists, with server-side paging and a result count in the header",
     "brief": "Add the filter to the sample list.",
     "ordine": 1,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "avviata",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "issue": 123,
     "tentativo": "X",
     "tentatoIl": "ISTANTE",
     "avvioScade": "ISTANTE",
     "incerto": false,
     "lanciataDa": "sessione-master",
     "avviataIl": "ISTANTE",
     "sessione": "local_12345678-1234-1234-1234-123456789abc"
    }
   ]
  ]
 },
 "effetti:vscode:scarta": {
  "helper": [
   [
    "cas",
    "X:/orch/azioni/a-blocca01.json",
    "0",
    {
     "id": "a-blocca01",
     "versione": 1,
     "titolo": "Draft from another conversation",
     "brief": "Sample brief.",
     "ordine": 2,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "scartata",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "contesto": "fork",
     "origineFork": "altra-sessione",
     "origineNome": "Other",
     "statoPrima": "proposta"
    }
   ]
  ],
  "app": [],
  "scritti": [
   [
    "X:/orch/azioni/a-blocca01.json",
    {
     "id": "a-blocca01",
     "versione": 1,
     "titolo": "Draft from another conversation",
     "brief": "Sample brief.",
     "ordine": 2,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "scartata",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "contesto": "fork",
     "origineFork": "altra-sessione",
     "origineNome": "Other",
     "statoPrima": "proposta"
    }
   ]
  ]
 },
 "effetti:vscode:applica": {
  "helper": [
   [
    "configura",
    "X:/casa/.claude/chipmanager/config.json",
    {
     "atteso": "{\"lingua\":\"en\",\"account\":{\"apiClaude\":{\"budgetUsd\":20,\"tetto\":2}},\"progetti\":{\"acme/progetto\":{}}}",
     "repo": "acme/progetto",
     "campi": {
      "profilo": "risparmio",
      "pesi": [
       {
        "tipo": "fornitore",
        "nome": "codex",
        "percentuale": 40,
        "assoluto": 0
       },
       {
        "tipo": "effort",
        "nome": "low",
        "percentuale": 40,
        "assoluto": 0
       },
       {
        "tipo": "effort",
        "nome": "high",
        "percentuale": -40,
        "assoluto": 0
       },
       {
        "tipo": "effort",
        "nome": "xhigh",
        "percentuale": -90,
        "assoluto": 0
       }
      ]
     }
    }
   ]
  ],
  "app": [
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   }
  ],
  "scritti": [
   [
    "X:/casa/.claude/chipmanager/config.json",
    {
     "lingua": "en",
     "account": {
      "apiClaude": {
       "budgetUsd": 20,
       "tetto": 2
      }
     },
     "progetti": {
      "acme/progetto": {
       "profilo": "risparmio",
       "pesi": [
        {
         "tipo": "fornitore",
         "nome": "codex",
         "percentuale": 40,
         "assoluto": 0
        },
        {
         "tipo": "effort",
         "nome": "low",
         "percentuale": 40,
         "assoluto": 0
        },
        {
         "tipo": "effort",
         "nome": "high",
         "percentuale": -40,
         "assoluto": 0
        },
        {
         "tipo": "effort",
         "nome": "xhigh",
         "percentuale": -90,
         "assoluto": 0
        }
       ]
      }
     }
    }
   ]
  ]
 },
 "effetti:mobile:dove": {
  "helper": [
   [
    "cas",
    "X:/orch/azioni/a-dove0001.json",
    "0",
    {
     "id": "a-dove0001",
     "versione": 1,
     "titolo": "Sample move between destinations",
     "brief": "Sample brief.",
     "ordine": 6,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "proposta",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "destinazione": "api-claude"
    }
   ]
  ],
  "app": [],
  "scritti": [
   [
    "X:/orch/azioni/a-dove0001.json",
    {
     "id": "a-dove0001",
     "versione": 1,
     "titolo": "Sample move between destinations",
     "brief": "Sample brief.",
     "ordine": 6,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "proposta",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "destinazione": "api-claude"
    }
   ]
  ]
 },
 "effetti:mobile:avvia": {
  "helper": [
   [
    "prenota",
    "X:/orch/azioni",
    {
     "elenco": [
      "a-avviab01.json",
      "a-blocca01.json",
      "a-coda0001.json",
      "a-fallit01.json",
      "a-conseg01.json",
      "a-dove0001.json"
     ],
     "attese": {
      "a-avviab01.json": 0,
      "a-blocca01.json": 0,
      "a-coda0001.json": 0,
      "a-fallit01.json": 0,
      "a-conseg01.json": 0,
      "a-dove0001.json": 1
     },
     "scrivi": {
      "a-avviab01.json": {
       "id": "a-avviab01",
       "versione": 1,
       "titolo": "Search filter for long lists, with server-side paging and a result count in the header",
       "brief": "Add the filter to the sample list.",
       "ordine": 1,
       "dipende": [],
       "esecutore": "claude",
       "revisore": "codex",
       "modello": "claude-opus-5-5",
       "stato": "in-avvio",
       "creata": "ISTANTE",
       "aggiornata": "ISTANTE",
       "repo": "acme/progetto",
       "issue": 123,
       "tentativo": "X",
       "tentatoIl": "ISTANTE",
       "avvioScade": "ISTANTE",
       "incerto": false,
       "lanciataDa": "sessione-master"
      }
     }
    }
   ],
   [
    "cas",
    "X:/orch/azioni/a-avviab01.json",
    "1",
    {
     "id": "a-avviab01",
     "versione": 2,
     "titolo": "Search filter for long lists, with server-side paging and a result count in the header",
     "brief": "Add the filter to the sample list.",
     "ordine": 1,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "avviata",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "issue": 123,
     "tentativo": "X",
     "tentatoIl": "ISTANTE",
     "avvioScade": "ISTANTE",
     "incerto": false,
     "lanciataDa": "sessione-master",
     "avviataIl": "ISTANTE",
     "sessione": "local_12345678-1234-1234-1234-123456789abc"
    }
   ]
  ],
  "app": [
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session",
    "tool": "start_session",
    "args": {
     "initiation": "user_asked",
     "context": "fresh",
     "title": "Search filter for long lists, with server-side paging and a",
     "prompt": "Add the filter to the sample list.\n\n**Review: Codex.** Before reporting, have Codex review the branch diff read-only, ALWAYS through the machine lane (one Codex run at a time, reviews go first): `node \"PLUGIN/strumenti/disco.cjs\" corsia-codex --revisione -- codex exec -c model_reasoning_effort=\"xhigh\" -s read-only -C <worktree> -` with the review request on stdin. Address or justify every finding in the report.\n\n_Suggested action `a-avviab01`, attempt `az-TENTATIVO`._ When the work is delivered (branch pushed, report to the coordinator), if you have the `mcp__chip-manager__aggiorna_azione` tool, call it with id \"a-avviab01\", stato \"consegnata\" and tentativo \"az-TENTATIVO\". The merge decides the closing. When the review has an outcome, report it with the same tool: id, tentativo and `revisione` ({ esito: \"in-corso\" | \"approvata\" | \"da-correggere\", nota }).",
     "name": "az-TENTATIVO",
     "background": "Follow the project instructions (CLAUDE.md or AGENTS.md): work in your worktree, push the branch and report to whoever proposed the action; do not merge into main.",
     "model": "claude-opus-5-5",
     "effort": "high",
     "use_worktree": true
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "local_12345678-1234-1234-1234-123456789abc"
    }
   }
  ],
  "scritti": [
   [
    "X:/orch/azioni/a-avviab01.json",
    {
     "id": "a-avviab01",
     "versione": 2,
     "titolo": "Search filter for long lists, with server-side paging and a result count in the header",
     "brief": "Add the filter to the sample list.",
     "ordine": 1,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "avviata",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "issue": 123,
     "tentativo": "X",
     "tentatoIl": "ISTANTE",
     "avvioScade": "ISTANTE",
     "incerto": false,
     "lanciataDa": "sessione-master",
     "avviataIl": "ISTANTE",
     "sessione": "local_12345678-1234-1234-1234-123456789abc"
    }
   ]
  ]
 },
 "effetti:mobile:scarta": {
  "helper": [
   [
    "cas",
    "X:/orch/azioni/a-blocca01.json",
    "0",
    {
     "id": "a-blocca01",
     "versione": 1,
     "titolo": "Draft from another conversation",
     "brief": "Sample brief.",
     "ordine": 2,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "scartata",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "contesto": "fork",
     "origineFork": "altra-sessione",
     "origineNome": "Other",
     "statoPrima": "proposta"
    }
   ]
  ],
  "app": [],
  "scritti": [
   [
    "X:/orch/azioni/a-blocca01.json",
    {
     "id": "a-blocca01",
     "versione": 1,
     "titolo": "Draft from another conversation",
     "brief": "Sample brief.",
     "ordine": 2,
     "dipende": [],
     "esecutore": "claude",
     "revisore": "codex",
     "modello": "claude-opus-5-5",
     "stato": "scartata",
     "creata": "ISTANTE",
     "aggiornata": "ISTANTE",
     "repo": "acme/progetto",
     "contesto": "fork",
     "origineFork": "altra-sessione",
     "origineNome": "Other",
     "statoPrima": "proposta"
    }
   ]
  ]
 },
 "effetti:mobile:applica": {
  "helper": [
   [
    "configura",
    "X:/casa/.claude/chipmanager/config.json",
    {
     "atteso": "{\"lingua\":\"en\",\"account\":{\"apiClaude\":{\"budgetUsd\":20,\"tetto\":2}},\"progetti\":{\"acme/progetto\":{}}}",
     "repo": "acme/progetto",
     "campi": {
      "profilo": "risparmio",
      "pesi": [
       {
        "tipo": "fornitore",
        "nome": "codex",
        "percentuale": 40,
        "assoluto": 0
       },
       {
        "tipo": "effort",
        "nome": "low",
        "percentuale": 40,
        "assoluto": 0
       },
       {
        "tipo": "effort",
        "nome": "high",
        "percentuale": -40,
        "assoluto": 0
       },
       {
        "tipo": "effort",
        "nome": "xhigh",
        "percentuale": -90,
        "assoluto": 0
       }
      ]
     }
    }
   ]
  ],
  "app": [
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   }
  ],
  "scritti": [
   [
    "X:/casa/.claude/chipmanager/config.json",
    {
     "lingua": "en",
     "account": {
      "apiClaude": {
       "budgetUsd": 20,
       "tetto": 2
      }
     },
     "progetti": {
      "acme/progetto": {
       "profilo": "risparmio",
       "pesi": [
        {
         "tipo": "fornitore",
         "nome": "codex",
         "percentuale": 40,
         "assoluto": 0
        },
        {
         "tipo": "effort",
         "nome": "low",
         "percentuale": 40,
         "assoluto": 0
        },
        {
         "tipo": "effort",
         "nome": "high",
         "percentuale": -40,
         "assoluto": 0
        },
        {
         "tipo": "effort",
         "nome": "xhigh",
         "percentuale": -90,
         "assoluto": 0
        }
       ]
      }
     }
    }
   ]
  ]
 },
 "controlli:mobile:sessione-al-lavoro": [
  {
   "tipo": "Button",
   "chiave": "ricarica",
   "label": "Aggiorna · HH:MM",
   "hotkey": "r",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-lavoro",
   "label": "Lavoro",
   "hotkey": "1",
   "variant": "primary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vista-carico",
   "label": "Carico",
   "hotkey": "2",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "impostazioni",
   "label": "Impostazioni",
   "hotkey": "3",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "cambia-mod-a-cmbf9001",
   "label": "Cambia modello",
   "value": "claude-opus-5-5",
   "options": [
    {
     "value": "claude-opus-5-5",
     "label": "Opus 5.5"
    },
    {
     "value": "claude-sonnet-5-5",
     "label": "Sonnet 5.5"
    },
    {
     "value": "claude-haiku-5-5",
     "label": "Haiku 5.5"
    },
    {
     "value": "claude-fable-5-1",
     "label": "Fable 5.1"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Select",
   "chiave": "cambia-eff-a-cmbf9001",
   "label": "Cambia effort",
   "value": "high",
   "options": [
    {
     "value": "low",
     "label": "▰▱▱▱  low"
    },
    {
     "value": "medium",
     "label": "▰▰▱▱  medium"
    },
    {
     "value": "high",
     "label": "▰▰▰▱  high"
    },
    {
     "value": "xhigh",
     "label": "▰▰▰▰  xhigh"
    }
   ],
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vedi-a-cmbf9001",
   "label": "Apri 1 · T a-cmbf9001",
   "variant": "secondary",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "fatta-a-cmbf9001",
   "label": "Segna completata 1 · T a-cmbf9001",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "mod-a-cmbf9001",
   "label": "Dettagli 1 · T a-cmbf9001",
   "gestori": [
    "press"
   ]
  },
  {
   "tipo": "Button",
   "chiave": "vedi-a-cmbf9001",
   "label": "Apri la sessione di T a-cmbf9001",
   "gestori": [
    "press"
   ]
  }
 ],
 "effetti:mobile:cambia": {
  "app": [
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "set_session_model",
    "args": {
     "session_id": "local_12345678-1234-1234-1234-123456789abc",
     "model": "claude-sonnet-5-5"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "local_12345678-1234-1234-1234-123456789abc"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "self"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "set_session_effort",
    "args": {
     "session_id": "local_12345678-1234-1234-1234-123456789abc",
     "effort": "xhigh"
    }
   },
   {
    "server": "ccd_session_mgmt",
    "tool": "get_session",
    "args": {
     "session_id": "local_12345678-1234-1234-1234-123456789abc"
    }
   }
  ],
  "record": {
   "id": "a-cmbf9001",
   "versione": 0,
   "titolo": "T a-cmbf9001",
   "brief": "Fai X.",
   "ordine": 1,
   "dipende": [],
   "esecutore": "claude",
   "revisore": "nessuno",
   "stato": "avviata",
   "creata": "ISTANTE",
   "aggiornata": "ISTANTE",
   "repo": "acme/progetto",
   "sessione": "local_12345678-1234-1234-1234-123456789abc",
   "tentativo": "X",
   "lanciataDa": "sessione-master",
   "avviataIl": "ISTANTE",
   "modello": "claude-sonnet-5-5",
   "effort": "xhigh",
   "cambio": {
    "campo": "effort",
    "valore": "xhigh",
    "esito": "fatto",
    "quando": "ISTANTE"
   }
  }
 }
}
