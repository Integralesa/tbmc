import { useState } from 'react'
import { editAuction } from '../lib/auctions'
import { CARD_SEARCH_APIS } from '../lib/cardSearchApis'
import CardNameInput from './CardNameInput'
import DeliveryFields, { resolveDeliveryProvince, resolveDeliveryZone, resolveCardShops } from './DeliveryFields'
import { CABA_BARRIOS } from '../lib/locations'

const CABA_PROVINCE = 'Ciudad Autónoma de Buenos Aires'
const BUENOS_AIRES_PROVINCE = 'Buenos Aires'

/**
 * Formulario de edición dentro de la ventana de arrepentimiento (ver
 * EDIT_WINDOW_MINUTES en src/lib/auctions.js). A propósito no incluye
 * precio inicial ni fotos — esos quedan fijos desde que se publica.
 */
export default function EditAuctionPanel({ auction, user, onClose, onSaved }) {
  // Un lote/sleeves/deckbox nunca pasó por la búsqueda de carta al publicar
  // (ver CreateAuction), así que tampoco se le exige acá — el título queda
  // como texto libre editable.
  const isCardItem = !auction.itemType || auction.itemType === 'card' || auction.itemType === 'singles'
  const cardApi = isCardItem ? CARD_SEARCH_APIS[auction.game] : null

  // Subastas de antes de sumar "Provincia" no tienen `deliveryProvince`
  // guardado — se infiere a partir de la forma de `deliveryZone`: un
  // barrio de la lista es CABA, y "CP 1425" (con o sin partido) era
  // siempre Gran Buenos Aires en el sistema viejo.
  const inferredProvince = auction.deliveryProvince
    ? auction.deliveryProvince
    : auction.deliveryZone && CABA_BARRIOS.includes(auction.deliveryZone)
      ? CABA_PROVINCE
      : auction.deliveryZone && /CP\s*\d+/.test(auction.deliveryZone)
        ? BUENOS_AIRES_PROVINCE
        : ''
  const savedPostalCode =
    inferredProvince === BUENOS_AIRES_PROVINCE && auction.deliveryZone
      ? (auction.deliveryZone.match(/CP\s*(\d+)/) || [])[1] || ''
      : ''
  const savedBarrio = inferredProvince === CABA_PROVINCE ? auction.deliveryZone || '' : ''

  const [title, setTitle] = useState(auction.title)
  const [titleIsValidCard, setTitleIsValidCard] = useState(true) // ya venía verificada al publicar
  const [condition, setCondition] = useState(auction.condition)
  const [isFoil, setIsFoil] = useState(!!auction.isFoil)
  const [deliveryMethods, setDeliveryMethods] = useState(auction.deliveryMethods || [])
  const [deliveryProvince, setDeliveryProvince] = useState(inferredProvince)
  const [deliveryZone, setDeliveryZone] = useState(savedBarrio)
  const [deliveryZoneOther, setDeliveryZoneOther] = useState(savedPostalCode)
  const [cardShops, setCardShops] = useState(auction.cardShops || [])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setError('')

    if (!title) {
      setError('El título no puede quedar vacío.')
      return
    }

    if (cardApi) {
      if (!titleIsValidCard) {
        setError(`Elegí una carta de la lista de sugerencias de ${cardApi.label} antes de guardar.`)
        return
      }
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

    try {
      setSaving(true)
      await editAuction({
        auctionId: auction.id,
        title,
        condition,
        isFoil,
        deliveryMethods,
        deliveryProvince: resolveDeliveryProvince(deliveryMethods, deliveryProvince),
        deliveryZone: resolveDeliveryZone(deliveryMethods, deliveryProvince, deliveryZone, deliveryZoneOther),
        cardShops: resolveCardShops(deliveryMethods, cardShops),
        user,
      })
      onSaved?.()
    } catch (err) {
      setError(err.message || 'No se pudo guardar el cambio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="border border-brass/40 bg-panel p-4 mb-6 space-y-4">
      <p className="text-sm text-brass font-medium">Editando la subasta</p>
      <p className="text-[11px] text-muted -mt-2">
        El precio inicial y las fotos no se pueden cambiar. Al guardar, el cierre se reinicia a la duración completa.
        Si se ejecuta una modificación del trato, va a ser validada por Susurro o las Arañas.
      </p>

      <div>
        <label className="block text-sm text-muted mb-1.5">
          Título de la carta
          {cardApi && <span className="text-brass font-normal"> · autocompleta con {cardApi.label}</span>}
        </label>
        {cardApi ? (
          <CardNameInput
            value={title}
            onChange={setTitle}
            onValidityChange={setTitleIsValidCard}
            autocompleteCardName={cardApi.autocompleteCardName}
            noMatchHint={cardApi.noMatchHint}
            label={cardApi.label}
            initiallyConfirmed
            placeholder="Empezá a escribir el nombre en inglés"
          />
        ) : (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-ink border border-panelLine px-3 py-2.5 text-parchment focus:border-brass outline-none"
          />
        )}
      </div>

      <div>
        <label className="block text-sm text-muted mb-1.5">Estado</label>
        <select
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          className="w-full bg-ink border border-panelLine px-3 py-2.5 text-parchment focus:border-brass outline-none"
        >
          <option>Mint</option>
          <option>Near Mint</option>
          <option>Excellent</option>
          <option>Played</option>
          <option>Damaged</option>
        </select>
      </div>

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

      {error && <p className="text-bidRed text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="flex-1 py-2.5 border border-panelLine text-parchment hover:border-brass transition-colors disabled:opacity-50"
        >
          Cancelar edición
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2.5 bg-brass text-ink font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
