import { useEffect, useMemo, useState } from 'react'
import { subscribeToActiveAuctions } from '../lib/auctions'
import AuctionCard from '../components/AuctionCard'
import Hero from '../components/Hero'
import BountyRaffle from '../components/BountyRaffle'
import MonthlyRaffle from '../components/MonthlyRaffle'

const GAMES = ['Pokémon', 'Magic: The Gathering', 'Yu-Gi-Oh!', 'One Piece']

// No es un valor real de `game` (esas subastas guardan el juego que se
// haya dejado elegido en el dropdown al publicar, que no dice nada útil
// para un juego de mesa) — filtra por `itemType === 'board_game'` en vez
// de por el campo `game` (ver el filtro más abajo, en `filtered`).
const BOARD_GAMES_FILTER = 'BoardGames'

// Etiquetas cortas para que los botones de filtro no ocupen tanto lugar.
const GAME_FILTER_LABELS = {
  Todos: 'Todos',
  'Pokémon': 'Pokémon',
  'Magic: The Gathering': 'Magic',
  'Yu-Gi-Oh!': 'Yu-Gi-Oh!',
  'One Piece': 'One Piece',
  [BOARD_GAMES_FILTER]: 'Juegos de mesa',
}
const GAME_FILTER_OPTIONS = ['Todos', ...GAMES, BOARD_GAMES_FILTER]

export default function Home() {
  const [auctions, setAuctions] = useState(null)
  const [game, setGame] = useState('Todos')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  useEffect(() => {
    const unsubscribe = subscribeToActiveAuctions(setAuctions)
    return unsubscribe
  }, [])

  const filtered = useMemo(() => {
    if (!auctions) return null
    const result = auctions.filter((a) => {
      if (game === BOARD_GAMES_FILTER && a.itemType !== 'board_game') return false
      if (game !== 'Todos' && game !== BOARD_GAMES_FILTER && a.game !== game) return false
      if (minPrice !== '' && a.currentPrice < Number(minPrice)) return false
      if (maxPrice !== '' && a.currentPrice > Number(maxPrice)) return false
      return true
    })
    // Destacados primero (Intel de Pícaros > Informante > Chusma); dentro de
    // cada nivel, se mantiene el orden por cierre más próximo que ya trae
    // la consulta. Se ordena acá (no en Firestore) para no perder de la
    // lista las subastas viejas que todavía no tienen este campo.
    return [...result].sort(
      (a, b) => (b.sellerPlanPriority || 0) - (a.sellerPlanPriority || 0),
    )
  }, [auctions, game, minPrice, maxPrice])

  const hasActiveFilters = game !== 'Todos' || minPrice !== '' || maxPrice !== ''

  function clearFilters() {
    setGame('Todos')
    setMinPrice('')
    setMaxPrice('')
  }

  return (
    <div>
      <Hero />

      <div className="max-w-5xl mx-auto px-6 py-10">
      <BountyRaffle />
      <MonthlyRaffle />

      <div className="mb-8 max-w-xl">
        <h2 className="font-serif text-3xl text-parchment mb-2">Lotes en subasta</h2>
        <p className="text-muted">
          Cartas en venta ahora mismo, ordenadas por cierre más próximo. Las pujas se actualizan solas.
        </p>
      </div>

      {/* Filtros */}
      <div className="mb-8 pb-6 border-b border-panelLine">
        <div className="mb-4">
          <label className="block text-xs text-muted mb-1.5">Juego</label>
          <div className="flex flex-wrap gap-2">
            {GAME_FILTER_OPTIONS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGame(g)}
                className={`px-3 py-1.5 text-sm border transition-colors ${
                  game === g
                    ? 'bg-brass text-ink border-brass font-medium'
                    : 'bg-panel text-parchment/80 border-panelLine hover:border-brass'
                }`}
              >
                {GAME_FILTER_LABELS[g]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs text-muted mb-1.5">Precio mínimo</label>
          <input
            type="number"
            min="0"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="$0"
            className="w-28 bg-panel border border-panelLine px-3 py-2 text-sm text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
          />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1.5">Precio máximo</label>
          <input
            type="number"
            min="0"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Sin límite"
            className="w-28 bg-panel border border-panelLine px-3 py-2 text-sm text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-muted hover:text-brass transition-colors pb-2"
          >
            Limpiar filtros
          </button>
        )}
        </div>
      </div>

      {auctions === null && <p className="text-muted">Cargando lotes…</p>}

      {auctions?.length === 0 && (
        <div className="border border-panelLine border-dashed p-10 text-center">
          <p className="text-parchment mb-1">Todavía no hay subastas activas.</p>
          <p className="text-muted text-sm">Sé el primero en publicar una carta.</p>
        </div>
      )}

      {auctions && auctions.length > 0 && filtered.length === 0 && (
        <div className="border border-panelLine border-dashed p-10 text-center">
          <p className="text-parchment mb-1">Ningún lote coincide con esos filtros.</p>
          <button onClick={clearFilters} className="text-brass text-sm hover:underline">
            Limpiar filtros
          </button>
        </div>
      )}

      {filtered && filtered.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {filtered.map((a, i) => (
            <AuctionCard key={a.id} auction={a} lotNumber={i + 1} />
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
