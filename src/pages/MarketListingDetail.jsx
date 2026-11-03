import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { deleteListing, markListingSold, reactivateListing, subscribeToListing } from '../lib/market'

export default function MarketListingDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [listing, setListing] = useState(undefined)
  const [activeImage, setActiveImage] = useState(0)
  const [interested, setInterested] = useState(false)
  const [copied, setCopied] = useState(false)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsub = subscribeToListing(id, setListing)
    return unsub
  }, [id])

  if (listing === undefined) {
    return <div className="max-w-3xl mx-auto px-6 py-10 text-muted">Cargando…</div>
  }
  if (listing === null) {
    return <div className="max-w-3xl mx-auto px-6 py-10 text-parchment">Esta publicación ya no existe.</div>
  }

  const isOwner = user?.uid === listing.sellerId
  const isSold = listing.status === 'sold'
  const images = listing.images || []

  function copyEmail() {
    if (!listing.sellerEmail) return
    navigator.clipboard.writeText(listing.sellerEmail).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  async function handleMarkSold() {
    setError('')
    setActing(true)
    try {
      await markListingSold(id, user)
    } catch (err) {
      setError(err.message || 'No se pudo marcar como vendido.')
    } finally {
      setActing(false)
    }
  }

  async function handleReactivate() {
    setError('')
    setActing(true)
    try {
      await reactivateListing(id, user)
    } catch (err) {
      setError(err.message || 'No se pudo reactivar.')
    } finally {
      setActing(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('¿Borrar esta publicación? No se puede deshacer.')) return
    setError('')
    setActing(true)
    try {
      await deleteListing(id, user)
      navigate('/mercado')
    } catch (err) {
      setError(err.message || 'No se pudo borrar.')
      setActing(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <div className="aspect-[3/4] bg-ink border border-panelLine overflow-hidden">
            {images[activeImage] ? (
              <img src={images[activeImage]} alt="" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted text-sm">Sin imagen</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`w-14 h-14 border overflow-hidden ${
                    i === activeImage ? 'border-brass' : 'border-panelLine opacity-70'
                  }`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="text-xs uppercase tracking-wide text-brass/80">{listing.game}</span>
          <p className="text-3xl text-brass font-medium mt-1 mb-3">
            ${listing.price?.toLocaleString('es-AR')}
          </p>
          {isSold && (
            <p className="inline-block mb-3 text-xs uppercase tracking-wide px-2 py-1 bg-ink/80 text-muted border border-panelLine">
              Vendido
            </p>
          )}
          {listing.description && (
            <p className="text-parchment/85 text-sm whitespace-pre-wrap mb-4">{listing.description}</p>
          )}

          <div className="flex items-center gap-2 mb-6">
            {listing.sellerPhoto && (
              <img src={listing.sellerPhoto} alt="" className="w-8 h-8 rounded-full object-cover" />
            )}
            <p className="text-muted text-sm">Publicado por {listing.sellerName || 'Usuario'}</p>
          </div>

          {isOwner ? (
            <div className="border border-panelLine bg-panel p-4 space-y-2">
              <p className="text-xs text-muted mb-1">Es tu publicación</p>
              {!isSold ? (
                <button
                  onClick={handleMarkSold}
                  disabled={acting}
                  className="w-full px-4 py-2.5 bg-brass text-ink text-sm font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
                >
                  Marcar como vendido
                </button>
              ) : (
                <button
                  onClick={handleReactivate}
                  disabled={acting}
                  className="w-full px-4 py-2.5 border border-brass text-brass text-sm font-medium hover:bg-brass/10 transition-colors disabled:opacity-50"
                >
                  Reactivar publicación
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={acting}
                className="w-full px-4 py-2.5 border border-bidRed text-bidRed text-sm font-medium hover:bg-bidRed/10 transition-colors disabled:opacity-50"
              >
                Borrar publicación
              </button>
              {error && <p className="text-bidRed text-xs">{error}</p>}
            </div>
          ) : !user ? (
            <p className="text-muted text-sm">Iniciá sesión para contactar a quien vende.</p>
          ) : isSold ? (
            <p className="text-muted text-sm">Esta publicación ya no está disponible.</p>
          ) : !interested ? (
            <button
              onClick={() => setInterested(true)}
              className="w-full px-4 py-3 bg-brass text-ink font-medium hover:bg-brassHigh transition-colors"
            >
              Estoy interesado
            </button>
          ) : (
            <div className="border border-brass/40 bg-panel p-4">
              <p className="text-xs uppercase tracking-wide text-brass mb-2">Contacto</p>
              <p className="text-parchment font-medium">{listing.sellerName || 'Usuario'}</p>
              {listing.sellerEmail && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-muted text-sm truncate">{listing.sellerEmail}</p>
                  <button onClick={copyEmail} className="text-[11px] text-brass hover:underline shrink-0">
                    {copied ? 'Copiado ✓' : 'Copiar'}
                  </button>
                </div>
              )}
              {listing.sellerPhone ? (
                <a
                  href={`https://wa.me/${listing.sellerPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center mt-3 py-2.5 bg-bidGreen text-ink text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Escribir por WhatsApp
                </a>
              ) : (
                <p className="text-[11px] text-muted mt-3">
                  Quien vende no cargó un WhatsApp en su perfil, así que por ahora solo tenés el email.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
