import { useEffect, useState } from 'react'
import {
  CABA_BARRIOS,
  CARD_SHOPS,
  PROVINCIAS,
  POSTAL_CODE_LENGTH,
  sanitizePostalCode,
  getPartidoForPostalCode,
} from '../lib/locations'
import { subscribeToApprovedCardShops, submitShopSuggestion } from '../lib/cardShops'

const DELIVERY_OPTIONS = [
  { key: 'retiro', label: 'Retiro en persona' },
  { key: 'envio', label: 'Envío' },
  { key: 'envio_comprador', label: 'Envío a cargo del comprador' },
  { key: 'punto_encuentro', label: 'Punto de encuentro' },
]

const CABA_PROVINCE = 'Ciudad Autónoma de Buenos Aires'
const BUENOS_AIRES_PROVINCE = 'Buenos Aires'

/**
 * Métodos de entrega + provincia/zona + tiendas de referencia. Se usa
 * tanto al publicar (CreateAuction) como al editar (EditAuctionPanel) —
 * misma lógica en los dos lados: la provincia, la zona y las tiendas solo
 * importan si el vendedor marcó "Retiro en persona" o "Punto de
 * encuentro". Elegir una provincia habilita más detalle según cuál sea:
 * CABA → barrio (dropdown de los 48 oficiales); Buenos Aires → código
 * postal → partido (ver getPartidoForPostalCode); el resto, ningún
 * detalle extra. El checkbox de tiendas de referencia también se filtra
 * por la provincia elegida.
 */
export default function DeliveryFields({
  deliveryMethods,
  setDeliveryMethods,
  deliveryProvince,
  setDeliveryProvince,
  deliveryZone,
  setDeliveryZone,
  deliveryZoneOther,
  setDeliveryZoneOther,
  cardShops,
  setCardShops,
  user,
}) {
  const showZoneFields = deliveryMethods.includes('retiro') || deliveryMethods.includes('punto_encuentro')

  const [approvedShops, setApprovedShops] = useState([])
  useEffect(() => {
    const unsub = subscribeToApprovedCardShops(setApprovedShops)
    return unsub
  }, [])

  const [suggestName, setSuggestName] = useState('')
  const [suggestProvince, setSuggestProvince] = useState('')
  const [suggestBarrio, setSuggestBarrio] = useState('')
  const [suggestStatus, setSuggestStatus] = useState('idle') // 'idle' | 'sending' | 'sent' | 'error'

  async function handleSendSuggestion() {
    setSuggestStatus('sending')
    try {
      await submitShopSuggestion({ name: suggestName, province: suggestProvince, barrio: suggestBarrio, user })
      setSuggestStatus('sent')
      setSuggestName('')
      setSuggestProvince('')
      setSuggestBarrio('')
    } catch {
      setSuggestStatus('error')
    }
  }

  // Los locales curados van primero, después los aprobados por sugerencia,
  // y "Otras tiendas" siempre al final. Se filtran por la provincia elegida
  // — los que no tienen `province` (ej: "Otras tiendas") quedan siempre visibles.
  const otrasShop = CARD_SHOPS.find((s) => s.key === 'otras')
  const allShops = [...CARD_SHOPS.filter((s) => s.key !== 'otras'), ...approvedShops, otrasShop]
    .filter(Boolean)
    .filter((s) => !s.province || s.province === deliveryProvince)

  return (
    <div>
      <label className="block text-sm text-muted mb-1.5">¿Cómo entregás la carta?</label>
      <p className="text-[11px] text-muted mb-2">Podés marcar más de una opción.</p>
      <div className="flex flex-wrap gap-4">
        {DELIVERY_OPTIONS.map((opt) => (
          <label key={opt.key} className="flex items-center gap-2 text-sm text-parchment/85 cursor-pointer">
            <input
              type="checkbox"
              checked={deliveryMethods.includes(opt.key)}
              onChange={(e) => {
                setDeliveryMethods((prev) =>
                  e.target.checked ? [...prev, opt.key] : prev.filter((k) => k !== opt.key),
                )
              }}
              className="accent-brass w-4 h-4"
            />
            {opt.label}
          </label>
        ))}
      </div>

      {showZoneFields && (
        <div className="mt-4 space-y-4 border-t border-panelLine pt-4">
          <div>
            <label className="block text-sm text-muted mb-1.5">Provincia</label>
            <select
              value={deliveryProvince}
              onChange={(e) => {
                setDeliveryProvince(e.target.value)
                setDeliveryZone('')
                setDeliveryZoneOther('')
              }}
              className="w-full bg-panel border border-panelLine px-3 py-2.5 text-parchment focus:border-brass outline-none"
            >
              <option value="">Elegí una provincia</option>
              {PROVINCIAS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {deliveryProvince === CABA_PROVINCE && (
              <select
                value={deliveryZone}
                onChange={(e) => setDeliveryZone(e.target.value)}
                className="w-full mt-2 bg-panel border border-panelLine px-3 py-2.5 text-parchment focus:border-brass outline-none"
              >
                <option value="">Elegí un barrio</option>
                {CABA_BARRIOS.map((barrio) => (
                  <option key={barrio} value={barrio}>
                    {barrio}
                  </option>
                ))}
              </select>
            )}

            {deliveryProvince === BUENOS_AIRES_PROVINCE && (
              <>
                <input
                  value={deliveryZoneOther}
                  onChange={(e) => setDeliveryZoneOther(sanitizePostalCode(e.target.value))}
                  placeholder="Código postal (ej: 1425)"
                  inputMode="numeric"
                  maxLength={POSTAL_CODE_LENGTH}
                  className="w-full mt-2 bg-panel border border-panelLine px-3 py-2.5 text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
                />
                {getPartidoForPostalCode(deliveryZoneOther) ? (
                  <p className="text-[11px] text-brass mt-1">→ {getPartidoForPostalCode(deliveryZoneOther)}</p>
                ) : (
                  <p className="text-[10px] text-muted mt-1">
                    Solo números — el código postal de 4 dígitos de tu zona (opcional).
                  </p>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm text-muted mb-1.5">
              ¿En qué tiendas podés coordinar la entrega? (opcional)
            </label>
            {!deliveryProvince ? (
              <p className="text-[11px] text-muted">Elegí una provincia para ver los locales de esa zona.</p>
            ) : (
              <div className="flex flex-wrap gap-4">
                {allShops.map((shop) => (
                  <label key={shop.key} className="flex items-center gap-2 text-sm text-parchment/85 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cardShops.includes(shop.key)}
                      onChange={(e) => {
                        setCardShops((prev) =>
                          e.target.checked ? [...prev, shop.key] : prev.filter((k) => k !== shop.key),
                        )
                      }}
                      className="accent-brass w-4 h-4"
                    />
                    {shop.label}
                  </label>
                ))}
              </div>
            )}

            {cardShops.includes('otras') && (
              <div className="mt-3 border-t border-panelLine pt-3">
                <p className="text-[11px] text-muted mb-2">
                  Decinos los locales donde entregás y los agregamos a los checkboxes, con provincia y barrio si es
                  posible. Lo revisamos antes de sumarlo.
                </p>
                {suggestStatus === 'sent' ? (
                  <p className="text-[11px] text-brass">¡Gracias! Lo vamos a revisar.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <input
                      value={suggestName}
                      onChange={(e) => setSuggestName(e.target.value)}
                      placeholder="Nombre del local"
                      className="w-full bg-ink border border-panelLine px-3 py-2 text-sm text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
                    />
                    <select
                      value={suggestProvince}
                      onChange={(e) => setSuggestProvince(e.target.value)}
                      className="w-full bg-ink border border-panelLine px-3 py-2 text-sm text-parchment focus:border-brass outline-none"
                    >
                      <option value="">Provincia del local</option>
                      {PROVINCIAS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <input
                      value={suggestBarrio}
                      onChange={(e) => setSuggestBarrio(e.target.value)}
                      placeholder="Barrio o localidad (opcional)"
                      className="w-full bg-ink border border-panelLine px-3 py-2 text-sm text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSendSuggestion}
                      disabled={!suggestName.trim() || !suggestProvince || suggestStatus === 'sending' || !user}
                      className="self-start px-3 py-1.5 border border-panelLine text-parchment text-xs hover:border-brass transition-colors disabled:opacity-50"
                    >
                      {suggestStatus === 'sending' ? 'Enviando…' : 'Enviar sugerencia'}
                    </button>
                    {suggestStatus === 'error' && (
                      <p className="text-[11px] text-bidRed">No se pudo enviar. Probá de nuevo.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function resolveDeliveryProvince(deliveryMethods, deliveryProvince) {
  const showZoneFields = deliveryMethods.includes('retiro') || deliveryMethods.includes('punto_encuentro')
  if (!showZoneFields) return null
  return deliveryProvince || null
}

export function resolveDeliveryZone(deliveryMethods, deliveryProvince, deliveryZone, deliveryZoneOther) {
  const showZoneFields = deliveryMethods.includes('retiro') || deliveryMethods.includes('punto_encuentro')
  if (!showZoneFields) return null
  if (deliveryProvince === CABA_PROVINCE) {
    return deliveryZone || null
  }
  if (deliveryProvince === BUENOS_AIRES_PROVINCE) {
    if (!deliveryZoneOther) return null
    const partido = getPartidoForPostalCode(deliveryZoneOther)
    // Si reconocemos el partido lo mostramos primero (es lo que la gente
    // realmente reconoce), y el código postal queda entre paréntesis como
    // referencia — si no lo reconocemos, mostramos el código solo.
    return partido ? `${partido} (CP ${deliveryZoneOther})` : `CP ${deliveryZoneOther}`
  }
  return null // el resto de las provincias no tiene más detalle que la provincia misma
}

export function resolveCardShops(deliveryMethods, cardShops) {
  const showZoneFields = deliveryMethods.includes('retiro') || deliveryMethods.includes('punto_encuentro')
  return showZoneFields ? cardShops : []
}
