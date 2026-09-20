/**
 * Autocompletado de nombres de cartas de Magic vía Scryfall — API pública,
 * gratis, sin necesidad de API key. https://scryfall.com/docs/api/cards/autocomplete
 * Devuelve hasta 20 nombres reales de cartas que empiezan o contienen lo
 * que se escribió. Si hay menos de 2 caracteres, Scryfall devuelve lista
 * vacía en vez de error.
 */
export async function autocompleteCardName(query) {
  if (!query || query.trim().length < 2) return []
  const res = await fetch(`https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error('No se pudo buscar en Scryfall.')
  const data = await res.json()
  return data.data || []
}

/**
 * Confirma que un nombre existe EXACTO en Scryfall (no parcial). Se usa
 * como última validación justo antes de publicar, además del bloqueo del
 * campo en la UI — así, aunque alguien intente forzar el campo por fuera
 * de la interfaz normal, igual no se puede publicar con un nombre inventado.
 */
export async function verifyCardExists(name) {
  if (!name) return false
  const res = await fetch(`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}`)
  return res.ok
}

let setListCache = null

// Tipos de set "normales" — se dejan afuera memorabilia/token/alchemy y
// otros tipos raros que no tiene sentido ofrecer para armar un lote.
const RELEVANT_SET_TYPES = new Set([
  'core',
  'expansion',
  'masters',
  'draft_innovation',
  'commander',
  'starter',
  'box',
  'duel_deck',
  'premium_deck',
  'from_the_vault',
  'archenemy',
  'planechase',
  'arsenal',
])

/**
 * Lista de sets de Magic (para armar un lote de varias cartas por set —
 * ver CreateAuction). Se pide una sola vez por sesión de la página
 * (cacheada en memoria) porque no cambia seguido y son ~500 sets.
 * https://scryfall.com/docs/api/sets
 */
export async function fetchSetList() {
  if (setListCache) return setListCache
  const res = await fetch('https://api.scryfall.com/sets')
  if (!res.ok) throw new Error('No se pudo cargar la lista de sets de Scryfall.')
  const data = await res.json()
  setListCache = (data.data || [])
    .filter((s) => !s.digital && RELEVANT_SET_TYPES.has(s.set_type))
    .sort((a, b) => (b.released_at || '').localeCompare(a.released_at || ''))
    .map((s) => ({ code: s.code, name: s.name }))
  return setListCache
}
