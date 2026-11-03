import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../firebase'
import { getPublicName } from './users'
import { compressImage } from './image'

const PRODUCTS = 'workbenchProducts'
const ORDERS = 'workbenchOrders'
const MAX_PHOTOS = 4
const MAX_VIDEO_MB = 40

// ---------- Modelo de datos ----------
// workbenchProducts/{id}: {
//   title, description, price,
//   images: [urlFoto1, ..., urlFoto4],
//   videoUrl: url | null,            // un video corto opcional del producto
//   active: true | false,            // Susurro lo puede ocultar sin borrarlo
//   createdAt,
// }
// Catálogo propio de TBMC (impresiones 3D y otros productos a pedido) —
// solo Susurro lo carga, a diferencia de Mercado/auctions donde cualquier
// usuario publica. Ver COMO-FUNCIONA.md.
//
// workbenchOrders/{id}: {
//   productId, productTitle, productPrice,
//   buyerId, buyerName, buyerEmail, buyerPhone,
//   message,                          // lo que escribió el comprador en el box
//   status: 'pending' | 'accepted' | 'rejected' | 'delivered',
//   adminNote,
//   createdAt,
// }
// Es un PEDIDO, no una compra con pago online — a propósito no hay
// webhook ni pasarela: Susurro coordina precio final y entrega por fuera
// (WhatsApp/email), igual que el resto del sitio.

/** Sube hasta MAX_PHOTOS fotos y 1 video corto (opcional) a Storage. */
async function uploadProductMedia(productId, { imageFiles, videoFile }) {
  const images = []
  for (let i = 0; i < Math.min(imageFiles.length, MAX_PHOTOS); i++) {
    const compressed = await compressImage(imageFiles[i])
    const path = `workbench/${productId}/foto_${i + 1}_${Date.now()}.jpg`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, compressed, { contentType: 'image/jpeg' })
    images.push(await getDownloadURL(storageRef))
  }

  let videoUrl = null
  if (videoFile) {
    const path = `workbench/${productId}/video_${Date.now()}_${videoFile.name}`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, videoFile, { contentType: videoFile.type })
    videoUrl = await getDownloadURL(storageRef)
  }

  return { images, videoUrl }
}

/** Crea un producto del catálogo Workbench. Solo Susurro (ver firestore.rules). */
export async function createProduct({ title, description, price, imageFiles, videoFile, user }) {
  if (!user) throw new Error('Tenés que iniciar sesión.')
  if (!title?.trim()) throw new Error('Poné un título.')
  if (!price) throw new Error('Poné un precio.')
  if (!imageFiles || imageFiles.length === 0) throw new Error('Subí al menos 1 foto.')
  if (videoFile && videoFile.size > MAX_VIDEO_MB * 1024 * 1024) {
    throw new Error(`El video pesa demasiado (máx ${MAX_VIDEO_MB}MB).`)
  }

  const docRef = doc(collection(db, PRODUCTS))
  await setDoc(docRef, {
    title: title.trim(),
    description: (description || '').trim(),
    price: Number(price),
    images: [],
    videoUrl: null,
    active: true,
    createdAt: serverTimestamp(),
  })

  const { images, videoUrl } = await uploadProductMedia(docRef.id, { imageFiles, videoFile })
  await setDoc(docRef, { images, videoUrl }, { merge: true })

  return docRef.id
}

export async function setProductActive(productId, active) {
  await setDoc(doc(db, PRODUCTS, productId), { active: !!active }, { merge: true })
}

/** Productos visibles en /workbench (activos), más nuevos primero. */
export function subscribeToActiveProducts(callback) {
  const q = query(collection(db, PRODUCTS), where('active', '==', true), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

/** Todos los productos (activos e inactivos) — para la vista de Susurro. */
export function subscribeToAllProducts(callback) {
  const q = query(collection(db, PRODUCTS), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export function subscribeToProduct(productId, callback) {
  return onSnapshot(doc(db, PRODUCTS, productId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  })
}

/** Envía un pedido ("Crear/Craft") para un producto puntual. */
export async function createOrder({ product, message, user }) {
  if (!user) throw new Error('Tenés que iniciar sesión para pedir.')
  if (!message?.trim()) throw new Error('Contanos qué querés antes de enviar el pedido.')

  const profileSnap = await getDoc(doc(db, 'users', user.uid))
  const profile = profileSnap.exists() ? profileSnap.data() : null

  const docRef = doc(collection(db, ORDERS))
  await setDoc(docRef, {
    productId: product.id,
    productTitle: product.title,
    productPrice: product.price,
    buyerId: user.uid,
    buyerName: getPublicName(profile, user),
    buyerEmail: profile?.email || user.email || null,
    buyerPhone: profile?.phone || null,
    message: message.trim(),
    status: 'pending',
    adminNote: null,
    createdAt: serverTimestamp(),
  })

  return docRef.id
}

/** Pedidos propios — para "Mis pedidos" en /perfil. */
export function subscribeToUserOrders(uid, callback) {
  const q = query(collection(db, ORDERS), where('buyerId', '==', uid), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

/** Todos los pedidos — bandeja de Susurro en /admin. */
export function subscribeToAllOrders(callback) {
  const q = query(collection(db, ORDERS), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function setOrderStatus(orderId, status, adminNote = null) {
  await setDoc(doc(db, ORDERS, orderId), { status, adminNote }, { merge: true })
}
