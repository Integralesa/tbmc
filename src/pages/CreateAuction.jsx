import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createAuction, countTodayAuctionsByUser, DURATION_TIERS, EDIT_WINDOW_MINUTES } from '../lib/auctions'
import { subscribeToOwnProfile, updateDeliveryPreferences } from '../lib/users'
import { getPlan } from '../lib/plans'
import CardNameInput from '../components/CardNameInput'
import { CARD_SEARCH_APIS } from '../lib/cardSearchApis'
import { fetchSetList } from '../lib/scryfall'
import DeliveryFields, { resolveDeliveryProvince, resolveDeliveryZone, resolveCardShops } from '../components/DeliveryFields'
import { CARD_SHOPS } from '../lib/locations'
import { useCardShopLabels } from '../lib/cardShops'

const MAGIC_GAME = 'Magic: The Gathering'

const MAX_PHOTOS = 6
const MAX_RAW_FILE_MB = 25 // freno de emergencia antes de comprimir; casos normales de celular entran de sobra
const MAX_PRICE_DIGITS = 18 // tope contra números absurdos (ej: alguien fat-fingereando ceros de más)

const DELIVERY_LABELS = {
  retiro: 'Retiro en persona',
  envio: 'Envío',
  envio_comprador: 'Envío a cargo del comprador',
  punto_encuentro: 'Punto de encuentro',
}
const STATIC_CARD_SHOP_LABELS = Object.fromEntries(CARD_SHOPS.map((s) => [s.key, s.label]))

export default function CreateAuction() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const cardShopLabels = useCardShopLabels(STATIC_CARD_SHOP_LABELS)

  const [step, setStep] = useState('form') // 'form' | 'preview'

  const [title, setTitle] = useState('')
  const [titleIsValidCard, setTitleIsValidCard] = useState(false)
  const [game, setGame] = useState('Pokémon')
  const [isFoil, setIsFoil] = useState(false)
  const [itemType, setItemType] = useState('card') // 'card' | 'singles' | 'lote' | 'sleeves' | 'deckbox' | 'set_cartas' | 'board_game' | 'sealed'
  const [loteQuantity, setLoteQuantity] = useState('')
  const [loteSetsVariados, setLoteSetsVariados] = useState(false)
  const [loteSets, setLoteSets] = useState([]) // [{code, name}]
  const [magicSets, setMagicSets] = useState([])
  const [setToAdd, setSetToAdd] = useState('')
  const [condition, setCondition] = useState('Near Mint')
  const [showConditionGlossary, setShowConditionGlossary] = useState(false)
  const [sealIntact, setSealIntact] = useState(false)
  const [isGraded, setIsGraded] = useState(false)
  const [gradingCompany, setGradingCompany] = useState('PSA')
  const [grade, setGrade] = useState('')
  const [startingPrice, setStartingPrice] = useState('')
  const [durationTierKey, setDurationTierKey] = useState('30min')
  const [deliveryMethods, setDeliveryMethods] = useState([])
  const [deliveryProvince, setDeliveryProvince] = useState('')
  const [deliveryZone, setDeliveryZone] = useState('')
  const [deliveryZoneOther, setDeliveryZoneOther] = useState('')
  const [cardShops, setCardShops] = useState([])
  const [saveDeliveryPreference, setSaveDeliveryPreference] = useState(true)
  const [useFixedIncrement, setUseFixedIncrement] = useState(false)
  const [fixedBidIncrement, setFixedBidIncrement] = useState('')
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [coverIndex, setCoverIndex] = useState(0)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [plan, setPlan] = useState(getPlan('free'))
  const [todayCount, setTodayCount] = useState(null)

  // Pre-carga la forma de entrega guardada la primera vez que llega el
  // perfil — el ref evita que, si el documento cambia de nuevo más
  // adelante (ej. se guarda al publicar), se pisen los cambios que el
  // vendedor ya haya hecho a mano en este formulario.
  const deliveryPrefilledRef = useRef(false)

  useEffect(() => {
    if (!user) return
    const unsub = subscribeToOwnProfile(user.uid, (profile) => {
      setPlan(getPlan(profile?.plan))

      const prefs = profile?.deliveryPreferences
      if (prefs && !deliveryPrefilledRef.current) {
        deliveryPrefilledRef.current = true
        setDeliveryMethods(prefs.deliveryMethods || [])
        setDeliveryProvince(prefs.deliveryProvince || '')
        setDeliveryZone(prefs.deliveryZone || '')
        setDeliveryZoneOther(prefs.deliveryZoneOther || '')
        setCardShops(prefs.cardShops || [])
      }
    })
    return unsub
  }, [user])

  useEffect(() => {
    if (!user) return
    countTodayAuctionsByUser(user.uid).then(setTodayCount)
  }, [user])

  // Al cambiar de juego, la carta elegida (o el texto libre) del juego
  // anterior ya no aplica — se resetea en el mismo cambio de estado (no en
  // un useEffect aparte) para que CardNameInput ya nazca vacío y sin
  // "confirmar" cuando React lo remonte por el key={game}.
  function handleGameChange(newGame) {
    setGame(newGame)
    if (itemType === 'card' || itemType === 'singles') {
      setTitle('')
      setTitleIsValidCard(false)
    } else if (itemType === 'lote') {
      setLoteSets([]) // los sets elegidos eran de otro juego, ya no aplican
      setSetToAdd('')
    }
  }

  // "Singles" es solo una etiqueta — se sigue exigiendo elegir la carta de
  // la lista de sugerencias, igual que el default (sin ningún checkbox
  // tildado). Tildar Lote / Sleeves / Deckbox / Set de Cartas / Juego de
  // mesa / Material Sellado, en cambio, saca del medio esa búsqueda
  // obligatoria — el título pasa a armarse solo (ver más abajo). Tildar de
  // nuevo el mismo vuelve a "carta individual".
  function handleItemTypeToggle(type) {
    const next = itemType === type ? 'card' : type
    setItemType(next)
    setTitle('')
    setTitleIsValidCard(next !== 'card' && next !== 'singles' && next !== 'lote') // sleeves/deckbox/etc no necesitan más datos
    if (next !== 'lote') {
      setLoteQuantity('')
      setLoteSetsVariados(false)
      setLoteSets([])
      setSetToAdd('')
    }
  }

  // El título de un lote se arma solo a partir de la cantidad y los sets
  // elegidos — a propósito no hay un campo de texto libre superpuesto (ver
  // COMO-FUNCIONA.md: se evita el texto libre en toda esta sección).
  useEffect(() => {
    if (itemType === 'sleeves') {
      setTitle('Sleeves')
      setTitleIsValidCard(true)
      return
    }
    if (itemType === 'deckbox') {
      setTitle('Deckbox')
      setTitleIsValidCard(true)
      return
    }
    if (itemType === 'set_cartas') {
      setTitle('Set de Cartas')
      setTitleIsValidCard(true)
      return
    }
    if (itemType === 'board_game') {
      setTitle('BoardGame')
      setTitleIsValidCard(true)
      return
    }
    if (itemType === 'sealed') {
      setTitle('Material Sellado')
      setTitleIsValidCard(true)
      return
    }
    if (itemType === 'lote') {
      const qty = loteQuantity ? Number(loteQuantity) : null
      let t = qty ? `Lote de ${qty} carta${qty === 1 ? '' : 's'}` : 'Lote de cartas'
      if (game === MAGIC_GAME) {
        if (loteSetsVariados) t += ' (sets variados)'
        else if (loteSets.length > 0) t += ` — Sets: ${loteSets.map((s) => s.name).join(', ')}`
      } else {
        t += ` de ${game}`
      }
      setTitle(t)
      setTitleIsValidCard(true)
    }
  }, [itemType, loteQuantity, loteSetsVariados, loteSets, game])

  // La lista de sets de Magic se pide una sola vez, y solo si hace falta.
  useEffect(() => {
    if (itemType !== 'lote' || game !== MAGIC_GAME || loteSetsVariados) return
    if (magicSets.length > 0) return
    fetchSetList()
      .then(setMagicSets)
      .catch(() => setError('No se pudo cargar la lista de sets de Magic. Probá de nuevo en un momento.'))
  }, [itemType, game, loteSetsVariados, magicSets.length])

  const remaining = todayCount === null ? null : Math.max(plan.dailyLimit - todayCount, 0)
  const limitReached = remaining === 0
  const cardApi = CARD_SEARCH_APIS[game]
  const tier = DURATION_TIERS.find((t) => t.key === durationTierKey)

  function handleFileChange(e) {
    const selected = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir el mismo archivo después de sacarlo
    if (!selected) return
    if (files.length >= MAX_PHOTOS) return
    if (selected.size > MAX_RAW_FILE_MB * 1024 * 1024) {
      setError(`"${selected.name}" pesa demasiado (máx ${MAX_RAW_FILE_MB}MB). Probá con otra foto o sacale una captura más liviana.`)
      return
    }
    setError('')
    setFiles((prev) => [...prev, selected])
    setPreviews((prev) => [...prev, URL.createObjectURL(selected)])
  }

  function handleRemovePhoto(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index])
      return prev.filter((_, i) => i !== index)
    })
    // Si sacamos la portada, la portada vuelve a ser la primera que quede.
    setCoverIndex((prev) => (index === prev ? 0 : index < prev ? prev - 1 : prev))
  }

  async function handleReview(e) {
    e.preventDefault()
    setError('')

    if (!title || !startingPrice) {
      setError('Completá al menos el título y el precio inicial.')
      return
    }
    if (String(startingPrice).replace(/\D/g, '').length > MAX_PRICE_DIGITS) {
      setError(`El precio inicial es demasiado grande (máximo ${MAX_PRICE_DIGITS} dígitos) — revisalo, puede que hayas escrito algún cero de más.`)
      return
    }
    if (files.length === 0) {
      setError('Subí al menos 1 foto de la carta.')
      return
    }

    if (useFixedIncrement && (!fixedBidIncrement || Number(fixedBidIncrement) <= 0)) {
      setError('Poné un incremento fijo mayor a 0, o desactivá esa opción.')
      return
    }

    if (itemType === 'lote') {
      if (!loteQuantity || Number(loteQuantity) <= 0) {
        setError('Poné la cantidad de cartas del lote.')
        return
      }
      if (game === MAGIC_GAME && !loteSetsVariados && loteSets.length === 0) {
        setError('Elegí al menos un set del lote, o tildá "Sets variados".')
        return
      }
    }

    if ((itemType === 'card' || itemType === 'singles') && cardApi) {
      if (!titleIsValidCard) {
        setError(`Elegí una carta de la lista de sugerencias de ${cardApi.label} antes de publicar.`)
        return
      }
      // Doble chequeo contra la API justo antes de mostrar el preview, por
      // si el estado del formulario se manipuló por fuera de la interfaz normal.
      try {
        const exists = await cardApi.verifyCardExists(title)
        if (!exists) {
          setError(`No pudimos confirmar esa carta en ${cardApi.label}. Volvé a elegirla de la lista.`)
          setTitleIsValidCard(false)
          return
        }
      } catch {
        setError(`No se pudo validar la carta contra ${cardApi.label}. Probá de nuevo en un momento.`)
        return
      }
    }

    setStep('preview')
  }

  async function handlePublish() {
    setError('')
    try {
      setSubmitting(true)
      // La foto elegida como portada va primero — AuctionCard/AuctionDetail
      // usan siempre images[0] como imagen principal.
      const orderedFiles =
        coverIndex === 0 ? files : [files[coverIndex], ...files.filter((_, i) => i !== coverIndex)]

      const id = await createAuction({
        title,
        game,
        condition,
        isFoil,
        itemType,
        loteQuantity: itemType === 'lote' ? loteQuantity : null,
        loteSets: itemType === 'lote' ? loteSets : [],
        loteSetsVariados: itemType === 'lote' ? loteSetsVariados : false,
        sealIntact: itemType === 'sealed' ? sealIntact : null,
        isGraded: (itemType === 'card' || itemType === 'singles') && isGraded,
        gradingCompany: (itemType === 'card' || itemType === 'singles') && isGraded ? gradingCompany : null,
        grade: (itemType === 'card' || itemType === 'singles') && isGraded && grade ? Number(grade) : null,
        startingPrice,
        durationTierKey,
        deliveryMethods,
        deliveryProvince: resolveDeliveryProvince(deliveryMethods, deliveryProvince),
        deliveryZone: resolveDeliveryZone(deliveryMethods, deliveryProvince, deliveryZone, deliveryZoneOther),
        cardShops: resolveCardShops(deliveryMethods, cardShops),
        fixedBidIncrement: useFixedIncrement ? fixedBidIncrement : null,
        imageFiles: orderedFiles,
        user,
      })

      if (saveDeliveryPreference) {
        // No bloquea la navegación si falla — guardar la preferencia es
        // una comodidad, no algo de lo que dependa haber publicado bien.
        updateDeliveryPreferences(user.uid, {
          deliveryMethods,
          deliveryProvince,
          deliveryZone,
          deliveryZoneOther,
          cardShops,
        }).catch((err) => console.error('No se pudo guardar la forma de entrega:', err))
      }

      navigate(`/subasta/${id}`)
    } catch (err) {
      setError(err.message || 'Algo salió mal al publicar la carta.')
      setStep('form')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-6 py-16 text-center">
        <p className="text-parchment">Iniciá sesión con Google para publicar una carta.</p>
      </div>
    )
  }

  if (step === 'preview') {
    const resolvedProvince = resolveDeliveryProvince(deliveryMethods, deliveryProvince)
    const resolvedZone = resolveDeliveryZone(deliveryMethods, deliveryProvince, deliveryZone, deliveryZoneOther)
    const resolvedShops = resolveCardShops(deliveryMethods, cardShops)

    return (
      <div className="max-w-xl mx-auto px-6 py-10">
        <h1 className="font-serif text-3xl text-parchment mb-1">Revisá antes de publicar</h1>
        <p className="text-muted mb-6">Así va a verse tu subasta. Confirmá o volvé atrás para corregir algo.</p>

        <div className="border border-panelLine bg-panel p-5 mb-6">
          <div className="flex gap-4">
            <div className="w-28 h-36 border border-panelLine shrink-0 overflow-hidden">
              <img src={previews[coverIndex]} alt="Portada" className="w-full h-full object-cover" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wide text-brass/80">{game}</span>
              <h2 className="font-serif text-xl text-parchment flex items-center gap-2 flex-wrap">
                {title}
                {isFoil && (
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 bg-brass text-ink font-semibold">
                    Foil
                  </span>
                )}
              </h2>
              <p className="text-muted text-sm mt-1">Estado: {condition}</p>
              <p className="text-brass text-lg mt-2">${Number(startingPrice).toLocaleString('es-AR')}</p>
              <p className="text-muted text-xs mt-1">Duración: {tier.label}</p>
            </div>
          </div>

          {deliveryMethods.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-4">
              {deliveryMethods.map((m) => (
                <span key={m} className="text-[11px] px-2 py-1 border border-panelLine text-parchment/80">
                  {DELIVERY_LABELS[m] || m}
                </span>
              ))}
            </div>
          )}
          {resolvedProvince && <p className="text-sm text-muted mt-2">Provincia: {resolvedProvince}</p>}
          {resolvedZone && <p className="text-sm text-muted mt-1">Zona: {resolvedZone}</p>}
          {resolvedShops.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-2">
              {resolvedShops.map((s) => (
                <span key={s} className="text-[11px] px-2 py-1 border border-panelLine text-parchment/80">
                  {cardShopLabels[s] || s}
                </span>
              ))}
            </div>
          )}
          {useFixedIncrement && (
            <p className="text-[11px] text-muted mt-3">
              Puja con incremento fijo: cada clic suma ${Number(fixedBidIncrement || 0).toLocaleString('es-AR')}.
            </p>
          )}
        </div>

        <div
          className={`border px-4 py-3 mb-6 text-sm ${
            durationTierKey === 'flash' ? 'border-panelLine bg-panel text-muted' : 'border-brass/40 bg-brass/5 text-parchment/85'
          }`}
        >
          {durationTierKey === 'flash' ? (
            <p>
              Esta duración (Flash) no admite editar ni cancelar después de publicada — revisá bien los datos antes
              de confirmar.
            </p>
          ) : (
            <p>
              Una vez publicada, vas a tener <strong>{EDIT_WINDOW_MINUTES} minutos</strong> para corregir datos
              (menos precio inicial y fotos, que quedan fijos) o cancelarla del todo. Si la cancelás, no se puede
              reactivar — hay que publicarla de nuevo. Si se ejecuta una modificación del trato, va a ser
              validada por Susurro o las Arañas.
            </p>
          )}
        </div>

        <p className="text-[11px] text-muted mb-4">
          Al confirmar, tu carta queda "en revisión" unos segundos mientras chequeamos las fotos
          automáticamente, y después se publica sola.
        </p>

        {error && <p className="text-bidRed text-sm mb-4">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setStep('form')}
            disabled={submitting}
            className="flex-1 py-3 border border-panelLine text-parchment hover:border-brass transition-colors disabled:opacity-50"
          >
            Volver a editar
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={submitting}
            className="flex-1 py-3 bg-brass text-ink font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
          >
            {submitting ? 'Publicando…' : 'Confirmar y publicar'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <h1 className="font-serif text-3xl text-parchment mb-1">Publicar</h1>
      <p className="text-muted mb-4">Subí hasta {MAX_PHOTOS} fotos y definí el precio de arranque.</p>

      {remaining !== null && (
        <div
          className={`border px-4 py-3 mb-6 text-sm ${
            limitReached ? 'border-bidRed/50 bg-bidRed/5' : 'border-panelLine bg-panel'
          }`}
        >
          <p className={limitReached ? 'text-bidRed' : 'text-parchment/80'}>
            Plan <strong>{plan.label}</strong>: {remaining} de {plan.dailyLimit === Infinity ? '∞' : plan.dailyLimit}{' '}
            publicaciones disponibles hoy.
          </p>
          {limitReached && (
            <p className="mt-1">
              Llegaste al límite de hoy.{' '}
              <Link to="/planes" className="text-brass hover:underline">
                Mirá los planes para publicar más
              </Link>
              .
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleReview} className="space-y-6">
        <div>
          <label className="block text-sm text-muted mb-1.5">Juego</label>
          <select
            value={game}
            onChange={(e) => handleGameChange(e.target.value)}
            className="w-full bg-panel border border-panelLine px-3 py-2.5 text-parchment focus:border-brass outline-none"
          >
            <option>Pokémon</option>
            <option>Magic: The Gathering</option>
            <option>Yu-Gi-Oh!</option>
            <option>One Piece</option>
          </select>
        </div>

        <div className="border border-panelLine bg-panel p-4">
          <p className="text-sm text-muted mb-2">¿Qué estás publicando?</p>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-parchment/85 cursor-pointer">
              <input
                type="checkbox"
                checked={itemType === 'singles'}
                onChange={() => handleItemTypeToggle('singles')}
                className="accent-brass w-4 h-4"
              />
              Singles
            </label>
            <label className="flex items-center gap-2 text-sm text-parchment/85 cursor-pointer">
              <input
                type="checkbox"
                checked={itemType === 'lote'}
                onChange={() => handleItemTypeToggle('lote')}
                className="accent-brass w-4 h-4"
              />
              Lote de varias cartas
            </label>
            <label className="flex items-center gap-2 text-sm text-parchment/85 cursor-pointer">
              <input
                type="checkbox"
                checked={itemType === 'set_cartas'}
                onChange={() => handleItemTypeToggle('set_cartas')}
                className="accent-brass w-4 h-4"
              />
              Set de Cartas
            </label>
            <label className="flex items-center gap-2 text-sm text-parchment/85 cursor-pointer">
              <input
                type="checkbox"
                checked={itemType === 'sleeves'}
                onChange={() => handleItemTypeToggle('sleeves')}
                className="accent-brass w-4 h-4"
              />
              Sleeves (fundas)
            </label>
            <label className="flex items-center gap-2 text-sm text-parchment/85 cursor-pointer">
              <input
                type="checkbox"
                checked={itemType === 'deckbox'}
                onChange={() => handleItemTypeToggle('deckbox')}
                className="accent-brass w-4 h-4"
              />
              Deckbox
            </label>
            <label className="flex items-center gap-2 text-sm text-parchment/85 cursor-pointer">
              <input
                type="checkbox"
                checked={itemType === 'board_game'}
                onChange={() => handleItemTypeToggle('board_game')}
                className="accent-brass w-4 h-4"
              />
              Juego de mesa
            </label>
            <label className="flex items-center gap-2 text-sm text-parchment/85 cursor-pointer">
              <input
                type="checkbox"
                checked={itemType === 'sealed'}
                onChange={() => handleItemTypeToggle('sealed')}
                className="accent-brass w-4 h-4"
              />
              Material Sellado
            </label>
          </div>
          <p className="text-[11px] text-muted mt-2">
            "Singles" es solo para marcar que es una carta suelta (sigue habiendo que elegirla de la lista de
            sugerencias) — si no tildás ninguna, es lo mismo. "Set de Cartas" es para varias cartas distintas en
            la misma foto — "Lote" es para una cantidad de cartas (opcionalmente de un set puntual de Magic).
          </p>

          {itemType === 'lote' && (
            <div className="mt-4 space-y-3 border-t border-panelLine pt-3">
              <div>
                <label className="block text-sm text-muted mb-1.5">Cantidad de cartas</label>
                <input
                  type="number"
                  min="1"
                  value={loteQuantity}
                  onChange={(e) => setLoteQuantity(e.target.value)}
                  placeholder="20"
                  className="w-full bg-ink border border-panelLine px-3 py-2.5 text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
                />
              </div>

              {game === MAGIC_GAME && (
                <div>
                  <label className="flex items-center gap-2 text-sm text-parchment/85 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={loteSetsVariados}
                      onChange={(e) => {
                        setLoteSetsVariados(e.target.checked)
                        if (e.target.checked) setLoteSets([])
                      }}
                      className="accent-brass w-4 h-4"
                    />
                    Sets variados / mezclados
                  </label>

                  {!loteSetsVariados && (
                    <>
                      <label className="block text-sm text-muted mb-1.5">Agregar set</label>
                      <div className="flex gap-2">
                        <select
                          value={setToAdd}
                          onChange={(e) => setSetToAdd(e.target.value)}
                          className="flex-1 bg-ink border border-panelLine px-3 py-2.5 text-parchment focus:border-brass outline-none"
                        >
                          <option value="">Elegí un set</option>
                          {magicSets
                            .filter((s) => !loteSets.some((added) => added.code === s.code))
                            .map((s) => (
                              <option key={s.code} value={s.code}>
                                {s.name}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const found = magicSets.find((s) => s.code === setToAdd)
                            if (!found) return
                            setLoteSets((prev) => [...prev, found])
                            setSetToAdd('')
                          }}
                          disabled={!setToAdd}
                          className="px-4 py-2.5 border border-panelLine text-parchment hover:border-brass transition-colors disabled:opacity-50"
                        >
                          Agregar
                        </button>
                      </div>
                      {loteSets.length > 0 && (
                        <div className="flex gap-2 flex-wrap mt-2">
                          {loteSets.map((s) => (
                            <span
                              key={s.code}
                              className="text-[11px] px-2 py-1 border border-panelLine text-parchment/80 flex items-center gap-1.5"
                            >
                              {s.name}
                              <button
                                type="button"
                                onClick={() => setLoteSets((prev) => prev.filter((x) => x.code !== s.code))}
                                className="text-bidRed hover:opacity-80"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm text-muted mb-1.5">
            {itemType === 'card' || itemType === 'singles' ? 'Título de la carta' : 'Título (automático)'}
            {(itemType === 'card' || itemType === 'singles') && cardApi && (
              <span className="text-brass font-normal"> · autocompleta con {cardApi.label}</span>
            )}
          </label>
          {itemType !== 'card' && itemType !== 'singles' ? (
            <p className="w-full bg-ink border border-panelLine px-3 py-2.5 text-parchment/90">{title || '—'}</p>
          ) : cardApi ? (
            <CardNameInput
              key={game}
              value={title}
              onChange={setTitle}
              onValidityChange={setTitleIsValidCard}
              autocompleteCardName={cardApi.autocompleteCardName}
              noMatchHint={cardApi.noMatchHint}
              label={cardApi.label}
              initiallyConfirmed={titleIsValidCard}
              placeholder="Empezá a escribir el nombre en inglés"
            />
          ) : (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Charizard Base Set 1ª edición"
              className="w-full bg-panel border border-panelLine px-3 py-2.5 text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
            />
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm text-muted">Estado</label>
            <button
              type="button"
              onClick={() => setShowConditionGlossary((v) => !v)}
              className="text-[11px] text-brass hover:underline"
            >
              {showConditionGlossary ? 'Ocultar' : 'ⓘ Qué significa cada estado'}
            </button>
          </div>
          {showConditionGlossary && (
            <ul className="text-[11px] text-muted mb-2 space-y-1 border border-panelLine bg-panel px-3 py-2">
              <li><span className="text-parchment">Mint:</span> perfecta, como salida de sobre, sin ninguna marca.</li>
              <li><span className="text-parchment">Near Mint:</span> sin marcas visibles a simple vista — como mucho, desgaste mínimo en esquinas bajo luz directa.</li>
              <li><span className="text-parchment">Excellent:</span> algo de desgaste leve (esquinas, bordes o superficie), pero se nota solo mirando de cerca.</li>
              <li><span className="text-parchment">Played:</span> desgaste visible a simple vista — marcas, doblado leve o rayones.</li>
              <li><span className="text-parchment">Damaged:</span> daño importante — roturas, dobleces fuertes, manchas, escritura, etc.</li>
            </ul>
          )}
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="w-full bg-panel border border-panelLine px-3 py-2.5 text-parchment focus:border-brass outline-none"
          >
            <option>Mint</option>
            <option>Near Mint</option>
            <option>Excellent</option>
            <option>Played</option>
            <option>Damaged</option>
          </select>
        </div>

        {(itemType === 'card' || itemType === 'singles') && (
          <div className="border border-panelLine bg-panel p-4">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isGraded}
                onChange={(e) => setIsGraded(e.target.checked)}
                className="accent-brass w-4 h-4"
              />
              <span className="text-sm text-parchment/85">Está graduada (PSA / BGS / CGC)</span>
            </label>
            {isGraded && (
              <div className="flex gap-3 mt-3">
                <select
                  value={gradingCompany}
                  onChange={(e) => setGradingCompany(e.target.value)}
                  className="flex-1 bg-ink border border-panelLine px-3 py-2 text-sm text-parchment focus:border-brass outline-none"
                >
                  <option>PSA</option>
                  <option>BGS</option>
                  <option>CGC</option>
                  <option>Otra</option>
                </select>
                <input
                  type="number"
                  min="1"
                  max="10"
                  step="0.5"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="Grado (ej: 10)"
                  className="w-32 bg-ink border border-panelLine px-3 py-2 text-sm text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
                />
              </div>
            )}
          </div>
        )}

        {itemType === 'sealed' && (
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={sealIntact}
              onChange={(e) => setSealIntact(e.target.checked)}
              className="accent-brass w-4 h-4"
            />
            <span className="text-sm text-parchment/85">Sello de fábrica intacto (shrink-wrap)</span>
          </label>
        )}

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={isFoil}
            onChange={(e) => setIsFoil(e.target.checked)}
            className="accent-brass w-4 h-4"
          />
          <span className="text-sm text-parchment">Es Foil</span>
        </label>

        <DeliveryFields
          deliveryMethods={deliveryMethods}
          setDeliveryMethods={setDeliveryMethods}
          deliveryProvince={deliveryProvince}
          setDeliveryProvince={setDeliveryProvince}
          deliveryZone={deliveryZone}
          setDeliveryZone={setDeliveryZone}
          deliveryZoneOther={deliveryZoneOther}
          setDeliveryZoneOther={setDeliveryZoneOther}
          cardShops={cardShops}
          setCardShops={setCardShops}
          user={user}
        />

        {deliveryMethods.length > 0 && (
          <label className="flex items-center gap-2.5 cursor-pointer -mt-2">
            <input
              type="checkbox"
              checked={saveDeliveryPreference}
              onChange={(e) => setSaveDeliveryPreference(e.target.checked)}
              className="accent-brass w-4 h-4"
            />
            <span className="text-[11px] text-muted">
              Guardar esta forma de entrega para no tener que cargarla de nuevo la próxima vez
            </span>
          </label>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-muted mb-1.5">Precio inicial (ARS)</label>
            <input
              type="number"
              min="1"
              maxLength={MAX_PRICE_DIGITS}
              value={startingPrice}
              onChange={(e) => setStartingPrice(e.target.value.slice(0, MAX_PRICE_DIGITS))}
              placeholder="5000"
              className="w-full bg-panel border border-panelLine px-3 py-2.5 text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-muted mb-1.5">Duración</label>
            <select
              value={durationTierKey}
              onChange={(e) => setDurationTierKey(e.target.value)}
              className="w-full bg-panel border border-panelLine px-3 py-2.5 text-parchment focus:border-brass outline-none"
            >
              {DURATION_TIERS.map((t) => {
                const locked = t.minPlanPriority > plan.priority
                return (
                  <option key={t.key} value={t.key} disabled={locked}>
                    {t.label}
                    {locked ? ` (requiere ${t.minPlanPriority === 2 ? 'Intel de Pícaros' : 'Informante'})` : ''}
                  </option>
                )
              })}
            </select>
            <p className="text-[11px] text-muted mt-1.5">
              Si entra una puja en los últimos {tier.extendWindowMinutes} min, el cierre se extiende{' '}
              {tier.extendByMinutes} min más.
            </p>
            {plan.priority < 2 && (
              <p className="text-[11px] text-muted mt-1">
                Las duraciones de 12h, 24h y 7 días se desbloquean con planes superiores —{' '}
                <Link to="/planes" className="text-brass hover:underline">
                  ver planes
                </Link>
                .
              </p>
            )}
          </div>
        </div>

        <div className="border border-panelLine bg-panel p-4">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={useFixedIncrement}
              onChange={(e) => setUseFixedIncrement(e.target.checked)}
              className="accent-brass w-4 h-4"
            />
            <span className="text-sm text-parchment">Puja con incremento fijo (botón único)</span>
          </label>
          <p className="text-[11px] text-muted mt-1.5 mb-3">
            Si lo activás, el comprador no escribe un monto: ve un solo botón para pujar precio
            actual + este incremento. Si lo dejás apagado, puede escribir cualquier monto mayor
            al mínimo sugerido.
          </p>
          {useFixedIncrement && (
            <input
              type="number"
              min="1"
              value={fixedBidIncrement}
              onChange={(e) => setFixedBidIncrement(e.target.value)}
              placeholder="Incremento en ARS, ej. 500"
              className="w-full bg-ink border border-panelLine px-3 py-2.5 text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
            />
          )}
        </div>

        <div>
          <label className="block text-sm text-muted mb-1.5">
            Fotos de la carta (hasta {MAX_PHOTOS})
          </label>
          <p className="text-[11px] text-muted mb-2">
            Se comprimen solas al subir, así que no te preocupes por el tamaño del archivo original.
            Subilas de a una — si te equivocás, sacala con la ✕ y subí otra.
          </p>
          {previews.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-3">
              {previews.map((src, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className="relative">
                    <img
                      src={src}
                      alt={`Foto ${i + 1}`}
                      className={`w-24 h-32 object-cover border-2 ${
                        coverIndex === i ? 'border-brass' : 'border-panelLine'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(i)}
                      aria-label={`Sacar foto ${i + 1}`}
                      className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center bg-bidRed text-ink text-xs font-bold rounded-full hover:opacity-90"
                    >
                      ✕
                    </button>
                  </div>
                  {previews.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setCoverIndex(i)}
                      className={`text-[11px] ${
                        coverIndex === i ? 'text-brass' : 'text-muted hover:text-parchment'
                      }`}
                    >
                      {coverIndex === i ? '★ Portada' : 'Usar como portada'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {previews.length > 1 && (
            <p className="text-[11px] text-muted mb-3">
              La portada es la foto que se ve primero en el listado de subastas.
            </p>
          )}
          {files.length < MAX_PHOTOS && (
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:border file:border-panelLine file:bg-panel file:text-parchment file:cursor-pointer"
            />
          )}
        </div>

        {error && <p className="text-bidRed text-sm">{error}</p>}

        <button
          type="submit"
          disabled={limitReached}
          className="w-full py-3 bg-brass text-ink font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
        >
          {limitReached ? 'Límite diario alcanzado' : 'Revisar y publicar'}
        </button>
      </form>
    </div>
  )
}
