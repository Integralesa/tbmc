import { useEffect, useRef, useState } from 'react'

/**
 * Input de texto con autocompletado de nombres reales de cartas (la API la
 * elige el padre según el juego — ver src/lib/cardSearchApis.js). A
 * diferencia de un autocompletado "sugerido", este es OBLIGATORIO: hasta que
 * no se elige una carta real de la lista, no se considera válido (avisa al
 * padre vía onValidityChange). Una vez elegida, el campo se bloquea para que
 * no se pueda escribir cualquier cosa después — hay un botón "Cambiar" para
 * volver a buscar otra.
 */
export default function CardNameInput({
  value,
  onChange,
  onValidityChange,
  placeholder,
  autocompleteCardName,
  noMatchHint = 'revisá cómo lo escribiste',
  label = 'la base de datos',
  initiallyConfirmed = false,
}) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(initiallyConfirmed)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (confirmed) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value || value.trim().length < 2) {
      setSuggestions([])
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const names = await autocompleteCardName(value)
        setSuggestions(names)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [value, confirmed])

  function handleChange(text) {
    onChange(text)
    onValidityChange?.(false)
    setOpen(true)
  }

  function handleSelect(name) {
    onChange(name)
    setSuggestions([])
    setOpen(false)
    setConfirmed(true)
    onValidityChange?.(true)
  }

  function handleReset() {
    onChange('')
    setConfirmed(false)
    onValidityChange?.(false)
  }

  if (confirmed) {
    return (
      <div className="flex items-center gap-2 bg-panel border border-bidGreen px-3 py-2.5">
        <span className="text-bidGreen">✓</span>
        <span className="flex-1 text-parchment">{value}</span>
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-brass hover:underline shrink-0"
        >
          Cambiar
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full bg-panel border border-panelLine px-3 py-2.5 text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
      />
      {open && value.trim().length >= 2 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-panel border border-panelLine max-h-56 overflow-y-auto">
          {loading && (
            <li className="px-3 py-2 text-xs text-muted">Buscando en {label}…</li>
          )}
          {!loading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted">
              Sin coincidencias — {noMatchHint}.
            </li>
          )}
          {!loading &&
            suggestions.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onMouseDown={() => handleSelect(name)}
                  className="w-full text-left px-3 py-2 text-sm text-parchment hover:bg-brass/20 transition-colors"
                >
                  {name}
                </button>
              </li>
            ))}
        </ul>
      )}
      {!open && value.trim().length > 0 && (
        <p className="text-[11px] text-bidRed mt-1">
          Tenés que elegir una carta de la lista para poder publicar.
        </p>
      )}
    </div>
  )
}
