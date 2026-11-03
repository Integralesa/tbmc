import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import {
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage'
import { db, storage } from '../firebase'
import { startOfTodayInArgentina, getPlan } from './plans'
import { getPublicName, isUserBanned } from './users'
import { compressImage } from './image'
import { findMatchingWishlists, createMatchNotifications } from './wishlistMatching'

const AUCTIONS = 'auctions'
const BIDS = 'bids'

// ---------- Modelo de datos ----------
// auctions/{id}: {
//   title, game, condition, isFoil,
//   itemType: 'card' | 'singles' | 'lote' | 'sleeves' | 'deckbox' | 'set_cartas' | 'board_game' | 'sealed', // 'card' = carta individual (default); 'singles' es igual pero con la etiqueta explícita
//   loteQuantity, loteSets, loteSetsVariados,  // solo si itemType === 'lote' — ver CreateAuction
//   sealIntact: bool | null,               // solo si itemType === 'sealed' — sello de fábrica intacto
//   isGraded, gradingCompany, grade,       // graduación de terceros (PSA/BGS/CGC), opcional
//   deliveryMethods, deliveryProvince, deliveryZone, cardShops, cardShopOtherName,
//   images: [urlFoto1, ..., urlFoto6],   // hasta 6 fotos
//   sellerId, sellerName, sellerPhoto,
//   startingPrice, currentPrice,
//   currentBidderId, currentBidderName, currentBidderWantsNotify, bidCount,
//   status: 'pending_review' | 'active' | 'ended' | 'closed_by_admin' | 'cancelled_by_seller',
//   photosTotal, photosChecked, hasFlaggedPhoto, // ver checkAuctionPhoto (Cloud Function)
//   durationTier: 'flash' | '30min' | '2h' | '5h' | '12h' | '24h' | '7d',
//   extendWindowMinutes, extendByMinutes,  // config anti-sniping de esta subasta
//   fixedBidIncrement: number | null,      // si está seteado, el comprador puja con un botón único
//   endsAt: Timestamp, createdAt: Timestamp,
//   editedAt: Timestamp | undefined,       // si el vendedor la corrigió en la ventana de 5 min
//   cancelledAt: Timestamp | undefined,    // si el vendedor la canceló en la ventana de 5 min
// }
// "Republicar" (ver republishAuction) NO crea una subasta nueva — reactiva
// el mismo documento (status: 'ended' → 'active' de nuevo), para que no
// aparezca duplicada en "Mis subastas".
// bids/{id}: { auctionId, userId, userName, userPhoto, amount, createdAt }

// ---------- Duración + anti-sniping ----------
// Si alguien puja dentro de los últimos `extendWindowMinutes` minutos,
// se suma `extendByMinutes` al cierre de la subasta (se puede repetir
// varias veces si siguen entrando pujas de último momento).
// `minPlanPriority` es el plan mínimo necesario para usar esa duración
// (0 = Chusma en adelante, 1 = Informante en adelante, 2 = solo Intel de
// Pícaros) — ver src/lib/plans.js para los valores de priority de cada plan.
export const DURATION_TIERS = [
  { key: 'flash', label: 'Flash — 10 minutos', minutes: 10, extendWindowMinutes: 1, extendByMinutes: 2, minPlanPriority: 0 },
  { key: '30min', label: '30 minutos', minutes: 30, extendWindowMinutes: 5, extendByMinutes: 5, minPlanPriority: 0 },
  { key: '2h', label: '2 horas', minutes: 120, extendWindowMinutes: 10, extendByMinutes: 10, minPlanPriority: 0 },
  { key: '5h', label: '5 horas', minutes: 300, extendWindowMinutes: 10, extendByMinutes: 10, minPlanPriority: 0 },
  { key: '12h', label: '12 horas', minutes: 720, extendWindowMinutes: 10, extendByMinutes: 10, minPlanPriority: 1 },
  { key: '24h', label: '24 horas', minutes: 1440, extendWindowMinutes: 10, extendByMinutes: 10, minPlanPriority: 2 },
  // Franja larga para objetos puntuales/raros que necesitan más tiempo
  // para encontrar comprador (idea tomada de cómo se manejan las casas de
  // subastas japonesas) — a propósito solo para el plan más alto: las
  // franjas cortas de arriba se mantienen como están (se acortaron adrede
  // en su momento para evitar sniping y que el sitio no se sienta
  // "parado"), y la duración sigue siendo parte de lo que se paga.
  { key: '7d', label: '7 días — objetos puntuales', minutes: 10080, extendWindowMinutes: 10, extendByMinutes: 10, minPlanPriority: 2 },
]

export function getDurationTier(key) {
  return DURATION_TIERS.find((t) => t.key === key) || DURATION_TIERS[0]
}

const MAX_PHOTOS = 6
export const MAX_PRICE_DIGITS = 18 // tope contra números absurdos (ej: un cero de más al escribir el precio)
export const MIN_BID_AMOUNT = 500 // piso de la puja libre — no aplica a puja con incremento fijo

// ---------- Edición / cancelación por el vendedor ----------
// Ventana de arrepentimiento: dentro de los primeros EDIT_WINDOW_MINUTES
// desde que se publicó, el vendedor puede corregir datos (no precio ni
// fotos, para que no pueda hacer un "cambiazo") o cancelar del todo. No
// aplica a la duración "flash" (10 min) porque la ventana casi no dejaría
// tiempo real de subasta. Si cancela, la subasta no se puede reactivar —
// hay que publicarla de nuevo.
export const EDIT_WINDOW_MINUTES = 5

/**
 * Devuelve si esta subasta todavía está dentro de la ventana de edición o
 * cancelación del vendedor, y por qué no si no lo está. Se usa tanto para
 * mostrar/ocultar los botones como para calcular el tiempo restante.
 */
export function getEditWindowStatus(auction) {
  if (!auction) return { canEdit: false, msRemaining: 0 }
  if (auction.status !== 'active') return { canEdit: false, msRemaining: 0 }
  if (auction.durationTier === 'flash') return { canEdit: false, msRemaining: 0 }
  const createdAt = auction.createdAt?.toDate ? auction.createdAt.toDate() : new Date(auction.createdAt)
  const deadline = createdAt.getTime() + EDIT_WINDOW_MINUTES * 60 * 1000
  const msRemaining = deadline - Date.now()
  return { canEdit: msRemaining > 0, msRemaining: Math.max(msRemaining, 0) }
}

/**
 * Cuenta cuántas subastas publicó este usuario desde la medianoche de hoy
 * (huso horario Argentina). Se usa para hacer respetar el límite diario
 * del plan (ver src/lib/plans.js). Nota: este control es del lado del
 * cliente, no está reforzado en las reglas de Firestore — para un límite
 * "blando" de negocio como este alcanza, pero alguien muy técnico podría
 * saltearlo llamando directo a Firestore. Si en algún momento esto importa
 * de verdad, hay que moverlo a una Cloud Function que valide en el server.
 */
export async function countTodayAuctionsByUser(userId) {
  const start = startOfTodayInArgentina()
  const q = query(
    collection(db, AUCTIONS),
    where('sellerId', '==', userId),
    where('createdAt', '>=', Timestamp.fromDate(start)),
  )
  const snap = await getCountFromServer(q)
  return snap.data().count
}

/** Sube hasta 6 fotos de la carta a Storage, comprimidas, y devuelve sus URLs. */
async function uploadAuctionImages(auctionId, files) {
  const limited = files.slice(0, MAX_PHOTOS)
  const urls = []
  for (let i = 0; i < limited.length; i++) {
    const compressed = await compressImage(limited[i])
    const path = `auctions/${auctionId}/foto_${i + 1}_${Date.now()}.jpg`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' })
    const url = await getDownloadURL(storageRef)
    urls.push(url)
  }
  return urls
}

/**
 * Resube las fotos de una subasta propia, reemplazando las que tenga —
 * pensado como herramienta de reparación (ej: fotos que quedaron rotas
 * por el incidente de carpetas huérfanas de Storage, ver COMO-FUNCIONA.md),
 * no como forma normal de editar. Solo funciona mientras bidCount sigue en
 * 0 (reforzado también en firestore.rules): una vez que hay pujas, nadie
 * puede tocar las fotos, para que no se preste a un "cambiazo".
 */
export async function replaceAuctionImages({ auctionId, imageFiles, user }) {
  if (!user) throw new Error('Tenés que iniciar sesión.')
  if (!imageFiles || imageFiles.length === 0) {
    throw new Error('Subí al menos 1 foto.')
  }
  if (imageFiles.length > MAX_PHOTOS) {
    throw new Error(`Máximo ${MAX_PHOTOS} fotos por carta.`)
  }
  const snap = await getDoc(doc(db, AUCTIONS, auctionId))
  if (!snap.exists()) throw new Error('La subasta ya no existe.')
  const auction = snap.data()
  if (auction.sellerId !== user.uid) throw new Error('Esta subasta no es tuya.')
  if ((auction.bidCount || 0) > 0) {
    throw new Error('Ya tiene pujas — no se pueden cambiar las fotos de una subasta con pujas.')
  }

  const images = await uploadAuctionImages(auctionId, imageFiles)
  await updateDoc(doc(db, AUCTIONS, auctionId), { images })
  return images
}

/**
 * Crea una subasta nueva.
 * imageFiles: array de hasta 2 objetos File.
 * durationTierKey: 'flash' | '30min' | '2h' | '5h'
 * fixedBidIncrement: número (opcional) — si se pasa, la puja se hace con botón único.
 */
export async function createAuction({
  title,
  game,
  condition,
  isFoil,
  itemType,
  loteQuantity,
  loteSets,
  loteSetsVariados,
  sealIntact,
  isGraded,
  gradingCompany,
  grade,
  startingPrice,
  durationTierKey,
  fixedBidIncrement,
  deliveryMethods,
  deliveryProvince,
  deliveryZone,
  cardShops,
  imageFiles,
  user,
}) {
  if (!user) throw new Error('Tenés que iniciar sesión para publicar una carta.')
  if (!imageFiles || imageFiles.length === 0) {
    throw new Error('Subí al menos 1 foto de la carta.')
  }
  if (imageFiles.length > MAX_PHOTOS) {
    throw new Error(`Máximo ${MAX_PHOTOS} fotos por carta.`)
  }
  if (String(Math.trunc(Number(startingPrice) || 0)).length > MAX_PRICE_DIGITS) {
    throw new Error(`El precio inicial es demasiado grande (máximo ${MAX_PRICE_DIGITS} dígitos).`)
  }

  // Límite diario según el plan del usuario (ver src/lib/plans.js).
  const profileSnap = await getDoc(doc(db, 'users', user.uid))
  if (profileSnap.exists() && isUserBanned(profileSnap.data())) {
    throw new Error('Tu cuenta está suspendida y no podés publicar cartas. Escribinos si creés que es un error.')
  }
  const planKey = profileSnap.exists() ? profileSnap.data().plan : 'free'
  const plan = getPlan(planKey)
  const todayCount = await countTodayAuctionsByUser(user.uid)
  if (todayCount >= plan.dailyLimit) {
    throw new Error(
      `Llegaste al límite de tu plan (${plan.label}: ${plan.dailyLimit} publicaciones por día). Mirá los planes para subir el límite.`,
    )
  }

  const tier = getDurationTier(durationTierKey)
  if (tier.minPlanPriority > plan.priority) {
    throw new Error(
      `La duración "${tier.label}" requiere un plan mejor que ${plan.label}. Mirá los planes para desbloquearla.`,
    )
  }
  const endsAt = new Date(Date.now() + tier.minutes * 60 * 1000)

  // Creamos el documento primero para tener un id y subir las fotos a esa carpeta.
  const docRef = await addDoc(collection(db, AUCTIONS), {
    title,
    game,
    condition,
    isFoil: !!isFoil,
    itemType: itemType || 'card',
    loteQuantity: itemType === 'lote' && loteQuantity ? Number(loteQuantity) : null,
    loteSets: itemType === 'lote' ? loteSets || [] : [],
    loteSetsVariados: itemType === 'lote' ? !!loteSetsVariados : false,
    // Inspirado en cómo se manejan las casas de subastas japonesas (ver
    // COMO-FUNCIONA.md): el sello intacto importa mucho para sellados, y
    // la graduación de terceros (PSA/BGS/CGC) le da confianza extra a
    // cartas de alto valor.
    sealIntact: itemType === 'sealed' ? !!sealIntact : null,
    isGraded: !!isGraded,
    gradingCompany: isGraded ? gradingCompany || null : null,
    grade: isGraded && grade ? Number(grade) : null,
    deliveryMethods: deliveryMethods || [], // ej: ['retiro', 'envio', 'punto_encuentro']
    deliveryProvince: deliveryProvince || null, // ej: "Ciudad Autónoma de Buenos Aires", "Córdoba"
    deliveryZone: deliveryZone || null, // barrio de CABA, o "Partido (CP 1425)" si la provincia es Buenos Aires
    cardShops: cardShops || [], // ej: ['magic_palace', 'otras']
    images: [],
    sellerId: user.uid,
    sellerName: getPublicName(profileSnap.exists() ? profileSnap.data() : null, user),
    sellerPhoto: user.photoURL || null,
    sellerPlan: plan.key, // snapshot del plan al momento de publicar (define si aparece destacado)
    sellerPlanPriority: plan.priority || 0, // 0 chusma, 1 informante, 2 intel de pícaros
    startingPrice: Number(startingPrice),
    currentPrice: Number(startingPrice),
    currentBidderId: null,
    currentBidderName: null,
    bidCount: 0,
    // Arranca en revisión: checkAuctionPhoto (Cloud Function) la pasa a
    // 'active' sola apenas Cloud Vision revisa las fotos (normalmente
    // unos segundos) — a menos que algo parezca raro, en cuyo caso queda
    // pendiente hasta que Susurro/Araña la aprueben a mano (ver sección 24
    // de COMO-FUNCIONA.md).
    status: 'pending_review',
    photosTotal: imageFiles.length,
    photosChecked: 0,
    hasFlaggedPhoto: false,
    durationTier: tier.key,
    extendWindowMinutes: tier.extendWindowMinutes,
    extendByMinutes: tier.extendByMinutes,
    fixedBidIncrement: fixedBidIncrement ? Number(fixedBidIncrement) : null,
    endsAt,
    createdAt: serverTimestamp(),
  })

  const images = await uploadAuctionImages(docRef.id, imageFiles)
  await runTransaction(db, async (tx) => {
    tx.update(doc(db, AUCTIONS, docRef.id), { images })
  })

  // Buscar y notificar a usuarios que buscan esta carta (no bloqueante)
  if (title) {
    findMatchingWishlists(title, null, null, 1).then((matches) => {
      if (matches.length > 0) {
        createMatchNotifications(docRef.id, title, null, null, 1, matches)
      }
    })
  }

  return docRef.id
}

/**
 * Republica una subasta propia que ya cerró sin ninguna puja — evita tener
 * que volver a cargar título, fotos, entrega, etc. desde cero. A propósito
 * NO crea una subasta nueva (antes sí, y eso la hacía aparecer duplicada
 * en "Mis subastas" — la vieja cerrada y la nueva activa, como dos cosas
 * distintas): reactiva el MISMO documento, así en el perfil sigue siendo
 * un solo ítem que pasó de "Cerrada" a "Activa" de nuevo. Reutiliza las
 * fotos ya subidas (siguen en Storage, nunca se borran) — por eso pasa
 * directo a `status: 'active'`, esas fotos ya pasaron el chequeo de Cloud
 * Vision la primera vez. El precio inicial queda igual que la vez pasada;
 * la duración por default es la misma de antes, pero se puede pasar
 * `durationTierKey` para elegir otra (ej: republicar algo que antes
 * estaba a 24h, ahora a 7 días) — sigue estando sujeta al plan del
 * vendedor, igual que al publicar de cero.
 */
export async function republishAuction({ auctionId, user, durationTierKey }) {
  if (!user) throw new Error('Tenés que iniciar sesión.')
  const snap = await getDoc(doc(db, AUCTIONS, auctionId))
  if (!snap.exists()) throw new Error('La subasta ya no existe.')
  const old = snap.data()
  if (old.sellerId !== user.uid) throw new Error('Esta subasta no es tuya.')
  if (old.status !== 'ended' || (old.bidCount || 0) > 0) {
    throw new Error('Solo se pueden republicar subastas cerradas sin ninguna puja.')
  }
  if (!old.images || old.images.length === 0) {
    throw new Error('Esta subasta no tiene fotos guardadas para reutilizar.')
  }

  // Mismos chequeos que al publicar de cero: cuenta suspendida, límite
  // diario del plan, y que el plan alcance para la duración original.
  const profileSnap = await getDoc(doc(db, 'users', user.uid))
  if (profileSnap.exists() && isUserBanned(profileSnap.data())) {
    throw new Error('Tu cuenta está suspendida y no podés publicar cartas. Escribinos si creés que es un error.')
  }
  const planKey = profileSnap.exists() ? profileSnap.data().plan : 'free'
  const plan = getPlan(planKey)
  const todayCount = await countTodayAuctionsByUser(user.uid)
  if (todayCount >= plan.dailyLimit) {
    throw new Error(
      `Llegaste al límite de tu plan (${plan.label}: ${plan.dailyLimit} publicaciones por día). Mirá los planes para subir el límite.`,
    )
  }
  const tier = getDurationTier(durationTierKey || old.durationTier)
  if (tier.minPlanPriority > plan.priority) {
    throw new Error(
      `La duración "${tier.label}" requiere un plan mejor que ${plan.label}. Mirá los planes para desbloquearla.`,
    )
  }
  const endsAt = new Date(Date.now() + tier.minutes * 60 * 1000)

  await updateDoc(doc(db, AUCTIONS, auctionId), {
    status: 'active',
    currentPrice: old.startingPrice,
    currentBidderId: null,
    currentBidderName: null,
    bidCount: 0,
    endsAt,
    durationTier: tier.key,
    extendWindowMinutes: tier.extendWindowMinutes,
    extendByMinutes: tier.extendByMinutes,
  })

  return auctionId
}

/**
 * Corrige datos de una subasta propia dentro de la ventana de arrepentimiento
 * (ver EDIT_WINDOW_MINUTES). A propósito NO permite tocar precio ni fotos —
 * son los dos datos que alguien podría cambiar para "engañar" a quien ya
 * vio o pujó en la publicación original. El título, si cambia, ya tiene
 * que venir validado contra la API del juego (lo hace el formulario antes
 * de llamar a esta función). El cierre (endsAt) se reinicia a la duración
 * completa original, para que la edición no le robe tiempo real a la
 * subasta. Las pujas ya hechas NO se tocan.
 */
export async function editAuction({
  auctionId,
  title,
  condition,
  isFoil,
  deliveryMethods,
  deliveryProvince,
  deliveryZone,
  cardShops,
  user,
}) {
  if (!user) throw new Error('Tenés que iniciar sesión.')
  const snap = await getDoc(doc(db, AUCTIONS, auctionId))
  if (!snap.exists()) throw new Error('La subasta ya no existe.')
  const auction = snap.data()
  if (auction.sellerId !== user.uid) throw new Error('Esta subasta no es tuya.')

  const { canEdit } = getEditWindowStatus(auction)
  if (!canEdit) {
    throw new Error(
      `Ya pasaron los ${EDIT_WINDOW_MINUTES} minutos para editar esta subasta (o es de duración Flash, que no admite edición).`,
    )
  }

  const tier = getDurationTier(auction.durationTier)
  const endsAt = new Date(Date.now() + tier.minutes * 60 * 1000)

  // Firestore no admite arrays anidados (un array adentro de otro array),
  // así que cada cambio va como { before, after } — no como tupla [antes,
  // después] — porque deliveryMethods/cardShops ya son arrays de por sí.
  const changes = {
    title: { before: auction.title, after: title },
    condition: { before: auction.condition, after: condition },
    isFoil: { before: !!auction.isFoil, after: !!isFoil },
    deliveryMethods: { before: auction.deliveryMethods || [], after: deliveryMethods || [] },
    deliveryProvince: { before: auction.deliveryProvince || null, after: deliveryProvince || null },
    deliveryZone: { before: auction.deliveryZone || null, after: deliveryZone || null },
    cardShops: { before: auction.cardShops || [], after: cardShops || [] },
  }

  await updateDoc(doc(db, AUCTIONS, auctionId), {
    title,
    condition,
    isFoil: !!isFoil,
    deliveryMethods: deliveryMethods || [],
    deliveryProvince: deliveryProvince || null,
    deliveryZone: deliveryZone || null,
    cardShops: cardShops || [],
    endsAt,
    editedAt: serverTimestamp(),
  })

  // Cualquier modificación de una subasta se avisa a Susurro/Arañas — ver
  // sección "🔧 Modificaciones de subastas" en /admin. Si este aviso
  // fallara por algo, no le arruina al vendedor un guardado que ya se hizo
  // bien — se registra en consola nada más.
  try {
    await addDoc(collection(db, 'auctionEdits'), {
      auctionId,
      auctionTitle: title,
      sellerId: user.uid,
      sellerEmail: user.email || null,
      sellerName: user.displayName || null,
      changes,
      status: 'open',
      createdAt: serverTimestamp(),
    })
  } catch (err) {
    console.error('No se pudo avisar a Susurro/Arañas de la edición:', err)
  }
}

/**
 * Cancela una subasta propia dentro de la ventana de arrepentimiento (ver
 * EDIT_WINDOW_MINUTES). Se permite aunque ya tenga pujas — el disclaimer en
 * la UI avisa de esto antes de confirmar. No hay reactivación: si el
 * vendedor se arrepiente de cancelar, tiene que publicar de nuevo.
 */
export async function cancelAuction({ auctionId, user }) {
  if (!user) throw new Error('Tenés que iniciar sesión.')
  const snap = await getDoc(doc(db, AUCTIONS, auctionId))
  if (!snap.exists()) throw new Error('La subasta ya no existe.')
  const auction = snap.data()
  if (auction.sellerId !== user.uid) throw new Error('Esta subasta no es tuya.')

  const { canEdit } = getEditWindowStatus(auction)
  if (!canEdit) {
    throw new Error(
      `Ya pasaron los ${EDIT_WINDOW_MINUTES} minutos para cancelar esta subasta (o es de duración Flash, que no admite cancelación).`,
    )
  }

  await updateDoc(doc(db, AUCTIONS, auctionId), {
    status: 'cancelled_by_seller',
    cancelledAt: serverTimestamp(),
  })
}

/** Escucha en tiempo real la lista de subastas activas, ordenadas por cierre más próximo. */
export function subscribeToActiveAuctions(callback) {
  const q = query(
    collection(db, AUCTIONS),
    where('status', '==', 'active'),
    orderBy('endsAt', 'asc'),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

/** Escucha en tiempo real una subasta puntual. Devuelve null si no existe. */
export function subscribeToAuction(auctionId, callback) {
  return onSnapshot(doc(db, AUCTIONS, auctionId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  })
}

/** Escucha en tiempo real el historial de pujas de una subasta. */
export function subscribeToBids(auctionId, callback) {
  const q = query(
    collection(db, BIDS),
    where('auctionId', '==', auctionId),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

/** Escucha en tiempo real las subastas publicadas por un usuario ("mis subastas"). */
export function subscribeToUserAuctions(userId, callback) {
  const q = query(
    collection(db, AUCTIONS),
    where('sellerId', '==', userId),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

/**
 * Marca la confirmación propia ("se completó de mi lado") en el handshake
 * post-cierre. Cada usuario solo puede tocar su propio campo — lo valida
 * firestore.rules. La Cloud Function recalcula el estado general.
 */
export async function confirmDeal({ auctionId, isSeller }) {
  const field = isSeller ? 'sellerConfirmed' : 'winnerConfirmed'
  await updateDoc(doc(db, AUCTIONS, auctionId, 'contact', 'info'), { [field]: true })
}

/**
 * Reporta un problema con la operación, con motivo. No requiere que la
 * otra parte esté de acuerdo. Además de marcar el campo en el contacto,
 * crea un registro en problemReports para que Susurro y las Arañas lo
 * vean en /admin (no hay sistema de mail armado, así que el "aviso" es
 * esa bandeja dentro de la app).
 */
export async function reportDealProblem({
  auctionId,
  auctionTitle,
  isSeller,
  reason,
  reporterId,
  reporterEmail,
  reporterName,
  sellerId,
  winnerId,
}) {
  const field = isSeller ? 'sellerReportedProblem' : 'winnerReportedProblem'
  const reasonField = isSeller ? 'sellerProblemReason' : 'winnerProblemReason'

  await updateDoc(doc(db, AUCTIONS, auctionId, 'contact', 'info'), {
    [field]: true,
    [reasonField]: reason || null,
  })

  await addDoc(collection(db, 'problemReports'), {
    auctionId,
    auctionTitle: auctionTitle || null,
    sellerId: sellerId || null,
    winnerId: winnerId || null,
    reporterId,
    reporterEmail: reporterEmail || null,
    reporterName: reporterName || null,
    reportedRole: isSeller ? 'seller' : 'winner',
    reason: reason || null,
    status: 'open',
    createdAt: serverTimestamp(),
  })
}

/**
 * Escucha en tiempo real el documento de contacto (email) de una subasta
 * cerrada con ganador. Solo va a devolver datos si el usuario logueado es
 * el vendedor o el ganador — para cualquier otro, Firestore rechaza la
 * lectura por reglas de seguridad, así que devolvemos null en ese caso
 * en vez de propagar el error (es un resultado esperado, no un bug).
 */
export function subscribeToContact(auctionId, callback) {
  const ref = doc(db, AUCTIONS, auctionId, 'contact', 'info')
  return onSnapshot(
    ref,
    (snap) => callback(snap.exists() ? snap.data() : null),
    () => callback(null),
  )
}

/**
 * Escucha en tiempo real las pujas hechas por un usuario ("mis pujas") y
 * devuelve, para cada subasta en la que participó, su última puja propia
 * más el id de la subasta (el detalle completo de la subasta se resuelve
 * aparte, ver useMyBidAuctions en el hook de la página de perfil).
 */
export function subscribeToUserBids(userId, callback) {
  const q = query(
    collection(db, BIDS),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

/**
 * Puja por una subasta usando una transacción: garantiza que dos pujas
 * simultáneas no pisen el precio actual de forma inconsistente.
 * Si la puja entra dentro de la ventana anti-sniping de la subasta,
 * el cierre (endsAt) se extiende automáticamente.
 */
export async function placeBid({ auctionId, amount, user, notifyIfOutbid = true }) {
  if (!user) throw new Error('Tenés que iniciar sesión para pujar.')
  if (String(Math.trunc(Number(amount) || 0)).length > MAX_PRICE_DIGITS) {
    throw new Error('Ese monto es demasiado grande.')
  }

  const profileSnap = await getDoc(doc(db, 'users', user.uid))
  if (profileSnap.exists() && isUserBanned(profileSnap.data())) {
    throw new Error('Tu cuenta está suspendida y no podés pujar. Escribinos si creés que es un error.')
  }
  const bidderName = getPublicName(profileSnap.exists() ? profileSnap.data() : null, user)

  await runTransaction(db, async (tx) => {
    const auctionRef = doc(db, AUCTIONS, auctionId)
    const auctionSnap = await tx.get(auctionRef)
    if (!auctionSnap.exists()) throw new Error('La subasta ya no existe.')

    const auction = auctionSnap.data()
    const now = new Date()
    const currentEndsAt = auction.endsAt?.toDate ? auction.endsAt.toDate() : new Date(auction.endsAt)

    if (auction.status !== 'active') throw new Error('Esta subasta ya cerró.')
    if (currentEndsAt < now) throw new Error('Esta subasta ya cerró.')
    if (auction.sellerId === user.uid) {
      throw new Error('No podés pujar en tu propia subasta.')
    }
    if (Number(amount) <= Number(auction.currentPrice)) {
      throw new Error('Tu puja tiene que ser mayor al precio actual.')
    }

    // Tope y piso de la puja libre (sin botonera de incremento fijo): no
    // se puede pujar más de 50% por encima del precio actual de una sola
    // vez (evita que alguien escriba un número absurdo y arruine la
    // subasta), ni menos de MIN_BID_AMOUNT. El tope nunca queda por debajo
    // del piso — si no, en subastas de precio inicial muy bajo el rango
    // quedaría imposible. Con incremento fijo no aplica ninguno de los dos,
    // porque el salto ya lo define el vendedor al publicar.
    if (!auction.fixedBidIncrement) {
      if (Number(amount) < MIN_BID_AMOUNT) {
        throw new Error(`La puja mínima es $${MIN_BID_AMOUNT.toLocaleString('es-AR')}.`)
      }
      const maxAllowed = Math.max(Number(auction.currentPrice) * 1.5, MIN_BID_AMOUNT)
      if (Number(amount) > maxAllowed) {
        throw new Error(
          `No podés pujar más de un 50% por encima del precio actual en esta subasta (máximo $${Math.floor(maxAllowed).toLocaleString('es-AR')}).`,
        )
      }
    }

    // Máximo 2 pujas seguidas de la misma persona sin que nadie más puje en
    // el medio; a partir de la 3ra seguida, hay que esperar 1 minuto desde
    // la última. Evita que alguien infle la subasta pujándose a sí mismo
    // muy rápido. Si puja otra persona distinta, el contador se resetea.
    const isSameBidder = auction.currentBidderId === user.uid
    const prevStreak = auction.bidderStreak || 0
    const newStreak = isSameBidder ? prevStreak + 1 : 1

    if (isSameBidder && newStreak > 2) {
      const lastBidAt = auction.lastBidAt?.toDate ? auction.lastBidAt.toDate() : null
      const secondsSinceLastBid = lastBidAt ? (now.getTime() - lastBidAt.getTime()) / 1000 : Infinity
      if (secondsSinceLastBid < 60) {
        const wait = Math.ceil(60 - secondsSinceLastBid)
        throw new Error(
          `Ya pujaste 2 veces seguidas en esta subasta — esperá ${wait} segundo${wait === 1 ? '' : 's'} más antes de volver a pujar.`,
        )
      }
    }

    // Anti-sniping: si la puja cae dentro de la ventana final, se extiende el cierre.
    const windowMs = (auction.extendWindowMinutes || 0) * 60 * 1000
    const extendByMs = (auction.extendByMinutes || 0) * 60 * 1000
    const remainingMs = currentEndsAt.getTime() - now.getTime()
    const newEndsAt =
      windowMs > 0 && remainingMs <= windowMs
        ? new Date(currentEndsAt.getTime() + extendByMs)
        : currentEndsAt

    tx.update(auctionRef, {
      currentPrice: Number(amount),
      currentBidderId: user.uid,
      currentBidderName: bidderName,
      currentBidderWantsNotify: !!notifyIfOutbid,
      bidCount: (auction.bidCount || 0) + 1,
      endsAt: newEndsAt,
      bidderStreak: newStreak,
      lastBidAt: now,
    })

    const newBidRef = doc(collection(db, BIDS))
    tx.set(newBidRef, {
      auctionId,
      userId: user.uid,
      userName: bidderName,
      userPhoto: user.photoURL || null,
      amount: Number(amount),
      createdAt: serverTimestamp(),
    })
  })
}
