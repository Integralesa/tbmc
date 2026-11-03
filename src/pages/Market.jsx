import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { subscribeToMarketListings } from '../lib/market'
import MarketListingCard from '../components/MarketListingCard'

const GAMES = ['Pokémon', 'Magic: The Gathering', 'Yu-Gi-Oh!', 'One Piece', 'Otro']
const GAME_FILTER_OPTIONS = ['Todos', ...GAMES]

export default function Market() {
  const [listings, setListings] = useState(null)
  const [game, setGame] = useState('Todos')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  useEffect(() => {
    const unsubscribe = subscribeToMarketListings(setListings)
    return unsubscribe
  }, [])

  const filtered = useMemo(() => {
    if (!listings) return null
    return listings.filter((l) => {
      if (game !== 'Todos' && l.game !== game) return false
      if (minPrice !== '' && l.price < Number(minPrice)) return false
      if (maxPrice !== '' && l.price > Number(maxPrice)) return false
      return true
    })
  }, [listings, game, minPrice, maxPrice])

  const hasActiveFilters = game !== 'Todos' || minPrice !== '' || maxPrice !== ''

  function clearFilters() {
    setGame('Todos')
    setMinPrice('')
    setMaxPrice('')
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8 max-w-xl">
        <h1 className="font-serif text-3xl text-parchment mb-2">Mercado</h1>
        <p className="text-muted">
          Fotos de carpetas y colecciones a precio fijo — sin puja, sin cierre. Si te interesa algo,
          entrás al aviso y contactás directo a quien vende.
        </p>
      </div>

      <div className="mb-8">
        <Link
          to="/mercado/publicar"
          className="inline-block bg-brass text-ink font-medium px-4 py-2.5 hover:bg-brassHigh transition-colors"
        >
          Publicar en el Mercado
        </Link>
      </div>

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
                {g}
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
            <button onClick={clearFilters} className="text-sm text-muted hover:text-brass transition-colors pb-2">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {listings === null && <p className="text-muted">Cargando publicaciones…</p>}

      {listings?.length === 0 && (
        <div className="border border-panelLine border-dashed p-10 text-center">
          <p className="text-parchment mb-1">Todavía no hay nada publicado en el Mercado.</p>
          <p className="text-muted text-sm">Sé el primero en subir fotos de tu carpeta.</p>
        </div>
      )}

      {listings && listings.length > 0 && filtered.length === 0 && (
        <div className="border border-panelLine border-dashed p-10 text-center">
          <p className="text-parchment mb-1">Nada coincide con esos filtros.</p>
          <button onClick={clearFilters} className="text-brass text-sm hover:underline">
            Limpiar filtros
          </button>
        </div>
      )}

      {filtered && filtered.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {filtered.map((l) => (
            <MarketListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  )
}
