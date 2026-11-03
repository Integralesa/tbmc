import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../firebase'
import { getPublicName, isUserBanned } from './users'
import { compressImage } from './image'
import { MAX_PRICE_DIGITS } from './auctions'

const MARKET = 'marketListings'
const MAX_PHOTOS = 6

// ---------- Modelo de datos ----------
// marketListings/{id}: {
//   game, price, description,
//   images: [urlFoto1, ..., urlFoto6],   // hasta 6 fotos (una carpeta puede
//                                        // ocupar varias páginas)
//   sellerId, sellerName, sellerPhoto,
//   sellerPhone, sellerEmail,   // guardados en el propio documento a
//                                // propósito: acá no hay handshake post-
//                                // cierre como en auctions, el contacto se
//                                // revela directo apenas alguien entra
//                                // (ver MarketListingDetail.jsx)
//   status: 'active' | 'sold',
//   createdAt,
// }
//
// A diferencia de auctions, NO hay bidding, ni endsAt, ni chequeo de fotos
// bloqueante — es un bazaar tipo grupo de compraventa: precio fijo, el
// interesado escribe por fuera. El vendedor marca "vendido" a mano cuando
// se lo vendió (ver markListingSold).

/** Sube hasta 6 fotos a Storage, comprimidas, y devuelve sus URLs. */
async function uploadListingImages(listingId, files) {
  const limited = files.slice(0, MAX_PHOTOS)
  const urls = []
  for (let i = 0; i < limited.length; i++) {
    const compressed = await compressImage(limited[i])
    const path = `market/${listingId}/foto_${i + 1}_${Date.now()}.jpg`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' })
    const url = await getDownloadURL(storageRef)
    urls.push(url)
  }
  return urls
}

/**
 * Publica un aviso de Mercado. imageFiles: array de hasta 6 objetos File.
 * A diferencia de createAuction, no hay límite diario de plan (es un
 * contador aparte, ver COMO-FUNCIONA.md) ni verificación de título contra
 * ninguna API — el precio es fijo y la descripción es texto libre.
 */
export async function createListing({ game, price, description, imageFiles, user }) {
  if (!user) throw new Error('Tenés que iniciar sesión para publicar.')
  if (!imageFiles || imageFiles.length === 0) {
    throw new Error('Subí al menos 1 foto.')
  }
  if (imageFiles.length > MAX_PHOTOS) {
    throw new Error(`Máximo ${MAX_PHOTOS} fotos por publicación.`)
  }
  if (String(Math.trunc(Number(price) || 0)).length > MAX_PRICE_DIGITS) {
    throw new Error(`El precio es demasiado grande (máximo ${MAX_PRICE_DIGITS} dígitos).`)
  }

  const profileSnap = await getDoc(doc(db, 'users', user.uid))
  const profile = profileSnap.exists() ? profileSnap.data() : null
  if (isUserBanned(profile)) {
    throw new Error('Tu cuenta está suspendida y no podés publicar. Escribinos si creés que es un error.')
  }

  const docRef = await addDoc(collection(db, MARKET), {
    game: game || null,
    price: Number(price),
    description: (description || '').trim(),
    images: [],
    sellerId: user.uid,
    sellerName: getPublicName(profile, user),
    sellerPhoto: user.photoURL || null,
    sellerPhone: profile?.phone || null,
    sellerEmail: profile?.email || user.email || null,
    status: 'active',
    createdAt: serverTimestamp(),
  })

  const images = await uploadListingImages(docRef.id, imageFiles)
  await updateDoc(doc(db, MARKET, docRef.id), { images })

  return docRef.id
}

/** Publicaciones activas, más nuevas primero — para la grilla de /mercado. */
export function subscribeToMarketListings(callback) {
  const q = query(collection(db, MARKET), where('status', '==', 'active'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

/** Publicaciones propias (activas y vendidas) — para "Mis publicaciones" en /perfil. */
export function subscribeToUserListings(uid, callback) {
  const q = query(collection(db, MARKET), where('sellerId', '==', uid), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export function subscribeToListing(id, callback) {
  return onSnapshot(doc(db, MARKET, id), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  })
}

export async function markListingSold(listingId, user) {
  const snap = await getDoc(doc(db, MARKET, listingId))
  if (!snap.exists()) throw new Error('La publicación ya no existe.')
  if (snap.data().sellerId !== user.uid) throw new Error('Esta publicación no es tuya.')
  await updateDoc(doc(db, MARKET, listingId), { status: 'sold' })
}

export async function reactivateListing(listingId, user) {
  const snap = await getDoc(doc(db, MARKET, listingId))
  if (!snap.exists()) throw new Error('La publicación ya no existe.')
  if (snap.data().sellerId !== user.uid) throw new Error('Esta publicación no es tuya.')
  await updateDoc(doc(db, MARKET, listingId), { status: 'active' })
}

export async function deleteListing(listingId, user) {
  const snap = await getDoc(doc(db, MARKET, listingId))
  if (!snap.exists()) return
  if (snap.data().sellerId !== user.uid) throw new Error('Esta publicación no es tuya.')
  await deleteDoc(doc(db, MARKET, listingId))
}
