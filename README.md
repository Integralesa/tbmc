# The Black Market Connections — TCG

App de subastas de cartas coleccionables (Pokémon, Magic, Yu-Gi-Oh!, etc.) con:
- Login con Google (Firebase Auth)
- Subastas con pujas **en tiempo real** (Firestore + `onSnapshot`)
- Hasta **2 fotos** por carta (Firebase Storage)

## 1. Instalar dependencias

```bash
npm install
```

## 2. Conectar tu proyecto de Firebase

Editá `src/firebase.js` y pegá la config de tu proyecto
(Consola de Firebase → ⚙️ Configuración del proyecto → Tus apps → SDK de Firebase):

```js
const firebaseConfig = {
  apiKey: '...',
  authDomain: '...',
  projectId: '...',
  storageBucket: '...',
  messagingSenderId: '...',
  appId: '...',
}
```

En la consola de Firebase, activá:
- **Authentication → Sign-in method → Google** (habilitalo)
- **Firestore Database** (creala en modo producción)
- **Storage** (creala)

## 3. Subir las reglas de seguridad

Con la Firebase CLI (`npm i -g firebase-tools`, `firebase login`, `firebase init` apuntando a tu proyecto):

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage:rules
```

O pegá manualmente el contenido de `firestore.rules` y `storage.rules` en la consola
(Firestore → Reglas / Storage → Reglas). El archivo `firestore.indexes.json` define
los índices compuestos que las consultas necesitan (Firestore también te va a tirar un
link para crearlos automáticamente la primera vez que corras la app, si no los subiste antes).

## 4. Correr en desarrollo

```bash
npm run dev
```

## 5. Cloud Function: cierre automático de subastas

Hay una función programada (`functions/closeExpiredAuctions`) que corre cada 5 minutos,
busca subastas `active` cuyo `endsAt` ya pasó y las marca como `ended` (guardando quién ganó).
Esto evita que una subasta quede "viva" para siempre si nadie tiene la página abierta.

**Requiere el plan Blaze** (pago por uso) de Firebase — las funciones programadas
(Cloud Scheduler) no están en el plan gratuito Spark, aunque el uso normal de esta
app cae dentro de la capa gratuita de Blaze salvo tráfico muy alto.

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Podés ver los logs con `firebase functions:log` o desde la consola (Functions → Logs).

## Estructura

```
src/
  firebase.js              # init de Firebase (poné tus credenciales acá)
  context/AuthContext.jsx  # estado de sesión + login/logout con Google
  lib/auctions.js          # toda la lógica de datos: crear subasta, pujar, listeners
  components/
    Navbar.jsx
    AuctionCard.jsx
    Countdown.jsx
  pages/
    Home.jsx               # grilla de subastas activas
    CreateAuction.jsx       # publicar carta (hasta 2 fotos)
    AuctionDetail.jsx       # detalle + pujar + historial en tiempo real
```

## Modelo de datos (Firestore)

**`auctions/{id}`**
```
title, game, condition, description
images: [url1, url2]
sellerId, sellerName, sellerPhoto
startingPrice, currentPrice
currentBidderId, currentBidderName, bidCount
status: 'active' | 'ended'
endsAt, createdAt
```

**`bids/{id}`**
```
auctionId, userId, userName, userPhoto, amount, createdAt
```

Las pujas se hacen con una **transacción de Firestore** (`runTransaction`) para evitar
que dos personas pujen al mismo tiempo y se pisen el precio.

## Qué falta / próximos pasos posibles

- Cloud Function programada que marque `status: 'ended'` cuando `endsAt` ya pasó
  (hoy el cierre es "visual": el front no deja pujar pero el doc sigue en `active`
  hasta que alguien lo actualice).
- Perfil de usuario / "mis subastas" / "mis pujas".
- Notificaciones cuando te superan una puja.
- Filtros por juego/precio en el home.

Decime qué querés sumar primero y seguimos iterando.
