import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../firebase'
import { compressImage } from './image'

/**
 * Envía una solicitud de plan con comprobante de pago adjunto. Queda en
 * planRequests con status 'pending' hasta que el admin la revise desde
 * /admin (ahí la aprueba y se activa el plan, o la rechaza).
 */
export async function submitPlanRequest({ user, planKey, receiptFile }) {
  if (!user) throw new Error('Tenés que iniciar sesión primero.')
  if (!receiptFile) throw new Error('Subí una foto o captura del comprobante de pago.')

  const compressed = await compressImage(receiptFile, { maxDimension: 1400, quality: 0.85 })
  const path = `receipts/${user.uid}/${Date.now()}.jpg`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' })
  const receiptURL = await getDownloadURL(storageRef)

  await addDoc(collection(db, 'planRequests'), {
    userId: user.uid,
    userEmail: user.email || null,
    userName: user.displayName || null,
    planKey,
    receiptURL,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
}

/** Escucha en tiempo real las solicitudes pendientes de revisión (para /admin). */
export function subscribeToPendingPlanRequests(callback) {
  const q = query(
    collection(db, 'planRequests'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}
