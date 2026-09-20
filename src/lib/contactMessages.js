import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Envía el formulario de "Quiénes somos". No hay sistema de mail armado
 * (ver COMO-FUNCIONA.md) — el mensaje queda como bandeja para Susurro/
 * Arañas en /admin, mismo patrón que problemReports/planRequests.
 */
export async function sendContactMessage({ name, email, message }) {
  await addDoc(collection(db, 'contactMessages'), {
    name: name || null,
    email,
    message,
    status: 'open',
    createdAt: serverTimestamp(),
  })
}

/** Escucha en tiempo real los mensajes de contacto sin revisar (para /admin). */
export function subscribeToOpenContactMessages(callback) {
  const q = query(
    collection(db, 'contactMessages'),
    where('status', '==', 'open'),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

/** Marca un mensaje de contacto como revisado. */
export async function markContactMessageReviewed(messageId) {
  await setDoc(
    doc(db, 'contactMessages', messageId),
    { status: 'reviewed', reviewedAt: Timestamp.now() },
    { merge: true },
  )
}
