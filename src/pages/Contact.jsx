import { useState } from 'react'
import { sendContactMessage } from '../lib/contactMessages'

const CONTACT_EMAIL = 'theblackmarketconnections@gmail.com'

export default function Contact() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !message.trim()) {
      setError('Completá al menos el email y el mensaje.')
      return
    }
    try {
      setSending(true)
      await sendContactMessage({ name: name.trim(), email: email.trim(), message: message.trim() })
      setSent(true)
      setName('')
      setEmail('')
      setMessage('')
    } catch (err) {
      setError(err.message || 'No se pudo enviar el mensaje. Probá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="font-serif text-3xl text-parchment mb-8">Quiénes somos</h1>

      <div className="space-y-4 text-parchment/85 leading-relaxed mb-10">
        <p>
          Somos <strong className="text-brass">Gabi</strong>,{' '}
          <strong className="text-brass">Claudio</strong>,{' '}
          <strong className="text-brass">Francisco</strong> y{' '}
          <strong className="text-brass">Eli</strong> — cuatro personas que amamos los TCG y
          armamos The Black Market Connections porque disfrutamos muchísimo hacerlo.
        </p>
        <p>
          Si sos de ir a las LGS de CABA, Buenos Aires, seguro te cruzaste con alguno de nosotros alguna vez.
        </p>
      </div>

      <div className="border border-panelLine bg-panel p-6">
        <h2 className="font-serif text-xl text-parchment mb-2">Contacto</h2>
        <p className="text-muted text-sm mb-4">
          ¿Preguntas, problemas, sugerencias, o simplemente querés saludar? Escribinos acá abajo.
        </p>

        {sent ? (
          <p className="text-bidGreen text-sm">
            ¡Gracias! Tu mensaje ya nos llegó — te vamos a responder a {email || 'tu email'} apenas podamos.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre (opcional)"
              className="w-full bg-ink border border-panelLine px-3 py-2.5 text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Tu email"
              className="w-full bg-ink border border-panelLine px-3 py-2.5 text-parchment placeholder:text-muted/60 focus:border-brass outline-none"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Contanos qué necesitás"
              className="w-full bg-ink border border-panelLine px-3 py-2.5 text-parchment placeholder:text-muted/60 focus:border-brass outline-none resize-none"
            />
            {error && <p className="text-bidRed text-sm">{error}</p>}
            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2.5 bg-brass text-ink text-sm font-medium hover:bg-brassHigh transition-colors disabled:opacity-50"
            >
              {sending ? 'Enviando…' : 'Enviar mensaje'}
            </button>
          </form>
        )}

        <p className="text-[11px] text-muted mt-4">
          También podés escribirnos directamente a{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-brass">
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </div>
    </div>
  )
}
