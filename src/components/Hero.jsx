import heroBanner from '../assets/hero-banner.jpg'
import { Link } from 'react-router-dom'

export default function Hero() {
  return (
    <div className="relative h-[380px] md:h-[460px] overflow-hidden border-b border-panelLine max-w-5xl mx-auto">
      <img
        src={heroBanner}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover object-center"
      />
      {/* degradé para que se funda con el fondo oscuro de la app */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/80 via-transparent to-transparent" />

      <div className="relative h-full max-w-5xl mx-auto px-6 flex flex-col justify-end pb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-brass mb-3">
          Subastas entre coleccionistas
        </p>
        <h1 className="font-serif text-4xl md:text-5xl text-parchment leading-tight max-w-lg">
          The Black Market <span className="italic text-brass">Connections</span>
        </h1>
        <p className="text-parchment/70 mt-4 max-w-md">
          Comprá y vendé cartas coleccionables en subastas en tiempo real. Sin intermediarios,
          sin vueltas — solo vos, la carta, y quien la quiera más que vos.
        </p>
        <div>
          <Link
            to="/publicar"
            className="inline-block mt-6 px-5 py-2.5 bg-brass text-ink font-medium hover:bg-brassHigh transition-colors"
          >
            Publicar una carta
          </Link>
        </div>
      </div>
    </div>
  )
}
