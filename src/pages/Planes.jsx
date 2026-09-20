import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { submitPlanRequest } from '../lib/planRequests'
import { PLANS } from '../lib/plans'

// Links de pago de Mercado Pago (monto fijo, sin cobro automático).
// Cuando cambies un precio en plans.js, acordate de generar un link nuevo acá.
const MP_LINKS = {
  pro: 'https://mpago.la/1iJLVev', // Informante - $6.000
  unlimited: 'https://mpago.la/1p1UgNU', // Intel de Pícaros - $15.000
}

function ReportDealForm({ planKey, planLabel, onSubmitted }) {
  const { user, loginWithGoogle } = useAuth()
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!user) {
      setError('Iniciá sesión primero.')
      return
    }
    if (!file) {
      setError('Subí una foto o captura del comprobante.')
      return
    }
    setSubmitting(true)
    try {
      await submitPlanRequest({ user, planKey, receiptFile: file })
      onSubmitted()
    } catch (err) {
      setError(err.message || 'No se pudo enviar. Probá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={loginWithGoogle}
        className="block w-full text-center py-2.5 border border-panelLine text-parchment text-sm font-medium hover:border-brass transition-colors"
      >
        Ingresá para informar el trato
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <p className="text-[11px] text-muted">
        Subí una foto o captura del comprobante de pago del plan {planLabel}.
      </p>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="w-full text-xs text-muted file:mr-3 file:py-1.5 file:px-3 file:border file:border-panelLine file:bg-ink file:text-parchment file:cursor-pointer"
      />
      {error && <p className="text-bidRed text-xs">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2.5 border border-panelLine text-parchment text-sm font-medium hover:border-brass transition-colors disabled:opacity-50"
      >
        {submitting ? 'Enviando…' : 'Enviar comprobante'}
      </button>
    </form>
  )
}

function PlanCard({ plan, highlighted }) {
  const isFree = plan.key === 'free'
  const priceLabel = isFree ? 'Gratis' : plan.price ? `$${plan.price.toLocaleString('es-AR')}/mes` : 'A definir'
  const mpLink = MP_LINKS[plan.key]
  const [reporting, setReporting] = useState(false)
  const [sent, setSent] = useState(false)

  return (
    <div
      className={`border p-6 flex flex-col ${
        highlighted ? 'border-brass bg-panel' : 'border-panelLine bg-panel/60'
      }`}
    >
      <div className="flex items-center gap-3 mb-1">
        {plan.icon && (
          <img src={plan.icon} alt="" className="w-14 h-14 rounded-full border border-brass/40 bg-parchment object-cover" />
        )}
        <p className="text-xs uppercase tracking-wide text-brass">{plan.label}</p>
      </div>
      <p className="font-serif text-3xl text-parchment mb-1">{priceLabel}</p>
      <p className="text-muted text-sm mb-4">{plan.tagline}</p>

      <ul className="text-sm text-parchment/85 space-y-2 mb-6 flex-1">
        {plan.features.map((f) => (
          <li key={f} className={f.startsWith('✦') || f.startsWith('★') ? 'text-brass font-medium' : ''}>
            {f}
          </li>
        ))}
      </ul>

      {isFree ? (
        <div className="text-center py-2.5 text-sm text-muted border border-panelLine">
          Tu plan actual, si no pediste otro
        </div>
      ) : sent ? (
        <p className="text-bidGreen text-sm text-center py-2.5">
          Comprobante enviado — en breve activamos tu plan.
        </p>
      ) : (
        <div className="space-y-2">
          {mpLink && (
            <a
              href={mpLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center py-2.5 bg-brass text-ink text-sm font-semibold hover:bg-brassHigh transition-colors"
            >
              Pagar con Mercado Pago
            </a>
          )}

          {reporting ? (
            <ReportDealForm planKey={plan.key} planLabel={plan.label} onSubmitted={() => setSent(true)} />
          ) : (
            <button
              type="button"
              onClick={() => setReporting(true)}
              className="block w-full text-center py-2.5 border border-panelLine text-parchment text-sm font-medium hover:border-brass transition-colors"
            >
              Informar del trato
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function Planes() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-serif text-3xl text-parchment mb-2">Planes</h1>
      <p className="text-muted mb-6 max-w-xl">
        El límite es solo para publicar cartas nuevas — podés pujar sin restricción en cualquier
        plan, siempre.
      </p>

      <div className="border border-panelLine bg-panel/60 px-5 py-4 mb-6 max-w-2xl">
        <h2 className="text-sm font-medium text-parchment mb-2">¿Por qué hay planes pagos?</h2>
        <p className="text-sm text-muted leading-relaxed">
          Cada carta que se publica, cada puja y cada foto que subís vive en servidores de verdad
          (Firebase) que cuestan plata a medida que crece el uso — guardar datos, guardar fotos, y
          servirle todo eso a cada persona que entra a mirar. Los planes pagos existen
          principalmente para <strong className="text-parchment/90">cubrir ese costo de
          infraestructura</strong> y así poder mantener la plataforma funcionando, gratis para la
          mayoría, y seguir sumando mejoras con el tiempo. No es una forma de sacar ventaja de
          nadie — es lo que hace falta para que esto exista y siga creciendo.
        </p>
      </div>

      <div className="border border-brass/40 bg-panel px-4 py-3 mb-8 text-xs text-muted leading-relaxed max-w-xl">
        <strong className="text-brass">Activación manual por ahora:</strong> pagá con el link de
        Mercado Pago y después tocá <strong className="text-parchment/90">"Informar del trato"</strong> para
        subir el comprobante — te llega directo a nuestro panel y activamos tu plan desde ahí.
        Todavía no hay renovación automática: el mes que viene volvés a pagar con el mismo link.
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        <PlanCard plan={PLANS.free} />
        <PlanCard plan={PLANS.pro} highlighted />
        <PlanCard plan={PLANS.unlimited} />
      </div>
    </div>
  )
}
