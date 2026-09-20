/**
 * Zonas y tiendas de referencia para coordinar "Retiro en persona" o
 * "Punto de encuentro" (ver CreateAuction). Son los 48 barrios oficiales
 * de la Ciudad Autónoma de Buenos Aires + una opción libre para quien esté
 * fuera de CABA (Gran Buenos Aires, otras provincias, etc).
 */
export const CABA_BARRIOS = [
  'Agronomía',
  'Almagro',
  'Balvanera',
  'Barracas',
  'Belgrano',
  'Boedo',
  'Caballito',
  'Chacarita',
  'Coghlan',
  'Colegiales',
  'Constitución',
  'Flores',
  'Floresta',
  'La Boca',
  'La Paternal',
  'Liniers',
  'Mataderos',
  'Monserrat',
  'Monte Castro',
  'Nueva Pompeya',
  'Núñez',
  'Palermo',
  'Parque Avellaneda',
  'Parque Chacabuco',
  'Parque Chas',
  'Parque Patricios',
  'Puerto Madero',
  'Recoleta',
  'Retiro',
  'Saavedra',
  'San Cristóbal',
  'San Nicolás',
  'San Telmo',
  'Vélez Sarsfield',
  'Versalles',
  'Villa Crespo',
  'Villa del Parque',
  'Villa Devoto',
  'Villa General Mitre',
  'Villa Lugano',
  'Villa Luro',
  'Villa Ortúzar',
  'Villa Pueyrredón',
  'Villa Real',
  'Villa Riachuelo',
  'Villa Santa Rita',
  'Villa Soldati',
  'Villa Urquiza',
]

// Provincias de Argentina (23 + CABA), para el selector de "Provincia" al
// coordinar "Retiro en persona" o "Punto de encuentro". CABA y Buenos Aires
// van primero porque son, por lejos, las más elegidas; el resto en orden
// alfabético. Elegir una habilita más detalle según cuál sea (ver
// DeliveryFields): CABA → barrio, Buenos Aires → código postal → partido.
export const PROVINCIAS = [
  'Ciudad Autónoma de Buenos Aires',
  'Buenos Aires',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego, Antártida e Islas del Atlántico Sur',
  'Tucumán',
]

// Código postal argentino "clásico" de 4 dígitos (el que la mayoría conoce
// de memoria) — no se valida contra una base real de direcciones, solo el
// formato, para no permitir texto libre en este campo.
export const POSTAL_CODE_LENGTH = 4
export function sanitizePostalCode(value) {
  return value.replace(/\D/g, '').slice(0, POSTAL_CODE_LENGTH)
}

// Códigos postales del Gran Buenos Aires → partido. No es una API en vivo
// (no existe ninguna oficial y gratis para el código postal "viejo" de 4
// dígitos — Georef, la del gobierno, no lo soporta) — es una tabla armada
// a mano cruzando una base de datos abierta de localidades con fuentes
// públicas, código por código, en septiembre 2026. A propósito es parcial
// y se limita al GBA (que es donde vive la inmensa mayoría de quienes usan
// el sitio): un código que no está acá simplemente no muestra partido, se
// sigue mostrando el número solo — nunca se inventa un partido incorrecto.
// Si ves alguno mal o falta uno común, es un objeto plano fácil de corregir.
export const POSTAL_CODE_TO_PARTIDO = {
  1602: 'Vicente López',
  1617: 'Tigre',
  1642: 'San Isidro',
  1646: 'San Fernando',
  1647: 'San Fernando',
  1649: 'San Fernando',
  1650: 'General San Martín',
  1661: 'San Miguel',
  1663: 'San Miguel',
  1665: 'José C. Paz',
  1672: 'General San Martín',
  1678: 'Tres de Febrero',
  1686: 'Hurlingham',
  1702: 'Tres de Febrero',
  1708: 'Morón',
  1714: 'Ituzaingó',
  1716: 'Merlo',
  1722: 'Merlo',
  1723: 'Merlo',
  1744: 'Moreno',
  1746: 'Moreno',
  1748: 'General Rodríguez',
  1757: 'La Matanza',
  1759: 'La Matanza',
  1761: 'Merlo',
  1763: 'La Matanza',
  1765: 'La Matanza',
  1766: 'La Matanza',
  1778: 'La Matanza',
  1804: 'Ezeiza',
  1806: 'Esteban Echeverría',
  1822: 'Lanús',
  1824: 'Lanús',
  1828: 'Lomas de Zamora',
  1832: 'Lomas de Zamora',
  1834: 'Lomas de Zamora',
  1836: 'Lomas de Zamora',
  1838: 'Esteban Echeverría',
  1842: 'Esteban Echeverría',
  1846: 'Almirante Brown',
  1847: 'Almirante Brown',
  1852: 'Almirante Brown',
  1854: 'Almirante Brown',
  1856: 'Almirante Brown',
  1870: 'Avellaneda',
  1872: 'Avellaneda',
  1874: 'Avellaneda',
  1878: 'Quilmes',
  1879: 'Quilmes',
  1881: 'Quilmes',
  1884: 'Berazategui',
  1885: 'Berazategui',
  1888: 'Florencio Varela',
  1889: 'Florencio Varela',
  1894: 'Berazategui',
  1900: 'La Plata',
  1901: 'La Plata',
  1902: 'La Plata',
  1903: 'La Plata',
  1904: 'La Plata',
  1905: 'La Plata',
  1906: 'La Plata',
  1907: 'La Plata',
}

/** Devuelve el partido para ese código postal, o null si no está en la tabla. */
export function getPartidoForPostalCode(cp) {
  return POSTAL_CODE_TO_PARTIDO[Number(cp)] || null
}

// Tiendas de cartas de Capital Federal donde se puede coordinar entrega —
// nombres y ubicaciones confirmados en septiembre 2026. Cada una tiene su
// `province` para que el checkbox solo aparezca cuando esa es la provincia
// elegida (ver DeliveryFields) — "otras" no tiene provincia a propósito,
// así queda siempre visible sin importar cuál se elija.
export const CARD_SHOPS = [
  { key: 'magic_palace', label: 'Magic Palace', province: 'Ciudad Autónoma de Buenos Aires' },
  { key: 'el_refugio', label: 'El Refugio', province: 'Ciudad Autónoma de Buenos Aires' },
  { key: 'magic_dealers', label: 'Magic Dealers', province: 'Ciudad Autónoma de Buenos Aires' },
  { key: 'magic_lair', label: 'Magic Lair', province: 'Ciudad Autónoma de Buenos Aires' },
  { key: 'la_batikueva', label: 'La Batikueva', province: 'Ciudad Autónoma de Buenos Aires' },
  { key: 'otras', label: 'Otras tiendas' },
]

// Solo para mostrar bien las subastas viejas que se publicaron cuando
// "otro" todavía tenía un campo de texto libre (ver cardShopOtherName).
export const LEGACY_CARD_SHOP_LABELS = { otro: 'Otra tienda' }
