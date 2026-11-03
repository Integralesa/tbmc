import { db } from '../firebase'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'

// Busca wishlists que coincidan con una carta de subasta
export async function findMatchingWishlists(cardName, cardSetCode, cardNumber, quantity) {
  try {
    const wishlists = await getDocs(
      query(collection(db, 'wishlists'), where('isPublic', '==', true))
    )

    const matches = []

    for (const doc of wishlists.docs) {
      const wishlist = doc.data()
      const cards = wishlist.cards || []

      // Buscar si alguna carta en el wishlist coincide
      const matchedCard = cards.find(
        (card) =>
          card.name.toLowerCase() === cardName.toLowerCase() ||
          (card.cardNumber && card.cardNumber === cardNumber)
      )

      if (matchedCard) {
        matches.push({
          userId: wishlist.userId,
          userName: wishlist.userName,
          wishlistId: doc.id,
          searchedQuantity: matchedCard.quantity,
          availableQuantity: quantity,
        })
      }
    }

    return matches
  } catch (error) {
    console.error('Error finding matching wishlists:', error)
    return []
  }
}

// Crea notificaciones para usuarios que buscan una carta
export async function createMatchNotifications(auctionId, cardName, cardSetCode, cardNumber, quantity, matches) {
  try {
    const notificationsCreated = []

    for (const match of matches) {
      const notificationId = `${match.userId}_${auctionId}`

      await setDoc(doc(db, 'notifications', notificationId), {
        userId: match.userId,
        auctionId,
        cardName,
        cardSetCode,
        cardNumber,
        searchedQuantity: match.searchedQuantity,
        availableQuantity: quantity,
        type: 'wishlist_match',
        read: false,
        createdAt: serverTimestamp(),
      })

      notificationsCreated.push(notificationId)
      console.log(`Notification created for ${match.userId}: ${cardName}`)
    }

    return notificationsCreated
  } catch (error) {
    console.error('Error creating notifications:', error)
    return []
  }
}

// Obtiene notificaciones de un usuario
export async function getUserNotifications(userId) {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'notifications'),
        where('userId', '==', userId)
      )
    )

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (error) {
    console.error('Error getting notifications:', error)
    return []
  }
}

// Marca una notificación como leída
export async function markNotificationAsRead(notificationId) {
  try {
    await setDoc(
      doc(db, 'notifications', notificationId),
      { read: true },
      { merge: true }
    )
  } catch (error) {
    console.error('Error marking notification as read:', error)
  }
}
