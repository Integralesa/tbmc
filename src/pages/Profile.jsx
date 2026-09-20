import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribeToUserAuctions } from '../lib/auctions'
import { getActiveStrikeCount, subscribeToOwnProfile, updateUserPhone } from '../lib/users'
import { SUSURRO_EMAIL } from '../lib/roles'
import { getPlan } from '../lib/plans'
import Countdown from '../components/Countdown'
import { useMyBidAuctions } from '../hooks/useMyBidAuctions'

function PlanStatus({ userId }) {
  const [profile, setProfile] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const unsub = subscribeToOwnProfile(userId, (p) => {
      setProfile(p)
      setLoaded(true)
    })
    return unsub
  }, [userId])

  if (!loaded) return null

  const plan = getPlan(profile?.plan)
  const expiresAt = profile?.planExpiresAt?.toDate ? profile.planExpiresAt.toDate() : null
  const isExpired = expiresAt && expiresAt < new Date()

  return (
    <div className="border border-panelLine bg-panel p-4 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {plan.icon && (
          <img
            src={plan.icon}
            alt=""
            className="w-16 h-16 rounded-full border border-brass/40 bg-parchment object-cover"
          />
        )}
        <div>
          <p className="text-xs text-muted mb-0.5">Tu plan</p>
          <p className="text-parchment font-medium">{plan.label}</p>
        </div>
      </div>
      <div className="text-right">
        {expiresAt ? (
          <p className={`text-sm ${isExpired ? 'text-bidRed' : 'text-muted'}`}>
            {isExpired ? 'Venció el' : 'Vence el'} {expiresAt.toLocaleDateString('es-AR')}
          </p>
        ) : plan.key !== 'free' ? (
          <p className="text-sm text-muted">Sin fecha de vencimiento cargada</p>
        ) : null}
        {plan.key !== 'free' && (
          <Link to="/planes" className="text-xs text-brass hover:underline">
            Ver planes
          </Link>
        )}
      </div>
    </div>
  )
}

// Lista de países soportados para el prefijo de WhatsApp. Por ahora solo
// Argentina (WhatsApp necesita el '9' extra para celulares argentinos).
// Para sumar otro país en el futuro, alcanza con agregar un objeto acá.
const COUNTRIES = [
  { code: 'AR', label: 'Argentina (+54)', dial: '54', mobilePrefix: '9', example: '1122334455' },
]

function buildWhatsAppNumber(country, localDigits) {
  return `${country.dial}${country.mobilePrefix}${localDigits}`
}

// Área + número de un celular argentino sin 0/15 entra siempre en 10-11
// dígitos — este tope es lo que evita que el campo se desborde de la caja.
const LOCAL_NUMBER_MAX_LENGTH = 11

function PhoneEditor({ userId }) {
  const [countryCode, setCountryCode] = useState(COUNTRIES[0].code)
  const [localNumber, setLocalNumber] = useState('')
  const [savedPhone, setSavedPhone] = useState('') // número completo (549...) tal cual está en Firestore
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  const country = COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0]
  const cleanLocal = localNumber.replace(/\D/g, '')
  const preview = cleanLocal ? buildWhatsAppNumber(country, cleanLocal) : ''

  useEffect(() => {
    const unsub = subscribeToOwnProfile(userId, (profile) => {
      // si ya había un teléfono guardado (formato completo 549...), separamos
      // el prefijo para precargar el campo de número local.
      const full = profile?.phone || ''
      setSavedPhone(full)
      const prefix = country.dial + country.mobilePrefix
      setLocalNumber(full.startsWith(prefix) ? full.slice(prefix.length) : full)
      setLoaded(true)
    })
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  function handleLocalNumberChange(e) {
    // Solo números — nada de letras ni caracteres especiales, ni al
    // escribir ni al pegar — y con un tope de dígitos para que no se
    // desborde de la caja.
    setLocalNumber(e.target.value.replace(/\D/g, '').slice(0, LOCAL_NUMBER_MAX_LENGTH))
  }

  function handleStartEditing() {
    setError('')
    setSaved(false)
    setEditing(true)
  }

  function handleCancelEditing() {
    // Volvemos a lo que había guardado, descartando cambios sin confirmar.
    const prefix = country.dial + country.mobilePrefix
    setLocalNumber(savedPhone.startsWith(prefix) ? savedPhone.slice(prefix.length) : savedPhone)
    setError('')
    setEditing(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await updateUserPhone(userId, cleanLocal ? preview : '')
      setSaved(true)
      setEditing(false)
    } catch (err) {
      setError(err.message || 'No se pudo guardar. Probá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  if (!loaded) return null

  return (
    <div className="border border-panelLine bg-panel p-4 mb-8">
      <p className="text-sm text-parchment mb-1">WhatsApp (opcional)</p>
      <p className="text-[11px] text-muted mb-3">
        Se muestra solo a la otra parte cuando ganás o vendés una subasta, para coordinar además
        del email.
      </p>

      {!editing ? (
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-parchment">
            {savedPhone ? <>+{savedPhone}</> : <span className="text-muted">No cargaste un WhatsApp todavía.</span>}
          </p>
          <button
            type="button"
            onClick={handleStartEditing}
            className="text-xs text-brass hover:underline"
          >
            {savedPhone ? 'Editar' : 'Agregar'}
          </button>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-muted mb-2">
            Escribí tu número con código de área, <strong>sin el 0 ni el 15</strong> (ej: para
            011-15-2233-4455 escribí {country.example}). Solo números.
          </p>
          <form onSubmit={handleSave} className="flex flex-wrap gap-2">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="bg-ink border border-panelLine px-2 py-2 text-sm text-parchment focus:border-brass outline-none"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={LOCAL_NUMBER_MAX_LENGTH}
              value={localNumber}
              onChange={handleLocalNumberChange}
              placeholder={country.example}
              className="flex-1 min-w-[140px] bg-ink border border-panelLine px-3 py-2 text-sm text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
            />
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-brass text-ink text-sm font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={handleCancelEditing}
              disabled={saving}
              className="px-4 py-2 border border-panelLine text-parchment text-sm hover:border-brass transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          </form>

          {preview && (
            <div className="flex items-center gap-3 mt-3">
              <p className="text-[11px] text-muted">
                Va a quedar: <span className="text-parchment">+{preview}</span>
              </p>
              <a
                href={`https://wa.me/${preview}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-brass hover:underline"
              >
                Previsualizar mi WhatsApp →
              </a>
            </div>
          )}
        </>
      )}
      {saved && <p className="text-bidGreen text-xs mt-2">Guardado.</p>}
      {error && <p className="text-bidRed text-xs mt-2">{error}</p>}
    </div>
  )
}

function StatusBadge({ status }) {
  if (status === 'pending_review') {
    return <span className="text-xs text-brass">⏳ En revisión</span>
  }
  if (status === 'active') {
    return <span className="text-xs text-bidGreen">Activa</span>
  }
  if (status === 'closed_by_admin') {
    return <span className="text-xs text-bidRed">🔒 Cerrada por admin</span>
  }
  if (status === 'cancelled_by_seller') {
    return <span className="text-xs text-bidRed">❌ Cancelada por vos</span>
  }
  return <span className="text-xs text-muted">Cerrada</span>
}

function MisSubastas({ userId }) {
  const [auctions, setAuctions] = useState(null)

  useEffect(() => {
    const unsub = subscribeToUserAuctions(userId, setAuctions)
    return unsub
  }, [userId])

  if (auctions === null) return <p className="text-muted">Cargando…</p>
  if (auctions.length === 0) {
    return (
      <div className="border border-panelLine border-dashed p-8 text-center">
        <p className="text-parchment mb-1">Todavía no publicaste ninguna carta.</p>
        <Link to="/publicar" className="text-brass text-sm hover:underline">
          Publicar mi primera carta
        </Link>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-panelLine">
      {auctions.map((a) => (
        <li key={a.id}>
          <Link
            to={`/subasta/${a.id}`}
            className="flex items-center gap-4 py-4 hover:bg-panel/60 transition-colors px-2"
          >
            <div className="w-14 h-20 bg-panel border border-panelLine shrink-0 overflow-hidden">
              {a.images?.[0] && (
                <img src={a.images[0]} alt={a.title} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-parchment font-serif text-lg truncate">{a.title}</p>
              <p className="text-xs text-muted">{a.bidCount || 0} pujas</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-brass font-medium">
                ${a.currentPrice?.toLocaleString('es-AR')}
              </p>
              <div className="text-xs mt-0.5">
                <StatusBadge status={a.status} />
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function MisPujas({ userId }) {
  const { loading, auctionIds, auctionsById } = useMyBidAuctions(userId)

  if (loading) return <p className="text-muted">Cargando…</p>
  if (auctionIds.length === 0) {
    return (
      <div className="border border-panelLine border-dashed p-8 text-center">
        <p className="text-parchment mb-1">Todavía no pujaste en ninguna subasta.</p>
        <Link to="/" className="text-brass text-sm hover:underline">
          Ver lotes activos
        </Link>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-panelLine">
      {auctionIds.map((id) => {
        const a = auctionsById[id]
        if (!a) return null
        const winning = a.currentBidderId === userId
        const ended = a.status !== 'active'

        return (
          <li key={id}>
            <Link
              to={`/subasta/${id}`}
              className="flex items-center gap-4 py-4 hover:bg-panel/60 transition-colors px-2"
            >
              <div className="w-14 h-20 bg-panel border border-panelLine shrink-0 overflow-hidden">
                {a.images?.[0] && (
                  <img src={a.images[0]} alt={a.title} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-parchment font-serif text-lg truncate">{a.title}</p>
                <p className="text-xs">
                  {a.status === 'closed_by_admin' ? (
                    <span className="text-bidRed">🔒 Cerrada por administración</span>
                  ) : a.status === 'cancelled_by_seller' ? (
                    <span className="text-bidRed">❌ El vendedor canceló esta subasta</span>
                  ) : ended ? (
                    winning ? (
                      <span className="text-brass">Ganaste esta subasta</span>
                    ) : (
                      <span className="text-muted">No ganaste</span>
                    )
                  ) : winning ? (
                    <span className="text-bidGreen">Vas ganando</span>
                  ) : (
                    <span className="text-bidRed">Te superaron</span>
                  )}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-brass font-medium">
                  ${a.currentPrice?.toLocaleString('es-AR')}
                </p>
                {!ended && (
                  <div className="text-xs mt-0.5">
                    <Countdown endsAt={a.endsAt} />
                  </div>
                )}
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function SubastasGanadas({ userId }) {
  const { loading, auctionIds, auctionsById } = useMyBidAuctions(userId)

  const wonIds = auctionIds.filter((id) => {
    const a = auctionsById[id]
    return a && a.status === 'ended' && a.currentBidderId === userId
  })

  if (loading) return <p className="text-muted">Cargando…</p>
  if (wonIds.length === 0) {
    return (
      <div className="border border-panelLine border-dashed p-8 text-center">
        <p className="text-parchment mb-1">Todavía no ganaste ninguna subasta.</p>
        <Link to="/" className="text-brass text-sm hover:underline">
          Ver lotes activos
        </Link>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-panelLine">
      {wonIds.map((id) => {
        const a = auctionsById[id]
        return (
          <li key={id}>
            <Link
              to={`/subasta/${id}`}
              className="flex items-center gap-4 py-4 hover:bg-panel/60 transition-colors px-2"
            >
              <div className="w-14 h-20 bg-panel border border-panelLine shrink-0 overflow-hidden">
                {a.images?.[0] && (
                  <img src={a.images[0]} alt={a.title} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-parchment font-serif text-lg truncate">{a.title}</p>
                <p className="text-xs text-brass">🏆 Ganaste esta subasta</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-brass font-medium">${a.currentPrice?.toLocaleString('es-AR')}</p>
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export default function Profile() {
  const { user, profile } = useAuth()
  const [tab, setTab] = useState('subastas')

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <p className="text-parchment">Iniciá sesión con Google para ver tu perfil.</p>
      </div>
    )
  }

  const strikeCount = getActiveStrikeCount(profile)

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-8">
        {user.photoURL && (
          <img src={user.photoURL} alt={user.displayName} className="w-12 h-12 rounded-full" />
        )}
        <div>
          <h1 className="font-serif text-2xl text-parchment">{user.displayName}</h1>
          <p className="text-muted text-sm">{user.email}</p>
        </div>
      </div>

      {strikeCount > 0 && (
        <div
          className={`border px-4 py-3 mb-4 text-sm text-bidRed ${
            strikeCount >= 3 ? 'border-bidRed bg-bidRed/10' : 'border-bidRed/40 bg-bidRed/5'
          }`}
        >
          <p>
            {strikeCount >= 3 ? '🚫' : '⚠️'} Tenés <strong>{strikeCount}</strong>{' '}
            {strikeCount === 1 ? 'aviso activo' : 'avisos activos'} por subastas no concretadas
            {strikeCount === 2 && ' — la próxima podría implicar la suspensión de tu cuenta'}
            {strikeCount >= 3 && ' — tu cuenta ya fue suspendida por esto'}.
          </p>
          <p className="text-[11px] mt-1.5 text-bidRed/80">
            Cada aviso se borra solo a las 2 semanas de aplicado. Revisá los{' '}
            <a href="/terminos" className="underline">Términos y Condiciones</a>, y si creés que
            hay un error, escribinos a{' '}
            <a href={`mailto:${SUSURRO_EMAIL}?subject=${encodeURIComponent('Quiero apelar una sanción')}`} className="underline">
              {SUSURRO_EMAIL}
            </a>{' '}
            para pedir que lo revisemos.
          </p>
        </div>
      )}

      <PlanStatus userId={user.uid} />
      <PhoneEditor userId={user.uid} />

      <div className="flex gap-6 border-b border-panelLine mb-6">
        <button
          onClick={() => setTab('subastas')}
          className={`pb-3 text-sm ${
            tab === 'subastas'
              ? 'text-brass border-b-2 border-brass'
              : 'text-muted hover:text-parchment'
          }`}
        >
          Mis subastas
        </button>
        <button
          onClick={() => setTab('pujas')}
          className={`pb-3 text-sm ${
            tab === 'pujas'
              ? 'text-brass border-b-2 border-brass'
              : 'text-muted hover:text-parchment'
          }`}
        >
          Mis pujas
        </button>
        <button
          onClick={() => setTab('ganadas')}
          className={`pb-3 text-sm ${
            tab === 'ganadas'
              ? 'text-brass border-b-2 border-brass'
              : 'text-muted hover:text-parchment'
          }`}
        >
          Subastas ganadas
        </button>
      </div>

      {tab === 'subastas' ? (
        <MisSubastas userId={user.uid} />
      ) : tab === 'pujas' ? (
        <MisPujas userId={user.uid} />
      ) : (
        <SubastasGanadas userId={user.uid} />
      )}
    </div>
  )
}
