// Il disco finto dei test: il config.json prende `lingua: 'it'` se non ne dice una, perché i test esistenti leggono
// frasi italiane. Un test che vuole il config com'è (per esempio «assente = inglese») mette `lingua = undefined`.
export class DiscoIt extends Map<string, string> {
  lingua: string | undefined = 'it'

  override set(k: string, v: string) {
    if (this.lingua && k.endsWith('chipmanager/config.json'))
      try {
        const c = JSON.parse(v) as unknown
        if (c && typeof c === 'object' && !Array.isArray(c) && !('lingua' in c)) v = JSON.stringify({ lingua: this.lingua, ...c })
      } catch {
        // un config rotto resta rotto
      }
    return super.set(k, v)
  }
}
