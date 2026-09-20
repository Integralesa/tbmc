import { collection, doc, onSnapshot, orderBy, query, setDoc, where } from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Escucha en tiempo real los avisos no leídos del usuario logueado (te
 * superaron la puja, cancelaron una subasta en la que pujaste, terminó tu
 * subasta, ganaste una subasta). Los crea únicamente la Cloud Function
 * notifyOnAuctionChange (Admin SDK) — ver functions/index.js — así que
 * llegan aunque no tengas el sitio abierto en el momento exacto.
 */
export function subscribeToUnreadNotifications(userId, callback) {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function markNotificationRead(notificationId) {
  await setDoc(doc(db, 'notifications', notificationId), { read: true }, { merge: true })
}

export async function markAllNotificationsRead(notifications) {
  await Promise.all(notifications.map((n) => markNotificationRead(n.id)))
}
