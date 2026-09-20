import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Guarda (o actualiza) el perfil público mínimo del usuario logueado.
 * Se llama automáticamente cada vez que inicia sesión.
 * Solo el propio usuario puede leer/escribir su documento (ver firestore.rules).
 * Esto es lo que le permite a la Cloud Function de cierre de subastas
 * revelar el email correcto al vendedor y al ganador.
 *
 * `createdAt` se agrega una sola vez, la primera vez que se ve a este
 * usuario (por eso el getDoc previo) — si fuera parte del objeto de
 * siempre, `merge: true` lo pisaría en cada login y ya no serviría como
 * fecha de registro real. Las cuentas creadas antes de este cambio no
 * tienen `createdAt` (no hay forma de reconstruirlo retroactivamente).
 */
export async function upsertUserProfile(user) {
  if (!user) return
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  await setDoc(
    ref,
    {
      displayName: user.displayName || null,
      email: user.email || null,
      photoURL: user.photoURL || null,
      updatedAt: serverTimestamp(),
      ...(snap.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  )
}

/** Escucha en tiempo real el perfil propio (para mostrarlo/editarlo en /perfil). */
export function subscribeToOwnProfile(uid, callback) {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    callback(snap.exists() ? snap.data() : null)
  })
}

/**
 * Últimos usuarios registrados, más nuevo primero (para /admin). Solo
 * incluye cuentas creadas después de que se agregó `createdAt` — las
 * anteriores no tienen ese campo, así que `orderBy` las deja afuera solas
 * en vez de mostrar una fecha inventada.
 */
export async function getRecentUsers(count = 10) {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(count))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Guarda la forma de entrega habitual del usuario (métodos, provincia,
 * zona, tiendas) para pre-cargarla la próxima vez que publique — así no
 * tiene que volver a completar lo mismo en cada carta. Se guarda como un
 * solo objeto anidado (`deliveryPreferences`) en vez de campos sueltos,
 * para no tener que tocar la lista de campos permitidos en firestore.rules
 * cada vez que se agregue un dato nuevo a la forma de entrega.
 */
export async function updateDeliveryPreferences(uid, preferences) {
  await setDoc(
    doc(db, 'users', uid),
    { deliveryPreferences: preferences, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

/**
 * Guarda el teléfono/WhatsApp del usuario (opcional). Se guarda tal cual lo
 * escribe, en formato internacional sin espacios ni símbolos (ej: 5491122334455),
 * porque así lo necesita el link de wa.me al revelarlo en el contacto.
 */
export async function updateUserPhone(uid, phone) {
  await setDoc(
    doc(db, 'users', uid),
    { phone: phone || null, updatedAt: serverTimestamp() },
    { merge: true },
  )
}

/**
 * Devuelve true si el perfil está baneado ahora mismo. Un ban temporal con
 * bannedUntil vencido se considera "ya no baneado" automáticamente, sin
 * necesidad de que nadie lo desactive a mano.
 */
export function isUserBanned(profile) {
  if (!profile?.banned) return false
  if (!profile.bannedUntil) return true // ban permanente
  const until = profile.bannedUntil.toDate ? profile.bannedUntil.toDate() : new Date(profile.bannedUntil)
  return until > new Date()
}

const STRIKE_EXPIRY_MS = 14 * 24 * 60 * 60 * 1000 // 2 semanas

/**
 * Los incumplimientos ("strikes") se guardan como una lista de fechas en
 * profile.strikes. Uno vence solo a las 2 semanas de aplicado — esta
 * función filtra y devuelve solo los que siguen "vivos". Se usa tanto
 * para mostrarle el conteo real a la persona en /perfil como para que
 * addStrike() sepa si el próximo va a ser el 3ro/4to/5to activo (no el
 * histórico de siempre).
 */
export function getActiveStrikes(profile) {
  const strikes = profile?.strikes || []
  const cutoff = Date.now() - STRIKE_EXPIRY_MS
  return strikes.filter((s) => {
    const at = s?.toDate ? s.toDate().getTime() : new Date(s).getTime()
    return at > cutoff
  })
}

export function getActiveStrikeCount(profile) {
  return getActiveStrikes(profile).length
}
