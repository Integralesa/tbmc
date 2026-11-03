import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiX, FiCheckSquare, FiSquare } from 'react-icons/fi'

export default function PublishAuctionModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const [acceptedTerms, setAcceptedTerms] = useState(false)

  const handlePublish = () => {
    if (acceptedTerms) {
      onClose()
      navigate('/publicar')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-ink/80 flex items-center justify-center z-50 px-4">
      <div className="bg-panel border border-panelLine max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-serif text-parchment">Publicar Subasta</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-parchment transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>

        <p className="text-sm text-parchment/80">
          Antes de publicar, debes aceptar nuestros términos y condiciones.
        </p>

        <div className="space-y-2">
          <button
            onClick={() => setAcceptedTerms(!acceptedTerms)}
            className="flex items-center gap-2 text-parchment hover:text-brass transition-colors w-full"
          >
            {acceptedTerms ? (
              <FiCheckSquare size={20} className="text-brass" />
            ) : (
              <FiSquare size={20} />
            )}
            <span className="text-sm">
              Acepto{' '}
              <a
                href="/terminos"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brass hover:underline"
              >
                términos y condiciones
              </a>
            </span>
          </button>
        </div>

        <div className="flex gap-2 pt-4">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-ink border border-panelLine text-parchment hover:border-brass transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handlePublish}
            disabled={!acceptedTerms}
            className="flex-1 px-4 py-2 bg-brass text-ink font-medium hover:bg-brassHigh transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Publicar
          </button>
        </div>
      </div>
    </div>
  )
}
