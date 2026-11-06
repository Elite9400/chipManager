// Lingue dell'interfaccia: completezza dei dizionari, segnaposto, plurali, date e numeri propri (niente Intl).
import { expect, test } from 'claude-code/testing'

import { data, DIZIONARI, formaPlurale, LINGUE, letto, linguaDa, msg, numero, ora, salvato, t, testo } from '../hooks/lingua'
import type { Chiave } from '../hooks/lingua'

const segnaposto = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',')
const forme = (v: unknown) => (typeof v === 'string' ? [v] : Object.values(v as Record<string, string>))

test('ogni chiave dell\'inglese esiste in ogni lingua, dello stesso tipo e con gli stessi segnaposto', () => {
  const chiavi = Object.keys(DIZIONARI.en) as Chiave[]
  for (const l of LINGUE) {
    expect(Object.keys(DIZIONARI[l]).sort()).toEqual([...chiavi].sort())
    for (const k of chiavi) {
      const fonte = DIZIONARI.en[k]!
      const v = DIZIONARI[l][k]
      if (v === undefined) continue
      expect(`${l}:${k}:${typeof v}`).toBe(`${l}:${k}:${typeof fonte}`)
      // Nei plurali la forma `one` può dire «una» invece di {n}: lì {n} è facoltativo, gli altri segnaposto no.
      const senzaN = (s: string) => (typeof fonte === 'string' ? segnaposto(s) : segnaposto(s.replace(/\{n\}/g, '')))
      const attesi = senzaN(forme(fonte).at(-1)!)
      for (const s of forme(v)) expect(`${l}:${k}:${senzaN(s)}:${s.trim().length > 0}`).toBe(`${l}:${k}:${attesi}:true`)
    }
  }
})

test('plurali: 0, 1, 2 e 5 in ogni lingua; francese e portoghese (Brasile) contano lo zero come uno', () => {
  const atteso = { en: 'other one other other', it: 'other one other other', es: 'other one other other', de: 'other one other other', fr: 'one one other other', pt: 'one one other other' }
  for (const l of LINGUE) expect(`${l}: ${[0, 1, 2, 5].map(n => formaPlurale(l, n)).join(' ')}`).toBe(`${l}: ${atteso[l]}`)
})

test('lingua: solo i codici ammessi; assente, sconosciuta o di un altro tipo = inglese', () => {
  expect(linguaDa('de')).toBe('de')
  for (const v of [undefined, null, '', 'EN', 'it-IT', 'zh', 3, {}]) expect(linguaDa(v)).toBe('en')
})

test('t: segnaposto per nome, ripiego sull\'inglese, chiave sconosciuta restituita com\'è', () => {
  expect(t('it', 'data.formato', { giorno: 4, mese: 'nov', ora: '14:30' })).toBe('4 nov, 14:30')
  expect(t('it', 'nessuna.chiave' as Chiave)).toBe('nessuna.chiave')
  expect(testo('de', 'frase di un record vecchio')).toBe('frase di un record vecchio')
  expect(testo('it', { k: 'data.formato', p: { giorno: 1, mese: 'gen', ora: '09:05' } })).toBe('1 gen, 09:05')
})

test('messaggi salvati: frase inglese più codice; un record vecchio con la sola frase si mostra com\'è', () => {
  const m = msg('coda.paralleli', { n: 2 })
  const campi = salvato('motivoCoda', 'motivo', m)
  expect(campi).toEqual({ motivoCoda: 'limit of 2 parallel sessions', motivoCodice: 'coda.paralleli', motivoParametri: { n: 2 } })
  expect(testo('it', letto(campi.motivoCodice, campi.motivoParametri, campi.motivoCoda))).toBe('limite di 2 sessioni in parallelo')
  expect(testo('it', letto(undefined, undefined, 'corsia Codex occupata'))).toBe('corsia Codex occupata')
  // Un codice che questa versione non conosce: la frase salvata.
  expect(testo('it', letto('codice.futuro', {}, 'a later sentence'))).toBe('a later sentence')
  expect(salvato('errore', 'errore', undefined)).toEqual({ errore: undefined, erroreCodice: undefined, erroreParametri: undefined })
  // Parametri annidati: ogni messaggio nella lingua della frase.
  expect(t('it', 'err.nonParte', { motivi: [msg('v.r4Bypass'), 'testo esterno'] })).toBe('Non parte: corsia sensibile (R4): niente bypass dei permessi; testo esterno')
})

test('date e ore senza Intl: mese dal dizionario, 12 ore solo in inglese, fuso locale', () => {
  const d = new Date(2026, 10, 4, 14, 30)
  expect(data('en', d)).toBe('Nov 4, 2:30 pm')
  expect(data('it', d)).toBe('4 nov, 14:30')
  expect(data('es', d)).toBe('4 nov, 14:30')
  expect(data('fr', d)).toBe('4 nov., 14:30')
  expect(data('de', d)).toBe('4. Nov., 14:30')
  expect(data('pt', d)).toBe('4 de nov., 14:30')
  expect(ora('en', new Date(2026, 0, 1, 0, 5))).toBe('12:05 am')
  expect(ora('en', new Date(2026, 0, 1, 12, 0))).toBe('12:00 pm')
  expect(ora('it', new Date(2026, 0, 1, 9, 5))).toBe('09:05')
  expect(data('it', 'non una data')).toBe('—')
})

test('numeri: separatore decimale della lingua, migliaia solo da 10.000', () => {
  expect(numero('en', 1234.5, 1)).toBe('1234.5')
  expect(numero('it', 1234.5, 1)).toBe('1234,5')
  expect(numero('en', 12345)).toBe('12,345')
  expect(numero('it', 1234567)).toBe('1.234.567')
  expect(numero('fr', 12345)).toBe('12 345')
  expect(numero('de', -12345.25, 2)).toBe('-12.345,25')
  expect(numero('pt', 9999)).toBe('9999')
})
