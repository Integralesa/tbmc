import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isSusurro } from '../lib/roles'
import { createOrder, setProductActive, subscribeToProduct } from '../lib/workbench'

export default function WorkbenchProductDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const admin = isSusurro(user)

  const [product, setProduct] = useState(undefined)
  const [activeMedia, setActiveMedia] = useState(0) // índice dentro de [...images, video?]
  const [requesting, setRequesting] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [togglingActive, setTogglingActive] = useState(false)

  useEffect(() => {
    const unsub = subscribeToProduct(id, setProduct)
    return unsub
  }, [id])

  if (product === undefined) {
    return <div className="max-w-3xl mx-auto px-6 py-10 text-muted">Cargando…</div>
  }
  if (product === null) {
    return <div className="max-w-3xl mx-auto px-6 py-10 text-parchment">Este producto ya no existe.</div>
  }

  const images = product.images || []
  const mediaItems = [...images.map((src) => ({ type: 'image', src })), ...(product.videoUrl ? [{ type: 'video', src: product.videoUrl }] : [])]
  const current = mediaItems[activeMedia]

  function handleCraftClick() {
    setError('')
    setRequesting(true)
  }

  function handleCancel() {
    setRequesting(false)
    setMessage('')
    setError('')
  }

  async function handleSubmitOrder() {
    setError('')
    if (!message.trim()) {
      setError('Contanos qué querés antes de enviar el pedido.')
      return
    }
    setSubmitting(true)
    try {
      await createOrder({ product, message, user })
      setSubmitted(true)
      setRequesting(false)
    } catch (err) {
      setError(err.message || 'No se pudo enviar el pedido.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive() {
    setTogglingActive(true)
    try {
      await setProductActive(product.id, product.active === false)
    } finally {
      setTogglingActive(false)
    }
  }

  const buttonLabel = !user
    ? 'Iniciá sesión para pedir'
    : submitted
      ? 'Pedido enviado ✓'
      : requesting || submitting
        ? 'Crafting…'
        : 'Crear'

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {admin && (
        <div className="mb-6 flex items-center gap-3 text-sm">
          <span className={product.active === false ? 'text-muted' : 'text-brass'}>
            {product.active === false ? 'Oculto del catálogo' : 'Visible en el catálogo'}
          </span>
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={togglingActive}
            className="text-xs text-brass hover:underline disabled:opacity-50"
          >
            {product.active === false ? 'Mostrar de nuevo' : 'Ocultar'}
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <div className="aspect-[3/4] bg-ink border border-panelLine overflow-hidden flex items-center justify-center">
            {current?.type === 'video' ? (
              <video src={current.src} controls className="w-full h-full object-contain" />
            ) : current ? (
              <img src={current.src} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="text-muted text-sm">Sin imagen</span>
            )}
          </div>
          {mediaItems.length > 1 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {mediaItems.map((m, i) => (
                <button
                  key={i}
                  onClick={() => setActiveMedia(i)}
                  className={`w-14 h-14 border overflow-hidden flex items-center justify-center bg-ink ${
                    i === activeMedia ? 'border-brass' : 'border-panelLine opacity-70'
                  }`}
                >
                  {m.type === 'video' ? (
                    <span className="text-brass text-xs">▶</span>
                  ) : (
                    <img src={m.src} alt="" className="w-full h-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="font-serif text-2xl text-parchment mb-2">{product.title}</h1>
          <p className="text-3xl text-brass font-medium mb-4">${product.price?.toLocaleString('es-AR')}</p>
          {product.description && (
            <p className="text-parchment/85 text-sm whitespace-pre-wrap mb-6">{product.description}</p>
          )}

          {!submitted && !requesting && (
            <button
              type="button"
              onClick={handleCraftClick}
              disabled={!user}
              className="w-full px-4 py-3 bg-brass text-ink font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
            >
              {buttonLabel}
            </button>
          )}

          {requesting && !submitted && (
            <div className="border border-brass/40 bg-panel p-4">
              <p className="text-xs uppercase tracking-wide text-brass mb-2">Crafting…</p>
              <p className="text-parchment/85 text-sm mb-3">
                Contanos qué necesitás: color, tamaño, cantidad, para cuándo lo querés, etc. Te contactamos
                para coordinar precio final (puede variar según personalización) y entrega.
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Ej: lo quiero en color negro, para un iPhone 14, ¿lo tenés para este fin de semana?"
                className="w-full bg-ink border border-panelLine px-3 py-2 text-sm text-parchment placeholder:text-muted/60 focus:border-brass outline-none resize-none mb-3"
              />
              {error && <p className="text-bidRed text-xs mb-2">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSubmitOrder}
                  disabled={submitting}
                  className="px-4 py-2 bg-brass text-ink text-sm font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Enviando…' : 'Enviar pedido'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={submitting}
                  className="px-4 py-2 border border-panelLine text-muted text-sm hover:text-parchment transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {submitted && (
            <div className="border border-bidGreen/40 bg-bidGreen/10 px-4 py-3 text-sm text-bidGreen">
              ✅ Pedido enviado — te vamos a contactar para coordinar precio final y entrega.
            </div>
          )}

          <p className="text-[11px] text-muted mt-4">
            Esto es un pedido, no una compra online — coordinamos precio y entrega directo con vos. Revisá los{' '}
            <a href="/terminos" className="underline hover:text-brass">Términos y Condiciones</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
