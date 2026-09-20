// Susurro es el poder máximo, fijo a esta cuenta — no se puede nombrar
// a otro Susurro desde la UI, solo cambiando este archivo (y las reglas).
export const SUSURRO_EMAIL = 'theblackmarketconnections@gmail.com'

export function isSusurro(user) {
  return !!user && user.email === SUSURRO_EMAIL
}

/** Araña: rol que Susurro le puede dar a cualquier usuario desde /admin.
 * Puede banear cuentas y cerrar subastas — nada más (ni planes, ni nombrar
 * a otras Arañas). Se guarda en users/{uid}.role === 'arana'. */
export function isArana(profile) {
  return profile?.role === 'arana'
}

/** True si la persona tiene cualquiera de los dos roles de moderación. */
export function isStaff(user, profile) {
  return isSusurro(user) || isArana(profile)
}
