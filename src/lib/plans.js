import badgeChusma from '../assets/badge-chusma.png'
import badgeInformante from '../assets/badge-informante.png'
import badgeIntel from '../assets/badge-intel.png'

// Definición de los planes de suscripción. Por ahora la activación es
// MANUAL: el usuario paga por fuera (transferencia / Mercado Pago) y el
// admin le cambia el campo "plan" a mano en users/{uid} desde la consola
// de Firebase. No hay webhooks ni cobro automático todavía.
export const PLANS = {
  free: {
    key: 'free',
    label: 'Chusma',
    dailyLimit: 2,
    price: 0,
    priority: 0,
    icon: badgeChusma,
    tagline: 'Vendés lo que juntás por ahí, sin muchas vueltas.',
    features: [
      '2 publicaciones por día',
      'Pujas ilimitadas',
      'Hasta 2 fotos por carta',
      'Anti-sniping y contacto post-cierre incluidos',
      'Orden normal en el home (sin prioridad)',
    ],
  },
  pro: {
    key: 'pro',
    label: 'Informante',
    dailyLimit: 10,
    price: 6000,
    priority: 1,
    icon: badgeInformante,
    tagline: 'Movés mercadería con cierta regularidad.',
    features: [
      '10 publicaciones por día',
      'Pujas ilimitadas',
      'Hasta 2 fotos por carta',
      'Anti-sniping y contacto post-cierre incluidos',
      '✦ Aparecés "Destacado" y más arriba en el home',
      '✦ Todas las duraciones, incluida la de 12 horas',
    ],
  },
  unlimited: {
    key: 'unlimited',
    label: 'Intel de Pícaros',
    dailyLimit: Infinity,
    price: 15000,
    priority: 2,
    icon: badgeIntel,
    tagline: 'Publicaciones sin límite — para quien maneja el mercado.',
    features: [
      'Publicaciones ilimitadas por día',
      'Pujas ilimitadas',
      'Hasta 2 fotos por carta',
      'Anti-sniping y contacto post-cierre incluidos',
      '★ Prioridad máxima — arriba de todo el home',
      '★ Todas las duraciones, incluida la de 24 horas',
    ],
  },
}

export function getPlan(key) {
  return PLANS[key] || PLANS.free
}

/**
 * Medianoche de "hoy" en huso horario de Argentina (UTC-3 fijo, sin
 * horario de verano), devuelta como instante real en UTC — lista para
 * comparar contra Timestamps de Firestore.
 */
export function startOfTodayInArgentina() {
  const now = new Date()
  const shifted = new Date(now.getTime() - 3 * 60 * 60 * 1000) // "hora de Bs As" en el reloj UTC
  const startShifted = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    0, 0, 0,
  )
  return new Date(startShifted + 3 * 60 * 60 * 1000) // instante UTC real de esa medianoche
}
