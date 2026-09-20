import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  placeBid,
  subscribeToAuction,
  subscribeToBids,
  getEditWindowStatus,
  cancelAuction,
  EDIT_WINDOW_MINUTES,
  MIN_BID_AMOUNT,
  MAX_PRICE_DIGITS,
} from '../lib/auctions'
import { isStaff } from '../lib/roles'
import Countdown from '../components/Countdown'
import ContactReveal from '../components/ContactReveal'
import AdminAuctionPanel from '../components/AdminAuctionPanel'
import EditAuctionPanel from '../components/EditAuctionPanel'
import { CARD_SHOPS, LEGACY_CARD_SHOP_LABELS } from '../lib/locations'
import { useCardShopLabels } from '../lib/cardShops'

const DELIVERY_LABELS = {
  retiro: 'Retiro en persona',
  envio: 'Envío',
  envio_comprador: 'Envío a cargo del comprador',
  punto_encuentro: 'Punto de encuentro',
}

const STATIC_CARD_SHOP_LABELS = Object.fromEntries(CARD_SHOPS.map((s) => [s.key, s.label]))

export default function AuctionDetail() {
  const { id } = useParams()
  const { user, profile, loginWithGoogle } = useAuth()
  const cardShopLabels = useCardShopLabels(STATIC_CARD_SHOP_LABELS)

  const [auction, setAuction] = useState(undefined)
  const [bids, setBids] = useState([])
  const [activeImage, setActiveImage] = useState(0)
  const [bidAmount, setBidAmount] = useState('')
  const [notifyIfOutbid, setNotifyIfOutbid] = useState(true)
  const [error, setError] = useState('')
  const [placing, setPlacing] = useState(false)

  const [windowExpired, setWindowExpired] = useState(false)
  const [showEditPanel, setShowEditPanel] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [cancelSaving, setCancelSaving] = useState(false)

  useEffect(() => {
    const unsub = subscribeToAuction(id, setAuction)
    return unsub
  }, [id])

  useEffect(() => {
    const unsub = subscribeToBids(id, setBids)
    return unsub
  }, [id])

  useEffect(() => {
    setWindowExpired(false)
    setShowEditPanel(false)
    setConfirmingCancel(false)
  }, [id])

  const editDeadline = useMemo(() => {
    if (!auction?.createdAt) return null
    const createdAt = auction.createdAt.toDate ? auction.createdAt.toDate() : new Date(auction.createdAt)
    return new Date(createdAt.getTime() + EDIT_WINDOW_MINUTES * 60 * 1000)
  }, [auction?.createdAt])

  const minNextBid = useMemo(() => {
    if (!auction) return 0
    // incremento mínimo sugerido: 5% del precio actual, redondeado, con un
    // piso absoluto de MIN_BID_AMOUNT para subastas de precio inicial bajo
    const step = Math.max(Math.round(auction.currentPrice * 0.05), 100)
    return Math.max(auction.currentPrice + step, MIN_BID_AMOUNT)
  }, [auction])

  const maxNextBid = useMemo(() => {
    if (!auction) return 0
    // El tope normal es 50% por encima del precio actual, pero nunca puede
    // quedar por debajo del piso de MIN_BID_AMOUNT — si no, en subastas de
    // precio inicial muy bajo el rango de puja quedaría imposible (mínimo
    // mayor al máximo).
    return Math.max(Math.floor(auction.currentPrice * 1.5), MIN_BID_AMOUNT)
  }, [auction])

  async function handleBid(e) {
    e.preventDefault()
    setError('')
    if (!user) {
      setError('Iniciá sesión para pujar.')
      return
    }
    if (String(bidAmount).replace(/\D/g, '').length > MAX_PRICE_DIGITS) {
      setError(`Ese monto es demasiado grande (máximo ${MAX_PRICE_DIGITS} dígitos).`)
      return
    }
    if (Number(bidAmount) < MIN_BID_AMOUNT) {
      setError(`La puja mínima es $${MIN_BID_AMOUNT.toLocaleString('es-AR')}.`)
      return
    }
    try {
      setPlacing(true)
      await placeBid({ auctionId: id, amount: bidAmount, user, notifyIfOutbid })
      setBidAmount('')
    } catch (err) {
      setError(err.message)
    } finally {
      setPlacing(false)
    }
  }

  async function handleFixedBid(amount) {
    setError('')
    if (!user) {
      setError('Iniciá sesión para pujar.')
      return
    }
    try {
      setPlacing(true)
      await placeBid({ auctionId: id, amount, user, notifyIfOutbid })
    } catch (err) {
      setError(err.message)
    } finally {
      setPlacing(false)
    }
  }

  async function handleConfirmCancel() {
    setCancelError('')
    try {
      setCancelSaving(true)
      await cancelAuction({ auctionId: id, user })
      setConfirmingCancel(false)
    } catch (err) {
      setCancelError(err.message || 'No se pudo cancelar la subasta.')
    } finally {
      setCancelSaving(false)
    }
  }

  if (auction === undefined) {
    return <p className="max-w-5xl mx-auto px-6 py-16 text-muted">Cargando lote…</p>
  }
  if (auction === null) {
    return <p className="max-w-5xl mx-auto px-6 py-16 text-muted">Esta subasta no existe.</p>
  }

  const isSeller = user?.uid === auction.sellerId
  const isEnded = auction.status !== 'active'
  const isPendingReview = auction.status === 'pending_review'
  const isClosedByAdmin = auction.status === 'closed_by_admin'
  const isCancelledBySeller = auction.status === 'cancelled_by_seller'
  const editWindow = getEditWindowStatus(auction)
  const showEditControls = isSeller && editWindow.canEdit && !windowExpired

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 grid md:grid-cols-2 gap-10">
      {/* Galería — hasta 2 fotos */}
      <div>
        <div
          className={`aspect-[3/4] bg-panel border flex items-center justify-center overflow-hidden ${
            isClosedByAdmin || isCancelledBySeller ? 'border-bidRed' : 'border-panelLine'
          }`}
        >
          {auction.images?.[activeImage] ? (
            <img
              src={auction.images[activeImage]}
              alt={auction.title}
              className={`w-full h-full object-contain ${isClosedByAdmin || isCancelledBySeller ? 'opacity-50' : ''}`}
            />
          ) : (
            <span className="text-muted text-sm">Sin imagen</span>
          )}
        </div>
        {auction.images?.length > 1 && (
          <div className="flex gap-3 mt-3">
            {auction.images.map((src, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`w-20 h-28 border ${
                  activeImage === i ? 'border-brass' : 'border-panelLine'
                }`}
              >
                <img src={src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info + pujas */}
      <div>
        {isStaff(user, profile) && <AdminAuctionPanel auction={auction} />}
        {isPendingReview && (
          <div className="border border-brass bg-brass/10 px-4 py-3 mb-4">
            <p className="text-brass font-medium text-sm">⏳ Esta publicación está en revisión</p>
            <p className="text-parchment/80 text-sm mt-1">
              Normalmente demora solo unos segundos — se publica sola apenas termine. No hace falta
              que hagas nada.
            </p>
          </div>
        )}
        {isClosedByAdmin && (
          <div className="border border-bidRed bg-bidRed/10 px-4 py-3 mb-4">
            <p className="text-bidRed font-medium text-sm">🔒 Esta subasta fue cerrada por administración</p>
            {auction.adminCloseReason && (
              <p className="text-bidRed/90 text-sm mt-1">Motivo: {auction.adminCloseReason}</p>
            )}
          </div>
        )}
        {isCancelledBySeller && (
          <div className="border border-bidRed bg-bidRed/10 px-4 py-3 mb-4">
            <p className="text-bidRed font-medium text-sm">❌ Esta subasta fue cancelada por el vendedor</p>
          </div>
        )}

        {showEditControls && !showEditPanel && (
          <div className="border border-brass/40 bg-brass/5 px-4 py-3 mb-4 text-sm">
            <p className="text-parchment/85">
              Podés corregir datos o cancelar esta subasta durante{' '}
              <Countdown endsAt={editDeadline} onEnd={() => setWindowExpired(true)} /> más.
            </p>
            {!confirmingCancel ? (
              <div className="flex gap-3 mt-2.5">
                <button
                  type="button"
                  onClick={() => setShowEditPanel(true)}
                  className="text-brass hover:underline"
                >
                  Editar subasta
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(true)}
                  className="text-bidRed hover:underline"
                >
                  Cancelar subasta
                </button>
              </div>
            ) : (
              <div className="mt-3 border-t border-brass/20 pt-3">
                <p className="text-parchment/85">
                  {auction.bidCount > 0
                    ? `Ya hay ${auction.bidCount} puja${auction.bidCount === 1 ? '' : 's'} en esta subasta. Si cancelás, esas pujas se pierden y quien pujó no va a poder reclamar nada.`
                    : 'Todavía no hay pujas en esta subasta.'}{' '}
                  Esto no se puede deshacer — si te arrepentís, vas a tener que publicarla de nuevo.
                </p>
                {cancelError && <p className="text-bidRed text-sm mt-2">{cancelError}</p>}
                <div className="flex gap-3 mt-3">
                  <button
                    type="button"
                    onClick={() => setConfirmingCancel(false)}
                    disabled={cancelSaving}
                    className="px-3 py-1.5 border border-panelLine text-parchment hover:border-brass transition-colors disabled:opacity-50"
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCancel}
                    disabled={cancelSaving}
                    className="px-3 py-1.5 bg-bidRed text-ink font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {cancelSaving ? 'Cancelando…' : 'Sí, cancelar subasta'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {showEditControls && showEditPanel && (
          <EditAuctionPanel
            auction={auction}
            user={user}
            onClose={() => setShowEditPanel(false)}
            onSaved={() => setShowEditPanel(false)}
          />
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-wide text-brass/80">{auction.game}</span>
          {auction.sellerPlanPriority >= 2 && (
            <span className="text-[10px] uppercase tracking-wide px-2 py-1 font-semibold bg-brass text-ink">
              ★ Intel de Pícaros
            </span>
          )}
          {auction.sellerPlanPriority === 1 && (
            <span className="text-[10px] uppercase tracking-wide px-2 py-1 font-semibold bg-ink border border-brass/50 text-brass">
              Destacado
            </span>
          )}
        </div>
        <h1 className="font-serif text-3xl text-parchment mt-1 mb-3 flex items-center gap-2.5 flex-wrap">
          {auction.title}
          {auction.isFoil && (
            <span className="text-xs uppercase tracking-wide px-2 py-1 bg-brass text-ink font-semibold">
              Foil
            </span>
          )}
        </h1>
        <p className="text-muted text-sm mb-1">Estado: {auction.condition}</p>
        {auction.deliveryMethods?.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-2">
            {auction.deliveryMethods.map((m) => (
              <span
                key={m}
                className="text-[11px] px-2 py-1 border border-panelLine text-parchment/80"
              >
                {DELIVERY_LABELS[m] || m}
              </span>
            ))}
          </div>
        )}
        {auction.deliveryProvince && (
          <p className="text-sm text-muted mb-1">Provincia: {auction.deliveryProvince}</p>
        )}
        {auction.deliveryZone && (
          <p className="text-sm text-muted mb-2">Zona: {auction.deliveryZone}</p>
        )}
        {auction.cardShops?.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6">
            {auction.cardShops.map((s) => (
              <span
                key={s}
                className="text-[11px] px-2 py-1 border border-panelLine text-parchment/80"
              >
                {cardShopLabels[s] || LEGACY_CARD_SHOP_LABELS[s] || s}
              </span>
            ))}
          </div>
        )}
        {auction.description && <p className="text-parchment/80 mb-6">{auction.description}</p>}

        <div className="border border-panelLine bg-panel p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] text-muted">Puja actual</p>
              <p className="text-3xl text-brass font-medium">
                ${auction.currentPrice?.toLocaleString('es-AR')}
              </p>
              {auction.currentBidderName && (
                <p className="text-xs text-muted mt-1">
                  Va ganando {auction.currentBidderName}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted mb-1">
                {isPendingReview ? 'Estado' : isEnded ? 'Estado' : 'Cierra en'}
              </p>
              {isPendingReview ? (
                <span className="text-brass">En revisión</span>
              ) : isEnded ? (
                <span className="text-bidRed">Cerrada</span>
              ) : (
                <Countdown endsAt={auction.endsAt} />
              )}
              {!isEnded && auction.extendWindowMinutes > 0 && (
                <p className="text-[10px] text-muted mt-1 max-w-[140px]">
                  +{auction.extendByMinutes} min si hay pujas en los últimos {auction.extendWindowMinutes} min
                </p>
              )}
            </div>
          </div>

          {!isEnded && !isSeller && (
            <p className="text-[11px] text-muted mb-2">
              Al pujar, te comprometés a completar la operación si ganás.
            </p>
          )}

          {!isEnded && !isSeller && user && (
            <label className="flex items-start gap-2 text-[11px] text-muted mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyIfOutbid}
                onChange={(e) => setNotifyIfOutbid(e.target.checked)}
                className="accent-brass w-3.5 h-3.5 mt-0.5 shrink-0"
              />
              <span>
                Avisame acá en la página si me superan esta puja (por ahora es solo mientras estás
                navegando el sitio — más adelante lo vamos a mandar también por WhatsApp).
              </span>
            </label>
          )}

          {!isEnded && !isSeller && auction.fixedBidIncrement ? (
            <div>
              <button
                onClick={() => handleFixedBid(auction.currentPrice + auction.fixedBidIncrement)}
                disabled={placing || !user}
                className="w-full py-3 bg-brass text-ink font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
              >
                {placing
                  ? 'Pujando…'
                  : user
                    ? `Pujar $${(auction.currentPrice + auction.fixedBidIncrement).toLocaleString('es-AR')}`
                    : 'Ingresá para pujar'}
              </button>
              {!user && (
                <button
                  type="button"
                  onClick={loginWithGoogle}
                  className="w-full mt-2 py-2 text-sm text-brass hover:underline"
                >
                  Ingresar con Google
                </button>
              )}
              <p className="text-[11px] text-muted mt-2">
                Esta subasta usa puja fija: cada clic suma ${auction.fixedBidIncrement.toLocaleString('es-AR')}.
              </p>
            </div>
          ) : (
            !isEnded &&
            !isSeller && (
              <div>
                <form onSubmit={handleBid} className="flex gap-2">
                  <input
                    type="number"
                    min={minNextBid}
                    max={maxNextBid}
                    maxLength={MAX_PRICE_DIGITS}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value.slice(0, MAX_PRICE_DIGITS))}
                    placeholder={`Mínimo $${minNextBid.toLocaleString('es-AR')}`}
                    className="flex-1 bg-ink border border-panelLine px-3 py-2.5 text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
                  />
                  {user ? (
                    <button
                      type="submit"
                      disabled={placing}
                      className="px-5 py-2.5 bg-brass text-ink font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
                    >
                      {placing ? 'Pujando…' : 'Pujar'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={loginWithGoogle}
                      className="px-5 py-2.5 bg-brass text-ink font-medium hover:bg-brassHigh transition-colors"
                    >
                      Ingresar para pujar
                    </button>
                  )}
                </form>
                <p className="text-[11px] text-muted mt-1.5">
                  Tope por puja: hasta ${maxNextBid.toLocaleString('es-AR')} (50% por encima del precio actual), para que nadie arruine la subasta con un salto enorme.
                </p>
              </div>
            )
          )}
          {isSeller && !isEnded && (
            <p className="text-sm text-muted">Es tu propia carta — no podés pujar en ella.</p>
          )}
          {error && <p className="text-bidRed text-sm mt-2">{error}</p>}
        </div>

        {isEnded && user && <ContactReveal auctionId={id} auctionTitle={auction.title} user={user} />}

        <div>
          <h2 className="text-sm text-muted mb-3">Historial de pujas ({bids.length})</h2>
          {bids.length === 0 ? (
            <p className="text-muted text-sm">Todavía nadie pujó por esta carta.</p>
          ) : (
            <ul className="space-y-2">
              {bids.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between text-sm border-b border-panelLine pb-2"
                >
                  <span className="text-parchment/80">{b.userName}</span>
                  <span className="text-brass">${b.amount.toLocaleString('es-AR')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
