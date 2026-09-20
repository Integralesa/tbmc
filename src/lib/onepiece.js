/**
 * Autocompletado de nombres de cartas de One Piece TCG vía optcgapi.com —
 * API pública y gratis, sin API key. https://optcgapi.com/documentation
 * Es un proyecto de un fan corriendo en un VPS personal (no tan "oficial"
 * como Scryfall o YGOPRODeck), así que podría eventualmente cambiar o
 * caerse — el llamador ya tolera el fallo.
 */

const BASE_URL = 'https://optcgapi.com/api/sets/filtered/'

export async function autocompleteCardName(query) {
  const trimmed = query?.trim()
  if (!trimmed || trimmed.length < 2) return []
  const res = await fetch(`${BASE_URL}?card_name=${encodeURIComponent(trimmed)}`)
  // La API devuelve 404 cuando no hay coincidencias — no es un error real.
  if (res.status === 404) return []
  if (!res.ok) throw new Error('No se pudo buscar en la API de One Piece TCG.')
  const data = await res.json()
  const names = (data || []).map((c) => c.card_name)
  return [...new Set(names)].slice(0, 20)
}

/**
 * Confirma que exista una carta con ese nombre EXACTO (sin importar
 * mayúsculas). No hay endpoint de "match exacto", así que se busca por
 * nombre y se compara a mano contra lo devuelto.
 */
export async function verifyCardExists(name) {
  const trimmed = name?.trim()
  if (!trimmed) return false
  const res = await fetch(`${BASE_URL}?card_name=${encodeURIComponent(trimmed)}`)
  if (!res.ok) return false
  const data = await res.json()
  return (data || []).some((c) => c.card_name.toLowerCase() === trimmed.toLowerCase())
}
