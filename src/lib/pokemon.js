/**
 * Autocompletado de nombres de cartas Pokémon vía pokemontcg.io — API pública,
 * gratis, sin necesidad de API key (con el límite compartido: 1000 req/día,
 * 30/min). https://docs.pokemontcg.io/
 * Nota: esta API es notablemente menos estable que Scryfall (devuelve 500/502
 * de tanto en tanto incluso con queries válidas) — el llamador ya tolera el
 * fallo mostrando "sin coincidencias" o pidiendo reintentar.
 */

import { db } from '../firebase'
import { doc, setDoc } from 'firebase/firestore'

const BASE_URL = 'https://api.pokemontcg.io/v2/cards'

// Mapeo de códigos Limitless → pokemontcg.io set IDs
// Crece automáticamente cuando se descubren nuevos sets
const INITIAL_SET_MAPPINGS = {
  'PBL': 'sv04.5',      // Paldea Evolved
  'TWM': 'sv04pt5',     // Twilight Masquerade
  'SCR': 'sv3.5',       // Stellar Crown
  'SVI': 'sv01',        // Scarlet & Violet
  'JTG': 'sv3',         // Journey Together
  'DRI': 'sv3pt5',      // Destined Rivals
  'SSP': 'sv4.5',       // Surging Sparks
  'BLK': 'bwp',         // Black & White Promos
  'ASC': 'sv4',         // Ascended Heroes
  // MEG, WHT, POR, MEE, TEF se descubrirán automáticamente
}

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

// Cache en memoria para evitar múltiples búsquedas del mismo set
let setMappingCache = { ...INITIAL_SET_MAPPINGS }

export async function getSetMapping(limitlessCode) {
  if (setMappingCache[limitlessCode]) {
    return setMappingCache[limitlessCode]
  }

  // Si no está en caché, devolver null para que se busque luego
  return null
}

export async function saveSetMapping(limitlessCode, pokemontcgId) {
  setMappingCache[limitlessCode] = pokemontcgId

  // Guardar en Firestore para persistencia
  try {
    await setDoc(doc(db, 'setMappings', limitlessCode), {
      limitlessCode,
      pokemontcgId,
      discoveredAt: new Date(),
    })
    console.log(`Set mapping saved: ${limitlessCode} → ${pokemontcgId}`)
  } catch (error) {
    console.log('Could not save mapping to Firestore:', error.message)
  }
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

export async function getCardImage(name, limitlessSetCode, cardNumber) {
  const trimmed = name?.trim()
  if (!trimmed) return null
  try {
    const url = new URL(BASE_URL)
    let query = `name:${trimmed}`

    // Si tenemos código de set de Limitless, intentar mapear a pokemontcg.io
    let pokemontcgSetId = null
    if (limitlessSetCode) {
      pokemontcgSetId = await getSetMapping(limitlessSetCode)
      if (pokemontcgSetId) {
        query += ` set.id:${pokemontcgSetId}`
      }
    }

    url.searchParams.set('q', query)
    url.searchParams.set('pageSize', '50')
    const res = await fetchWithRetry(url)
    if (!res.ok) {
      console.error('API error for:', trimmed, res.status)
      return null
    }
    const data = await res.json()
    const cards = data.data || []

    let card = null

    // Prioridad 1: nombre exacto + número de carta exacto
    if (cardNumber) {
      card = cards.find(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase() &&
               c.number === cardNumber
      )
    }

    // Prioridad 2: nombre exacto (cualquier versión del set)
    if (!card) {
      card = cards.find((c) => c.name.toLowerCase() === trimmed.toLowerCase())
    }

    // Prioridad 3: primer resultado
    if (!card && cards.length > 0) {
      card = cards[0]
    }

    // Si encontramos un set nuevo, guardarlo en el mapeo
    if (card && limitlessSetCode && !pokemontcgSetId) {
      await saveSetMapping(limitlessSetCode, card.set.id)
    }

    const image = card?.images?.small
    const foundCard = card?.name || 'not found'
    const setDisplay = card?.set?.id ? ` [${card.set.id}]` : ''
    console.log(`${trimmed}${cardNumber ? '#' + cardNumber : ''} → ${foundCard}${setDisplay} ${image ? '✓' : '✗'}`)
    return image || null
  } catch (error) {
    console.error('Error fetching image for', trimmed, error)
    return null
  }
}
