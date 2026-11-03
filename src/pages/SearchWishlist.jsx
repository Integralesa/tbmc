import { useState, useEffect } from 'react'
import { FiClipboard, FiX, FiChevronUp, FiChevronDown, FiBookmark } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'
import { saveWishlist, getUserWishlist, getPublicWishlists } from '../lib/wishlists'

export default function SearchWishlist() {
  const { user } = useAuth()
  const [cards, setCards] = useState([])
  const [savedWishlist, setSavedWishlist] = useState(null)
  const [publicWishlists, setPublicWishlists] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('search')

  useEffect(() => {
    const init = async () => {
      if (user) {
        try {
          await loadUserWishlist()
        } catch (err) {
          console.error('Error loading user wishlist:', err)
        }
      }
      try {
        await loadPublicWishlists()
      } catch (err) {
        console.error('Error loading public wishlists:', err)
      }
    }
    init()
  }, [user])

  const loadUserWishlist = async () => {
    if (!user) return
    try {
      const data = await getUserWishlist(user.uid)
      if (data) {
        setSavedWishlist(data)
        setCards(data.cards || [])
      }
    } catch (error) {
      console.error('Error loading wishlist:', error)
    }
  }

  const loadPublicWishlists = async () => {
    try {
      const data = await getPublicWishlists()
      setPublicWishlists(data)
    } catch (error) {
      console.error('Error loading public wishlists:', error)
    }
  }

  const parseCards = (text) => {
    // Parse Limitless format: "4 Litwick PBL 36" or "4x Card Name" etc
    const lines = text.split('\n').filter(line => line.trim())
    const parsed = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.includes(':')) continue // Skip headers like "Pokémon: 21"

      // Match patterns like "4 Card Name", "4x Card Name", "1 Litwick PBL 36", etc
      const match = trimmed.match(/^(\d+)[x\s]+(.+)$/)
      if (match) {
        const quantity = parseInt(match[1])
        let fullText = match[2].trim()

        // Extraer set y número: "Litwick PBL 36" → {name: "Litwick", set: "PBL", number: "36"}
        const setMatch = fullText.match(/^(.+?)\s+([A-Z]{1,4})\s+(\d+)\s*$/)

        let cardName = fullText
        let setCode = null
        let cardNumber = null

        if (setMatch) {
          cardName = setMatch[1].trim()
          setCode = setMatch[2]
          cardNumber = setMatch[3]
        } else {
          // Fallback: quitar paréntesis si existen
          cardName = fullText.replace(/\s*\([^)]*\).*$/, '')
        }

        if (cardName.length > 0) {
          parsed.push({
            name: cardName,
            quantity,
            setCode,
            cardNumber,
            added: new Date()
          })
        }
      }
    }

    return parsed
  }

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      console.log('Clipboard text:', text)
      const parsed = parseCards(text)
      console.log('Parsed cards:', parsed)

      if (parsed.length === 0) {
        alert('No encontré cartas en el formato. Usa: "4x Pikachu" o "1 Charizard EX"')
        return
      }

      setCards(parsed)
      setIsLoading(false)
    } catch (error) {
      console.error('Clipboard error:', error)
      alert('No se pudo acceder al clipboard.')
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user || cards.length === 0) return

    setIsLoading(true)
    try {
      await saveWishlist(user.uid, {
        cards,
        game: 'Pokémon', // Default, could be made dynamic
        updatedAt: new Date(),
      })
      setSavedWishlist({ cards, game: 'Pokémon' })
      alert('¡Búsqueda guardada!')
      await loadPublicWishlists()
    } catch (error) {
      console.error('Error saving wishlist:', error)
      alert('Error al guardar')
    } finally {
      setIsLoading(false)
    }
  }

  const removeCard = (index) => {
    setCards(cards.filter((_, i) => i !== index))
  }

  const updateQuantity = (index, newQuantity) => {
    if (newQuantity <= 0) {
      removeCard(index)
    } else {
      const updated = [...cards]
      updated[index].quantity = newQuantity
      setCards(updated)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-4xl text-parchment mb-2">Buscar Cartas</h1>
        <p className="text-muted">
          Pega una lista de Limitless o tu wishlist, y nosotros te avisamos cuando salgan.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-panelLine">
        <button
          onClick={() => setActiveTab('search')}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'search'
              ? 'text-brass border-b-2 border-brass -mb-[2px]'
              : 'text-parchment/60 hover:text-parchment'
          }`}
        >
          Mi búsqueda
        </button>
        <button
          onClick={() => setActiveTab('public')}
          className={`px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'public'
              ? 'text-brass border-b-2 border-brass -mb-[2px]'
              : 'text-parchment/60 hover:text-parchment'
          }`}
        >
          Búsquedas públicas
        </button>
      </div>

      {activeTab === 'search' ? (
        <div className="space-y-6">
          {/* Input area */}
          <div className="mb-8">
            <p className="text-sm text-parchment mb-4">Pega tu lista de Limitless</p>
            <button
              onClick={handlePasteFromClipboard}
              disabled={isLoading}
              className="px-6 py-3 bg-brass text-ink font-medium hover:bg-brassHigh transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FiClipboard size={18} />
              Pegar del clipboard
            </button>
          </div>

          {/* Cards list */}
          {cards.length > 0 && (
            <div>
              <h2 className="text-lg text-parchment mb-4 font-serif">
                Cartas en tu búsqueda ({cards.length})
              </h2>
              <div className="space-y-1 mb-6 font-mono text-sm">
                {cards.map((card, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-panel border border-panelLine px-4 py-2 hover:border-brass/50 transition-colors"
                  >
                    <p className="text-parchment flex-1">
                      {card.quantity} {card.name} {card.setCode && <span className="text-muted">{card.setCode} {card.cardNumber}</span>}
                    </p>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-ink border border-panelLine px-1.5 py-0.5">
                        <button
                          onClick={() => updateQuantity(i, card.quantity - 1)}
                          className="text-muted hover:text-brass transition-colors"
                          title="Decrementar"
                        >
                          <FiChevronDown size={14} />
                        </button>
                        <span className="w-4 text-center text-parchment font-medium text-xs">
                          {card.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(i, card.quantity + 1)}
                          className="text-muted hover:text-brass transition-colors"
                          title="Incrementar"
                        >
                          <FiChevronUp size={14} />
                        </button>
                      </div>

                      <button
                        onClick={() => removeCard(i)}
                        className="text-muted hover:text-bidRed transition-colors ml-1"
                        title="Eliminar"
                      >
                        <FiX size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSave}
                disabled={isLoading || !user}
                className="px-6 py-3 bg-brass text-ink font-medium hover:bg-brassHigh transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <FiBookmark size={18} />
                {isLoading ? 'Guardando...' : 'Guardar búsqueda'}
              </button>

              {!user && (
                <p className="text-sm text-muted mt-3">Inicia sesión para guardar tu búsqueda</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          <h2 className="text-lg text-parchment mb-4 font-serif">Búsquedas activas</h2>
          {publicWishlists.length === 0 ? (
            <p className="text-muted">No hay búsquedas públicas aún. ¡Sé el primero!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {publicWishlists.map((wishlist) => (
                <div key={wishlist.id} className="border border-panelLine bg-panel p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-parchment font-medium">{wishlist.userName}</h3>
                      <p className="text-xs text-muted">{wishlist.game}</p>
                    </div>
                    <span className="text-xs bg-brass/20 text-brass px-2 py-1">
                      {wishlist.cards.length} cartas
                    </span>
                  </div>
                  <div className="space-y-1">
                    {wishlist.cards.slice(0, 5).map((card, i) => (
                      <p key={i} className="text-sm text-parchment/70">
                        {card.quantity}x {card.name}
                      </p>
                    ))}
                    {wishlist.cards.length > 5 && (
                      <p className="text-xs text-muted pt-2">+{wishlist.cards.length - 5} más...</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
