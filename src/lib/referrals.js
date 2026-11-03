/**
 * Sistema de invitación para el sorteo bounty (ver COMO-FUNCIONA.md). El
 * "código" de invitación es directamente el uid de quien invita — no hace
 * falta generar ni chequear uno propio. Si alguien entra por
 * ".../?ref=UID" y se registra por primera vez, ese uid queda guardado en
 * su perfil (`referredBy`, una sola vez, ver upsertUserProfile en
 * lib/users.js) y las Cloud Functions de referidos hacen el resto.
 */
const REF_STORAGE_KEY = 'tbmc_referral_code'

/** Se llama una vez al arrancar la app — guarda el ?ref= de la URL si vino con uno. */
export function captureReferralCodeFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) localStorage.setItem(REF_STORAGE_KEY, ref)
  } catch {
    // localStorage puede fallar en navegación privada — no es crítico, solo se pierde el referido.
  }
}

export function getStoredReferralCode() {
  try {
    return localStorage.getItem(REF_STORAGE_KEY)
  } catch {
    return null
  }
}

/** Link personal de invitación para compartir. */
export function getReferralLink(uid) {
  return `${window.location.origin}/?ref=${uid}`
}
