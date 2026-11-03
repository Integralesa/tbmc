import { collection, deleteDoc, doc, getDoc, getDocs, increment, query, setDoc, Timestamp, where } from 'firebase/firestore'
import { db } from '../firebase'
import { SUSURRO_EMAIL } from './roles'
import {
  getActiveStrikes,
  REP_WEIGHT_BIDDER_STRIKE,
  REP_WEIGHT_SELLER_STRIKE,
} from './users'
import { getDurationTier } from './auctions'

/**
 * Cuentas sin email (`email: null`) — es la firma de una sesión anónima
 * (ver upsertUserProfile en lib/users.js, que guarda `email: user.email ||
 * null`). Se usa para encontrar y limpiar las cuentas de prueba que deja
 * cada ronda de testing con Playwright/signInAnonymously, que si no se
 * borran se acumulan y aparecen en "Últimos registrados". Solo Susurro
 * puede leer el listado completo de usuarios (ver firestore.rules).
 */
export async function findAnonymousTestUsers() {
  const q = query(collection(db, 'users'), where('email', '==', null))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** Borra el documento de perfil de un usuario. Solo Susurro (ver firestore.rules). */
export async function deleteUserDoc(uid) {
  await deleteDoc(doc(db, 'users', uid))
}

/** Busca el perfil de un usuario por email exacto. Devuelve null si no existe. */
export async function findUserByEmail(email) {
  const q = query(collection(db, 'users'), where('email', '==', email.trim()))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
}

/**
 * Activa (o desactiva) el plan de un usuario. Para 'free' no carga fecha
 * de vencimiento; para el resto, calcula "hoy + N meses" automáticamente.
 * Solo Susurro puede hacer esto (ver firestore.rules) — las Arañas no
 * tocan planes.
 */
export async function setUserPlan(uid, planKey, months = 1) {
  const planExpiresAt =
    planKey === 'free'
      ? null
      : Timestamp.fromDate(new Date(new Date().setMonth(new Date().getMonth() + months)))

  await setDoc(
    doc(db, 'users', uid),
    { plan: planKey, planExpiresAt, planGrantedVia: planKey === 'free' ? null : 'admin' },
    { merge: true },
  )
}

/**
 * Le da o le saca el rol de Araña a alguien. Solo Susurro puede hacer esto
 * (ver firestore.rules) — una Araña no puede nombrar a otra.
 */
export async function setUserRole(uid, role) {
  await setDoc(doc(db, 'users', uid), { role: role || null }, { merge: true })
}

/**
 * Banea a un usuario. durationDays: 2, 7, o null para permanente.
 * Un ban temporal se "vence" solo (ver isUserBanned en lib/users.js) —
 * no hace falta ninguna función que lo levante automáticamente.
 * Susurro y las Arañas pueden hacer esto.
 */
export async function banUser(uid, durationDays, reason = '') {
  const bannedUntil = durationDays
    ? Timestamp.fromDate(new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000))
    : null

  await setDoc(
    doc(db, 'users', uid),
    { banned: true, bannedUntil, bannedAt: Timestamp.now(), banReason: reason || null },
    { merge: true },
  )
}

/** Levanta un ban antes de que se venza solo. Susurro y Arañas pueden hacerlo. */
export async function unbanUser(uid) {
  await setDoc(
    doc(db, 'users', uid),
    { banned: false, bannedUntil: null },
    { merge: true },
  )
}

/** Trae todas las subastas de un vendedor (para elegir cuál cerrar desde /admin). */
export async function findAuctionsBySeller(uid) {
  const q = query(collection(db, 'auctions'), where('sellerId', '==', uid))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
}

/**
 * Cierra una subasta a mano, con motivo. Queda con status 'closed_by_admin'
 * (distinto de 'ended' por tiempo) — no dispara contacto ni handshake con
 * quien iba ganando, ya que un cierre manual normalmente es por algo raro
 * con la publicación, no una venta real completada. Susurro y las Arañas
 * pueden hacer esto.
 */
export async function closeAuctionByAdmin(auctionId, reason) {
  await setDoc(
    doc(db, 'auctions', auctionId),
    {
      status: 'closed_by_admin',
      adminCloseReason: reason || null,
      adminClosedAt: Timestamp.now(),
    },
    { merge: true },
  )
}

/**
 * Borra una subasta sin importar su estado ni si tuvo pujas — solo
 * Susurro (ver firestore.rules). Pensado para limpiar pruebas viejas que
 * quedaron con pujas falsas dando vueltas para siempre (la protección
 * normal de "nunca se borra si tuvo pujas" sigue intacta para todos los
 * demás casos — esto es la excepción manual y deliberada).
 */
export async function deleteAuctionByAdmin(auctionId) {
  await deleteDoc(doc(db, 'auctions', auctionId))
}

/**
 * Aprueba una subasta que quedó "en revisión" porque Cloud Vision marcó
 * alguna de sus fotos (ver checkAuctionPhoto y photoFlags) — la pasa a
 * 'active' y le da la duración completa desde este momento (no desde que
 * se publicó), para que la espera de la revisión no le robe tiempo real
 * de subasta al vendedor. Susurro y las Arañas pueden hacer esto.
 */
export async function approvePendingAuction(auctionId) {
  const snap = await getDoc(doc(db, 'auctions', auctionId))
  if (!snap.exists()) throw new Error('La subasta ya no existe.')
  const auction = snap.data()
  const tier = getDurationTier(auction.durationTier)
  const endsAt = new Date(Date.now() + tier.minutes * 60 * 1000)

  await setDoc(
    doc(db, 'auctions', auctionId),
    { status: 'active', hasFlaggedPhoto: false, endsAt },
    { merge: true },
  )
}

/** Aprueba una solicitud de plan: activa el plan y marca la solicitud como aprobada. Solo Susurro. */
export async function approvePlanRequest(request) {
  await setUserPlan(request.userId, request.planKey)
  await setDoc(
    doc(db, 'planRequests', request.id),
    { status: 'approved', reviewedAt: Timestamp.now(), reviewedBy: SUSURRO_EMAIL },
    { merge: true },
  )
}

/** Rechaza una solicitud de plan (comprobante inválido, monto incorrecto, etc). Solo Susurro. */
export async function rejectPlanRequest(requestId, note = '') {
  await setDoc(
    doc(db, 'planRequests', requestId),
    { status: 'rejected', reviewedAt: Timestamp.now(), reviewedBy: SUSURRO_EMAIL, adminNote: note || null },
    { merge: true },
  )
}

/**
 * Suma un incumplimiento ("subasta no concretada") a alguien — a criterio
 * humano de Susurro/Araña, normalmente después de revisar un reporte de
 * problema. Cada strike vence solo a las 2 semanas de aplicado (ver
 * getActiveStrikes en lib/users.js) — acá se descartan los ya vencidos
 * antes de sumar el nuevo, para que la escalada se calcule sobre strikes
 * realmente activos, no sobre el historial de siempre:
 *   1ro y 2do (activos) → solo quedan contados, aviso en el perfil.
 *   3ro (activo)        → suspensión automática de 2 días.
 *   4to (activo)        → suspensión automática de 7 días.
 *   5to en adelante     → suspensión permanente.
 * Devuelve el nuevo total de strikes activos.
 *
 * `role` ('seller' | 'bidder') es quién de los dos incumplió en esa subasta
 * puntual — lo decide quien modera al mirar el reporte (ver Admin.jsx). Se
 * usa para restar puntaje de reputación (getReputationScore en lib/users.js);
 * el strike en sí (para la escalada de suspensión de arriba) no distingue rol,
 * eso no cambia.
 */
export async function addStrike(uid, role) {
  const userRef = doc(db, 'users', uid)
  const snap = await getDoc(userRef)
  const current = snap.exists() ? snap.data() : {}
  const activeStrikes = getActiveStrikes(current)
  const newStrikes = [...activeStrikes, Timestamp.now()]
  const newCount = newStrikes.length

  const strikeWeight = role === 'seller' ? REP_WEIGHT_SELLER_STRIKE : REP_WEIGHT_BIDDER_STRIKE
  const update = {
    strikes: newStrikes,
    repNumerator: increment(1 * strikeWeight),
    repDenominator: increment(strikeWeight),
    repOpsCount: increment(1),
  }

  if (newCount === 3) {
    update.banned = true
    update.bannedUntil = Timestamp.fromDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000))
    update.bannedAt = Timestamp.now()
    update.banReason = 'Incumplimiento reiterado de subastas (3er aviso activo)'
  } else if (newCount === 4) {
    update.banned = true
    update.bannedUntil = Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    update.bannedAt = Timestamp.now()
    update.banReason = 'Incumplimiento reiterado de subastas (4to aviso activo)'
  } else if (newCount >= 5) {
    update.banned = true
    update.bannedUntil = null
    update.bannedAt = Timestamp.now()
    update.banReason = 'Incumplimiento reiterado de subastas (5to aviso activo o más)'
  }

  await setDoc(userRef, update, { merge: true })
  return newCount
}
