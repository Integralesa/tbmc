/**
 * Autocompletado de nombres de cartas Pokémon vía pokemontcg.io — API pública,
 * gratis, sin necesidad de API key (con el límite compartido: 1000 req/día,
 * 30/min). https://docs.pokemontcg.io/
 * Nota: esta API es notablemente menos estable que Scryfall (devuelve 500/502
 * de tanto en tanto incluso con queries válidas) — el llamador ya tolera el
 * fallo mostrando "sin coincidencias" o pidiendo reintentar.
 */

const BASE_URL = 'https://api.pokemontcg.io/v2/cards'

// Esta API tira 500/502 con bastante frecuencia incluso en queries válidas
// (confirmado a mano: varios intentos seguidos fallando antes de que ande).
// Un reintento corto alcanza para tapar la mayoría de esos baches.
async function fetchWithRetry(url, { retries = 2, delayMs = 500 } = {}) {
  let lastRes
  for (let attempt = 0; attempt <= retries; attempt++) {
    lastRes = await fetch(url)
    if (lastRes.ok) return lastRes
    if (attempt < retries) await new Promise((r) => setTimeout(r, delayMs))
  }
  return lastRes
}

// La sintaxis de búsqueda (tipo Lucene) no soporta "nombre de varias
// palabras" + wildcard en la misma query (tira 400), así que para
// autocompletar usamos wildcard solo sobre la última palabra escrita y
// filtramos los resultados a mano para que sean relevantes a lo que se
// tipeó completo.
export async function autocompleteCardName(query) {
  const trimmed = query?.trim()
  if (!trimmed || trimmed.length < 2) return []
  const lastWord = trimmed.split(/\s+/).pop()
  const url = new URL(BASE_URL)
  url.searchParams.set('q', `name:${lastWord}*`)
  url.searchParams.set('pageSize', '30')
  const res = await fetchWithRetry(url)
  if (!res.ok) throw new Error('No se pudo buscar en la API de Pokémon.')
  const data = await res.json()
  const q = trimmed.toLowerCase()
  const names = (data.data || [])
    .map((c) => c.name)
    .filter((name) => name.toLowerCase().includes(q))
  return [...new Set(names)].slice(0, 20)
}

/**
 * Confirma que exista una carta con ese nombre EXACTO (sin importar
 * mayúsculas). La API no tiene un endpoint de "match exacto" como
 * Scryfall, así que se busca por nombre entre comillas (frase exacta) y
 * se compara a mano contra lo devuelto.
 */
export async function verifyCardExists(name) {
  const trimmed = name?.trim()
  if (!trimmed) return false
  const url = new URL(BASE_URL)
  url.searchParams.set('q', `name:"${trimmed}"`)
  const res = await fetchWithRetry(url)
  if (!res.ok) return false
  const data = await res.json()
  return (data.data || []).some((c) => c.name.toLowerCase() === trimmed.toLowerCase())
}
