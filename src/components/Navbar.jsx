import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isStaff } from '../lib/roles'
import NotificationBell from './NotificationBell'
import NotificationBadge from './NotificationBadge'
import PublishAuctionModal from './PublishAuctionModal'

export default function Navbar() {
  const { user, profile, loginWithGoogle, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [publishModalOpen, setPublishModalOpen] = useState(false)

  const linkClass = 'text-sm text-parchment/80 hover:text-brass transition-colors'

  // Los mismos links de página se usan en el menú de escritorio (fila
  // horizontal) y en el desplegable de celular (columna) — así no hay que
  // mantener dos listas. Cada uno cierra el menú de celular al navegar.
  const pageLinks = (
    <>
      <Link to="/" onClick={() => setMenuOpen(false)} className={linkClass}>
        Subastas
      </Link>
      <Link to="/buscar" onClick={() => setMenuOpen(false)} className={linkClass}>
        Buscar
      </Link>
      {isStaff(user, profile) && (
        <Link
          to="/admin"
          onClick={() => setMenuOpen(false)}
          className="text-xs uppercase tracking-wide text-bidRed/80 hover:text-bidRed transition-colors"
        >
          Admin
        </Link>
      )}
    </>
  )

  const authSection = user ? (
    <div className="flex items-center gap-3">
      <button
        onClick={() => setPublishModalOpen(true)}
        className="text-sm font-medium px-4 py-2 rounded-sm bg-brass text-ink hover:bg-brassHigh transition-colors"
      >
        Publicar
      </button>
      <Link to="/perfil" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 group">
        {user.photoURL && (
          <img
            src={user.photoURL}
            alt={user.displayName}
            className="w-8 h-8 rounded-full border border-panelLine group-hover:border-brass transition-colors"
          />
        )}
        <span className="text-sm text-parchment/80 group-hover:text-brass transition-colors">
          Mi perfil
        </span>
      </Link>
      <button
        onClick={() => {
          logout()
          setMenuOpen(false)
        }}
        className="text-sm text-muted hover:text-parchment transition-colors"
      >
        Salir
      </button>
    </div>
  ) : (
    <button
      onClick={() => {
        loginWithGoogle()
        setMenuOpen(false)
      }}
      className="text-sm font-medium px-4 py-2 rounded-sm bg-brass text-ink hover:bg-brassHigh transition-colors"
    >
      Ingresar con Google
    </button>
  )

  return (
    <header className="relative">
      <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between md:justify-end gap-4 border-b border-panelLine">
        {/* Escritorio: todo en una fila */}
        <nav className="hidden md:flex items-center gap-6">
          {pageLinks}
          {user && <NotificationBadge />}
          {user && <NotificationBell />}
          {authSection}
        </nav>

        {/* Celular: campanita (si hay sesión) + botón de menú compacto */}
        <div className="flex md:hidden items-center gap-3 ml-auto">
          {user && <NotificationBadge />}
          {user && <NotificationBell />}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            className="text-parchment/80 hover:text-brass text-2xl leading-none w-8 h-8 flex items-center justify-center"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-panelLine bg-ink px-6 py-4 flex flex-col gap-4">
          {pageLinks}
          <div className="pt-2 border-t border-panelLine">{authSection}</div>
        </div>
      )}
      <PublishAuctionModal isOpen={publishModalOpen} onClose={() => setPublishModalOpen(false)} />
    </header>
  )
}
