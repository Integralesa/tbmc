import { Link } from 'react-router-dom'
import Countdown from './Countdown'

export default function AuctionCard({ auction, lotNumber }) {
  const cover = auction.images?.[0]
  const priority = auction.sellerPlanPriority || 0
  const isTopTier = priority >= 2
  const isFeatured = priority >= 1
  const isClosedByAdmin = auction.status === 'closed_by_admin'

  return (
    <Link
      to={`/subasta/${auction.id}`}
      className={`group block border bg-panel transition-colors relative ${
        isClosedByAdmin
          ? 'border-bidRed'
          : isTopTier
            ? 'border-brass shadow-[0_0_16px_-4px_rgba(199,154,75,0.6)]'
            : isFeatured
              ? 'border-brass/50'
              : 'border-panelLine hover:border-brass/60'
      }`}
    >
      {isClosedByAdmin ? (
        <span className="absolute top-2 left-2 z-10 text-[10px] uppercase tracking-wide px-2 py-1 font-semibold bg-bidRed text-ink">
          🔒 Cerrada por admin
        </span>
      ) : (
        isFeatured && (
          <span
            className={`absolute top-2 left-2 z-10 text-[10px] uppercase tracking-wide px-2 py-1 font-semibold ${
              isTopTier ? 'bg-brass text-ink' : 'bg-ink/80 text-brass border border-brass/50'
            }`}
          >
            {isTopTier ? '★ Intel de Pícaros' : 'Destacado'}
          </span>
        )
      )}

      <div className="aspect-[3/4] bg-ink overflow-hidden">
        {cover ? (
          <img
            src={cover}
            alt={auction.title}
            className={`w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-300 ${
              isClosedByAdmin ? 'opacity-50' : ''
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-sm">
            Sin imagen
          </div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs text-muted font-mono">Lote {lotNumber}</span>
          <span className="text-xs uppercase tracking-wide text-brass/80">{auction.game}</span>
        </div>
        <h3 className="font-serif text-lg text-parchment leading-snug line-clamp-2 flex items-center gap-1.5 flex-wrap">
          {auction.title}
          {auction.isFoil && (
            <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 bg-brass text-ink font-semibold shrink-0">
              Foil
            </span>
          )}
          {auction.isGraded && (
            <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 bg-ink border border-brass text-brass font-semibold shrink-0">
              {auction.gradingCompany} {auction.grade}
            </span>
          )}
          {auction.sealIntact && (
            <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 bg-ink border border-brass text-brass font-semibold shrink-0">
              🔒 Sellado
            </span>
          )}
        </h3>
        <div className="flex items-end justify-between pt-1">
          <div>
            <p className="text-[11px] text-muted">Puja actual</p>
            <p className="text-lg text-brass font-medium">
              ${auction.currentPrice?.toLocaleString('es-AR')}
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="text-muted">{auction.bidCount || 0} pujas</p>
            {isClosedByAdmin ? (
              <p className="text-bidRed">Cerrada</p>
            ) : (
              <Countdown endsAt={auction.endsAt} />
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
