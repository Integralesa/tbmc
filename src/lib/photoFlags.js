import { collection, doc, onSnapshot, orderBy, query, setDoc, Timestamp, where } from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Escucha en tiempo real las fotos marcadas para revisión (para /admin).
 * Las crea únicamente la Cloud Function checkAuctionPhoto (Admin SDK) —
 * ver firestore.rules — cuando Cloud Vision detecta algo raro en una foto
 * recién subida (contenido inapropiado, o que parece la foto de una
 * persona en vez de un objeto).
 */
export function subscribeToOpenPhotoFlags(callback) {
  const q = query(
    collection(db, 'photoFlags'),
    where('status', '==', 'open'),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

/** Marca una foto como revisada, sin aplicar ninguna sanción. */
export async function markPhotoFlagReviewed(flagId) {
  await setDoc(
    doc(db, 'photoFlags', flagId),
    { status: 'reviewed', reviewedAt: Timestamp.now() },
    { merge: true },
  )
}
