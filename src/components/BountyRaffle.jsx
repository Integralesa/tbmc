import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { subscribeToActiveBountyRaffle } from '../lib/bountyRaffles'
import { getReferralLink } from '../lib/referrals'

/**
 * Tarjeta del sorteo bounty en el home — solo aparece mientras hay uno
 * activo (ver COMO-FUNCIONA.md). Además de avisar, muestra el link
 * personal de invitación de quien esté logueado: es al mismo tiempo el
 * aviso del sorteo y la herramienta para sumar más chances.
 */
export default function BountyRaffle() {
  const { user } = useAuth()
  const [raffle, setRaffle] = useState(undefined)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const unsub = subscribeToActiveBountyRaffle(setRaffle)
    return unsub
  }, [])

  if (!raffle) return null // cargando, o no hay sorteo activo — no ocupa lugar

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(getReferralLink(user.uid))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // si falla el portapapeles no pasa nada grave, el link ya está a la vista
    }
  }

  return (
    <div className="border-2 border-brass bg-panel p-5 mb-8 shadow-[0_0_20px_-6px_rgba(199,154,75,0.5)]">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">💰</span>
        <h2 className="font-serif text-xl text-parchment">Sorteo bounty</h2>
        <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 bg-brass text-ink font-semibold ml-1">
          Activo
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-5">
        {raffle.imageUrl && (
          <div className="w-full sm:w-56 aspect-[3/4] border-2 border-brass shrink-0 overflow-hidden mx-auto sm:mx-0 max-w-xs sm:max-w-none">
            <img src={raffle.imageUrl} alt={raffle.title} className="w-full h-full object-contain bg-ink" />
          </div>
        )}
        <div className="min-w-0 flex flex-col">
          <p className="text-parchment font-serif text-2xl">{raffle.title}</p>
          <p className="text-muted text-sm mt-2">
            Sorteamos esta carta entre todos los usuarios registrados. Traé gente nueva (que se
            registre o pujen al menos una vez) y sumás más chances de ganar.
          </p>

          {user ? (
            <div className="mt-4 pt-4 border-t border-panelLine">
              <p className="text-[11px] uppercase tracking-wide text-brass mb-1.5">Tu link de invitación</p>
              <div className="flex gap-2 flex-wrap">
                <code className="flex-1 min-w-[200px] bg-ink border border-panelLine px-3 py-2 text-xs text-parchment/85 truncate">
                  {getReferralLink(user.uid)}
                </code>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-brass text-ink text-xs font-medium hover:bg-brassHigh transition-colors"
                >
                  {copied ? '¡Copiado!' : 'Copiar link'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted mt-4 pt-4 border-t border-panelLine">
              Iniciá sesión para conseguir tu link de invitación y sumar chances.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
