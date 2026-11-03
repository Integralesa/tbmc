import { Link } from 'react-router-dom'
import { FiCoffee } from 'react-icons/fi'

function InstagramIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function TelegramIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M21 4 3 11.5l6 2m12-9.5-3.5 16-8.5-6.5m12-9.5L9 13.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-panelLine mt-16">
      <div className="max-w-5xl mx-auto px-6 py-8 text-center space-y-3">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <a
            href="https://instagram.com/theblackmarketconnections"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="text-muted hover:text-brass transition-colors"
          >
            <InstagramIcon className="w-5 h-5" />
          </a>
          <a
            href="https://t.me/tablontbmc"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Telegram"
            className="text-muted hover:text-brass transition-colors"
          >
            <TelegramIcon className="w-5 h-5" />
          </a>
          <a
            href="https://ko-fi.com/theblackmarketconnections"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ko-fi"
            className="text-muted hover:text-brass transition-colors"
            title="Donar en Ko-fi"
          >
            <FiCoffee className="w-5 h-5" />
          </a>
        </div>
        <p className="text-sm text-muted">
          © {year} The Black Market Connections. Todos los derechos reservados.
        </p>
        <p className="text-sm">
          <Link to="/nosotros" className="text-brass hover:underline">
            Quiénes somos
          </Link>
          <span className="text-panelLine mx-2">|</span>
          <Link to="/planes" className="text-brass hover:underline">
            Planes
          </Link>
          <span className="text-panelLine mx-2">|</span>
          <Link to="/terminos" className="text-brass hover:underline">
            Términos y Condiciones
          </Link>
          <span className="text-panelLine mx-2">|</span>
          <Link to="/privacidad" className="text-brass hover:underline">
            Política de Privacidad
          </Link>
        </p>
        <p className="text-xs text-muted max-w-2xl mx-auto leading-relaxed">
          The Black Market Connections es un proyecto independiente. No estamos afiliados ni respaldados por
          Wizards of the Coast, Pokémon, Konami u otras marcas. Las marcas e imágenes pertenecen a
          sus respectivos dueños.
        </p>
      </div>
    </footer>
  )
}
