import { Link } from 'react-router-dom'

export default function WorkbenchProductCard({ product }) {
  const cover = product.images?.[0]

  return (
    <Link
      to={`/workbench/${product.id}`}
      className={`group block border bg-panel transition-colors relative ${
        product.active === false ? 'border-panelLine opacity-60' : 'border-panelLine hover:border-brass/60'
      }`}
    >
      {product.active === false && (
        <span className="absolute top-2 left-2 z-10 text-[10px] uppercase tracking-wide px-2 py-1 font-semibold bg-ink/80 text-muted border border-panelLine">
          Oculto
        </span>
      )}
      {product.videoUrl && (
        <span className="absolute top-2 right-2 z-10 text-[10px] uppercase tracking-wide px-2 py-1 font-semibold bg-brass text-ink">
          ▶ Video
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
      <div className="p-4 space-y-1">
        <h3 className="font-serif text-lg text-parchment leading-snug line-clamp-1">{product.title}</h3>
        <p className="text-lg text-brass font-medium">${product.price?.toLocaleString('es-AR')}</p>
      </div>
    </Link>
  )
}
