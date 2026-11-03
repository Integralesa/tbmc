const { onSchedule } = require('firebase-functions/v2/scheduler')
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { onObjectFinalized } = require('firebase-functions/v2/storage')
const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore')
const { getStorage } = require('firebase-admin/storage')
const vision = require('@google-cloud/vision')

initializeApp()
const db = getFirestore()
const visionClient = new vision.ImageAnnotatorClient()

// Token del bot de Telegram "El Rumor" y URL del webhook de Discord (canal
// #anuncios) — guardados como secretos (Secret Manager), nunca en el
// código ni en git (ver COMO-FUNCIONA.md, sección del Tablón de TBMC). Se
// cargan con `firebase functions:secrets:set`.
const TELEGRAM_BOT_TOKEN = defineSecret('TELEGRAM_BOT_TOKEN')
const DISCORD_WEBHOOK_URL = defineSecret('DISCORD_WEBHOOK_URL')
const TELEGRAM_CHANNEL = '@tablontbmc'
const SITE_URL = 'https://theblackmarketconnections.com'

/**
 * Corre cada 5 minutos: busca subastas activas cuyo endsAt ya pasó
 * y las marca como 'ended'. Así el front deja de aceptar pujas sobre
 * ellas de forma consistente, aunque nadie tenga la página abierta.
 *
 * Si hubo un ganador, además crea auctions/{id}/contact/info con los
 * emails de vendedor y ganador — ese documento solo lo puede leer esa
 * misma pareja de usuarios (ver firestore.rules), nunca terceros.
 * También arranca en 'pending' el estado del handshake de confirmación.
 */
exports.closeExpiredAuctions = onSchedule('every 5 minutes', async () => {
  const now = Timestamp.now()

  const expired = await db
    .collection('auctions')
    .where('status', '==', 'active')
    .where('endsAt', '<=', now)
    .get()

  if (expired.empty) {
    console.log('No hay subastas para cerrar.')
    return
  }

  const batch = db.batch()
  const pendingContact = []

  expired.docs.forEach((docSnap) => {
    const data = docSnap.data()
    const winnerId = data.currentBidderId || null

    batch.update(docSnap.ref, {
      status: 'ended',
      winnerId,
      winnerName: data.currentBidderName || null,
      closedAt: now,
    })

    if (winnerId && data.sellerId) {
      pendingContact.push({
        auctionRef: docSnap.ref,
        sellerId: data.sellerId,
        winnerId,
      })
    }
  })

  await batch.commit()
  console.log(`Cerré ${expired.size} subasta(s) vencida(s).`)

  // Revelar contacto (email) entre vendedor y ganador, solo para esa pareja.
  for (const { auctionRef, sellerId, winnerId } of pendingContact) {
    try {
      const [sellerSnap, winnerSnap] = await Promise.all([
        db.collection('users').doc(sellerId).get(),
        db.collection('users').doc(winnerId).get(),
      ])
      const seller = sellerSnap.exists ? sellerSnap.data() : {}
      const winner = winnerSnap.exists ? winnerSnap.data() : {}

      await auctionRef.collection('contact').doc('info').set({
        sellerId,
        winnerId,
        sellerName: seller.displayName || null,
        sellerEmail: seller.email || null,
        sellerPhone: seller.phone || null,
        winnerName: winner.displayName || null,
        winnerEmail: winner.email || null,
        winnerPhone: winner.phone || null,
        revealedAt: now,
        // handshake de confirmación de operación (sección 6 de COMO-FUNCIONA.md)
        sellerConfirmed: false,
        winnerConfirmed: false,
        sellerReportedProblem: false,
        winnerReportedProblem: false,
        dealStatus: 'pending', // 'pending' | 'completed' | 'disputed'
      })
    } catch (err) {
      console.error(`No se pudo revelar contacto para ${auctionRef.id}:`, err)
    }
  }

  if (pendingContact.length > 0) {
    console.log(`Revelé contacto en ${pendingContact.length} subasta(s) con ganador.`)
  }
})

// Cuánto tiempo se deja una subasta cerrada SIN pujas antes de borrarla
// sola (ver cleanupOldAuctions). Las que sí tuvieron ganador NO se tocan
// acá — quedan para siempre por si hace falta revisar un reclamo.
const CLEANUP_AFTER_DAYS = 14

// Los tres estados "cerrados sin venta" que se limpian solos, cada uno con
// el campo de fecha que realmente usa (no es el mismo en los tres — ver
// closeExpiredAuctions, closeAuctionByAdmin en lib/admin.js, y
// cancelAuction en lib/auctions.js).
const CLEANUP_STATUSES = [
  { status: 'ended', dateField: 'closedAt' },
  { status: 'closed_by_admin', dateField: 'adminClosedAt' },
  { status: 'cancelled_by_seller', dateField: 'cancelledAt' },
]

/**
 * Corre una vez por día: borra subastas cerradas SIN venta (sin pujas)
 * que llevan más de CLEANUP_AFTER_DAYS días así — sea porque terminaron
 * sin ganador, las cerró un admin, o las canceló el vendedor. No dejan
 * contacto revelado ni handshake que consultar, así que no tiene sentido
 * juntarlas para siempre — si no se limpian, se acumulan de a decenas en
 * Firestore y sus fotos en Storage (ver COMO-FUNCIONA.md). Antes de
 * borrar el documento, borra también sus fotos en Storage (carpeta
 * auctions/{id}/) para no dejar basura ahí tampoco.
 */
exports.cleanupOldAuctions = onSchedule('every 24 hours', async () => {
  const bucket = getStorage().bucket()
  const cutoff = Timestamp.fromMillis(Date.now() - CLEANUP_AFTER_DAYS * 24 * 60 * 60 * 1000)

  const results = await Promise.all(
    CLEANUP_STATUSES.map(({ status, dateField }) =>
      db.collection('auctions').where('status', '==', status).where(dateField, '<=', cutoff).get(),
    ),
  )

  const toDelete = results.flatMap((snap) => snap.docs).filter((docSnap) => !(docSnap.data().bidCount > 0))

  if (toDelete.length === 0) {
    console.log('No hay subastas viejas sin pujas para borrar.')
    return
  }

  // Antes de borrar fotos de Storage: un bug viejo (ya arreglado) de
  // "Republicar" llegó a crear subastas nuevas cuyas fotos en realidad
  // viven en la carpeta de OTRA subasta (la original, de antes del
  // arreglo) en vez de en la propia — esto pasó de verdad y causó que se
  // rompieran fotos de subastas activas al borrarse la huérfana que
  // "dueña" la carpeta (ver COMO-FUNCIONA.md). Por eso, antes de borrar
  // la carpeta auctions/{id}/ de alguien que se está yendo, nos fijamos
  // si alguna OTRA subasta que NO se está borrando ahora todavía
  // referencia esa misma carpeta en su campo `images` — si es así, se
  // salta el borrado de Storage (el documento huérfano sí se borra
  // igual, pero sus fotos no, para no romper una subasta que sigue viva).
  const toDeleteIds = new Set(toDelete.map((d) => d.id))
  const allSnap = await db.collection('auctions').select('images').get()
  const folderIdsStillInUse = new Set()
  allSnap.docs.forEach((d) => {
    if (toDeleteIds.has(d.id)) return
    const images = d.data().images || []
    images.forEach((url) => {
      const match = url.match(/auctions%2F([^%/]+)%2F/)
      if (match) folderIdsStillInUse.add(match[1])
    })
  })

  let skippedStorage = 0
  for (const docSnap of toDelete) {
    if (folderIdsStillInUse.has(docSnap.id)) {
      skippedStorage++
      console.log(`${docSnap.id}: otra subasta todavía usa esas fotos — no se borran de Storage.`)
      continue
    }
    try {
      await bucket.deleteFiles({ prefix: `auctions/${docSnap.id}/` })
    } catch (err) {
      console.error(`No se pudieron borrar las fotos de ${docSnap.id}:`, err)
    }
  }

  const batch = db.batch()
  toDelete.forEach((docSnap) => batch.delete(docSnap.ref))
  await batch.commit()

  console.log(
    `Borré ${toDelete.length} subasta(s) cerrada(s) sin venta de hace más de ${CLEANUP_AFTER_DAYS} días` +
      (skippedStorage > 0 ? ` (${skippedStorage} sin tocar sus fotos, por seguir en uso).` : '.'),
  )
})

/**
 * Cada vez que alguna de las partes marca su propia confirmación o reporte
 * de problema (el cliente solo puede tocar sus propios campos, ver
 * firestore.rules), esta función recalcula el estado general del handshake:
 * - Si cualquiera de los dos reportó un problema → 'disputed'.
 * - Si ambos confirmaron → 'completed'.
 * - Si no → sigue 'pending'.
 * El cliente nunca escribe dealStatus directamente, solo esta función.
 */
exports.recomputeDealStatus = onDocumentUpdated(
  'auctions/{auctionId}/contact/{docId}',
  async (event) => {
    const after = event.data.after.data()
    if (!after) return

    const sellerReported = !!after.sellerReportedProblem
    const winnerReported = !!after.winnerReportedProblem
    const sellerConfirmed = !!after.sellerConfirmed
    const winnerConfirmed = !!after.winnerConfirmed

    let newStatus = 'pending'
    if (sellerReported || winnerReported) {
      newStatus = 'disputed'
    } else if (sellerConfirmed && winnerConfirmed) {
      newStatus = 'completed'
    }

    if (after.dealStatus !== newStatus) {
      await event.data.after.ref.update({ dealStatus: newStatus })

      // Reputación (ver getReputationScore en src/lib/users.js): solo al
      // transitar A 'completed' (nunca si ya estaba 'completed' y se
      // recalcula de nuevo), para no sumar puntos dos veces. Vendedor pesa
      // más que pujador porque concretar una venta implica más compromiso
      // real (fotos, entrega) que solo pagar una puja ganada.
      if (newStatus === 'completed' && after.sellerId && after.winnerId) {
        const inc = FieldValue.increment
        await Promise.all([
          db.collection('users').doc(after.sellerId).set(
            { repNumerator: inc(5 * 1.0), repDenominator: inc(1.0), repOpsCount: inc(1) },
            { merge: true },
          ),
          db.collection('users').doc(after.winnerId).set(
            { repNumerator: inc(5 * 0.2), repDenominator: inc(0.2), repOpsCount: inc(1) },
            { merge: true },
          ),
        ])
      }
    }
  },
)

/**
 * Genera avisos persistentes (colección `notifications`) cada vez que pasa
 * algo relevante en una subasta — corre en el servidor, así que funciona
 * aunque nadie tenga la página abierta en ese momento (a diferencia de un
 * aviso puramente del lado del cliente, que solo funciona si estás
 * navegando el sitio justo cuando pasa):
 *  - Te superaron la puja (si tenías el aviso activado).
 *  - Cancelaron una subasta en la que pujaste.
 *  - Terminó tu subasta (a vos, el vendedor) — con quién ganó.
 *  - Ganaste una subasta.
 * El cliente se suscribe a sus propios avisos no leídos (ver
 * src/lib/notifications.js) — no hay envío por WhatsApp todavía (ver
 * COMO-FUNCIONA.md), esto vive solo dentro de la app.
 */
exports.notifyOnAuctionChange = onDocumentUpdated('auctions/{auctionId}', async (event) => {
  const auctionId = event.params.auctionId
  const before = event.data.before.data()
  const after = event.data.after.data()
  if (!before || !after) return

  const notifications = []

  // Te superaron: cambió quién va ganando, el anterior quería aviso, y la
  // subasta sigue activa (no es un cierre).
  if (
    before.currentBidderId &&
    before.currentBidderId !== after.currentBidderId &&
    before.currentBidderWantsNotify &&
    after.status === 'active'
  ) {
    notifications.push({
      userId: before.currentBidderId,
      type: 'outbid',
      auctionId,
      auctionTitle: after.title || null,
      message: `Te están ganando la subasta de ${after.title}`,
    })
  }

  // Cancelada por el vendedor: avisar a todos los que pujaron ahí, no solo
  // a quien iba ganando en ese momento.
  if (before.status === 'active' && after.status === 'cancelled_by_seller') {
    const bidsSnap = await db.collection('bids').where('auctionId', '==', auctionId).get()
    const bidderIds = new Set(bidsSnap.docs.map((d) => d.data().userId).filter(Boolean))
    for (const uid of bidderIds) {
      notifications.push({
        userId: uid,
        type: 'cancelled',
        auctionId,
        auctionTitle: after.title || null,
        message: `El vendedor canceló la subasta de ${after.title}`,
      })
    }
  }

  // Terminó normalmente (closeExpiredAuctions la pasó a 'ended'): avisar
  // al vendedor (con quién ganó, o que no hubo pujas) y al ganador.
  if (before.status === 'active' && after.status === 'ended') {
    if (after.sellerId) {
      notifications.push({
        userId: after.sellerId,
        type: 'auction_ended_seller',
        auctionId,
        auctionTitle: after.title || null,
        message: after.winnerId
          ? `Tu subasta de ${after.title} terminó — ganó ${after.winnerName || 'un comprador'}`
          : `Tu subasta de ${after.title} terminó sin pujas`,
      })
    }
    if (after.winnerId) {
      notifications.push({
        userId: after.winnerId,
        type: 'auction_won',
        auctionId,
        auctionTitle: after.title || null,
        message: `¡Ganaste la subasta de ${after.title}!`,
      })
    }
  }

  if (notifications.length === 0) return

  const batch = db.batch()
  for (const n of notifications) {
    const ref = db.collection('notifications').doc()
    batch.set(ref, { ...n, read: false, createdAt: Timestamp.now() })
  }
  await batch.commit()
})

const PLAN_PRIORITY = { free: 0, pro: 1, unlimited: 2 }

/** Medianoche del día 1 de un mes, N meses atrás, en huso Argentina (UTC-3 fijo). */
function startOfMonthInArgentina(monthsAgo) {
  const now = new Date()
  const shifted = new Date(now.getTime() - 3 * 60 * 60 * 1000)
  const y = shifted.getUTCFullYear()
  const m = shifted.getUTCMonth() - monthsAgo
  const startShifted = Date.UTC(y, m, 1, 0, 0, 0)
  return new Date(startShifted + 3 * 60 * 60 * 1000)
}

/** Devuelve los sellerId distintos que publicaron con ese plan en el rango dado. */
async function distinctSellers(planKey, startTs, endTs) {
  const snap = await db
    .collection('auctions')
    .where('sellerPlan', '==', planKey)
    .where('createdAt', '>=', startTs)
    .where('createdAt', '<', endTs)
    .get()
  const ids = new Set()
  snap.docs.forEach((d) => {
    const sellerId = d.data().sellerId
    if (sellerId) ids.add(sellerId)
  })
  return [...ids]
}

/** Le da un plan a alguien SIN bajarlo nunca de categoría; si ya lo tiene, solo extiende 1 mes. */
async function grantPlanNeverDowngrade(uid, planKey) {
  const userRef = db.collection('users').doc(uid)
  const snap = await userRef.get()
  const current = snap.exists ? snap.data() : {}
  const currentPriority = PLAN_PRIORITY[current.plan] ?? 0
  const targetPriority = PLAN_PRIORITY[planKey] ?? 0

  if (targetPriority > currentPriority) {
    const expires = new Date()
    expires.setMonth(expires.getMonth() + 1)
    await userRef.set(
      { plan: planKey, planExpiresAt: Timestamp.fromDate(expires), planGrantedVia: 'raffle' },
      { merge: true },
    )
  } else {
    // ya tiene ese plan o uno mejor: no lo tocamos de categoría, solo le sumamos 1 mes de margen.
    const currentExpiry =
      current.planExpiresAt && current.planExpiresAt.toDate ? current.planExpiresAt.toDate() : new Date()
    const base = currentExpiry > new Date() ? currentExpiry : new Date()
    const extended = new Date(base)
    extended.setMonth(extended.getMonth() + 1)
    await userRef.set({ planExpiresAt: Timestamp.fromDate(extended) }, { merge: true })
  }
}

/**
 * Sorteo mensual automático. Corre el día 1 de cada mes (6am UTC = 3am
 * Argentina) y mira las subastas publicadas durante el mes anterior:
 * - Entre quienes publicaron siendo 'free' (Chusma), sortea 1 mes de
 *   Informante.
 * - Entre quienes publicaron siendo 'pro' (Informante), sortea 1 mes de
 *   Intel de Pícaros — pero SOLO si hubo 30 o más personas distintas.
 * Queda un registro en raffles/{AAAA-MM} con cuántos candidatos hubo y
 * quién ganó, para poder mostrarlo después si se quiere.
 */
exports.monthlyRaffle = onSchedule(
  { schedule: '0 6 1 * *', timeZone: 'Etc/UTC' },
  async () => {
    const start = startOfMonthInArgentina(1) // 1° del mes pasado
    const end = startOfMonthInArgentina(0) // 1° de este mes (límite exclusivo)
    const startTs = Timestamp.fromDate(start)
    const endTs = Timestamp.fromDate(end)

    const freeSellers = await distinctSellers('free', startTs, endTs)
    let freeWinner = null
    let freeWinnerName = null
    if (freeSellers.length > 0) {
      freeWinner = freeSellers[Math.floor(Math.random() * freeSellers.length)]
      await grantPlanNeverDowngrade(freeWinner, 'pro')
      const winnerSnap = await db.collection('users').doc(freeWinner).get()
      freeWinnerName = winnerSnap.exists ? winnerSnap.data().displayName || null : null
    }

    const proSellers = await distinctSellers('pro', startTs, endTs)
    let proWinner = null
    let proWinnerName = null
    if (proSellers.length >= 30) {
      proWinner = proSellers[Math.floor(Math.random() * proSellers.length)]
      await grantPlanNeverDowngrade(proWinner, 'unlimited')
      const winnerSnap = await db.collection('users').doc(proWinner).get()
      proWinnerName = winnerSnap.exists ? winnerSnap.data().displayName || null : null
    }

    const periodKey = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`
    await db.collection('raffles').doc(periodKey).set({
      periodStart: startTs,
      periodEnd: endTs,
      freeCandidates: freeSellers.length,
      freeWinnerId: freeWinner,
      freeWinnerName,
      proCandidates: proSellers.length,
      proWinnerId: proWinner,
      proWinnerName,
      proRaffleHeld: proSellers.length >= 30,
      ranAt: Timestamp.now(),
    })

    console.log(
      `Sorteo ${periodKey}: Chusma→Informante entre ${freeSellers.length} candidato(s), ganó ${freeWinner || 'nadie (sin candidatos)'}. ` +
        `Informante→Intel entre ${proSellers.length} candidato(s) (necesita 30+), ${
          proSellers.length >= 30 ? `ganó ${proWinner}` : 'no se hizo por falta de candidatos'
        }.`,
    )
  },
)

// Umbrales de SafeSearch que consideramos "marcar para revisión". LIKELY y
// VERY_LIKELY son los dos niveles más altos que devuelve Cloud Vision
// (los otros son UNKNOWN, VERY_UNLIKELY, UNLIKELY, POSSIBLE).
const SAFE_SEARCH_FLAG_LEVELS = new Set(['LIKELY', 'VERY_LIKELY'])

// Etiquetas de Cloud Vision típicas de una foto de una persona (selfie,
// retrato, etc.) en vez de un objeto — para agarrar casos como el de una
// foto de perfil subida por error en vez de una foto de la carta. No es
// prueba de que SÍ sea una carta (eso es mucho más difícil de detectar
// con certeza) — solo un indicio de que probablemente NO lo sea.
const PERSON_LABELS = new Set([
  'person', 'face', 'head', 'selfie', 'human', 'portrait', 'skin',
  'forehead', 'chin', 'smile', 'hair', 'eyebrow', 'nose', 'cheek',
])

/**
 * Se dispara con cada foto nueva subida a Storage, mientras la subasta
 * está "en revisión" (status: 'pending_review', ver createAuction). Le
 * pasa la imagen a Cloud Vision (SafeSearch + detección de etiquetas):
 *
 *  - Si todas las fotos de la subasta salen limpias, la pasa sola a
 *    'active' — normalmente tarda solo unos segundos, así que el
 *    vendedor casi no nota la espera.
 *  - Si alguna foto parece rara (contenido inapropiado, o pinta de ser la
 *    foto de una persona en vez de un objeto), la subasta se queda en
 *    revisión y además se crea un registro en `photoFlags` para que
 *    Susurro o las Arañas la aprueben o la rechacen a mano en /admin.
 *
 * Nunca decide "esto es una carta" con certeza (eso es mucho más difícil
 * de detectar) — solo filtra los casos más obvios de que NO lo es.
 */
exports.checkAuctionPhoto = onObjectFinalized({ region: 'us-east1' }, async (event) => {
  const filePath = event.data.name || ''
  const contentType = event.data.contentType || ''
  const match = filePath.match(/^auctions\/([^/]+)\//)
  if (!contentType.startsWith('image/') || !match) return // no es una foto de subasta

  const auctionId = match[1]
  const gcsUri = `gs://${event.data.bucket}/${filePath}`

  let result
  let analysisFailed = false
  try {
    ;[result] = await visionClient.annotateImage({
      image: { source: { imageUri: gcsUri } },
      features: [{ type: 'SAFE_SEARCH_DETECTION' }, { type: 'LABEL_DETECTION', maxResults: 10 }],
    })
  } catch (err) {
    // Si Cloud Vision falla (API caída, etc.), no dejamos la subasta
    // trabada en revisión para siempre — se cuenta como "chequeada" pero
    // sin poder confirmar que está limpia, así que no se auto-activa;
    // queda para que Susurro/Araña la mire a mano.
    console.error(`No se pudo analizar la foto de la subasta ${auctionId} (${filePath}):`, err)
    analysisFailed = true
  }

  const safe = analysisFailed ? {} : result.safeSearchAnnotation || {}
  const labels = analysisFailed ? [] : (result.labelAnnotations || []).map((l) => l.description)
  const labelsLower = labels.map((l) => l.toLowerCase())

  const flaggedSafeSearch = ['adult', 'violence', 'racy'].filter((k) => SAFE_SEARCH_FLAG_LEVELS.has(safe[k]))
  const personLabelsFound = labelsLower.filter((l) => PERSON_LABELS.has(l))

  const reasons = []
  if (analysisFailed) {
    reasons.push('No se pudo analizar automáticamente esta foto')
  }
  if (flaggedSafeSearch.length > 0) {
    reasons.push(`Contenido posiblemente inapropiado (${flaggedSafeSearch.join(', ')})`)
  }
  if (personLabelsFound.length >= 2) {
    reasons.push(`Parece la foto de una persona, no de un objeto (${personLabelsFound.join(', ')})`)
  }

  const auctionRef = db.collection('auctions').doc(auctionId)
  let shouldCreateFlag = false
  let auctionForFlag = null

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(auctionRef)
    if (!snap.exists) return
    const auction = snap.data()
    // Si ya salió de "en revisión" (la aprobaron/rechazaron a mano, la
    // cancelaron, etc.), no tocamos nada más.
    if (auction.status !== 'pending_review') return

    const photosChecked = (auction.photosChecked || 0) + 1
    const hasFlaggedPhoto = !!auction.hasFlaggedPhoto || reasons.length > 0
    const photosTotal = auction.photosTotal || 1

    const update = { photosChecked, hasFlaggedPhoto }
    if (photosChecked >= photosTotal && !hasFlaggedPhoto) {
      update.status = 'active' // todas las fotos salieron limpias
    }
    tx.update(auctionRef, update)

    if (reasons.length > 0) {
      shouldCreateFlag = true
      auctionForFlag = auction
    }
  })

  if (!shouldCreateFlag) return

  // URL pública de la foto — el bucket permite lectura pública para
  // auctions/{id}/* (ver storage.rules), así que no hace falta token.
  const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${event.data.bucket}/o/${encodeURIComponent(filePath)}?alt=media`

  await db.collection('photoFlags').add({
    auctionId,
    auctionTitle: auctionForFlag.title || null,
    sellerId: auctionForFlag.sellerId || null,
    imagePath: filePath,
    imageUrl,
    reasons,
    labels,
    safeSearch: safe,
    status: 'open',
    createdAt: Timestamp.now(),
  })

  console.log(`Foto marcada para revisión (${filePath}): ${reasons.join(' | ')}`)
})

/**
 * Avisa en el canal de Telegram "El Tablón de TBMC" (@tablontbmc, posteado
 * por el bot "El Rumor") cada vez que una subasta recién publicada termina
 * de pasar el chequeo de fotos y queda 'active' — sea automático (Cloud
 * Vision, ver checkAuctionPhoto) o aprobada a mano por Susurro/Araña
 * (approvePendingAuction). Solo mira la transición 'pending_review' →
 * 'active', a propósito: así NO avisa de nuevo cuando se "Republica" una
 * subasta vieja ('ended' → 'active'), que no es una publicación nueva de
 * verdad — evita mandar 14 avisos seguidos si alguien republica una tanda.
 */
exports.notifyTelegramOnNewAuction = onDocumentUpdated(
  { document: 'auctions/{auctionId}', secrets: [TELEGRAM_BOT_TOKEN, DISCORD_WEBHOOK_URL] },
  async (event) => {
    const before = event.data.before.data()
    const after = event.data.after.data()
    if (!before || !after) return
    if (before.status !== 'pending_review' || after.status !== 'active') return

    const price = after.currentPrice ?? after.startingPrice ?? 0
    const link = `${SITE_URL}/subasta/${event.params.auctionId}`
    const text = `🆕 Nuevo en El Tablón\n\n${after.title}\n💰 $${Number(price).toLocaleString('es-AR')}\n\n${link}`

    const [telegramResult, discordResult] = await Promise.allSettled([
      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN.value()}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHANNEL, text }),
      }),
      fetch(DISCORD_WEBHOOK_URL.value(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, username: 'El Rumor' }),
      }),
    ])

    if (telegramResult.status === 'rejected' || !telegramResult.value?.ok) {
      console.error('No se pudo avisar por Telegram:', telegramResult.reason || telegramResult.value?.status)
    }
    if (discordResult.status === 'rejected' || !discordResult.value?.ok) {
      console.error('No se pudo avisar por Discord:', discordResult.reason || discordResult.value?.status)
    }
  },
)

/**
 * API pública de solo lectura: nombre y precio actual de las subastas
 * activas, en JSON — pensada para que otro sitio pueda mostrar/enlazar
 * las cartas en venta sin tener que meterse a leer Firestore directo.
 * Es de lectura abierta a propósito, a diferencia del resto de las
 * Cloud Functions de este proyecto: no expone nada que no se vea ya en
 * el home público (título y precio), así que no hace falta autenticación
 * para esta primera versión — si en algún momento hiciera falta limitar
 * quién la usa, se puede sumar una clave simple por query param.
 */
exports.publicAuctionsFeed = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET')
    res.status(204).send('')
    return
  }

  try {
    const snap = await db.collection('auctions').where('status', '==', 'active').get()
    const auctions = snap.docs.map((d) => ({
      title: d.data().title || null,
      price: d.data().currentPrice ?? null,
    }))
    res.set('Cache-Control', 'public, max-age=60') // evita pegarle a Firestore en cada refresh de quien la consuma
    res.status(200).json({ auctions })
  } catch (err) {
    console.error('Error en publicAuctionsFeed:', err)
    res.status(500).json({ error: 'No se pudo obtener la lista de subastas.' })
  }
})

// Puntos que suma quien invitó, por evento — ver sección "Sorteo bounty" en
// COMO-FUNCIONA.md. Solo se acreditan mientras hay un sorteo bounty activo:
// no se acumulan para siempre, cada sorteo arranca de cero.
const REFERRAL_SIGNUP_POINTS = 1
const REFERRAL_FIRST_BID_POINTS = 2

/** Busca el sorteo bounty activo ahora mismo, o null si no hay ninguno. */
async function getActiveBountyRaffleId() {
  const snap = await db.collection('bountyRaffles').where('status', '==', 'active').limit(1).get()
  return snap.empty ? null : snap.docs[0].id
}

/**
 * Suma puntos al referente en bountyRaffles/{id}/entries/{referrerUid} —
 * subcolección aparte de la lista de usuarios, así que un usuario nunca
 * puede tocar sus propios puntos escribiendo directo a Firestore (ver
 * firestore.rules: esa subcolección es de solo lectura para el cliente).
 */
async function awardReferralPoints(referrerUid, points, referrerName) {
  const raffleId = await getActiveBountyRaffleId()
  if (!raffleId) return // no hay sorteo corriendo — no se acredita nada
  const entryRef = db.collection('bountyRaffles').doc(raffleId).collection('entries').doc(referrerUid)
  await entryRef.set(
    { points: FieldValue.increment(points), userName: referrerName || null },
    { merge: true },
  )
}

/**
 * Se dispara al crear cualquier cuenta nueva. Si vino invitada (campo
 * `referredBy`, cargado una sola vez por el propio cliente al crearse el
 * documento — ver upsertUserProfile en src/lib/users.js), le suma puntos
 * de sorteo a quien la invitó.
 */
exports.awardReferralSignupBonus = onDocumentCreated('users/{uid}', async (event) => {
  const newUser = event.data.data()
  const referrerUid = newUser.referredBy
  if (!referrerUid || referrerUid === event.params.uid) return // no autoinvitarse

  const referrerSnap = await db.collection('users').doc(referrerUid).get()
  if (!referrerSnap.exists) return

  await awardReferralPoints(referrerUid, REFERRAL_SIGNUP_POINTS, referrerSnap.data().displayName)
})

/**
 * Se dispara con cada puja nueva. Además de marcar `hasBid: true` en el
 * perfil de quien pujó (usado para el contador de "gente pujando" en
 * /admin), si es su PRIMERA puja de siempre y vino invitada, le suma
 * puntos extra a quien la invitó — bonus más grande que el de registrarse
 * solo, para premiar más a quien trae gente que realmente participa.
 */
exports.awardReferralBidBonus = onDocumentCreated('bids/{bidId}', async (event) => {
  const bid = event.data.data()
  const bidderId = bid.userId
  if (!bidderId) return

  const bidderRef = db.collection('users').doc(bidderId)

  const { isFirstBid, referrerUid } = await db.runTransaction(async (tx) => {
    const snap = await tx.get(bidderRef)
    if (!snap.exists) return { isFirstBid: false, referrerUid: null }
    const data = snap.data()
    if (data.hasBid) return { isFirstBid: false, referrerUid: null }
    tx.update(bidderRef, { hasBid: true })
    return { isFirstBid: true, referrerUid: data.referredBy || null }
  })

  if (!isFirstBid || !referrerUid) return

  const referrerSnap = await db.collection('users').doc(referrerUid).get()
  if (!referrerSnap.exists) return

  await awardReferralPoints(referrerUid, REFERRAL_FIRST_BID_POINTS, referrerSnap.data().displayName)
})
