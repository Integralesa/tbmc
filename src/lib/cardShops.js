import { useEffect, useState } from 'react'
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Locales sugeridos por vendedores (al tildar "Otras tiendas" en
 * DeliveryFields) y aprobados por Susurro/Arañas en /admin. Los aprobados
 * quedan en `cardShops` y aparecen como checkbox más para todo el mundo,
 * sin necesidad de tocar código ni volver a desplegar — a diferencia de la
 * lista curada original (CARD_SHOPS en src/lib/locations.js), que sigue
 * siendo fija en el código.
 */

/** Escucha en tiempo real los locales ya aprobados (para el checkbox). */
export function subscribeToApprovedCardShops(callback) {
  const q = query(collection(db, 'cardShops'), orderBy('label', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ key: d.id, ...d.data() })))
  })
}

/**
 * Envía una sugerencia de local nuevo para que la revise Susurro/Arañas.
 * `province` es obligatoria (una de PROVINCIAS, ver src/lib/locations.js) —
 * es lo que permite despué filtrar el checkbox por provincia elegida.
 * `barrio` es un detalle libre opcional (ej: "Palermo", "Nueva Córdoba").
 */
export async function submitShopSuggestion({ name, province, barrio, user }) {
  if (!user) throw new Error('Tenés que iniciar sesión.')
  if (!name || !name.trim()) throw new Error('Escribí el nombre del local.')
  if (!province) throw new Error('Elegí la provincia del local.')
  await addDoc(collection(db, 'shopSuggestions'), {
    name: name.trim(),
    province,
    barrio: barrio?.trim() || null,
    reporterId: user.uid,
    reporterName: user.displayName || null,
    reporterEmail: user.email || null,
    status: 'open',
    createdAt: serverTimestamp(),
  })
}

/** Escucha en tiempo real las sugerencias pendientes (para /admin). */
export function subscribeToOpenShopSuggestions(callback) {
  const q = query(
    collection(db, 'shopSuggestions'),
    where('status', '==', 'open'),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

/** Aprueba una sugerencia: la agrega a `cardShops` (aparece ya mismo como checkbox, filtrado por su provincia) y cierra la sugerencia. */
export async function approveShopSuggestion(suggestion) {
  const label = suggestion.barrio ? `${suggestion.name} (${suggestion.barrio})` : suggestion.name
  await addDoc(collection(db, 'cardShops'), {
    label,
    // Sugerencias viejas (antes de sumar el selector de provincia) no
    // tienen este campo — se aprueban igual, solo quedan sin filtrar por
    // provincia (siempre visibles), en vez de romper la aprobación.
    province: suggestion.province || null,
    createdAt: serverTimestamp(),
  })
  await setDoc(doc(db, 'shopSuggestions', suggestion.id), { status: 'approved' }, { merge: true })
}

/** Rechaza una sugerencia sin agregar ningún local nuevo. */
export async function rejectShopSuggestion(suggestionId) {
  await setDoc(doc(db, 'shopSuggestions', suggestionId), { status: 'rejected' }, { merge: true })
}

/**
 * Mapa completo de key → label para mostrar los chips de tiendas (en el
 * preview de CreateAuction y en AuctionDetail) — combina la lista curada
 * fija (pasada en `staticLabels`) con los locales aprobados por sugerencia,
 * así una subasta con un local nuevo no muestra el ID de Firestore pelado.
 */
export function useCardShopLabels(staticLabels) {
  const [approvedLabels, setApprovedLabels] = useState({})
  useEffect(() => {
    const unsub = subscribeToApprovedCardShops((shops) => {
      setApprovedLabels(Object.fromEntries(shops.map((s) => [s.key, s.label])))
    })
    return unsub
  }, [])
  return { ...staticLabels, ...approvedLabels }
}
