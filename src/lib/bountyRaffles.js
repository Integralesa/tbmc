import {
  collection,
  doc,
  getCountFromServer,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../firebase'
import { compressImage } from './image'

const COLLECTION = 'bountyRaffles'

/**
 * Modelo: bountyRaffles/{id} = {
 *   title, imageUrl, status: 'draft' | 'active' | 'closed',
 *   createdBy, createdAt, activatedAt, closedAt,
 *   winnerId, winnerName, totalEntries,
 * }
 * bountyRaffles/{id}/entries/{uid} = { points, userName } — puntos extra
 * por traer gente durante ESTE sorteo puntual. Solo las escriben las Cloud
 * Functions de referidos (ver functions/index.js) — el cliente no puede
 * tocarlos (ver firestore.rules).
 */

/** Crea el sorteo en borrador (invisible hasta que se active) y sube la foto. Solo Susurro. */
export async function createBountyDraft({ title, imageFile, user }) {
  if (!user) throw new Error('Tenés que iniciar sesión.')
  if (!title?.trim()) throw new Error('Poné un título para la carta.')
  if (!imageFile) throw new Error('Subí una foto de la carta.')

  const docRef = doc(collection(db, COLLECTION))
  await setDoc(docRef, {
    title: title.trim(),
    imageUrl: null,
    status: 'draft',
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  })

  const compressed = await compressImage(imageFile)
  const path = `bountyRaffles/${docRef.id}/foto_${Date.now()}.jpg`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' })
  const imageUrl = await getDownloadURL(storageRef)

  await setDoc(docRef, { imageUrl }, { merge: true })
  return docRef.id
}

/** Publica el sorteo en el home y arranca a contar puntos de referidos. Solo Susurro. */
export async function activateBountyRaffle(raffleId) {
  await setDoc(doc(db, COLLECTION, raffleId), { status: 'active', activatedAt: serverTimestamp() }, { merge: true })
}

/** Escucha en tiempo real el sorteo bounty activo ahora mismo (para el home). Devuelve null si no hay ninguno. */
export function subscribeToActiveBountyRaffle(callback) {
  const q = query(collection(db, COLLECTION), where('status', '==', 'active'))
  return onSnapshot(q, (snap) => {
    callback(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() })
  })
}

/** Escucha en tiempo real todos los sorteos bounty (para /admin), más nuevo primero. */
export function subscribeToAllBountyRaffles(callback) {
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

/**
 * Cuántas personas distintas pujaron alguna vez en el sitio — referencia
 * para saber si ya se llegó a las ~40 personas antes de activar un
 * sorteo (no es un bloqueo automático, Susurro decide cuándo activar).
 */
export async function getDistinctBidderCount() {
  const q = query(collection(db, 'users'), where('hasBid', '==', true))
  const snap = await getCountFromServer(q)
  return snap.data().count
}

/**
 * Sortea un ganador entre todos los usuarios registrados: 1 entrada base
 * cada uno, más las que haya sumado por traer gente durante este sorteo
 * (bountyRaffles/{id}/entries). El sorteo corre del lado del cliente
 * porque quien lo dispara ya está protegido por firestore.rules (solo
 * Susurro) — no hace falta una Cloud Function aparte para el azar en sí.
 */
export async function drawBountyWinner(raffleId) {
  const [usersSnap, entriesSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, COLLECTION, raffleId, 'entries')),
  ])

  const bonusPoints = {}
  entriesSnap.docs.forEach((d) => {
    bonusPoints[d.id] = d.data().points || 0
  })

  const pool = []
  usersSnap.docs.forEach((d) => {
    const weight = 1 + (bonusPoints[d.id] || 0)
    for (let i = 0; i < weight; i++) pool.push({ uid: d.id, name: d.data().displayName || 'Sin nombre' })
  })

  if (pool.length === 0) throw new Error('No hay usuarios registrados para sortear.')

  const winner = pool[Math.floor(Math.random() * pool.length)]

  await setDoc(
    doc(db, COLLECTION, raffleId),
    {
      status: 'closed',
      closedAt: serverTimestamp(),
      winnerId: winner.uid,
      winnerName: winner.name,
      totalEntries: pool.length,
    },
    { merge: true },
  )

  return winner
}
