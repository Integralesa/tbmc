import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { createListing } from '../lib/market'

const GAMES = ['Pokémon', 'Magic: The Gathering', 'Yu-Gi-Oh!', 'One Piece', 'Otro']
const MAX_PHOTOS = 6
const MAX_RAW_FILE_MB = 25
const MAX_PRICE_DIGITS = 18

export default function CreateMarketListing() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [game, setGame] = useState('Pokémon')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleFileChange(e) {
    const selected = e.target.files?.[0]
    e.target.value = ''
    if (!selected) return
    if (files.length >= MAX_PHOTOS) return
    if (selected.size > MAX_RAW_FILE_MB * 1024 * 1024) {
      setError(`"${selected.name}" pesa demasiado (máx ${MAX_RAW_FILE_MB}MB).`)
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
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!price) {
      setError('Poné un precio.')
      return
    }
    if (String(price).replace(/\D/g, '').length > MAX_PRICE_DIGITS) {
      setError(`El precio es demasiado grande (máximo ${MAX_PRICE_DIGITS} dígitos) — revisalo.`)
      return
    }
    if (files.length === 0) {
      setError('Subí al menos 1 foto de tu carpeta.')
      return
    }

    setSubmitting(true)
    try {
      const id = await createListing({ game, price, description, imageFiles: files, user })
      navigate(`/mercado/${id}`)
    } catch (err) {
      setError(err.message || 'No se pudo publicar.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <p className="text-parchment">Tenés que iniciar sesión para publicar en el Mercado.</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-10">
      <h1 className="font-serif text-3xl text-parchment mb-2">Publicar en el Mercado</h1>
      <p className="text-muted mb-8">
        Subí fotos de tu carpeta o colección, poné un precio, y quien esté interesado te va a poder
        escribir directo — sin puja, sin cierre automático.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm text-muted mb-1.5">Juego</label>
          <select
            value={game}
            onChange={(e) => setGame(e.target.value)}
            className="w-full bg-panel border border-panelLine px-3 py-2.5 text-parchment focus:border-brass outline-none"
          >
            {GAMES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-muted mb-1.5">Precio</label>
          <input
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="$0"
            className="w-full bg-panel border border-panelLine px-3 py-2.5 text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1.5">Descripción (opcional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Contá qué hay en las fotos, condición general, si vendés todo junto o por separado, etc."
            className="w-full bg-panel border border-panelLine px-3 py-2.5 text-parchment placeholder:text-muted/60 focus:border-brass outline-none resize-none"
          />
        </div>

        <div>
          <label className="block text-sm text-muted mb-1.5">
            Fotos ({files.length}/{MAX_PHOTOS})
          </label>
          <div className="flex flex-wrap gap-3 mb-3">
            {previews.map((src, i) => (
              <div key={i} className="relative w-20 h-20 border border-panelLine bg-ink">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(i)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-bidRed text-ink text-xs flex items-center justify-center rounded-full"
                >
                  ×
                </button>
              </div>
            ))}
            {files.length < MAX_PHOTOS && (
              <label className="w-20 h-20 border border-dashed border-panelLine flex items-center justify-center text-muted text-xs cursor-pointer hover:border-brass">
                + Foto
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            )}
          </div>
          <p className="text-[11px] text-muted">
            Subí una foto por página de la carpeta — hasta {MAX_PHOTOS} fotos.
          </p>
        </div>

        {error && <p className="text-bidRed text-sm">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brass text-ink font-medium py-3 hover:bg-brassHigh transition-colors disabled:opacity-50"
        >
          {submitting ? 'Publicando…' : 'Publicar'}
        </button>
      </form>
    </div>
  )
}
