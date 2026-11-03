import { db } from '../firebase'
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore'

const wishlistsCollection = collection(db, 'wishlists')

export async function saveWishlist(userId, wishlistData) {
  const docRef = doc(db, 'wishlists', userId)
  await setDoc(docRef, {
    userId,
    cards: wishlistData.cards,
    game: wishlistData.game || 'Pokémon',
    updatedAt: wishlistData.updatedAt || new Date(),
    isPublic: wishlistData.isPublic !== false, // Public by default
  })
}

export async function getUserWishlist(userId) {
  const docRef = doc(db, 'wishlists', userId)
  const snapshot = await getDoc(docRef)
  return snapshot.exists() ? snapshot.data() : null
}

export async function getPublicWishlists(limitCount = 10) {
  try {
    const q = query(
      wishlistsCollection,
      where('isPublic', '==', true),
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (error) {
    console.error('Error in getPublicWishlists:', error)
    // Fallback: get all public wishlists and sort client-side
    const snapshot = await getDocs(
      query(wishlistsCollection, where('isPublic', '==', true))
    )
    return snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a, b) => {
        const aTime = a.updatedAt?.toMillis?.() || a.updatedAt?.getTime?.() || 0
        const bTime = b.updatedAt?.toMillis?.() || b.updatedAt?.getTime?.() || 0
        return bTime - aTime
      })
      .slice(0, limitCount)
  }
}

export async function getWishlistsByGame(game) {
  const q = query(wishlistsCollection, where('game', '==', game), where('isPublic', '==', true))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }))
}
