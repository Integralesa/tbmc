import { useEffect, useState } from 'react'
import { confirmDeal, reportDealProblem, subscribeToContact } from '../lib/auctions'

/**
 * Se muestra solo cuando la subasta está cerrada y hubo ganador.
 * El propio hook de datos ya se encarga de no traer nada si el usuario
 * logueado no es ni el vendedor ni el ganador de esta subasta puntual.
 */
export default function ContactReveal({ auctionId, auctionTitle, user }) {
  const [contact, setContact] = useState(undefined)
  const [copied, setCopied] = useState(false)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    const unsub = subscribeToContact(auctionId, setContact)
    return unsub
  }, [auctionId])

  if (contact === undefined) return null // todavía cargando
  if (contact === null) return null // no autorizado, o no revelado (sin ganador, o no cerró aún)

  const userId = user.uid
  const isSeller = userId === contact.sellerId
  const otherName = isSeller ? contact.winnerName : contact.sellerName
  const otherEmail = isSeller ? contact.winnerEmail : contact.sellerEmail
  const otherPhone = isSeller ? contact.winnerPhone : contact.sellerPhone
  const role = isSeller ? 'el comprador que ganó' : 'el vendedor'
  const otherRoleLabel = isSeller ? 'el comprador' : 'el vendedor'

  const myConfirmed = isSeller ? contact.sellerConfirmed : contact.winnerConfirmed
  const otherConfirmed = isSeller ? contact.winnerConfirmed : contact.sellerConfirmed
  const myReported = isSeller ? contact.sellerReportedProblem : contact.winnerReportedProblem
  const dealStatus = contact.dealStatus || 'pending'

  function copyEmail() {
    if (!otherEmail) return
    navigator.clipboard.writeText(otherEmail).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  async function handleConfirm() {
    setError('')
    setActing(true)
    try {
      await confirmDeal({ auctionId, isSeller })
    } catch (err) {
      setError(err.message || 'No se pudo confirmar. Probá de nuevo.')
    } finally {
      setActing(false)
    }
  }

  async function handleReport() {
    setError('')
    if (!reason.trim()) {
      setError('Contanos qué pasó antes de enviar el reporte.')
      return
    }
    setActing(true)
    try {
      await reportDealProblem({
        auctionId,
        auctionTitle,
        isSeller,
        reason: reason.trim(),
        reporterId: user.uid,
        reporterEmail: user.email,
        reporterName: user.displayName,
        sellerId: contact.sellerId,
        winnerId: contact.winnerId,
      })
      setReporting(false)
    } catch (err) {
      setError(err.message || 'No se pudo enviar el reporte. Probá de nuevo.')
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="border border-brass/40 bg-panel p-5 mt-6">
      <p className="text-xs uppercase tracking-wide text-brass mb-2">Contacto revelado</p>
      <p className="text-parchment/85 text-sm mb-3">
        La subasta cerró y tenés que coordinar con {role} para completar la operación.
      </p>

      <div className="bg-ink border border-panelLine px-4 py-3">
        <p className="text-parchment font-medium">{otherName || 'Sin nombre'}</p>

        {otherEmail && (
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted text-sm truncate">{otherEmail}</p>
            <button
              type="button"
              onClick={copyEmail}
              className="text-[11px] text-brass hover:underline shrink-0"
            >
              {copied ? 'Copiado ✓' : 'Copiar'}
            </button>
          </div>
        )}

        {otherPhone ? (
          <a
            href={`https://wa.me/${otherPhone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center mt-3 py-2.5 bg-bidGreen text-ink text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Escribir por WhatsApp
          </a>
        ) : (
          <p className="text-[11px] text-muted mt-3">
            {isSeller ? 'El comprador' : 'El vendedor'} no cargó un WhatsApp en su perfil, así que
            por ahora solo tenés el email.
          </p>
        )}
      </div>

      {/* Estado de la operación / handshake de confirmación */}
      {dealStatus === 'completed' && (
        <div className="mt-4 bg-bidGreen/10 border border-bidGreen/40 px-4 py-3 text-sm text-bidGreen">
          ✅ Operación completada — ambas partes confirmaron.
        </div>
      )}

      {dealStatus === 'disputed' && (
        <div className="mt-4 bg-bidRed/10 border border-bidRed/40 px-4 py-3 text-sm text-bidRed">
          ⚠️ Se reportó un problema con esta operación.
        </div>
      )}

      {dealStatus === 'pending' && (
        <div className={`mt-4 border px-4 py-3 ${myConfirmed ? 'border-bidGreen' : 'border-bidRed'}`}>
          <p className="text-xs uppercase tracking-wide text-muted mb-2">Estado de la operación</p>

          {myReported ? (
            <p className="text-bidRed text-sm">Reportaste un problema con esta operación.</p>
          ) : myConfirmed ? (
            <p className="text-parchment/80 text-sm">
              Ya confirmaste de tu lado. Esperando a {otherRoleLabel}.
            </p>
          ) : reporting ? (
            <div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Contanos qué pasó (no llegó la carta, no pagaron, etc)"
                className="w-full bg-ink border border-panelLine px-3 py-2 text-sm text-parchment placeholder:text-muted/60 focus:border-brass outline-none resize-none mb-2"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReport}
                  disabled={acting}
                  className="px-4 py-2 bg-bidRed text-ink text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {acting ? 'Enviando…' : 'Enviar reporte'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReporting(false)
                    setReason('')
                    setError('')
                  }}
                  className="px-4 py-2 border border-panelLine text-muted text-sm hover:text-parchment transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-parchment/80 text-sm mb-3">
                {otherConfirmed
                  ? `${otherRoleLabel === 'el comprador' ? 'El comprador' : 'El vendedor'} ya confirmó. Marcá cuando la operación esté resuelta de tu lado.`
                  : 'Todavía nadie confirmó que la operación se completó.'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={acting}
                  className="px-4 py-2 bg-brass text-ink text-sm font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
                >
                  {acting ? 'Guardando…' : 'Confirmar que se completó'}
                </button>
                <button
                  type="button"
                  onClick={() => setReporting(true)}
                  disabled={acting}
                  className="px-4 py-2 border border-bidRed text-bidRed text-sm font-medium hover:bg-bidRed/10 transition-colors disabled:opacity-50"
                >
                  Reportar un problema
                </button>
              </div>
            </>
          )}
          {error && <p className="text-bidRed text-xs mt-2">{error}</p>}
        </div>
      )}

      <p className="text-[11px] text-muted mt-3">
        Coordiná el pago y el envío directamente con esta persona. La plataforma no interviene en
        esa parte — revisá los <a href="/terminos" className="underline hover:text-brass">Términos y Condiciones</a>.
      </p>
    </div>
  )
}
