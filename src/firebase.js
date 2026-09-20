import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

// Reemplazá estos valores por los de tu proyecto de Firebase:
// Consola de Firebase > Configuración del proyecto > Tus apps > Config del SDK
const firebaseConfig = {
  apiKey: 'AIzaSyDjuQBU4bJoOhZb75QxkdpE4-VXRuPIzes',
  authDomain: 'tbmc-1bd19.firebaseapp.com',
  projectId: 'tbmc-1bd19',
  storageBucket: 'tbmc-1bd19.firebasestorage.app',
  messagingSenderId: '518133425951',
  appId: '1:518133425951:web:627a79814f98e29d16322a',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
export const db = getFirestore(app)
export const storage = getStorage(app)
