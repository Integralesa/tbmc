import { Link } from 'react-router-dom'

export default function MarketListingCard({ listing }) {
  const cover = listing.images?.[0]
  const isSold = listing.status === 'sold'

  return (
    <Link
      to={`/mercado/${listing.id}`}
      className={`group block border bg-panel transition-colors relative ${
        isSold ? 'border-panelLine opacity-60' : 'border-panelLine hover:border-brass/60'
      }`}
    >
      {isSold && (
        <span className="absolute top-2 left-2 z-10 text-[10px] uppercase tracking-wide px-2 py-1 font-semibold bg-ink/80 text-muted border border-panelLine">
          Vendido
        </span>
      )}
      <div className="aspect-[3/4] bg-ink overflow-hidden">
        {cover ? (
          <img
            src={cover}
            alt=""
            className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-sm">
            Sin imagen
          </div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <span className="text-xs uppercase tracking-wide text-brass/80">{listing.game}</span>
        {listing.description && (
          <p className="text-parchment/85 text-sm leading-snug line-clamp-2">{listing.description}</p>
        )}
        <p className="text-lg text-brass font-medium pt-1">
          ${listing.price?.toLocaleString('es-AR')}
        </p>
      </div>
    </Link>
  )
}
