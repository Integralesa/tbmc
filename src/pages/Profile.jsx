import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { DURATION_TIERS, replaceAuctionImages, republishAuction, subscribeToUserAuctions } from '../lib/auctions'
import { deleteListing, markListingSold, reactivateListing, subscribeToUserListings } from '../lib/market'
import { subscribeToUserOrders } from '../lib/workbench'
import {
  getActiveStrikeCount,
  getReputationOpsCount,
  getReputationScore,
  getUsernameCooldownRemainingMs,
  subscribeToOwnProfile,
  updateUserPhone,
  updateUsername,
  USERNAME_PATTERN,
} from '../lib/users'
import { SUSURRO_EMAIL } from '../lib/roles'
import { getPlan } from '../lib/plans'
import Countdown from '../components/Countdown'
import { useMyBidAuctions } from '../hooks/useMyBidAuctions'

/**
 * Puntaje de reputación (1 a 5 estrellas) — ver getReputationScore en
 * lib/users.js. Por ahora solo visible acá, en el propio perfil (todavía
 * hay poca historia real en el sitio como para mostrarlo en público sin
 * que confunda). Con pocas operaciones reales el puntaje queda cerca de 4
 * a propósito (beneficio de la duda) — por eso se muestra también la
 * cantidad de operaciones, para que se entienda que es un puntaje que
 * recién empieza a formarse.
 */
function ReputationStars({ userId }) {
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

  const score = getReputationScore(profile)
  const ops = getReputationOpsCount(profile)
  const fullStars = Math.round(score)

  return (
    <div className="border border-panelLine bg-panel p-4 mb-4">
      <p className="text-xs text-muted mb-1">Tu reputación</p>
      <div className="flex items-center gap-2">
        <div className="flex text-lg leading-none" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={i <= fullStars ? 'text-brass' : 'text-panelLine'}>
              ★
            </span>
          ))}
        </div>
        <span className="text-parchment font-medium">{score.toFixed(1)}</span>
        <span className="text-xs text-muted">
          ({ops} {ops === 1 ? 'operación' : 'operaciones'})
        </span>
      </div>
      {ops === 0 && (
        <p className="text-xs text-muted mt-1">
          Todavía no tenés operaciones — el puntaje inicial es solo de referencia.
        </p>
      )}
    </div>
  )
}

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

/**
 * Nombre de usuario: es lo que se muestra en vez del nombre de Google en
 * pujas y ventas (ver getPublicName en lib/users.js). Cambiarlo tiene un
 * enfriamiento de 1 semana — reforzado también en firestore.rules, no
 * solo acá.
 */
function UsernameEditor({ userId }) {
  const [profile, setProfile] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsub = subscribeToOwnProfile(userId, (p) => {
      setProfile(p)
      setValue(p?.username || '')
      setLoaded(true)
    })
    return unsub
  }, [userId])

  if (!loaded) return null

  const cooldownMs = getUsernameCooldownRemainingMs(profile)
  const cooldownDays = cooldownMs > 0 ? Math.ceil(cooldownMs / (24 * 60 * 60 * 1000)) : 0

  function handleStartEditing() {
    setError('')
    setSaved(false)
    setValue(profile?.username || '')
    setEditing(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await updateUsername(userId, value)
      setSaved(true)
      setEditing(false)
    } catch (err) {
      setError(err.message || 'No se pudo guardar. Probá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-panelLine bg-panel p-4 mb-4">
      <p className="text-sm text-parchment mb-1">Nombre de usuario</p>
      <p className="text-[11px] text-muted mb-3">
        Es lo que ven los demás en tus pujas y publicaciones, en vez de tu nombre de Google. Podés
        cambiarlo una vez por semana.
      </p>

      {!editing ? (
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-parchment">
            {profile?.username || <span className="text-muted">No elegiste uno todavía.</span>}
          </p>
          {cooldownMs > 0 ? (
            <span className="text-[11px] text-muted">
              Podés cambiarlo en {cooldownDays} día{cooldownDays === 1 ? '' : 's'}
            </span>
          ) : (
            <button type="button" onClick={handleStartEditing} className="text-xs text-brass hover:underline">
              {profile?.username ? 'Cambiar' : 'Elegir'}
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={handleSave} className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^A-Za-z0-9_]/g, '').slice(0, 30))}
            placeholder="TuNombreDeUsuario"
            className="flex-1 min-w-[160px] bg-ink border border-panelLine px-3 py-2 text-sm text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
          />
          <button
            type="submit"
            disabled={saving || !USERNAME_PATTERN.test(value)}
            className="px-4 py-2 bg-brass text-ink text-sm font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            disabled={saving}
            className="px-4 py-2 border border-panelLine text-parchment text-sm hover:border-brass transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
        </form>
      )}
      {editing && (
        <p className="text-[10px] text-muted mt-2">3 a 30 caracteres — solo letras, números y guión bajo.</p>
      )}
      {saved && <p className="text-bidGreen text-xs mt-2">Guardado.</p>}
      {error && <p className="text-bidRed text-xs mt-2">{error}</p>}
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

function MisSubastas({ userId, user }) {
  const [auctions, setAuctions] = useState(null)
  const [republishingId, setRepublishingId] = useState(null)
  const [bulkProgress, setBulkProgress] = useState(null) // { done, total } mientras corre "Republicar todas"
  const [bulkDurationKey, setBulkDurationKey] = useState('') // '' = mantener la duración original de cada una
  const [replacingId, setReplacingId] = useState(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const unsub = subscribeToUserAuctions(userId, setAuctions)
    return unsub
  }, [userId])

  async function handleRepublish(auctionId) {
    setError('')
    setRepublishingId(auctionId)
    try {
      const newId = await republishAuction({ auctionId, user })
      navigate(`/subasta/${newId}`)
    } catch (err) {
      setError(err.message || 'No se pudo republicar la subasta.')
      setRepublishingId(null)
    }
  }

  // Una por una (no en paralelo): si alguna falla (cuenta suspendida, plan,
  // etc.) se corta ahí y se avisa cuántas alcanzaron a republicarse.
  // durationTierKey: si se eligió una duración distinta a "mantener la
  // original", se usa esa misma para las N subastas de la tanda.
  async function handleRepublishAll(label, candidates, durationTierKey) {
    if (!window.confirm(`¿Republicar las ${candidates.length} subastas de la tanda del ${label}?`)) return
    setError('')
    setBulkProgress({ label, done: 0, total: candidates.length })
    let done = 0
    try {
      for (const a of candidates) {
        await republishAuction({ auctionId: a.id, user, durationTierKey: durationTierKey || undefined })
        done += 1
        setBulkProgress({ label, done, total: candidates.length })
      }
    } catch (err) {
      setError(`Se republicaron ${done} de ${candidates.length} (tanda del ${label}). ${err.message || 'Falló una de las subastas.'}`)
    } finally {
      setBulkProgress(null)
    }
  }

  async function handleReplacePhotos(auctionId, files) {
    if (!files || files.length === 0) return
    setError('')
    setReplacingId(auctionId)
    try {
      await replaceAuctionImages({ auctionId, imageFiles: files, user })
    } catch (err) {
      setError(err.message || 'No se pudieron subir las fotos.')
    } finally {
      setReplacingId(null)
    }
  }

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

  const republishable = auctions.filter((a) => a.status === 'ended' && !(a.bidCount > 0) && a.images?.length > 0)

  // Agrupadas por fecha de publicación ("tanda") — así se puede republicar
  // solo la carga de un día puntual, en vez de mezclar 12 subastas activas
  // recientes con 42 viejas que quedaron sueltas de meses atrás.
  const republishGroups = []
  for (const a of republishable) {
    const d = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt)
    const label = d.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Argentina/Buenos_Aires',
    })
    let group = republishGroups.find((g) => g.label === label)
    if (!group) {
      group = { label, items: [] }
      republishGroups.push(group)
    }
    group.items.push(a)
  }

  // Solo se ofrece republicar la tanda más reciente (republishGroups[0] —
  // ya viene ordenada por createdAt desc), no todas las que haya en el
  // historial: evita mezclar la carga de ayer con la de hace meses.
  const latestGroup = republishGroups[0]

  return (
    <>
      {error && <p className="text-bidRed text-sm mb-3">{error}</p>}
      {latestGroup && latestGroup.items.length > 1 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleRepublishAll(latestGroup.label, latestGroup.items, bulkDurationKey)}
            disabled={bulkProgress !== null}
            className="px-4 py-2 bg-brass text-ink text-sm font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
          >
            {bulkProgress?.label === latestGroup.label
              ? `Republicando ${bulkProgress.done}/${bulkProgress.total}…`
              : `Republicar tanda del ${latestGroup.label} (${latestGroup.items.length})`}
          </button>
          <select
            value={bulkDurationKey}
            onChange={(e) => setBulkDurationKey(e.target.value)}
            disabled={bulkProgress !== null}
            className="bg-panel border border-panelLine px-2 py-2 text-xs text-parchment focus:border-brass outline-none disabled:opacity-50"
          >
            <option value="">Mantener duración original de cada una</option>
            {DURATION_TIERS.map((t) => (
              <option key={t.key} value={t.key}>
                Todas a: {t.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <ul className="divide-y divide-panelLine">
        {auctions.map((a) => {
          const canRepublish = a.status === 'ended' && !(a.bidCount > 0)
          return (
            <li key={a.id} className="flex items-center gap-4 py-4 px-2">
              <Link to={`/subasta/${a.id}`} className="flex items-center gap-4 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                <div className="w-14 h-20 bg-panel border border-panelLine shrink-0 overflow-hidden">
                  {a.images?.[0] && (
                    <img src={a.images[0]} alt={a.title} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-parchment font-serif text-lg truncate">{a.title}</p>
                  <p className="text-xs text-muted">{a.bidCount || 0} pujas</p>
                </div>
              </Link>
              <div className="text-right shrink-0">
                <p className="text-brass font-medium">
                  ${a.currentPrice?.toLocaleString('es-AR')}
                </p>
                <div className="text-xs mt-0.5">
                  <StatusBadge status={a.status} />
                </div>
                {canRepublish && (
                  <button
                    type="button"
                    onClick={() => handleRepublish(a.id)}
                    disabled={republishingId === a.id}
                    className="mt-1.5 text-xs text-brass hover:underline disabled:opacity-50"
                  >
                    {republishingId === a.id ? 'Republicando…' : 'Republicar'}
                  </button>
                )}
                {!(a.bidCount > 0) && (
                  <label className="mt-1.5 block text-xs text-muted hover:text-brass transition-colors cursor-pointer">
                    {replacingId === a.id ? 'Subiendo…' : 'Reemplazar fotos'}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={replacingId === a.id}
                      onChange={(e) => {
                        const files = Array.from(e.target.files || [])
                        e.target.value = ''
                        handleReplacePhotos(a.id, files)
                      }}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function MisPublicacionesMercado({ userId, user }) {
  const [listings, setListings] = useState(null)
  const [actingId, setActingId] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsub = subscribeToUserListings(userId, setListings)
    return unsub
  }, [userId])

  async function handleMarkSold(id) {
    setError('')
    setActingId(id)
    try {
      await markListingSold(id, user)
    } catch (err) {
      setError(err.message || 'No se pudo marcar como vendido.')
    } finally {
      setActingId(null)
    }
  }

  async function handleReactivate(id) {
    setError('')
    setActingId(id)
    try {
      await reactivateListing(id, user)
    } catch (err) {
      setError(err.message || 'No se pudo reactivar.')
    } finally {
      setActingId(null)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Borrar esta publicación? No se puede deshacer.')) return
    setError('')
    setActingId(id)
    try {
      await deleteListing(id, user)
    } catch (err) {
      setError(err.message || 'No se pudo borrar.')
    } finally {
      setActingId(null)
    }
  }

  if (listings === null) return <p className="text-muted">Cargando…</p>
  if (listings.length === 0) {
    return (
      <div className="border border-panelLine border-dashed p-8 text-center">
        <p className="text-parchment mb-1">Todavía no publicaste nada en el Mercado.</p>
        <Link to="/mercado/publicar" className="text-brass text-sm hover:underline">
          Publicar en el Mercado
        </Link>
      </div>
    )
  }

  return (
    <>
      {error && <p className="text-bidRed text-sm mb-3">{error}</p>}
      <ul className="divide-y divide-panelLine">
        {listings.map((l) => {
          const isSold = l.status === 'sold'
          return (
            <li key={l.id} className="flex items-center gap-4 py-4 px-2">
              <Link to={`/mercado/${l.id}`} className="flex items-center gap-4 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                <div className="w-14 h-20 bg-panel border border-panelLine shrink-0 overflow-hidden">
                  {l.images?.[0] && (
                    <img src={l.images[0]} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-parchment font-serif text-lg truncate">
                    {l.description || l.game || 'Sin descripción'}
                  </p>
                  <p className="text-xs text-muted">{isSold ? 'Vendido' : 'Disponible'}</p>
                </div>
              </Link>
              <div className="text-right shrink-0">
                <p className="text-brass font-medium">${l.price?.toLocaleString('es-AR')}</p>
                <div className="flex flex-col items-end gap-1 mt-1.5">
                  {!isSold ? (
                    <button
                      type="button"
                      onClick={() => handleMarkSold(l.id)}
                      disabled={actingId === l.id}
                      className="text-xs text-brass hover:underline disabled:opacity-50"
                    >
                      Marcar vendido
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleReactivate(l.id)}
                      disabled={actingId === l.id}
                      className="text-xs text-brass hover:underline disabled:opacity-50"
                    >
                      Reactivar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(l.id)}
                    disabled={actingId === l.id}
                    className="text-xs text-bidRed hover:underline disabled:opacity-50"
                  >
                    Borrar
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}

const WORKBENCH_STATUS_LABELS = {
  pending: 'Pendiente de revisión',
  accepted: 'Aceptado — te van a contactar',
  rejected: 'Rechazado',
  delivered: 'Entregado',
}

function MisPedidosWorkbench({ userId }) {
  const [orders, setOrders] = useState(null)

  useEffect(() => {
    const unsub = subscribeToUserOrders(userId, setOrders)
    return unsub
  }, [userId])

  if (orders === null) return <p className="text-muted">Cargando…</p>
  if (orders.length === 0) {
    return (
      <div className="border border-panelLine border-dashed p-8 text-center">
        <p className="text-parchment mb-1">Todavía no hiciste ningún pedido en el Workbench.</p>
        <Link to="/workbench" className="text-brass text-sm hover:underline">
          Ver el catálogo
        </Link>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-panelLine">
      {orders.map((o) => (
        <li key={o.id} className="py-4 px-2">
          <div className="flex items-center justify-between gap-4">
            <Link to={`/workbench/${o.productId}`} className="text-parchment font-serif text-lg hover:text-brass transition-colors truncate">
              {o.productTitle}
            </Link>
            <p className="text-brass font-medium shrink-0">${o.productPrice?.toLocaleString('es-AR')}</p>
          </div>
          <p className="text-xs text-muted mt-1">{WORKBENCH_STATUS_LABELS[o.status] || o.status}</p>
          <p className="text-parchment/70 text-sm mt-1 italic">"{o.message}"</p>
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

      <ReputationStars userId={user.uid} />
      <PlanStatus userId={user.uid} />
      <UsernameEditor userId={user.uid} />
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
          onClick={() => setTab('mercado')}
          className={`pb-3 text-sm ${
            tab === 'mercado'
              ? 'text-brass border-b-2 border-brass'
              : 'text-muted hover:text-parchment'
          }`}
        >
          Mercado
        </button>
        <button
          onClick={() => setTab('workbench')}
          className={`pb-3 text-sm ${
            tab === 'workbench'
              ? 'text-brass border-b-2 border-brass'
              : 'text-muted hover:text-parchment'
          }`}
        >
          Workbench
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
        <MisSubastas userId={user.uid} user={user} />
      ) : tab === 'pujas' ? (
        <MisPujas userId={user.uid} />
      ) : tab === 'mercado' ? (
        <MisPublicacionesMercado userId={user.uid} user={user} />
      ) : tab === 'workbench' ? (
        <MisPedidosWorkbench userId={user.uid} />
      ) : (
        <SubastasGanadas userId={user.uid} />
      )}
    </div>
  )
}
