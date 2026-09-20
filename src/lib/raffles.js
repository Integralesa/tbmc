import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'

/** Escucha en tiempo real el registro del último sorteo mensual corrido. */
export function subscribeToLatestRaffle(callback) {
  const q = query(collection(db, 'raffles'), orderBy('ranAt', 'desc'), limit(1))
  return onSnapshot(q, (snap) => {
    callback(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() })
  })
}
