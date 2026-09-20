/**
 * Autocompletado de nombres de cartas de Yu-Gi-Oh! vía YGOPRODeck — API
 * pública, gratis, sin necesidad de API key (límite: 20 req/seg por IP).
 * https://ygoprodeck.com/api-guide/
 */

const BASE_URL = 'https://db.ygoprodeck.com/api/v7/cardinfo.php'

export async function autocompleteCardName(query) {
  const trimmed = query?.trim()
  if (!trimmed || trimmed.length < 2) return []
  const res = await fetch(`${BASE_URL}?fname=${encodeURIComponent(trimmed)}`)
  // La API devuelve 400 cuando no hay coincidencias — no es un error real.
  if (res.status === 400) return []
  if (!res.ok) throw new Error('No se pudo buscar en YGOPRODeck.')
  const data = await res.json()
  const names = (data.data || []).map((c) => c.name)
  return [...new Set(names)].slice(0, 20)
}

/**
 * Confirma que exista una carta con ese nombre EXACTO. `name=` en esta API
 * ya es de coincidencia exacta (a diferencia de `fname=`, que es parcial).
 */
export async function verifyCardExists(name) {
  const trimmed = name?.trim()
  if (!trimmed) return false
  const res = await fetch(`${BASE_URL}?name=${encodeURIComponent(trimmed)}`)
  return res.ok
}
