import bannerLeft from '../assets/banner-left.jpg'
import bannerRight from '../assets/banner-right.jpg'

// Ancho real de las imágenes — no tiene sentido mostrar más que esto.
const IMAGE_WIDTH = 500

// El ancho visible se calcula solo, según cuánto lugar libre queda fuera
// del contenido central (max-w-5xl = 1024px): crece en pantallas anchas y
// se achica en pantallas más chicas, sin un corte abrupto por breakpoint.
const dynamicWidth = `min(${IMAGE_WIDTH}px, calc((100vw - 1024px) / 2))`

/**
 * Franjas decorativas a los costados de la pantalla, para que las páginas
 * no se sientan tan vacías en monitores anchos. No son clickeables
 * (pointer-events-none) y van detrás de todo (z-index bajo), puramente
 * ambientación — en pantallas sin espacio de sobra, el ancho calculado da
 * 0 y no se ve nada (no hace falta ocultarlas a mano).
 */
export default function SideBanners() {
  return (
    <>
      <div
        className="fixed left-0 top-0 h-screen z-0 pointer-events-none overflow-hidden"
        style={{ width: dynamicWidth }}
      >
        <img
          src={bannerLeft}
          alt=""
          className="h-full object-cover opacity-60"
          style={{
            width: `${IMAGE_WIDTH}px`,
            maskImage: 'linear-gradient(to bottom, transparent, black 8%, black 92%, transparent), linear-gradient(to right, black 80%, transparent)',
            maskComposite: 'intersect',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent, black 8%, black 92%, transparent), linear-gradient(to right, black 80%, transparent)',
            WebkitMaskComposite: 'source-in',
          }}
        />
      </div>

      <div
        className="fixed right-0 top-0 h-screen z-0 pointer-events-none overflow-hidden flex justify-end"
        style={{ width: dynamicWidth }}
      >
        <img
          src={bannerRight}
          alt=""
          className="h-full object-cover opacity-60"
          style={{
            width: `${IMAGE_WIDTH}px`,
            maskImage: 'linear-gradient(to bottom, transparent, black 8%, black 92%, transparent), linear-gradient(to left, black 80%, transparent)',
            maskComposite: 'intersect',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent, black 8%, black 92%, transparent), linear-gradient(to left, black 80%, transparent)',
            WebkitMaskComposite: 'source-in',
          }}
        />
      </div>
    </>
  )
}
