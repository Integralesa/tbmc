import * as scryfall from './scryfall'
import * as pokemon from './pokemon'
import * as yugioh from './yugioh'
import * as onepiece from './onepiece'

/**
 * Un registro por juego con la API de autocompletado/validación que le
 * corresponde. "Otro" no tiene entrada a propósito: para ese caso el título
 * sigue siendo texto libre en CreateAuction.
 */
export const CARD_SEARCH_APIS = {
  'Magic: The Gathering': {
    ...scryfall,
    label: 'Scryfall',
    noMatchHint: 'revisá cómo lo escribiste en inglés (Scryfall busca por nombre en inglés)',
  },
  Pokémon: {
    ...pokemon,
    label: 'pokemontcg.io',
    noMatchHint: 'revisá cómo lo escribiste en inglés',
  },
  'Yu-Gi-Oh!': {
    ...yugioh,
    label: 'YGOPRODeck',
    noMatchHint: 'revisá cómo lo escribiste en inglés',
  },
  'One Piece': {
    ...onepiece,
    label: 'la base de datos de One Piece TCG',
    noMatchHint: 'revisá cómo lo escribiste en inglés',
  },
}
