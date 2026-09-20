import { collection, doc, onSnapshot, orderBy, query, setDoc, Timestamp, where } from 'firebase/firestore'
import { db } from '../firebase'

/** Escucha en tiempo real las modificaciones de subastas sin revisar (para /admin). */
export function subscribeToOpenAuctionEdits(callback) {
  const q = query(
    collection(db, 'auctionEdits'),
    where('status', '==', 'open'),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

/** Marca una modificación como revisada por Susurro/Araña. */
export async function markAuctionEditReviewed(editId) {
  await setDoc(
    doc(db, 'auctionEdits', editId),
    { status: 'reviewed', reviewedAt: Timestamp.now() },
    { merge: true },
  )
}
