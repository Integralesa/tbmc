import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  approvePendingAuction,
  approvePlanRequest,
  banUser,
  closeAuctionByAdmin,
  deleteAuctionByAdmin,
  findAuctionsBySeller,
  findUserByEmail,
  rejectPlanRequest,
  setUserPlan,
  setUserRole,
  unbanUser,
  addStrike,
  deleteUserDoc,
  findAnonymousTestUsers,
} from '../lib/admin'
import { isArana, isStaff, isSusurro } from '../lib/roles'
import { subscribeToPendingPlanRequests } from '../lib/planRequests'
import { markProblemReportReviewed, subscribeToOpenProblemReports } from '../lib/problemReports'
import { markAuctionEditReviewed, subscribeToOpenAuctionEdits } from '../lib/auctionEdits'
import { markContactMessageReviewed, subscribeToOpenContactMessages } from '../lib/contactMessages'
import { markPhotoFlagReviewed, subscribeToOpenPhotoFlags } from '../lib/photoFlags'
import { approveShopSuggestion, rejectShopSuggestion, subscribeToOpenShopSuggestions } from '../lib/cardShops'
import { getRecentUsers, isUserBanned } from '../lib/users'
import { PLANS } from '../lib/plans'
import {
  activateBountyRaffle,
  createBountyDraft,
  drawBountyWinner,
  getDistinctBidderCount,
  subscribeToAllBountyRaffles,
} from '../lib/bountyRaffles'
import { setOrderStatus, subscribeToAllOrders } from '../lib/workbench'

export default function Admin() {
  const { user, profile } = useAuth()
  const [email, setEmail] = useState('')
  const [result, setResult] = useState(null)
  const [searching, setSearching] = useState(false)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [sellerAuctions, setSellerAuctions] = useState(null)
  const [loadingAuctions, setLoadingAuctions] = useState(false)
  const [closingId, setClosingId] = useState(null)
  const [closeReason, setCloseReason] = useState('')

  const [pendingRequests, setPendingRequests] = useState(null)
  const [reviewingId, setReviewingId] = useState(null)

  const [problemReports, setProblemReports] = useState(null)
  const [resolvingReportId, setResolvingReportId] = useState(null)

  const [auctionEdits, setAuctionEdits] = useState(null)
  const [resolvingEditId, setResolvingEditId] = useState(null)

  const [contactMessages, setContactMessages] = useState(null)
  const [resolvingMessageId, setResolvingMessageId] = useState(null)

  const [photoFlags, setPhotoFlags] = useState(null)
  const [resolvingFlagId, setResolvingFlagId] = useState(null)

  const [shopSuggestions, setShopSuggestions] = useState(null)
  const [resolvingShopId, setResolvingShopId] = useState(null)

  const [recentUsers, setRecentUsers] = useState(null)
  const [loadingRecentUsers, setLoadingRecentUsers] = useState(false)

  const [testUsers, setTestUsers] = useState(null)
  const [loadingTestUsers, setLoadingTestUsers] = useState(false)
  const [deletingTestUsers, setDeletingTestUsers] = useState(false)

  const [workbenchOrders, setWorkbenchOrders] = useState(null)
  const [resolvingOrderId, setResolvingOrderId] = useState(null)

  const [bountyRaffles, setBountyRaffles] = useState(null)
  const [bountyTitle, setBountyTitle] = useState('')
  const [bountyImage, setBountyImage] = useState(null)
  const [creatingBounty, setCreatingBounty] = useState(false)
  const [bountyActionId, setBountyActionId] = useState(null)
  const [distinctBidders, setDistinctBidders] = useState(null)

  const susurro = isSusurro(user)
  const staff = isStaff(user, profile)

  useEffect(() => {
    if (!susurro) return
    const unsub = subscribeToPendingPlanRequests(setPendingRequests)
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [susurro])

  useEffect(() => {
    if (!staff) return
    const unsub = subscribeToOpenProblemReports(setProblemReports)
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff])

  useEffect(() => {
    if (!staff) return
    const unsub = subscribeToOpenAuctionEdits(setAuctionEdits)
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff])

  useEffect(() => {
    if (!staff) return
    const unsub = subscribeToOpenContactMessages(setContactMessages)
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff])

  useEffect(() => {
    if (!staff) return
    const unsub = subscribeToOpenPhotoFlags(setPhotoFlags)
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff])

  useEffect(() => {
    if (!staff) return
    const unsub = subscribeToOpenShopSuggestions(setShopSuggestions)
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff])

  async function loadRecentUsers() {
    setLoadingRecentUsers(true)
    try {
      setRecentUsers(await getRecentUsers(10))
    } catch (err) {
      setError(err.message || 'No se pudieron cargar los últimos usuarios.')
    } finally {
      setLoadingRecentUsers(false)
    }
  }

  useEffect(() => {
    if (!staff) return
    loadRecentUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff])

  async function loadTestUsers() {
    setLoadingTestUsers(true)
    try {
      setTestUsers(await findAnonymousTestUsers())
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las cuentas de prueba.')
    } finally {
      setLoadingTestUsers(false)
    }
  }

  useEffect(() => {
    if (!susurro) return
    loadTestUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [susurro])

  // Borra de a una (no en paralelo) para no pegarle 100 escrituras juntas
  // a Firestore si alguna vez se junta un lote grande de testing. También
  // borra cualquier subasta que haya quedado publicada por esas cuentas
  // (ej: pruebas de Playwright que publicaron algo y quedó atascado en
  // "en revisión" para siempre) — esas no aparecen en el buscador normal
  // porque es por email, y las cuentas de prueba no tienen.
  async function handleDeleteTestUsers() {
    if (!testUsers || testUsers.length === 0) return
    if (!window.confirm(`¿Borrar ${testUsers.length} cuenta(s) de prueba sin email (y sus subastas, si publicaron algo)?`)) return
    setDeletingTestUsers(true)
    setError('')
    setMessage('')
    let deletedAuctions = 0
    try {
      for (const u of testUsers) {
        const theirAuctions = await findAuctionsBySeller(u.id)
        for (const a of theirAuctions) {
          await deleteAuctionByAdmin(a.id)
          deletedAuctions++
        }
        await deleteUserDoc(u.id)
      }
      setMessage(`Borradas ${testUsers.length} cuenta(s) de prueba${deletedAuctions > 0 ? ` y ${deletedAuctions} subasta(s) suya(s)` : ''}.`)
      setTestUsers([])
    } catch (err) {
      setError(err.message || 'No se pudieron borrar todas — probá de nuevo.')
      loadTestUsers()
    } finally {
      setDeletingTestUsers(false)
    }
  }

  useEffect(() => {
    if (!susurro) return
    const unsub = subscribeToAllOrders(setWorkbenchOrders)
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [susurro])

  useEffect(() => {
    if (!susurro) return
    const unsub = subscribeToAllBountyRaffles(setBountyRaffles)
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [susurro])

  useEffect(() => {
    if (!susurro) return
    getDistinctBidderCount().then(setDistinctBidders).catch(() => {})
  }, [susurro])

  async function handleCreateBounty(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setCreatingBounty(true)
    try {
      await createBountyDraft({ title: bountyTitle, imageFile: bountyImage, user })
      setBountyTitle('')
      setBountyImage(null)
      setMessage('Sorteo creado en borrador — todavía no aparece en el home.')
    } catch (err) {
      setError(err.message || 'No se pudo crear el sorteo.')
    } finally {
      setCreatingBounty(false)
    }
  }

  async function handleActivateBounty(raffleId) {
    setBountyActionId(raffleId)
    setError('')
    setMessage('')
    try {
      await activateBountyRaffle(raffleId)
      setMessage('Sorteo activado — ya aparece en el home.')
    } catch (err) {
      setError(err.message || 'No se pudo activar el sorteo.')
    } finally {
      setBountyActionId(null)
    }
  }

  async function handleDrawBounty(raffleId) {
    setBountyActionId(raffleId)
    setError('')
    setMessage('')
    try {
      const winner = await drawBountyWinner(raffleId)
      setMessage(`Ganó ${winner.name}.`)
    } catch (err) {
      setError(err.message || 'No se pudo sortear el ganador.')
    } finally {
      setBountyActionId(null)
    }
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <p className="text-parchment">Iniciá sesión para entrar acá.</p>
      </div>
    )
  }

  if (!staff) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <p className="text-parchment">No tenés acceso a esta página.</p>
      </div>
    )
  }

  async function handleApproveRequest(request) {
    setReviewingId(request.id)
    setError('')
    try {
      await approvePlanRequest(request)
    } catch (err) {
      setError(err.message || 'No se pudo aprobar la solicitud.')
    } finally {
      setReviewingId(null)
    }
  }

  async function handleRejectRequest(requestId) {
    setReviewingId(requestId)
    setError('')
    try {
      await rejectPlanRequest(requestId)
    } catch (err) {
      setError(err.message || 'No se pudo rechazar la solicitud.')
    } finally {
      setReviewingId(null)
    }
  }

  async function handleMarkReviewed(reportId) {
    setResolvingReportId(reportId)
    setError('')
    try {
      await markProblemReportReviewed(reportId)
    } catch (err) {
      setError(err.message || 'No se pudo marcar como visto.')
    } finally {
      setResolvingReportId(null)
    }
  }

  async function handleMarkEditReviewed(editId) {
    setResolvingEditId(editId)
    setError('')
    try {
      await markAuctionEditReviewed(editId)
    } catch (err) {
      setError(err.message || 'No se pudo marcar como visto.')
    } finally {
      setResolvingEditId(null)
    }
  }

  async function handleMarkMessageReviewed(messageId) {
    setResolvingMessageId(messageId)
    setError('')
    try {
      await markContactMessageReviewed(messageId)
    } catch (err) {
      setError(err.message || 'No se pudo marcar como visto.')
    } finally {
      setResolvingMessageId(null)
    }
  }

  async function handleApproveFlaggedAuction(flag) {
    setResolvingFlagId(flag.id)
    setError('')
    try {
      await approvePendingAuction(flag.auctionId)
      await markPhotoFlagReviewed(flag.id)
    } catch (err) {
      setError(err.message || 'No se pudo aprobar la subasta.')
    } finally {
      setResolvingFlagId(null)
    }
  }

  async function handleRejectFlaggedAuction(flag) {
    setResolvingFlagId(flag.id)
    setError('')
    try {
      await closeAuctionByAdmin(flag.auctionId, 'Foto no corresponde a una carta (marcada por Cloud Vision)')
      await markPhotoFlagReviewed(flag.id)
    } catch (err) {
      setError(err.message || 'No se pudo rechazar la subasta.')
    } finally {
      setResolvingFlagId(null)
    }
  }

  async function handleApproveShop(suggestion) {
    setResolvingShopId(suggestion.id)
    setError('')
    try {
      await approveShopSuggestion(suggestion)
    } catch (err) {
      setError(err.message || 'No se pudo aprobar el local.')
    } finally {
      setResolvingShopId(null)
    }
  }

  async function handleRejectShop(suggestionId) {
    setResolvingShopId(suggestionId)
    setError('')
    try {
      await rejectShopSuggestion(suggestionId)
    } catch (err) {
      setError(err.message || 'No se pudo rechazar la sugerencia.')
    } finally {
      setResolvingShopId(null)
    }
  }

  async function handleStrike(reportId, uid, roleLabel, role) {
    if (!uid) {
      setError('No tengo el ID de esa persona (subasta muy vieja). Buscala a mano por email.')
      return
    }
    setResolvingReportId(reportId)
    setError('')
    setMessage('')
    try {
      const total = await addStrike(uid, role)
      await markProblemReportReviewed(reportId)
      setMessage(`Incumplimiento sumado a ${roleLabel} (van ${total}).`)
    } catch (err) {
      setError(err.message || 'No se pudo sumar el incumplimiento.')
    } finally {
      setResolvingReportId(null)
    }
  }

  async function handleSetOrderStatus(orderId, status) {
    setResolvingOrderId(orderId)
    setError('')
    try {
      await setOrderStatus(orderId, status)
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el pedido.')
    } finally {
      setResolvingOrderId(null)
    }
  }

  async function handleSearch(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setResult(null)
    setSellerAuctions(null)
    setSearching(true)
    try {
      const found = await findUserByEmail(email)
      if (!found) {
        setError('No se encontró ningún usuario con ese email — tiene que haber iniciado sesión al menos una vez en la app.')
      } else {
        setResult(found)
      }
    } catch (err) {
      setError(err.message || 'Error al buscar.')
    } finally {
      setSearching(false)
    }
  }

  function handleViewRecentUser(u) {
    setError('')
    setMessage('')
    setSellerAuctions(null)
    setEmail(u.email || '')
    setResult(u)
  }

  async function handleSetPlan(planKey) {
    setActing(true)
    setError('')
    setMessage('')
    try {
      await setUserPlan(result.id, planKey)
      setResult((r) => ({ ...r, plan: planKey }))
      setMessage(`Listo — plan actualizado a "${PLANS[planKey]?.label || planKey}".`)
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el plan.')
    } finally {
      setActing(false)
    }
  }

  async function handleToggleArana() {
    setActing(true)
    setError('')
    setMessage('')
    try {
      const nextRole = isArana(result) ? null : 'arana'
      await setUserRole(result.id, nextRole)
      setResult((r) => ({ ...r, role: nextRole }))
      setMessage(nextRole ? 'Ahora es Araña 🕷️' : 'Ya no es Araña.')
    } catch (err) {
      setError(err.message || 'No se pudo actualizar el rol.')
    } finally {
      setActing(false)
    }
  }

  async function handleBan(durationDays, label) {
    setActing(true)
    setError('')
    setMessage('')
    try {
      await banUser(result.id, durationDays)
      setResult((r) => ({
        ...r,
        banned: true,
        bannedUntil: durationDays ? { toDate: () => new Date(Date.now() + durationDays * 86400000) } : null,
      }))
      setMessage(`Cuenta suspendida (${label}).`)
    } catch (err) {
      setError(err.message || 'No se pudo suspender la cuenta.')
    } finally {
      setActing(false)
    }
  }

  async function handleUnban() {
    setActing(true)
    setError('')
    setMessage('')
    try {
      await unbanUser(result.id)
      setResult((r) => ({ ...r, banned: false, bannedUntil: null }))
      setMessage('Suspensión levantada.')
    } catch (err) {
      setError(err.message || 'No se pudo levantar la suspensión.')
    } finally {
      setActing(false)
    }
  }

  async function handleLoadAuctions() {
    setLoadingAuctions(true)
    setError('')
    try {
      const auctions = await findAuctionsBySeller(result.id)
      setSellerAuctions(auctions)
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las subastas.')
    } finally {
      setLoadingAuctions(false)
    }
  }

  async function handleCloseAuction(auctionId) {
    setActing(true)
    setError('')
    setMessage('')
    try {
      await closeAuctionByAdmin(auctionId, closeReason)
      setSellerAuctions((list) =>
        list.map((a) =>
          a.id === auctionId
            ? { ...a, status: 'closed_by_admin', adminCloseReason: closeReason || null }
            : a,
        ),
      )
      setClosingId(null)
      setCloseReason('')
      setMessage('Subasta cerrada.')
    } catch (err) {
      setError(err.message || 'No se pudo cerrar la subasta.')
    } finally {
      setActing(false)
    }
  }

  async function handleDeleteAuction(auctionId, title) {
    if (!window.confirm(`¿Borrar "${title}" definitivamente? No se puede deshacer.`)) return
    setActing(true)
    setError('')
    setMessage('')
    try {
      await deleteAuctionByAdmin(auctionId)
      setSellerAuctions((list) => list.filter((a) => a.id !== auctionId))
      setMessage('Subasta borrada.')
    } catch (err) {
      setError(err.message || 'No se pudo borrar la subasta.')
    } finally {
      setActing(false)
    }
  }

  const currentPlan = PLANS[result?.plan] || PLANS.free

  // Reglas de a quién se puede suspender: nadie se suspende a sí mismo;
  // nadie (ni Susurro) suspende a Susurro; y una Araña no puede suspender
  // a otra Araña — solo Susurro puede.
  const targetIsSelf = result?.id === user.uid
  const targetIsSusurro = result ? isSusurro(result) : false
  const targetIsArana = result ? isArana(result) : false
  const canBanTarget = result && !targetIsSelf && !targetIsSusurro && (susurro || !targetIsArana)

  return (
    <div className="max-w-lg mx-auto px-6 py-10">
      <h1 className="font-serif text-3xl text-parchment mb-1">Administración</h1>
      <p className="text-muted text-sm mb-1">Buscá a alguien por email.</p>
      <p className="text-[11px] text-brass mb-6">
        {susurro ? 'Entraste como Susurro.' : 'Entraste como Araña 🕷️ (baneos y cierre de subastas).'}
      </p>

      {photoFlags && photoFlags.length > 0 && (
        <div className="border border-bidRed bg-panel p-4 mb-8">
          <p className="text-xs uppercase tracking-wide text-bidRed mb-3">
            📷 Fotos marcadas para revisión ({photoFlags.length})
          </p>
          <p className="text-[11px] text-muted mb-3">
            Estas subastas están retenidas, sin publicarse, hasta que las apruebes o las rechaces.
          </p>
          <ul className="space-y-4">
            {photoFlags.map((f) => (
              <li key={f.id} className="border border-panelLine p-3">
                <div className="flex gap-3">
                  {f.imageUrl && (
                    <img
                      src={f.imageUrl}
                      alt="Foto marcada"
                      className="w-20 h-20 object-cover border border-panelLine shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <a href={`/subasta/${f.auctionId}`} className="text-brass text-sm hover:underline">
                      {f.auctionTitle || 'Ver subasta'}
                    </a>
                    <ul className="text-parchment/85 text-xs mt-1 list-disc list-inside">
                      {(f.reasons || []).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => handleApproveFlaggedAuction(f)}
                    disabled={resolvingFlagId === f.id}
                    className="px-3 py-1.5 bg-brass text-ink text-xs font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
                  >
                    Aprobar y publicar
                  </button>
                  <button
                    onClick={() => handleRejectFlaggedAuction(f)}
                    disabled={resolvingFlagId === f.id}
                    className="px-3 py-1.5 bg-bidRed text-ink text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {problemReports && problemReports.length > 0 && (
        <div className="border border-bidRed bg-panel p-4 mb-8">
          <p className="text-xs uppercase tracking-wide text-bidRed mb-3">
            🚨 Problemas reportados ({problemReports.length})
          </p>
          <ul className="space-y-4">
            {problemReports.map((r) => {
              const otherRoleIsSeller = r.reportedRole === 'winner' // si reportó el ganador, el problema es con el vendedor
              const targetUid = otherRoleIsSeller ? r.sellerId : r.winnerId
              const targetLabel = otherRoleIsSeller ? 'vendedor' : 'comprador'
              const targetRole = otherRoleIsSeller ? 'seller' : 'bidder'
              return (
                <li key={r.id} className="border border-panelLine p-3">
                  <a
                    href={`/subasta/${r.auctionId}`}
                    className="text-brass text-sm hover:underline"
                  >
                    {r.auctionTitle || 'Ver subasta'}
                  </a>
                  <p className="text-muted text-xs mt-1">
                    Reportó {r.reportedRole === 'seller' ? 'el vendedor' : 'el comprador'}:{' '}
                    {r.reporterEmail}
                  </p>
                  <p className="text-parchment/85 text-sm mt-2 italic">"{r.reason}"</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={() => handleStrike(r.id, targetUid, targetLabel, targetRole)}
                      disabled={resolvingReportId === r.id}
                      className="px-3 py-1.5 bg-bidRed text-ink text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      Incumplimiento al {targetLabel}
                    </button>
                    <button
                      onClick={() => handleMarkReviewed(r.id)}
                      disabled={resolvingReportId === r.id}
                      className="px-3 py-1.5 border border-panelLine text-muted text-xs hover:text-parchment transition-colors disabled:opacity-50"
                    >
                      Marcar como visto (sin sanción)
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {auctionEdits && auctionEdits.length > 0 && (
        <div className="border border-brass bg-panel p-4 mb-8">
          <p className="text-xs uppercase tracking-wide text-brass mb-3">
            🔧 Modificaciones de subastas ({auctionEdits.length})
          </p>
          <ul className="space-y-4">
            {auctionEdits.map((e) => (
              <li key={e.id} className="border border-panelLine p-3">
                <a href={`/subasta/${e.auctionId}`} className="text-brass text-sm hover:underline">
                  {e.auctionTitle || 'Ver subasta'}
                </a>
                <p className="text-muted text-xs mt-1">
                  Editó {e.sellerName || 'el vendedor'} ({e.sellerEmail || 'sin email'})
                </p>
                {e.changes && (
                  <ul className="text-parchment/85 text-xs mt-2 space-y-1">
                    {Object.entries(e.changes)
                      .filter(([, { before, after }]) => JSON.stringify(before) !== JSON.stringify(after))
                      .map(([field, { before, after }]) => (
                        <li key={field}>
                          <span className="text-muted">{field}:</span>{' '}
                          <span className="line-through text-muted">{JSON.stringify(before)}</span>{' '}
                          → <span className="text-parchment">{JSON.stringify(after)}</span>
                        </li>
                      ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => handleMarkEditReviewed(e.id)}
                    disabled={resolvingEditId === e.id}
                    className="px-3 py-1.5 border border-panelLine text-muted text-xs hover:text-parchment transition-colors disabled:opacity-50"
                  >
                    Marcar como visto
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {contactMessages && contactMessages.length > 0 && (
        <div className="border border-brass bg-panel p-4 mb-8">
          <p className="text-xs uppercase tracking-wide text-brass mb-3">
            ✉️ Mensajes de contacto ({contactMessages.length})
          </p>
          <ul className="space-y-4">
            {contactMessages.map((m) => (
              <li key={m.id} className="border border-panelLine p-3">
                <p className="text-parchment text-sm">{m.name || 'Sin nombre'}</p>
                <p className="text-muted text-xs">{m.email}</p>
                <p className="text-parchment/85 text-sm mt-2 italic">"{m.message}"</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <a
                    href={`mailto:${m.email}`}
                    className="px-3 py-1.5 bg-brass text-ink text-xs font-medium hover:bg-brassHigh transition-colors"
                  >
                    Responder por mail
                  </a>
                  <button
                    onClick={() => handleMarkMessageReviewed(m.id)}
                    disabled={resolvingMessageId === m.id}
                    className="px-3 py-1.5 border border-panelLine text-muted text-xs hover:text-parchment transition-colors disabled:opacity-50"
                  >
                    Marcar como visto
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {shopSuggestions && shopSuggestions.length > 0 && (
        <div className="border border-brass bg-panel p-4 mb-8">
          <p className="text-xs uppercase tracking-wide text-brass mb-3">
            🏬 Locales sugeridos ({shopSuggestions.length})
          </p>
          <ul className="space-y-4">
            {shopSuggestions.map((s) => (
              <li key={s.id} className="border border-panelLine p-3">
                <p className="text-parchment text-sm">
                  {s.name}
                  {s.barrio && <span className="text-muted"> — {s.barrio}</span>}
                </p>
                <p className="text-brass text-xs">{s.province || 'Sin provincia (sugerencia vieja)'}</p>
                <p className="text-muted text-xs mt-1">
                  Sugerido por {s.reporterName || 'un vendedor'} ({s.reporterEmail || 'sin email'})
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => handleApproveShop(s)}
                    disabled={resolvingShopId === s.id}
                    className="px-3 py-1.5 bg-brass text-ink text-xs font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
                  >
                    Aprobar y agregar
                  </button>
                  <button
                    onClick={() => handleRejectShop(s.id)}
                    disabled={resolvingShopId === s.id}
                    className="px-3 py-1.5 border border-bidRed text-bidRed text-xs font-medium hover:bg-bidRed/10 transition-colors disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {susurro && pendingRequests && pendingRequests.length > 0 && (
        <div className="border border-brass bg-panel p-4 mb-8">
          <p className="text-xs uppercase tracking-wide text-brass mb-3">
            🔔 Tratos por confirmar ({pendingRequests.length})
          </p>
          <ul className="space-y-4">
            {pendingRequests.map((r) => {
              const requestedPlan = PLANS[r.planKey]
              return (
                <li key={r.id} className="border border-panelLine p-3">
                  <div className="flex gap-3">
                    <a href={r.receiptURL} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <img
                        src={r.receiptURL}
                        alt="Comprobante"
                        className="w-20 h-20 object-cover border border-panelLine hover:border-brass transition-colors"
                      />
                    </a>
                    <div className="min-w-0 flex-1">
                      <p className="text-parchment text-sm truncate">{r.userName || 'Sin nombre'}</p>
                      <p className="text-muted text-xs truncate">{r.userEmail}</p>
                      <p className="text-brass text-xs mt-1">Pide: {requestedPlan?.label || r.planKey}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleApproveRequest(r)}
                      disabled={reviewingId === r.id}
                      className="px-3 py-1.5 bg-brass text-ink text-xs font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
                    >
                      {reviewingId === r.id ? 'Procesando…' : `Activar ${requestedPlan?.label || ''}`}
                    </button>
                    <button
                      onClick={() => handleRejectRequest(r.id)}
                      disabled={reviewingId === r.id}
                      className="px-3 py-1.5 border border-bidRed text-bidRed text-xs font-medium hover:bg-bidRed/10 transition-colors disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {susurro && workbenchOrders && workbenchOrders.filter((o) => o.status === 'pending').length > 0 && (
        <div className="border border-brass bg-panel p-4 mb-8">
          <p className="text-xs uppercase tracking-wide text-brass mb-3">
            🔨 Pedidos del Workbench ({workbenchOrders.filter((o) => o.status === 'pending').length})
          </p>
          <ul className="space-y-4">
            {workbenchOrders.filter((o) => o.status === 'pending').map((o) => (
              <li key={o.id} className="border border-panelLine p-3">
                <a href={`/workbench/${o.productId}`} className="text-brass text-sm hover:underline">
                  {o.productTitle}
                </a>
                <p className="text-muted text-xs mt-1">
                  {o.buyerName} — {o.buyerEmail}
                  {o.buyerPhone && ` — WhatsApp: ${o.buyerPhone}`}
                </p>
                <p className="text-parchment/85 text-sm mt-2 italic">"{o.message}"</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => handleSetOrderStatus(o.id, 'accepted')}
                    disabled={resolvingOrderId === o.id}
                    className="px-3 py-1.5 bg-brass text-ink text-xs font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
                  >
                    Aceptar
                  </button>
                  <button
                    onClick={() => handleSetOrderStatus(o.id, 'rejected')}
                    disabled={resolvingOrderId === o.id}
                    className="px-3 py-1.5 border border-bidRed text-bidRed text-xs font-medium hover:bg-bidRed/10 transition-colors disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {susurro && (
        <div className="border-2 border-brass bg-panel p-4 mb-8">
          <p className="text-xs uppercase tracking-wide text-brass mb-3">💰 Sorteo bounty</p>

          <p className="text-[11px] text-muted mb-4">
            {distinctBidders === null
              ? 'Calculando cuánta gente pujó alguna vez…'
              : `${distinctBidders} persona${distinctBidders === 1 ? '' : 's'} pujaron alguna vez en el sitio (referencia — no bloquea activar el sorteo).`}
          </p>

          <form onSubmit={handleCreateBounty} className="space-y-2 mb-5 pb-5 border-b border-panelLine">
            <p className="text-[11px] text-muted mb-1">Nuevo sorteo (arranca en borrador, invisible)</p>
            <input
              type="text"
              value={bountyTitle}
              onChange={(e) => setBountyTitle(e.target.value)}
              placeholder="Nombre de la carta"
              className="w-full bg-ink border border-panelLine px-3 py-2 text-sm text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setBountyImage(e.target.files?.[0] || null)}
              className="w-full text-xs text-muted file:mr-3 file:py-1.5 file:px-3 file:border file:border-panelLine file:bg-ink file:text-parchment file:cursor-pointer"
            />
            <button
              type="submit"
              disabled={creatingBounty}
              className="px-4 py-2 bg-brass text-ink text-xs font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
            >
              {creatingBounty ? 'Creando…' : 'Crear en borrador'}
            </button>
          </form>

          {bountyRaffles === null ? (
            <p className="text-muted text-sm">Cargando…</p>
          ) : bountyRaffles.length === 0 ? (
            <p className="text-muted text-sm">Todavía no se creó ningún sorteo bounty.</p>
          ) : (
            <ul className="space-y-3">
              {bountyRaffles.map((r) => (
                <li key={r.id} className="border border-panelLine p-3 flex gap-3">
                  {r.imageUrl && (
                    <img src={r.imageUrl} alt="" className="w-14 h-18 object-cover border border-panelLine shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-parchment text-sm">{r.title}</p>
                    <p className="text-[11px] text-muted mb-2">
                      {r.status === 'draft' && 'Borrador — no visible'}
                      {r.status === 'active' && 'Activo — visible en el home'}
                      {r.status === 'closed' && `Cerrado — ganó ${r.winnerName || '—'} (${r.totalEntries || 0} entradas)`}
                    </p>
                    <div className="flex gap-2">
                      {r.status === 'draft' && (
                        <button
                          onClick={() => handleActivateBounty(r.id)}
                          disabled={bountyActionId === r.id}
                          className="px-3 py-1.5 bg-brass text-ink text-xs font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
                        >
                          Activar
                        </button>
                      )}
                      {r.status === 'active' && (
                        <button
                          onClick={() => handleDrawBounty(r.id)}
                          disabled={bountyActionId === r.id}
                          className="px-3 py-1.5 bg-bidRed text-ink text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          {bountyActionId === r.id ? 'Sorteando…' : 'Sortear ganador'}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {susurro && (
        <div className="border border-panelLine bg-panel p-4 mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-wide text-brass">
              🧪 Cuentas de prueba sin email {testUsers ? `(${testUsers.length})` : ''}
            </p>
            <button
              onClick={loadTestUsers}
              disabled={loadingTestUsers}
              className="text-xs text-muted hover:text-parchment transition-colors disabled:opacity-50"
            >
              {loadingTestUsers ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
          <p className="text-[11px] text-muted mb-3">
            Sesiones anónimas (de testing, sin Google real detrás) — nunca tienen email cargado, así se
            las identifica. Borrar acá solo saca el perfil de Firestore (deja de aparecer en listados y
            conteos); no afecta ninguna cuenta real.
          </p>
          {testUsers === null ? (
            <p className="text-muted text-sm">Cargando…</p>
          ) : testUsers.length === 0 ? (
            <p className="text-muted text-sm">No hay ninguna ahora mismo.</p>
          ) : (
            <>
              <button
                onClick={handleDeleteTestUsers}
                disabled={deletingTestUsers}
                className="px-3 py-1.5 bg-bidRed text-ink text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 mb-2"
              >
                {deletingTestUsers ? 'Borrando…' : `Borrar las ${testUsers.length}`}
              </button>
            </>
          )}
        </div>
      )}

      <div className="border border-panelLine bg-panel p-4 mb-8">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-wide text-brass">🆕 Últimos registrados</p>
          <button
            onClick={loadRecentUsers}
            disabled={loadingRecentUsers}
            className="text-xs text-muted hover:text-parchment transition-colors disabled:opacity-50"
          >
            {loadingRecentUsers ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
        {recentUsers === null ? (
          <p className="text-muted text-sm">Cargando…</p>
        ) : recentUsers.length === 0 ? (
          <p className="text-muted text-sm">
            Sin datos todavía — solo se cuentan las cuentas creadas después de sumar esta lista.
          </p>
        ) : (
          <ul className="space-y-2">
            {recentUsers.map((u) => (
              <li key={u.id}>
                <button
                  onClick={() => handleViewRecentUser(u)}
                  className="w-full flex items-center gap-3 text-left px-2 py-1.5 hover:bg-ink/40 transition-colors"
                >
                  {u.photoURL && (
                    <img src={u.photoURL} alt="" className="w-7 h-7 rounded-full shrink-0" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-parchment text-sm truncate">
                      {u.displayName || 'Sin nombre'}
                    </span>
                    <span className="block text-muted text-xs truncate">{u.email}</span>
                  </span>
                  <span className="text-[11px] text-muted shrink-0">
                    {u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString('es-AR') : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@ejemplo.com"
          className="flex-1 bg-panel border border-panelLine px-3 py-2.5 text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
        />
        <button
          type="submit"
          disabled={searching}
          className="px-5 py-2.5 bg-brass text-ink font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
        >
          {searching ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {error && <p className="text-bidRed text-sm mb-4">{error}</p>}
      {message && <p className="text-bidGreen text-sm mb-4">{message}</p>}

      {result && (
        <div className="border border-panelLine bg-panel p-5">
          <div className="flex items-center gap-3 mb-4">
            {result.photoURL && (
              <img src={result.photoURL} alt="" className="w-10 h-10 rounded-full" />
            )}
            <div>
              <p className="text-parchment font-medium">
                {result.displayName || 'Sin nombre'}
                {isArana(result) && <span className="text-brass text-xs ml-2">🕷️ Araña</span>}
              </p>
              <p className="text-muted text-sm">{result.email}</p>
              {result.phone && <p className="text-muted text-xs">WhatsApp: {result.phone}</p>}
            </div>
          </div>

          {susurro && (
            <>
              <p className="text-sm text-muted mb-4 flex items-center gap-2">
                Plan actual:
                {currentPlan.icon && (
                  <img
                    src={currentPlan.icon}
                    alt=""
                    className="w-10 h-10 rounded-full border border-brass/40 bg-parchment object-cover"
                  />
                )}
                <span className="text-brass">{currentPlan.label}</span>
              </p>

              <div className="flex flex-wrap gap-2 mb-5">
                <button
                  onClick={() => handleSetPlan('pro')}
                  disabled={acting}
                  className="px-4 py-2 bg-brass text-ink text-sm font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
                >
                  Activar Informante (+1 mes)
                </button>
                <button
                  onClick={() => handleSetPlan('unlimited')}
                  disabled={acting}
                  className="px-4 py-2 bg-brass text-ink text-sm font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
                >
                  Activar Intel de Pícaros (+1 mes)
                </button>
                <button
                  onClick={() => handleSetPlan('free')}
                  disabled={acting}
                  className="px-4 py-2 border border-panelLine text-parchment text-sm font-medium hover:border-brass transition-colors disabled:opacity-50"
                >
                  Bajar a Chusma
                </button>
              </div>

              <div className="border-t border-panelLine pt-4 mb-4">
                <p className="text-xs uppercase tracking-wide text-muted mb-2">Rol de moderación</p>
                <button
                  onClick={handleToggleArana}
                  disabled={acting || result.id === user.uid}
                  className={`px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                    isArana(result)
                      ? 'border border-bidRed text-bidRed hover:bg-bidRed/10'
                      : 'bg-brass text-ink hover:bg-brassHigh'
                  }`}
                >
                  {isArana(result) ? 'Quitarle el rol de Araña' : 'Nombrar Araña 🕷️'}
                </button>
                {result.id === user.uid && (
                  <p className="text-[11px] text-muted mt-1">No podés cambiarte el rol a vos mismo.</p>
                )}
              </div>
            </>
          )}

          <div className="border-t border-panelLine pt-4">
            <p className="text-xs uppercase tracking-wide text-muted mb-2">Suspensión de cuenta</p>

            {!canBanTarget ? (
              <p className="text-muted text-sm">
                {targetIsSelf
                  ? 'No podés suspenderte a vos mismo.'
                  : targetIsSusurro
                    ? 'A Susurro no lo puede suspender nadie.'
                    : 'Solo Susurro puede suspender a otra Araña.'}
              </p>
            ) : isUserBanned(result) ? (
              <div>
                <p className="text-bidRed text-sm mb-3">
                  🚫 Suspendida
                  {result.bannedUntil
                    ? ` hasta el ${result.bannedUntil.toDate().toLocaleDateString('es-AR')}`
                    : ' de forma permanente'}
                  .
                </p>
                <button
                  onClick={handleUnban}
                  disabled={acting}
                  className="px-4 py-2 bg-bidGreen text-ink text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  Levantar suspensión
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleBan(2, '2 días')}
                  disabled={acting}
                  className="px-4 py-2 border border-bidRed text-bidRed text-sm font-medium hover:bg-bidRed/10 transition-colors disabled:opacity-50"
                >
                  Suspender 2 días
                </button>
                <button
                  onClick={() => handleBan(7, '1 semana')}
                  disabled={acting}
                  className="px-4 py-2 border border-bidRed text-bidRed text-sm font-medium hover:bg-bidRed/10 transition-colors disabled:opacity-50"
                >
                  Suspender 1 semana
                </button>
                <button
                  onClick={() => handleBan(null, 'permanente')}
                  disabled={acting}
                  className="px-4 py-2 bg-bidRed text-ink text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  Suspender permanente
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-panelLine pt-4 mt-4">
            <p className="text-xs uppercase tracking-wide text-muted mb-2">Subastas de esta persona</p>

            {sellerAuctions === null ? (
              <button
                onClick={handleLoadAuctions}
                disabled={loadingAuctions}
                className="px-4 py-2 border border-panelLine text-parchment text-sm font-medium hover:border-brass transition-colors disabled:opacity-50"
              >
                {loadingAuctions ? 'Cargando…' : 'Ver sus subastas'}
              </button>
            ) : sellerAuctions.length === 0 ? (
              <p className="text-muted text-sm">Todavía no publicó ninguna carta.</p>
            ) : (
              <ul className="space-y-2">
                {sellerAuctions.map((a) => (
                  <li key={a.id} className="border border-panelLine px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-parchment text-sm truncate">{a.title}</p>
                        <p className="text-[11px] text-muted">
                          ${a.currentPrice?.toLocaleString('es-AR')} ·{' '}
                          {a.status === 'active'
                            ? 'Activa'
                            : a.status === 'closed_by_admin'
                              ? 'Cerrada por admin'
                              : 'Cerrada'}
                        </p>
                        {a.status === 'closed_by_admin' && a.adminCloseReason && (
                          <p className="text-[11px] text-bidRed">Motivo: {a.adminCloseReason}</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {a.status === 'active' && closingId !== a.id && (
                          <button
                            onClick={() => setClosingId(a.id)}
                            className="px-3 py-1.5 border border-bidRed text-bidRed text-xs font-medium hover:bg-bidRed/10 transition-colors"
                          >
                            Cerrar
                          </button>
                        )}
                        {susurro && (
                          <button
                            onClick={() => handleDeleteAuction(a.id, a.title)}
                            disabled={acting}
                            className="px-3 py-1.5 bg-bidRed text-ink text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                            title="Borra la subasta aunque tenga pujas — solo Susurro"
                          >
                            Borrar
                          </button>
                        )}
                      </div>
                    </div>

                    {closingId === a.id && (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          value={closeReason}
                          onChange={(e) => setCloseReason(e.target.value)}
                          placeholder="Motivo del cierre"
                          className="flex-1 bg-ink border border-panelLine px-2 py-1.5 text-xs text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
                        />
                        <button
                          onClick={() => handleCloseAuction(a.id)}
                          disabled={acting}
                          className="px-3 py-1.5 bg-bidRed text-ink text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => {
                            setClosingId(null)
                            setCloseReason('')
                          }}
                          className="px-3 py-1.5 border border-panelLine text-muted text-xs hover:text-parchment transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
