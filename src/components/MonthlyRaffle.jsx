import { useEffect, useState } from 'react'
import { subscribeToLatestRaffle } from '../lib/raffles'

function formatPeriod(timestamp) {
  if (!timestamp?.toDate) return ''
  const label = timestamp.toDate().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function MonthlyRaffle() {
  const [raffle, setRaffle] = useState(undefined)

  useEffect(() => {
    const unsub = subscribeToLatestRaffle(setRaffle)
    return unsub
  }, [])

  if (raffle === undefined) return null // cargando

  return (
    <div className="border border-panelLine bg-panel p-5 mb-8">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🎲</span>
        <h2 className="font-serif text-xl text-parchment">Sorteo mensual</h2>
      </div>
      <p className="text-muted text-sm mb-4">
        Cada 1° de mes sorteamos, entre quienes subastaron el mes anterior: 1 mes de{' '}
        <strong className="text-parchment/90">Informante</strong> para alguien del plan Chusma, y
        si hay 30 o más Informantes activos, 1 mes de{' '}
        <strong className="text-parchment/90">Intel de Pícaros</strong> entre ellos.
      </p>

      {raffle === null ? (
        <p className="text-sm text-parchment/70">
          Todavía no se corrió ningún sorteo — el primero sale el 1° del próximo mes. Publicá una
          carta este mes para entrar en carrera.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-ink border border-panelLine px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-brass mb-1">
              Informante — {formatPeriod(raffle.periodStart)}
            </p>
            {raffle.freeWinnerName ? (
              <p className="text-parchment">
                🏆 Ganó <strong>{raffle.freeWinnerName}</strong>
              </p>
            ) : (
              <p className="text-muted text-sm">Sin candidatos ese mes.</p>
            )}
            <p className="text-[11px] text-muted mt-1">
              {raffle.freeCandidates} persona{raffle.freeCandidates === 1 ? '' : 's'} en carrera
            </p>
          </div>

          <div className="bg-ink border border-panelLine px-4 py-3">
            <p className="text-[11px] uppercase tracking-wide text-brass mb-1">
              Intel de Pícaros — {formatPeriod(raffle.periodStart)}
            </p>
            {raffle.proRaffleHeld ? (
              <p className="text-parchment">
                🏆 Ganó <strong>{raffle.proWinnerName}</strong>
              </p>
            ) : (
              <p className="text-muted text-sm">
                No se hizo — hicieron falta 30 Informantes activos (hubo {raffle.proCandidates}).
              </p>
            )}
            <p className="text-[11px] text-muted mt-1">
              {raffle.proCandidates} persona{raffle.proCandidates === 1 ? '' : 's'} en carrera
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
