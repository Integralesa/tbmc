import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import { getStoredReferralCode } from './referrals'

// Nombre de usuario: 3-30 caracteres, letras/números/guión bajo (sin
// espacios ni símbolos, mismo criterio que el resto del sitio de evitar
// texto libre sin validar). Debe coincidir con la regex de firestore.rules.
// Es lo que se muestra en pujas y ventas en vez del nombre de Google (ver
// getPublicName más abajo) — así nadie queda identificado por su nombre
// real si no quiere.
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/
export const USERNAME_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000 // 1 semana

/** Normaliza a minúsculas — es la clave de `usernames/{clave}` que reserva la unicidad (no distingue mayúsculas). */
function normalizeUsername(username) {
  return username.trim().toLowerCase()
}

/**
 * Cuántos milisegundos faltan para poder volver a cambiar el nombre de
 * usuario (0 si ya se puede, o si nunca lo cambió). Se usa tanto para
 * bloquear el botón en /perfil como para mostrar la fecha.
 */
export function getUsernameCooldownRemainingMs(profile) {
  const changedAt = profile?.usernameChangedAt?.toDate ? profile.usernameChangedAt.toDate() : null
  if (!changedAt) return 0
  const remaining = changedAt.getTime() + USERNAME_CHANGE_COOLDOWN_MS - Date.now()
  return Math.max(remaining, 0)
}

/**
 * Cambia el nombre de usuario, reservando la unicidad en una colección
 * aparte (`usernames/{nombre en minúsculas}` → `{ uid }`) — el documento
 * en sí es lo que impide que dos cuentas tengan el mismo nombre, ya que
 * Firestore no deja crear dos veces el mismo id. Todo pasa en una
 * transacción: si el nombre nuevo ya está tomado por otra cuenta, no se
 * escribe nada. `firestore.rules` además exige que hayan pasado 7 días
 * desde el último cambio (`usernameChangedAt`) — reforzado ahí, no solo acá,
 * para que no se pueda saltear escribiendo directo a Firestore.
 */
export async function updateUsername(uid, rawUsername) {
  const username = rawUsername.trim()
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error('El nombre de usuario tiene que tener entre 3 y 30 caracteres: solo letras, números y guión bajo.')
  }
  const normalized = normalizeUsername(username)

  await runTransaction(db, async (tx) => {
    const userRef = doc(db, 'users', uid)
    const userSnap = await tx.get(userRef)
    const current = userSnap.exists() ? userSnap.data() : {}

    const remaining = getUsernameCooldownRemainingMs(current)
    if (remaining > 0) {
      const days = Math.ceil(remaining / (24 * 60 * 60 * 1000))
      throw new Error(`Ya cambiaste tu nombre de usuario hace poco — podés volver a cambiarlo en ${days} día${days === 1 ? '' : 's'}.`)
    }

    const newRef = doc(db, 'usernames', normalized)
    const newSnap = await tx.get(newRef)
    if (newSnap.exists() && newSnap.data().uid !== uid) {
      throw new Error('Ese nombre de usuario ya está en uso.')
    }

    const oldNormalized = current.username ? normalizeUsername(current.username) : null
    if (oldNormalized && oldNormalized !== normalized) {
      tx.delete(doc(db, 'usernames', oldNormalized))
    }
    if (!newSnap.exists()) {
      tx.set(newRef, { uid })
    }
    // set(...,{merge:true}) en vez de update(): si por una carrera rara
    // todavía no existe users/{uid} (upsertUserProfile es async y podría
    // no haber terminado), esto lo crea en vez de tirar "no existe".
    tx.set(userRef, { username, usernameChangedAt: serverTimestamp() }, { merge: true })
  })
}

/**
 * Guarda (o actualiza) el perfil público mínimo del usuario logueado.
 * Se llama automáticamente cada vez que inicia sesión.
 * Solo el propio usuario puede leer/escribir su documento (ver firestore.rules).
 * Esto es lo que le permite a la Cloud Function de cierre de subastas
 * revelar el email correcto al vendedor y al ganador.
 *
 * `createdAt` y `referredBy` se agregan una sola vez, la primera vez que
 * se ve a este usuario (por eso el getDoc previo) — si fueran parte del
 * objeto de siempre, `merge: true` los pisaría en cada login. Las cuentas
 * creadas antes de este cambio no tienen `createdAt` (no hay forma de
 * reconstruirlo retroactivamente). `referredBy` sale de un `?ref=UID` en
 * la URL con la que haya entrado (ver src/lib/referrals.js) — si vino con
 * uno, la Cloud Function `awardReferralSignupBonus` le suma puntos de
 * sorteo a quien invitó (ver COMO-FUNCIONA.md, sección del sorteo bounty).
 */
export async function upsertUserProfile(user) {
  if (!user) return
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  const isNewUser = !snap.exists()
  const referredBy = isNewUser ? getStoredReferralCode() : null

  await setDoc(
    ref,
    {
      displayName: user.displayName || null,
      email: user.email || null,
      photoURL: user.photoURL || null,
      updatedAt: serverTimestamp(),
      ...(isNewUser ? { createdAt: serverTimestamp() } : {}),
      ...(referredBy && referredBy !== user.uid ? { referredBy } : {}),
    },
    { merge: true },
  )
}

/**
 * El nombre que se muestra públicamente de alguien (en pujas, como
 * vendedor, etc): su nombre de usuario si se puso uno, si no el nombre de
 * su cuenta de Google. `profile` es el documento de Firestore (users/{uid});
 * `authUser` es el objeto de Firebase Auth (con displayName) — se acepta
 * cualquiera de los dos, para no obligar a tener los dos a mano siempre.
 */
export function getPublicName(profile, authUser) {
  return profile?.username || authUser?.displayName || profile?.displayName || 'Usuario'
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

// --- Reputación (estrellas) ---
//
// Promedio ponderado con un "piso" inicial: todo usuario arranca como si ya
// tuviera PRIOR_WEIGHT operaciones buenas a PRIOR_VALUE estrellas. Eso hace
// que una cuenta nueva no se vea desconfiable (arranca en 4 estrellas) y que
// un tropiezo aislado no la hunda por debajo de 2 — pero alguien con varios
// incumplimientos confirmados sí baja en serio, porque el "piso" se diluye
// a medida que hay más operaciones reales (buenas o malas) sumando peso.
//
// repNumerator/repDenominator se guardan en users/{uid} y solo los puede
// escribir el sistema: la Cloud Function recomputeDealStatus (cuando una
// operación se completa) o Susurro/Araña vía addStrike (ver lib/admin.js y
// firestore.rules) — nunca el propio usuario.
export const REP_PRIOR_VALUE = 4
export const REP_PRIOR_WEIGHT = 3

// Cuánto suma completar una operación, según el rol.
export const REP_WEIGHT_SELLER_COMPLETED = 1.0
export const REP_WEIGHT_BIDDER_COMPLETED = 0.2

// Cuánto resta un incumplimiento confirmado (Susurro/Araña), según el rol
// en esa subasta puntual. Pesa más como vendedor: no entregar afecta más
// la confianza que no pagar una puja.
export const REP_WEIGHT_SELLER_STRIKE = 1.5
export const REP_WEIGHT_BIDDER_STRIKE = 0.3

/** Puntaje de reputación de 1 a 5 estrellas (con un decimal). */
export function getReputationScore(profile) {
  const num = profile?.repNumerator || 0
  const den = profile?.repDenominator || 0
  const raw = (REP_PRIOR_VALUE * REP_PRIOR_WEIGHT + num) / (REP_PRIOR_WEIGHT + den)
  return Math.max(1, Math.min(5, Math.round(raw * 10) / 10))
}

/** Cantidad de operaciones reales (completadas + incumplimientos) contadas. */
export function getReputationOpsCount(profile) {
  return profile?.repOpsCount || 0
}
