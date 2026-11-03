import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { isSusurro } from '../lib/roles'
import { createProduct, subscribeToActiveProducts, subscribeToAllProducts } from '../lib/workbench'
import WorkbenchProductCard from '../components/WorkbenchProductCard'

const MAX_PHOTOS = 4
const MAX_RAW_FILE_MB = 25
const MAX_VIDEO_MB = 40

function NewProductForm({ user, onCreated }) {
  const [title, setTitle] = useState('')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [videoFile, setVideoFile] = useState(null)
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

  function handleVideoChange(e) {
    const selected = e.target.files?.[0]
    e.target.value = ''
    if (!selected) return
    if (selected.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(`El video pesa demasiado (máx ${MAX_VIDEO_MB}MB).`)
      return
    }
    setError('')
    setVideoFile(selected)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!title || !price || files.length === 0) {
      setError('Completá título, precio, y al menos 1 foto.')
      return
    }
    setSubmitting(true)
    try {
      await createProduct({ title, description, price, imageFiles: files, videoFile, user })
      setTitle('')
      setPrice('')
      setDescription('')
      setFiles([])
      setPreviews([])
      setVideoFile(null)
      onCreated?.()
    } catch (err) {
      setError(err.message || 'No se pudo crear el producto.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-brass/40 bg-panel p-5 mb-8 space-y-4">
      <p className="text-xs uppercase tracking-wide text-brass">Nuevo producto (solo vos lo ves así)</p>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título (ej: Soporte para celular impreso en 3D)"
        className="w-full bg-ink border border-panelLine px-3 py-2.5 text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
      />
      <input
        type="number"
        min="0"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="Precio"
        className="w-full bg-ink border border-panelLine px-3 py-2.5 text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        placeholder="Descripción, materiales, tiempos de entrega, colores disponibles, etc."
        className="w-full bg-ink border border-panelLine px-3 py-2.5 text-parchment placeholder:text-muted/60 focus:border-brass outline-none resize-none"
      />

      <div>
        <p className="text-sm text-muted mb-1.5">Fotos ({files.length}/{MAX_PHOTOS})</p>
        <div className="flex flex-wrap gap-3">
          {previews.map((src, i) => (
            <div key={i} className="relative w-16 h-16 border border-panelLine bg-ink">
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
            <label className="w-16 h-16 border border-dashed border-panelLine flex items-center justify-center text-muted text-xs cursor-pointer hover:border-brass">
              + Foto
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>
          )}
        </div>
      </div>

      <div>
        <p className="text-sm text-muted mb-1.5">Video corto (opcional)</p>
        {videoFile ? (
          <div className="flex items-center gap-2 text-sm text-parchment/85">
            <span className="truncate">{videoFile.name}</span>
            <button type="button" onClick={() => setVideoFile(null)} className="text-bidRed text-xs hover:underline">
              Quitar
            </button>
          </div>
        ) : (
          <label className="inline-block px-3 py-1.5 border border-dashed border-panelLine text-muted text-xs cursor-pointer hover:border-brass">
            + Video
            <input type="file" accept="video/*" onChange={handleVideoChange} className="hidden" />
          </label>
        )}
      </div>

      {error && <p className="text-bidRed text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2.5 bg-brass text-ink text-sm font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
      >
        {submitting ? 'Subiendo…' : 'Publicar producto'}
      </button>
    </form>
  )
}

export default function Workbench() {
  const { user } = useAuth()
  const [products, setProducts] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const admin = isSusurro(user)

  useEffect(() => {
    const unsub = admin ? subscribeToAllProducts(setProducts) : subscribeToActiveProducts(setProducts)
    return unsub
  }, [admin])

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8 max-w-xl">
        <h1 className="font-serif text-3xl text-parchment mb-2">🔨 Workbench</h1>
        <p className="text-muted">
          Impresiones 3D y otras piezas hechas a pedido. Elegís lo que te gusta, nos contás qué necesitás,
          y coordinamos precio final y entrega directo.
        </p>
      </div>

      {admin && (
        <div className="mb-8">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 border border-brass text-brass text-sm font-medium hover:bg-brass/10 transition-colors"
          >
            {showForm ? 'Cancelar' : '+ Agregar producto'}
          </button>
          {showForm && <div className="mt-4"><NewProductForm user={user} onCreated={() => setShowForm(false)} /></div>}
        </div>
      )}

      {products === null && <p className="text-muted">Cargando…</p>}

      {products?.length === 0 && (
        <div className="border border-panelLine border-dashed p-10 text-center">
          <p className="text-parchment">Todavía no hay productos publicados.</p>
        </div>
      )}

      {products && products.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {products.map((p) => (
            <WorkbenchProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
