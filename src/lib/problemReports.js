import { collection, doc, onSnapshot, orderBy, query, setDoc, Timestamp, where } from 'firebase/firestore'
import { db } from '../firebase'

/** Escucha en tiempo real los reportes de problema sin revisar (para /admin). */
export function subscribeToOpenProblemReports(callback) {
  const q = query(
    collection(db, 'problemReports'),
    where('status', '==', 'open'),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

/** Marca un reporte como revisado, sin aplicar ninguna sanción. */
export async function markProblemReportReviewed(reportId) {
  await setDoc(
    doc(db, 'problemReports', reportId),
    { status: 'reviewed', reviewedAt: Timestamp.now() },
    { merge: true },
  )
}
