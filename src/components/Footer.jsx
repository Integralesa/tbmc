import { Link } from 'react-router-dom'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-panelLine mt-16">
      <div className="max-w-5xl mx-auto px-6 py-8 text-center space-y-3">
        <p className="text-sm text-muted">
          © {year} The Black Market Connections. Todos los derechos reservados.
        </p>
        <p className="text-sm">
          <Link to="/nosotros" className="text-brass hover:underline">
            Quiénes somos
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
