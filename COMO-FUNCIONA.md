# Cómo funciona — The Black Market Connections

Este documento explica las reglas de negocio de la app en criollo, para no perder
el hilo de por qué las cosas funcionan como funcionan. Se actualiza cada vez que
sumamos o cambiamos algo importante. No es documentación técnica de código (para
eso está el README) — es la lógica del producto.

---

## 1. Roles

- **Vendedor**: publica una carta con hasta 2 fotos, define precio inicial, duración
  y si la puja va a ser libre o con incremento fijo.
- **Comprador**: puja por una carta publicada por otro usuario. No puede pujar en su
  propia subasta.
- Cualquier usuario logueado con Google puede ser vendedor y comprador a la vez
  (en subastas distintas).

## 2. Ciclo de vida de una subasta

1. El vendedor publica la carta → queda `status: active`.
2. Los compradores pujan mientras esté activa y dentro de tiempo.
3. Cuando se cumple el tiempo (`endsAt`) sin nuevas pujas de último momento, la
   subasta pasa a `status: ended` y queda registrado quién ganó (`winnerId`).
4. **El cierre automático lo hace una Cloud Function que corre cada 5 minutos**
   (`closeExpiredAuctions`). Es decir, el cierre real puede demorar hasta 5 minutos
   después de `endsAt`, aunque en pantalla el contador y el bloqueo de pujas ya
   reflejan que "cerró" antes de eso (ver sección de disclaimers).

## 3. Duración y anti-sniping (reglas actuales)

"Anti-sniping" es evitar que alguien gane pujando en el último segundo sin que
nadie tenga chance de responder. La regla: si entra una puja dentro de una
"ventana" cercana al cierre, el cierre se extiende automáticamente.

| Duración   | Ventana de alerta   | Extensión si hay puja en la ventana | Plan mínimo |
|------------|---------------------|--------------------------------------|-------------|
| Flash      | 10 minutos          | Últimos 1 min → **+2 min**           | Chusma |
| 30 minutos | 30 minutos          | Últimos 5 min → **+5 min**           | Chusma |
| 2 horas    | 2 horas             | Últimos 10 min → **+10 min**         | Chusma |
| 5 horas    | 5 horas             | Últimos 10 min → **+10 min**         | Chusma |
| 12 horas   | 12 horas            | Últimos 10 min → **+10 min**         | Informante |
| 24 horas   | 24 horas            | Últimos 10 min → **+10 min**         | Intel de Pícaros |

Las duraciones de 12h y 24h son un beneficio de plan (ver sección 8). En
`/publicar`, si tu plan no alcanza, la opción aparece en el desplegable
pero deshabilitada, con una nota de qué plan la desbloquea. El chequeo
también se valida en `createAuction` (no solo en la UI), para que nadie
lo salte llamando a la función directo con un plan insuficiente.

- La extensión se puede disparar **varias veces seguidas** si la gente sigue
  pujando dentro de la ventana (no tiene límite de extensiones por ahora).
- Se calcula sumando tiempo al cierre actual (no "resetea" el reloj a la ventana
  completa).

## 4. Cómo se puja

Dos modos, a elección del vendedor al publicar:

- **Puja libre** (default): el comprador escribe cualquier monto mayor al mínimo
  sugerido (5% arriba del precio actual, redondeado, mínimo $100 de salto).
- **Puja con incremento fijo**: el vendedor define un monto fijo al publicar.
  El comprador ve un solo botón ("Pujar $X") que equivale a precio actual +
  ese incremento. No puede ofertar otro monto.

Las pujas se resuelven con una **transacción de Firestore**: si dos personas
pujan casi al mismo tiempo, Firestore serializa y solo una gana la carrera con
el precio consistente (la otra puja, si ya no alcanza, se rechaza con error).

## 5. Disclaimers y límites actuales

- **La plataforma no es un intermediario de pago ni de envío.** No procesa
  cobros, no retiene dinero, no garantiza que el vendedor entregue la carta ni
  que el comprador pague. Es un espacio de coordinación de subasta, nada más
  (por ahora).
- **El cierre real puede demorar hasta 5 minutos** respecto al `endsAt` mostrado,
  por la frecuencia de la Cloud Function.
- **No hay reputación con estrellas todavía** (ver sección 7) — sí existe
  desde hace poco un historial de incumplimientos (sección 15).
- **No hay pasarela de pago automática** — ver sección 8 (Planes).
- **Los datos de contacto no se revelan automáticamente** — ver sección 6.

## 6. Contacto y confirmación post-cierre

**Implementado — revelar contacto (v1):**

- Al iniciar sesión, se guarda tu email en un documento privado (`users/{tu-id}`)
  que solo vos podés leer o escribir. Desde `/perfil` podés cargar además un
  **WhatsApp opcional** (se guarda en el mismo documento).
- Cuando la Cloud Function cierra una subasta **con ganador**, crea
  `auctions/{id}/contact/info` con el email, teléfono (si lo cargaron) y
  nombre de ambas partes.
- Ese documento **solo lo pueden leer el vendedor y el ganador** de esa subasta
  puntual — las reglas de Firestore lo bloquean para cualquier otro usuario,
  incluso conociendo la URL o el ID del documento.
- En la pantalla de detalle, si la subasta está cerrada y sos una de las dos
  partes, ves una tarjeta "Contacto revelado" con el nombre, el email (+ botón
  copiar) y un botón grande de WhatsApp si el otro cargó teléfono.

**Implementado — handshake de confirmación:**

- En la misma tarjeta de contacto, cada parte ve su propio estado y dos
  botones: **"Confirmar que se completó"** y **"Reportar un problema"**.
- Si **ambas partes** confirman → `dealStatus: 'completed'`.
- Si **cualquiera de las dos** reporta un problema → `dealStatus: 'disputed'`
  de inmediato (no hace falta acuerdo de la otra parte).
- Mientras nadie hizo nada, o falta una confirmación → `dealStatus: 'pending'`.
- Cada usuario solo puede escribir sus propios campos
  (`sellerConfirmed`/`sellerReportedProblem` o los equivalentes de
  `winner*`) — lo bloquean las reglas de Firestore. El campo `dealStatus`
  lo recalcula automáticamente una Cloud Function (`recomputeDealStatus`),
  nunca el cliente.
- Mientras la operación está `pending`, la tarjeta de "Estado de la
  operación" tiene **marco verde si vos ya confirmaste de tu lado, y rojo
  mientras todavía no confirmaste** — para que se note de un vistazo si
  falta tu acción.
- **Sin resolver a propósito, por ahora:** no hay plazo límite ni
  recordatorios si queda "pending" para siempre, y "reportar un problema"
  solo queda registrado — no dispara ninguna acción automática (ni
  suspensión, ni mediación). Es la base para la reputación/ranking de la
  sección 7.

**Pendiente (roadmap, no implementado):**

- Reemplazar el email por un **chat interno por subasta**, para no exponer
  el email real y dejar un historial dentro de la app (más parecido a cómo
  funcionan MercadoLibre/Vinted). Decidido con el dueño del proyecto: se
  arranca con la versión simple de email/WhatsApp y se migra a chat más
  adelante.

## 7. Roadmap: reputación / ranking (idea, sin diseñar todavía)

Depende de que exista primero la confirmación de operación de la sección 6
(ya implementada), que es justo lo que hacía falta para poder calificar una
operación de verdad completada. La idea, a grandes rasgos:

1. Al confirmarse una operación (`dealStatus: 'completed'`), cada parte puede
   calificar a la otra (ej: 1 a 5 estrellas + comentario corto opcional).
2. El perfil de cada usuario muestra su rating promedio y cantidad de
   operaciones completadas.
3. Una página de ranking/leaderboard con los mejores subastadores — ahí
   podrían entrar "títulos" temáticos, a definir más adelante.

Sin definir todavía: qué pasa con calificaciones injustas/de mala fe, si se
pueden editar o eliminar, y si el ranking pesa más por rating promedio o por
volumen de operaciones.

## 8. Planes / suscripciones

El límite es **solo para publicar** — pujar es y va a seguir siendo ilimitado
en todos los planes, para no desalentar la actividad que le da vida a la
plataforma.

| Plan | Límite diario de publicaciones | Precio (referencia sept. 2026) |
|------|-------------------------------|-------------------------------|
| Chusma (gratis) | 2 | — |
| Informante | 10 | $6.000/mes |
| Intel de Pícaros | Ilimitado | $15.000/mes |

**Estrategia de precio:** se arrancó con la mitad del ancla original (que
rondaba el precio de un sobre de Pokémon) a propósito, para bajar la
barrera de entrada y juntar una base inicial de suscriptores. La idea es
subir gradualmente más adelante a medida que la plataforma gane tracción —
es más fácil subir precios de a poco que bajarlos después de haber
arrancado caro.

**Activación: manual, con panel de admin.** El flujo es:
1. El usuario ve en `/planes` el botón "Pagar con Mercado Pago" (link de
   monto fijo, no es una suscripción real de MP) para el plan que quiera.
2. Paga, y toca **"Informar del trato"** en la misma tarjeta del plan —
   sube una foto o captura del comprobante, sin necesidad de escribir un
   mail ni un WhatsApp por fuera de la app.
3. Eso crea un documento en `planRequests` con status `'pending'`. Aparece
   automáticamente arriba de todo en `/admin` (sección "🔔 Tratos por
   confirmar"), con el comprobante, el email de quien lo mandó, y el plan
   pedido — sin que el admin tenga que buscar nada.
4. El admin toca "Activar [plan]" (llama a `setUserPlan` + marca la
   solicitud como `'approved'`) o "Rechazar" (`'rejected'`, no activa
   nada). Con un clic ya queda activo, con vencimiento a 1 mes.
5. **No hay renovación automática**: el mes que viene la persona vuelve a
   pagar con el mismo link y a informar el trato de nuevo.

Los comprobantes se guardan en Storage bajo `receipts/{uid}/...` — a
diferencia de las fotos de las cartas, **no son públicos**: solo los puede
ver quien los subió y la cuenta admin (reglas separadas en `storage.rules`).

Si hiciera falta cambiar de cuenta admin, hay que actualizar el email en
**cuatro lugares**: `src/lib/admin.js` (`ADMIN_EMAIL`), `firestore.rules`
(reglas de `users`, `auctions` y `planRequests`) y `storage.rules` (regla
de `receipts`).

**Importante — control del lado del cliente:** el límite diario hoy se
calcula y se hace cumplir en el propio código del front (`createAuction`
cuenta las publicaciones de hoy antes de crear una nueva). No está reforzado
en las reglas de Firestore ni en una Cloud Function. Es un límite de
negocio "blando": alguien muy técnico podría, en teoría, saltearlo llamando
directo a Firestore. Para esta etapa alcanza; si en algún momento esto
importa de verdad (por ejemplo, si hay usuarios problemáticos), hay que
mover la validación a una Cloud Function que corra en el servidor.

**Precios:** son una referencia tomada de lo que cuesta hoy un sobre de
Pokémon en Argentina (~$20-25k), pensado para que se sienta accesible.
Se arrancó a propósito con la mitad de ese valor de referencia ($6.000 /
$15.000) para bajar la barrera de entrada y juntar una base inicial de
suscriptores, con la idea de subir gradualmente más adelante. Con la
inflación argentina, conviene revisar estos números cada 2-3 meses a mano
en `src/lib/plans.js` (y generar un link de Mercado Pago nuevo si cambian).

**Destacados por plan:** al publicar una carta, se guarda una "foto" del
plan del vendedor en ese momento (`sellerPlan`, `sellerPlanPriority`: 0
Chusma, 1 Informante, 2 Intel de Pícaros). En el home, las subastas se
ordenan primero por esa prioridad (Intel de Pícaros arriba de todo,
después Informante, después el resto) y dentro de cada nivel por cierre
más próximo, como antes. Las de Informante e Intel de Pícaros muestran
además una etiqueta "Destacado" / "★ Intel de Pícaros" en la tarjeta y en
el detalle. Como es una foto al momento de publicar, si alguien sube o baja
de plan después no afecta a las subastas que ya había publicado — solo a
las nuevas. El ordenamiento se hace del lado del cliente (no en la consulta
de Firestore) para no dejar afuera a las subastas viejas que no tienen
este campo.

**Vencimiento (planExpiresAt):** al activar un plan en Firestore, además del
campo `plan`, se puede cargar `planExpiresAt` (tipo timestamp). Es solo un
**recordatorio visible** — se muestra en `/perfil` ("Vence el ..." / "Venció
el ..." en rojo si ya pasó) tanto para el usuario como para vos cuando
revisás Firestore. **No hay downgrade automático todavía**: si se vence,
sigue activo hasta que vos lo cambies a mano. Si en algún momento esto se
vuelve tedioso de trackear a mano, la solución sería una Cloud Function
programada (mismo patrón que `closeExpiredAuctions`) que baje a `free` a
quien tenga `planExpiresAt` vencido.

**Idea de crecimiento — sorteo mensual: IMPLEMENTADO Y AUTOMÁTICO.** Cloud
Function `monthlyRaffle`, corre sola el día 1 de cada mes (3am hora
Argentina):
- Mira las subastas publicadas **el mes anterior** por vendedores que en
  ese momento eran plan Chusma (gratis) — sortea entre ellos 1 mes de
  Informante.
- Mira las subastas publicadas el mes anterior por vendedores Informante —
  si hubo **30 o más personas distintas**, sortea entre ellos 1 mes de
  Intel de Pícaros. Si hay menos de 30, ese sorteo no se hace ese mes.
- **Nunca degrada a nadie**: si el ganador ya tenía un plan igual o mejor,
  solo se le extiende 1 mes el vencimiento, nunca se le baja de categoría.
- Queda un registro en `raffles/{AAAA-MM}` con cuántos candidatos hubo y
  quién ganó cada sorteo (colección de lectura pública, por si en algún
  momento se quiere mostrar "ganador del mes" en la web).
- El campo `planGrantedVia` en el perfil del usuario indica si el plan
  actual vino de `'raffle'` (sorteo) o `'admin'` (activado a mano) — sirve
  para diferenciarlos después si hace falta.

## 9. Suspensión de cuentas (bans)

Desde `/admin`, buscando a alguien por email, se lo puede suspender por
**2 días**, **1 semana**, o de forma **permanente** — pensado para casos de
abuso (estafas, mal comportamiento, etc.).

- Una cuenta suspendida **no puede publicar ni pujar** — se valida en
  `createAuction` y `placeBid`, del lado del cliente pero con el mismo nivel
  de confianza que el resto de las validaciones actuales de la app.
- La persona suspendida ve un cartel rojo en toda la app explicándole que
  está suspendida y hasta cuándo (o que es permanente).
- **Los bans temporales se vencen solos** — no hace falta entrar a
  levantarlos a mano. Se guarda `bannedUntil` (o `null` si es permanente) y
  se compara contra la fecha actual cada vez que se chequea (`isUserBanned`
  en `src/lib/users.js`). Si querés levantar uno antes de tiempo, hay un
  botón "Levantar suspensión" en `/admin`.
- No hay ninguna acción automática más allá de bloquear publicar/pujar: no
  se ocultan ni se cancelan las subastas que la persona ya tenía activas al
  momento de suspenderla.

**Cierre de agujero de seguridad (importante):** hasta este cambio, las
reglas de Firestore le daban a cada usuario permiso de escribir *cualquier*
campo de su propio documento en `users/{uid}` — lo que en teoría permitía
que alguien se auto-asignara `plan: "unlimited"` sin pagar, o se sacara un
ban escribiendo `banned: false` directo contra Firestore (sin pasar por la
UI de la app). Se restringió: un usuario común **solo puede tocar**
`displayName`, `email`, `photoURL`, `phone` y `updatedAt` de su propio
documento. Los campos `plan`, `planExpiresAt`, `planGrantedVia`, `banned`,
`bannedUntil`, `bannedAt` y `banReason` son **de solo-admin** — únicamente
la cuenta `theblackmarketconnections@gmail.com` los puede escribir, para
cualquier usuario.

## 10. Roles de moderación: Susurro y Araña

- **Susurro**: poder total, fijo a la cuenta `theblackmarketconnections@gmail.com`
  (no se nombra desde la UI, solo cambiando el email en 4 lugares: ver
  sección 8). Puede: activar/rechazar planes, banear, cerrar subastas, y
  nombrar o sacar Arañas.
- **Araña**: rol que Susurro le puede dar a cualquier usuario desde
  `/admin` (se guarda en `users/{uid}.role == 'arana'`). Puede **solo**
  banear cuentas y cerrar subastas — no toca planes ni puede nombrar a
  otra Araña.
- El check de Araña necesita leer el propio perfil del usuario (el rol no
  viene en el token de Google), por eso `AuthContext` ahora también
  suscribe al documento propio de `users/{uid}` y lo expone como `profile`
  junto a `user` en `useAuth()`.
- Las reglas de Firestore usan funciones reutilizables `isSusurro()`,
  `isArana()`, `isStaff()` (`firestore.rules`) para no repetir la lógica en
  cada colección.

## 11. Límite de pujas consecutivas

Para que nadie infle una subasta pujándose a sí mismo muy rápido: la misma
persona puede pujar **hasta 2 veces seguidas** sin restricción. A partir de
la 3ra vez seguida (sin que nadie más haya pujado en el medio), tiene que
esperar **1 minuto** desde su última puja. Si puja otra persona distinta en
el medio, el contador se resetea a cero. Se controla con dos campos en el
propio documento de la subasta (`bidderStreak`, `lastBidAt`), actualizados
dentro de la misma transacción de puja.

## 12. Cierre manual de subastas (admin)

Desde `/admin`, buscando al vendedor por email y entrando a "Ver sus
subastas", se puede cerrar cualquier subasta activa a mano, con un motivo.

- Queda con `status: 'closed_by_admin'` — un estado **distinto** de `'ended'`
  (que es el cierre normal por tiempo). Esto es a propósito: un cierre
  manual normalmente es por algo raro con la publicación (sospecha de
  estafa, contenido inapropiado, etc.), así que **no se dispara el
  contacto ni el handshake** con quien iba ganando — no tendría sentido
  armar una "operación" sobre algo que se cerró por un problema.
- Desaparece de la lista de subastas activas del home (la consulta filtra
  `status == 'active'`).
- En el detalle se ve un cartel rojo con el motivo, y la foto principal
  queda con opacidad reducida y borde rojo.
- En `/perfil` (tanto "Mis subastas" del vendedor como "Mis pujas" de quien
  pujó) aparece como "🔒 Cerrada por admin" en vez de "Cerrada" a secas.
- **No es reversible desde la UI todavía** — si hiciera falta reabrirla,
  hay que cambiar el `status` a mano en Firestore.

### 12.1. Últimos usuarios registrados

En `/admin`, arriba del buscador por email, hay un cuadro **"🆕 Últimos
registrados"** con los últimos 10 usuarios que se crearon una cuenta
(nombre, foto, email y fecha), ordenados del más nuevo al más viejo.
Tocar a alguien de la lista lo carga directo en el panel de abajo (plan,
suspensión, subastas), como si lo hubieras buscado por email a mano. Hay
un botón "Actualizar" para volver a pedir la lista (no se actualiza sola
en vivo).

- Se guarda un `createdAt` en `users/{uid}` **solo la primera vez** que
  alguien inicia sesión (`upsertUserProfile` en `src/lib/users.js`) — a
  propósito no se pisa en logins siguientes, si no dejaría de servir como
  fecha de registro real. En `firestore.rules`, `createdAt` está permitido
  al *crear* el documento, pero no en un *update* — así nadie puede
  falsear después su propia fecha de registro escribiendo directo a
  Firestore.
- **Las cuentas de antes de este cambio no tienen `createdAt`** (no hay
  forma de reconstruirlo con retroactividad) — no van a aparecer nunca en
  esta lista, aunque sigan siendo usuarios normales del sitio en todo lo
  demás.

## 13. Métodos de entrega

Al publicar, el vendedor marca (puede elegir varios): **Retiro en
persona**, **Envío**, **Envío a cargo del comprador**, **Punto de
encuentro**. Se guardan en `deliveryMethods` (array) y se muestran como
etiquetas en el detalle de la subasta. La dirección o zona puntual no
tiene campo propio — se pide en la descripción libre de la carta (el
placeholder del campo lo recuerda si corresponde).

## 14. Reportes de problema (motivo + bandeja para Susurro/Arañas)

Cuando alguien reporta un problema en el handshake (sección 6), ahora tiene
que escribir qué pasó. Eso hace dos cosas:
1. Guarda el motivo en el propio documento de contacto
   (`sellerProblemReason` / `winnerProblemReason`).
2. Crea un documento en `problemReports` (colección nueva, top-level) con
   el motivo, quién reportó, y los `sellerId`/`winnerId` de esa subasta.

Esa colección es la "bandeja de entrada" que ven **Susurro y las Arañas**
en `/admin` (sección "🚨 Problemas reportados") — no hay ningún sistema de
mail armado, así que el aviso vive adentro de la app. Desde ahí, quien
modera puede:
- **"Incumplimiento al vendedor/comprador"**: suma un strike a esa persona
  (ver sección 15) y marca el reporte como resuelto.
- **"Marcar como visto (sin sanción)"**: lo saca de la lista sin aplicar
  nada, para reportes sin fundamento.

## 15. Incumplimientos y suspensión progresiva

Política escrita en los Términos y Condiciones (sección 6 de ese
documento), implementada en `addStrike()` (`src/lib/admin.js`):

| Incumplimiento | Qué pasa |
|---|---|
| 1ro | Queda contado (`strikeCount`). Aviso visible en `/perfil`. |
| 2do | Aviso más fuerte en `/perfil`: la próxima puede ser suspensión. |
| 3ro | **Suspensión automática de 2 días.** |
| 4to | Suspensión automática de 7 días. |
| 5to en adelante | Suspensión **permanente**. |

Importante: **qué cuenta como "incumplimiento" es un juicio humano**, no
algo que el sistema detecta solo. Susurro o una Araña deciden, revisando
un reporte de problema, a quién corresponde sumarle el strike — el sistema
no intenta adivinar de qué lado estuvo la falla. Esta es una decisión de
diseño consciente: automatizar la atribución de culpa sin criterio humano
es más riesgoso que dejarlo en manos de quien modera.

## 16. Recordatorio de compromiso al pujar

En el formulario de puja (tanto libre como con incremento fijo) se muestra
el texto: *"Al pujar, te comprometés a completar la operación si ganás."*
— solo un recordatorio visual, no un chequeo técnico adicional (el
compromiso real ya está en los Términos y Condiciones, sección 4).

## 18. Título verificado contra la base del juego elegido

Al publicar, el título de la carta ya no es texto libre para Magic,
Pokémon, Yu-Gi-Oh! y One Piece (sí lo sigue siendo si más adelante se
agrega un juego sin API propia). El campo autocompleta contra la base de
datos real del juego elegido y **bloquea el campo** hasta que se elige un
nombre real de la lista — hay un botón "Cambiar" para buscar otro. Antes
de publicar (y antes de guardar una edición) se hace un segundo chequeo
contra la API por si el estado del formulario se manipuló por fuera de la
interfaz normal.

APIs usadas (todas gratis, sin necesidad de key):

| Juego | API | Estabilidad |
|---|---|---|
| Magic: The Gathering | Scryfall | Muy estable |
| Yu-Gi-Oh! | YGOPRODeck | Muy estable |
| One Piece | optcgapi.com | Estable, pero es un proyecto de un fan en un VPS propio (no oficial) |
| Pokémon | pokemontcg.io | Funciona, pero tira errores 500 con bastante frecuencia — tiene un reintento automático incorporado (`src/lib/pokemon.js`) que ayuda pero no lo soluciona del todo |

## 18.1. Publicar algo que no es una carta individual (y "Singles"): Lote / Set de Cartas / Sleeves / Deckbox / Juego de mesa

En `CreateAuction` hay 6 checkboxes mutuamente excluyentes entre sí (se
guardan en `itemType`), en este orden: **Singles**, **Lote de varias
cartas**, **Set de Cartas**, **Sleeves (fundas)**, **Deckbox** y **Juego
de mesa**. Tildar cualquiera de las últimas cinco saca del medio la
búsqueda obligatoria contra la API de cartas (sección 18) — el título se
arma solo, sin ningún campo de texto libre (mismo criterio que el resto
del formulario, ver sección 19):

- **Singles** → **no cambia nada del comportamiento**: sigue exigiendo
  elegir la carta de la lista de sugerencias de la API, exactamente
  igual que no tildar ningún checkbox. Es solo una etiqueta explícita
  (`itemType: 'singles'` en vez de `'card'`) para dejar constancia de que
  es una carta suelta — pensada como base para un filtro futuro, si hiciera
  falta, parecido al de "Juegos de mesa" en el home.
- **Sleeves** → título fijo: `"Sleeves"`.
- **Deckbox** → título fijo: `"Deckbox"`.
- **Juego de mesa** → título fijo: `"BoardGame"`. Se evaluó agregar
  "Juegos de mesa" como juego propio con autocompletado (como Magic,
  Pokémon, etc.), pero no existe ninguna API gratis y confiable para
  eso — se investigó BoardGameGeek (bloquea cualquier pedido automático
  con un desafío anti-bot de Cloudflare) y BoardGameAtlas, la
  alternativa más conocida (su dominio de API apunta a una app de Heroku
  que ya no responde, parece dada de baja). Decisión explícita del dueño
  del proyecto: en vez de eso, un checkbox simple con título fijo, igual
  de rápido que Sleeves/Deckbox — el detalle de qué juego es se ve en las
  fotos. Como estas subastas no tienen un `game` propio (el campo
  "Juego" del formulario queda con lo que sea que haya elegido antes, no
  significa nada para un juego de mesa), el filtro de "Juego" en el home
  tiene una opción aparte **"Juegos de mesa"** que filtra por
  `itemType === 'board_game'` en vez de por el campo `game` (ver
  `BOARD_GAMES_FILTER` en `src/pages/Home.jsx`).
- **Set de Cartas** → título fijo: `"Set de Cartas"`. Es para cuando el
  vendedor quiere subastar **varias cartas distintas en una misma
  foto** (sin armar un lote con cantidad/set) — se diferencia de "Lote"
  a propósito: Lote es una cantidad definida de cartas (opcionalmente de
  un set puntual de Magic), Set de Cartas es simplemente "estas cartas
  variadas de la foto", sin más estructura.
- **Lote de varias cartas** → pide la cantidad de cartas, y arma el
  título como `"Lote de {cantidad} cartas"`. Si el juego elegido es
  **Magic: The Gathering**, además se puede ir agregando de a un set (un
  `<select>` + botón "Agregar", con la lista completa de sets reales
  pedida una sola vez a Scryfall — `fetchSetList()` en `src/lib/scryfall.js`,
  cacheada en memoria) o tildar **"Sets variados / mezclados"** en vez de
  elegir sets puntuales. El título final queda, por ejemplo, `"Lote de 20
  cartas — Sets: Kamigawa: Neon Dynasty, Dominaria United"` o `"Lote de 20
  cartas (sets variados)"`. Para los demás juegos (sin API de sets propia
  integrada todavía) el título queda `"Lote de {cantidad} cartas de
  {juego}"`.
- El campo "Título" pasa a mostrarse de solo lectura (con la etiqueta
  "Título (automático)") mientras cualquiera de las últimas 5 opciones
  esté tildada — con "Singles" (o sin tildar nada) sigue siendo el campo
  de búsqueda normal.
- Se guarda `itemType` (`'card' | 'singles' | 'lote' | 'sleeves' |
  'deckbox' | 'set_cartas' | 'board_game'`) y, para lote, también
  `loteQuantity`, `loteSets` (array de `{code, name}`) y `loteSetsVariados`
  en el documento de la subasta — no solo el título ya armado, para tener
  el dato estructurado disponible a futuro.
- Al **editar** una subasta de estas cinco (ventana de 5 minutos, sección
  21), no se le vuelve a exigir la búsqueda de carta — el título queda
  como texto libre editable directamente en `EditAuctionPanel`. "Singles"
  es la excepción: al editarla sigue pidiendo la búsqueda, igual que una
  carta sin ningún checkbox tildado.

## 18.2. Foil

Checkbox **"Es Foil"** junto al selector de "Estado" al publicar (y
editable dentro de la ventana de 5 minutos de arrepentimiento, sección
21). Se guarda como `isFoil` (booleano) en la subasta y, si está
tildado, aparece una etiqueta **"Foil"** al lado del título en todos
lados: el listado de subastas (`AuctionCard`), el preview antes de
publicar, y el detalle de la subasta.

## 19. Entrega: provincia, zona y tiendas de referencia

Si el vendedor marca "Retiro en persona" o "Punto de encuentro" al
publicar, aparecen campos adicionales (no aplican si solo marca "Envío"):

- **Provincia**: dropdown con las 23 provincias + Ciudad Autónoma de
  Buenos Aires (`PROVINCIAS` en `src/lib/locations.js`). Elegir una
  habilita más detalle según cuál sea:
  - **Ciudad Autónoma de Buenos Aires** → aparece un segundo dropdown con
    los 48 barrios oficiales de CABA.
  - **Buenos Aires** → aparece un campo de código postal (4 dígitos, solo
    números — a propósito **no es una caja de texto libre**). Si el
    código está en `POSTAL_CODE_TO_PARTIDO` (`src/lib/locations.js`), se
    muestra el partido en vivo mientras se escribe y se guarda así en la
    subasta (ej: `"San Miguel (CP 1661)"`) — si no lo reconoce, se guarda
    solo `"CP 1425"`, sin inventar nada. **No es una API en vivo** — no
    existe ninguna oficial y gratis para el código postal viejo de 4
    dígitos (la del gobierno, Georef, no lo soporta) — es una tabla
    armada a mano, código por código, **acotada a los partidos del Gran
    Buenos Aires**. Si falta un código común o hay alguno mal, es un
    objeto plano fácil de corregir.
  - **Cualquier otra provincia** → no hay más detalle que la provincia
    misma (no existe ese nivel de dato armado todavía).
- **Tiendas**: checkboxes de locales — pero **solo se muestran los que
  son de la provincia elegida** (Magic Palace, El Refugio, Magic Dealers,
  Magic Lair y La Batikueva son todos de CABA, así que solo aparecen ahí)
  + los **locales aprobados por sugerencia** de esa misma provincia (ver
  19.1) + **"Otras tiendas"** al final, que se muestra siempre sin
  importar la provincia. Si todavía no se eligió provincia, se pide
  elegirla primero para poder ver los locales de esa zona.

En la subasta se guardan por separado `deliveryProvince` (la provincia) y
`deliveryZone` (el detalle: barrio o "Partido (CP ...)", según
corresponda) — subastas viejas (de antes de este cambio) no tienen
`deliveryProvince` guardado, así que al editarlas se infiere sola a
partir de la forma de `deliveryZone` (un barrio de la lista → CABA; un
"CP ..." → Buenos Aires, que es como funcionaba el sistema viejo).

### 19.1. Sugerir un local nuevo ("Otras tiendas")

Al tildar **"Otras tiendas"** aparece un cuadro: *"Decinos los locales
donde entregás y los agregamos a los checkboxes, con provincia y barrio
si es posible"*, con tres campos (nombre del local, **provincia** —
dropdown obligatorio, para que el filtro de arriba funcione — y barrio o
localidad opcional) y un botón "Enviar sugerencia". A propósito **no
agrega el local de una directamente** — cae en una bandeja nueva en
`/admin` ("🏬 Locales sugeridos") para que Susurro/Arañas la revisen:

- **Aprobar y agregar** → el local pasa a la colección `cardShops` (con
  su provincia) y **aparece como checkbox nuevo para todo el mundo de esa
  provincia al instante**, sin tocar código ni volver a desplegar el
  sitio (a diferencia de la lista curada de arriba, que sigue siendo fija
  en `src/lib/locations.js`).
- **Rechazar** → no se agrega nada, la sugerencia queda cerrada.

`src/lib/cardShops.js`: `subscribeToApprovedCardShops` (lee los locales
ya aprobados en vivo, para el checkbox), `submitShopSuggestion` (crea la
sugerencia), `subscribeToOpenShopSuggestions` / `approveShopSuggestion` /
`rejectShopSuggestion` (para `/admin`), y `useCardShopLabels` (combina
la lista curada fija con los locales aprobados para que el preview de
`CreateAuction` y el detalle de la subasta muestren el nombre real del
local en vez del ID de Firestore).

La caja de "Descripción" libre que existía antes se sacó del todo — la
información de zona/tienda ahora va en estos campos estructurados, y no
hay reemplazo para notas libres sobre la carta (defectos, detalles de
edición, etc.) por decisión explícita del dueño del proyecto.

### 19.2. Guardar la forma de entrega habitual

Al publicar, debajo de los campos de entrega hay un checkbox tildado por
defecto: *"Guardar esta forma de entrega para no tener que cargarla de
nuevo la próxima vez"*. Si se deja tildado, al confirmar la publicación se
guarda en el perfil del usuario (`users/{uid}.deliveryPreferences` — un
solo objeto anidado con métodos de entrega, provincia, zona/código postal
y tiendas elegidas) y **la próxima vez que abra "Publicar carta" esos
mismos campos ya vienen precargados** (igual de editables, no quedan
fijos). Si el vendedor destilda el checkbox esa vez, simplemente no se
actualiza lo guardado — no borra una preferencia anterior.

- No bloquea la publicación si falla el guardado — es una comodidad, no
  algo de lo que dependa haber publicado bien (`src/lib/users.js`,
  `updateDeliveryPreferences`).
- Se guarda como un objeto anidado (no campos sueltos) para no tener que
  tocar la lista de campos permitidos en `firestore.rules` cada vez que
  se agregue un dato nuevo a la forma de entrega.
- No se re-aplica la preferencia si el vendedor ya venía editando el
  formulario (ej. cambió de opinión mientras el perfil todavía estaba
  cargando) — solo se precarga una vez, la primera vez que llega el
  perfil.

## 20. Preview antes de publicar y portada de fotos

Antes de que la publicación se suba de verdad, se muestra una pantalla de
revisión (doble check) con cómo va a verse la subasta — foto de portada,
título, estado, precio, duración, entrega — y un aviso sobre la ventana de
5 minutos para editar/cancelar (sección 21), o de que no aplica si se
eligió duración "Flash". Desde ahí el vendedor puede "Volver a editar" o
"Confirmar y publicar" (recién ahí se sube todo a Firestore/Storage).

Si se suben 2 fotos, el vendedor elige cuál es la **portada** (la que se
va a ver primero en el listado de subastas del home y en el detalle) —
antes siempre era la primera que se subía, sin poder elegir.

Las fotos se suben **de a una** (no un selector múltiple): se elige la
primera, aparece con una ✕ para sacarla si hace falta, y recién ahí se
habilita subir la segunda. Cada miniatura ya subida tiene su propia ✕ para
sacarla y volver a subir otra en su lugar, sin tener que rehacer todo el
formulario por un error de foto.

## 21. Edición y cancelación de subasta por el vendedor (ventana de 5 minutos)

Pensado como una "ventana de arrepentimiento" para corregir errores recién
publicados, sin abrir la puerta a manipular una subasta que ya generó
interés:

- Aplica a las duraciones 30 min, 2h, 5h, 12h y 24h. **No aplica a
  "Flash"** (10 min) — la ventana casi no dejaría tiempo real de subasta.
- Dura **5 minutos desde que se publicó** (`EDIT_WINDOW_MINUTES` en
  `src/lib/auctions.js`), después no se puede ni editar ni cancelar.
- **Editar**: se puede corregir título (re-verificado contra la API del
  juego si cambia), estado, entrega/zona/tiendas. **A propósito no se
  puede tocar el precio inicial ni las fotos** — son los dos datos que
  alguien podría cambiar para "hacer un cambiazo" después de que ya lo
  vieron o pujaron. Al guardar, el cierre (`endsAt`) se reinicia a la
  duración completa original, para que editar no le robe tiempo real a la
  subasta. Las pujas ya hechas no se tocan.
- **Cancelar**: se permite **aunque ya haya pujas** — la UI avisa
  explícitamente de esto antes de confirmar ("esas pujas se pierden y
  quien pujó no va a poder reclamar nada"). Decisión explícita del dueño
  del proyecto: se prioriza la libertad del vendedor de dar marcha atrás
  por sobre la protección total del comprador, compensado con el aviso.
  Cancelar pone `status: 'cancelled_by_seller'` (no se borra el
  documento) — **no hay reactivación**, si te arrepentís hay que publicar
  de nuevo. No dispara contacto ni handshake (mismo criterio que
  `closed_by_admin`).
- Reforzado tanto del lado del cliente (`src/lib/auctions.js`) como en
  `firestore.rules` (`withinSellerEditWindow`) — no es un límite "blando"
  como el de publicaciones diarias.
- Agregado a Términos y Condiciones (sección 3) — **pendiente de que lo
  revise el abogado**, como toda regla de negocio nueva con implicancia
  legal.
- **Cada edición se avisa a Susurro/Arañas**: al guardar un cambio, además
  de actualizar la subasta se crea un registro en `auctionEdits` (qué
  cambió, antes/después, quién) — aparece en `/admin` en la sección "🔧
  Modificaciones de subastas". Tanto en el preview antes de publicar como
  en el panel de edición se muestra el aviso: *"Si se ejecuta una
  modificación del trato, va a ser validada por Susurro o las Arañas"*. Si
  por algo este aviso fallara, no le bloquea al vendedor un cambio que ya
  se guardó bien — solo queda un `console.error`.

## 22. Avisos (campanita) — te superaron / te cancelaron / terminó tu subasta / ganaste

Sistema de avisos persistentes guardados en Firestore (colección
`notifications`), mostrados con una **campanita 🔔 en el Navbar**
(`NotificationBell.jsx`, visible para cualquier usuario logueado, con
contador de no leídos). Reemplaza al viejo `AuctionAlerts` (popup
puramente del lado del cliente, que solo funcionaba si tenías una
pestaña del sitio abierta justo en el momento del evento).

Los avisos ahora los crea una Cloud Function del lado del servidor,
`notifyOnAuctionChange` (`onDocumentUpdated('auctions/{auctionId}')` en
`functions/index.js`), que corre cada vez que se actualiza cualquier
subasta y detecta estos casos:

- **Te superaron la puja**: cambió `currentBidderId` y quien iba ganando
  antes tenía tildado *"Avisame acá en la página si me superan esta
  puja"* (`currentBidderWantsNotify`), y la subasta sigue `active`.
- **Te cancelaron la subasta**: la subasta pasó de `active` a
  `cancelled_by_seller` — se avisa a **todos los que pujaron ahí**
  (se busca en la colección `bids` por `auctionId`), no solo a quien iba
  ganando.
- **Terminó tu subasta** (al vendedor): pasó de `active` a `ended` — le
  llega quién ganó (o que no hubo pujas).
- **Ganaste una subasta** (al ganador): mismo evento, aviso aparte.

Como el trigger es sobre el documento de la subasta y no sobre quién lo
edita, esto funciona igual si el cambio lo hizo `closeExpiredAuctions`
(el cierre automático cada 5 minutos), un admin, o el propio vendedor.

- `src/lib/notifications.js`: `subscribeToUnreadNotifications(userId, cb)`,
  `markNotificationRead(id)`, `markAllNotificationsRead(list)`.
- Reglas (`firestore.rules`): solo el Admin SDK puede crear avisos
  (`allow create: if false`); cada usuario solo lee los suyos y solo
  puede tocar el campo `read` (para marcarlos como leídos).
- Al aparecer un aviso nuevo mientras la campanita está en pantalla,
  suena el mismo sonido tipo "moneda" que usaba el sistema viejo
  (`playCoinSound()`, `src/lib/sound.js`, sintetizado con Web Audio API).
- **Por ahora sigue siendo 100% dentro del sitio** — no hay envío
  automático por WhatsApp (se evaluó y se descartó por ahora: requiere
  WhatsApp Business Platform, un número de teléfono de negocio dedicado,
  plantillas pre-aprobadas por Meta que tardan días en aprobarse, y
  costo por conversación pasado un plan gratuito chico — no es una
  integración de "clave de API gratis" como las demás de este proyecto).

## 23. Subastas ganadas (perfil)

En `/perfil` había dos pestañas ("Mis subastas" y "Mis pujas"); se sumó una
tercera, **"Subastas ganadas"**, que filtra de "Mis pujas" las que ya
cerraron normalmente (`status: 'ended'`) y en las que el usuario quedó
como `currentBidderId` — para verlas de un vistazo sin tener que revisar
una por una en "Mis pujas". La lógica de "a qué subastas pujé, con
listener en tiempo real por cada una" se compartía entre pestañas, así que
se extrajo a un hook reusable (`useMyBidAuctions`, en `src/hooks/`) — lo
usan tanto "Mis pujas" y "Subastas ganadas" como el aviso de la sección 22.

## 24. Chequeo automático de fotos (Cloud Vision)

Para evitar que se publique una carta con una foto que en realidad es de
otra cosa (pasó de verdad: apareció una subasta con la foto de una persona
en vez de una carta), cada foto que se sube a Storage dispara la Cloud
Function `checkAuctionPhoto`, que le pasa la imagen a **Google Cloud
Vision** (SafeSearch + detección de etiquetas):

**Publicación en espera** (decisión explícita del dueño del proyecto,
después de ver que una foto de una persona quedó visible en el home
mientras el chequeo era solo posterior a publicar):

- Toda subasta nueva arranca con `status: 'pending_review'` — **no
  aparece en el home** hasta que se resuelve. Se guardan también
  `photosTotal` (cuántas fotos tiene) y `photosChecked` (cuántas ya se
  analizaron).
- Cada foto que se sube dispara `checkAuctionPhoto`, que la analiza y
  sube el contador `photosChecked` en una transacción. Cuando
  `photosChecked` llega a `photosTotal` **y ninguna foto salió marcada**,
  la función pasa la subasta sola a `status: 'active'` — normalmente
  tarda solo unos segundos, el vendedor casi no nota la espera (ve un
  cartel "⏳ Esta publicación está en revisión" mientras tanto).
- Si SafeSearch marca alguna foto como `LIKELY` o `VERY_LIKELY` en
  adulto, violencia o contenido subido de tono, o si las etiquetas
  sugieren fuertemente que es la foto de una persona (dos o más de:
  persona, cara, cabeza, selfie, retrato, piel, frente, mentón, sonrisa,
  pelo, ceja, nariz, mejilla) en vez de un objeto, la subasta **se queda
  en revisión** (no se activa sola) y se crea un registro en
  `photoFlags`, visible en `/admin` ("📷 Fotos marcadas para revisión")
  con dos botones: **"Aprobar y publicar"** (la activa y le da la
  duración completa desde ese momento, no desde que se publicó) o
  **"Rechazar"** (la cierra con `status: 'closed_by_admin'`, mismo
  criterio que un cierre manual — sección 12).
- Si Cloud Vision falla al analizar una foto (API caída, etc.), esa foto
  también se marca para revisión humana en vez de asumir que está bien —
  así no se auto-publica nada sin haber podido chequearlo de verdad.
- `photoFlags` solo lo puede crear el Admin SDK (la propia Cloud
  Function) — ningún cliente puede crear un documento ahí directamente.
- **Requiere que la API de Cloud Vision esté habilitada** en el proyecto
  de Google Cloud (`tbmc-1bd19`) — si no está habilitada, la foto queda
  marcada para revisión (por el mismo camino que un fallo de análisis),
  la subasta no se pierde, solo se demora hasta que se apruebe a mano.
- **Costo**: primeras 1.000 imágenes por mes gratis, después
  US$1,50 cada 1.000 (SafeSearch y detección de etiquetas cuentan como
  una sola llamada combinada). Al ritmo de publicaciones actual del
  sitio, prácticamente no debería salir nunca del nivel gratuito.
- **Riesgo conocido, sin resolver a propósito por ahora**: si la Cloud
  Function llegara a fallar antes de sumar al contador `photosChecked`
  (un bug, no el análisis de Vision en sí — eso ya está cubierto), la
  subasta podría quedar "en revisión" para siempre, sin aparecer marcada
  en ningún lado. No hay todavía un chequeo que detecte subastas
  atascadas — si alguna vez pasa, se resuelve a mano cambiando el
  `status` en Firestore.

## 25. Topes de precio y de puja

Para que no se puedan escribir números absurdos (pasó de verdad: una
subasta real llegó a tener un precio con más de veinte dígitos):

- **Precio inicial** (al publicar): tope de **18 dígitos**, con aviso
  claro si se pasa ("puede que hayas escrito algún cero de más").
- **Puja libre**: mínimo **$500** y tope de **18 dígitos**. El tope normal
  de "no más de 50% por encima del precio actual" (sección 4) sigue
  aplicando, pero **nunca puede quedar por debajo de los $500** — si no,
  una subasta con precio inicial muy bajo (ej: $100) tendría un rango de
  puja imposible (mínimo $500, máximo $150). En ese caso el tope sube para
  que el rango sea siempre válido.
- Ninguno de estos dos topes aplica a la **puja con incremento fijo**,
  porque ahí el salto ya lo define el vendedor al publicar (podría ser
  legítimamente menor a $500 en una subasta barata).
- Reforzado tanto en la UI (`maxLength`, `min`/`max` del input) como en
  `src/lib/auctions.js` (`createAuction`/`placeBid`) — no es un límite
  "blando" que dependa solo del navegador.
- El teléfono/WhatsApp del perfil también tiene un tope (11 dígitos) por
  el mismo motivo: que no se desborde de la caja al escribir.

## 26. Formulario de contacto ("Quiénes somos")

La página `/nosotros` tiene un formulario (nombre opcional, email,
mensaje) además del link de `mailto:` que ya existía. Como el sitio no
tiene un sistema de mail armado (ver sección 14), los mensajes quedan como
una bandeja más en `/admin` ("✉️ Mensajes de contacto"), visible para
Susurro y Arañas, con un botón "Responder por mail" que abre el cliente de
correo de quien modera hacia el email que dejó la persona. No hace falta
estar logueado para mandar el formulario.

## 27. Historial de decisiones

- *Duración inicial* (6h/12h/24h/3d/7d) → reemplazada por los 4 tiers de la
  sección 3 con anti-sniping, a pedido explícito para achicar los tiempos y
  evitar sniping.
- *Puja*: arranca siendo siempre libre → se suma la opción de incremento fijo
  como alternativa opcional que define el vendedor.
- *Cierre*: se agregó Cloud Function programada porque sin ella una subasta
  vencida quedaba "activa" para siempre si nadie recargaba la página.
  **Desplegada y corriendo en producción** (proyecto `tbmc-1bd19`, cada 5
  minutos, región `us-central1`).
- *Legales*: se sumó footer con copyright, disclaimer de marcas registradas
  (no afiliación con Wizards/Pokémon/Konami, etc.) y páginas de Términos y
  Condiciones / Política de Privacidad. **Revisados por un abogado y
  confirmados como correctos** — se les sacó el disclaimer de "plantilla
  genérica". Cada vez que se agregue algo con implicancia legal (nuevas
  reglas de negocio, manejo de datos, pagos, etc.), toca una revisión
  nueva — no es un trámite de una sola vez.
- *Contacto y handshake*: implementados juntos — revelar email/WhatsApp al
  cerrar con ganador, y botones de confirmación mutua / reporte de problema.
  Base necesaria para la futura reputación (sección 7).
- *Planes*: nombres temáticos elegidos por el dueño del proyecto (Chusma /
  Informante / Intel de Pícaros). Precios de referencia, no definitivos.
- *Bans*: se sumó suspensión de cuentas (2 días / 1 semana / permanente)
  desde `/admin`, y de paso se cerró un agujero de seguridad en las reglas
  de Firestore que permitía a cualquier usuario auto-asignarse un plan
  pago o levantarse un ban propio escribiendo directo a la base.
- *Roles*: el admin único pasó a ser un sistema de dos roles (Susurro
  poder total, Araña moderación limitada), pensando en escalar el equipo
  de moderación a medida que crezca la base de usuarios.
- *Cumplimiento*: se sumaron métodos de entrega, motivo obligatorio al
  reportar un problema (con bandeja para Susurro/Arañas en `/admin`), y
  una política progresiva de incumplimientos (2 avisos → suspensión
  automática escalando). La atribución de "quién incumplió" queda a
  criterio humano de quien modera, a propósito.
- *Título por API*: se reemplazó el texto libre del título por
  autocompletado obligatorio contra la base de datos real del juego
  (sección 18), para Magic/Pokémon/Yu-Gi-Oh!/One Piece. Se sacó la opción
  "Otro" del dropdown de juego como consecuencia.
- *Descripción*: se eliminó la caja de texto libre de descripción a favor
  de campos estructurados de zona y tiendas de referencia (sección 19).
  Decisión consciente: se pierde la posibilidad de notas libres sobre
  defectos/detalles de la carta, a cambio de datos de entrega más
  ordenados.
- *Preview y portada*: se agregó una pantalla de revisión antes de
  publicar de verdad (doble check) y la posibilidad de elegir cuál de las
  2 fotos es la portada (sección 20).
- *Edición/cancelación del vendedor*: se sumó una ventana de 5 minutos
  para corregir o cancelar una publicación recién hecha (sección 21), sin
  incluir precio ni fotos entre lo editable para evitar manipulación.
  Decidido explícitamente permitir cancelar aunque ya haya pujas (con
  aviso claro en la UI), priorizando la libertad del vendedor de
  arrepentirse por sobre una protección total del comprador.
- *Teléfono/WhatsApp en el perfil*: se restringió el campo a solo números
  (se filtra letra por letra) y se cambió de "siempre editable" a un modo
  vista con botón "Editar"/"Agregar", para no dejar el campo abierto a
  edición accidental.
- *Aviso de "te están ganando"*: se agregó un popup en tiempo real, visible
  en cualquier página del sitio, para quien pujó y quiere saber si lo
  superaron (sección 22) — pensado como paso previo a mandarlo también por
  WhatsApp más adelante (todavía no implementado).
- *Subastas ganadas*: se agregó una tercera pestaña en `/perfil` para ver
  de un vistazo las subastas ganadas, sin tener que revisarlas una por una
  en "Mis pujas" (sección 23).
- *Aviso de cancelación + un solo popup + sonido*: el aviso de "te están
  ganando" se extendió para avisar también si el vendedor cancela una
  subasta en la que pujaste (a cualquiera que haya pujado, no solo a quien
  iba ganando). De paso se limitó a mostrar un solo popup a la vez
  (reemplaza al anterior en vez de apilarse) y se sumó un sonido corto
  sintetizado (sección 22).
- *Fotos de a una*: se cambió el selector múltiple de fotos por uno de a
  una, con botón para sacar cada foto ya subida — así un error de foto no
  obliga a rehacer todo el formulario (sección 20).
- *"Otro" en juego*: se sacó del todo la opción "Otro" tanto del selector
  de juego al publicar (ya no admitía texto libre desde antes) como del
  filtro de juego en el buscador del home, que se había quedado
  desactualizado.
- *Texto libre de "Otra tienda"*: se restringió a solo letras (sin
  números ni símbolos), hasta 10 caracteres — **superado después** por la
  decisión de sacar el texto libre del todo (ver el punto siguiente).
- *Código postal en vez de zona libre*: se reemplazó el texto libre de
  "Otra zona" por un campo de código postal (solo 4 dígitos numéricos), y
  "Otra tienda" pasó a ser un checkbox genérico "Otras tiendas" sin texto
  libre asociado — decisión explícita de no dejar ningún campo de texto
  libre en la sección de entrega (sección 19).
- *Marco verde/rojo en el handshake*: la tarjeta de "Estado de la
  operación" post-cierre ahora muestra en verde si ya confirmaste de tu
  lado, en rojo si todavía no (sección 6).
- *Topes de precio y puja*: se sumaron topes de dígitos y un piso de $500
  para la puja libre, después de que apareciera un precio real con más de
  veinte dígitos en producción (sección 25). Al implementarlo apareció un
  bug real (rango de puja imposible en subastas muy baratas), corregido
  antes de publicar el cambio.
- *Aviso a Susurro/Arañas por edición*: cada edición de subasta ahora
  genera un registro para que lo revise moderación, con el detalle de qué
  cambió (sección 21).
- *Formulario de contacto*: se agregó a "Quiénes somos", con los mensajes
  cayendo en una bandeja de `/admin` en vez de mandarse por mail de
  verdad, ya que el sitio no tiene ese sistema armado (sección 26).
- *Chequeo automático de fotos*: se agregó Cloud Vision (SafeSearch +
  etiquetas) disparado al subir cada foto, después de que apareciera en
  producción una subasta con la foto de una persona en vez de una carta
  (sección 24). Evaluado el costo antes de implementar (con el volumen
  del sitio, prácticamente gratis).
- *Publicación en espera*: la primera versión del chequeo de fotos dejaba
  la subasta publicada de entrada y recién avisaba después si algo salía
  mal — se cambió a que la subasta arranque "en revisión" (invisible en
  el home) y recién se active sola cuando el chequeo termina, para que
  nunca quede una foto rara visible públicamente ni sea un problema.
  Bug real encontrado al implementarlo: en el SDK de Admin de Firestore
  `snap.exists` es una propiedad, no una función (al revés que en el SDK
  de cliente, que sí usa `snap.exists()`) — confundirlos dejaba la
  subasta trabada en revisión para siempre. Corregido y reprobado antes
  de avisar que estaba listo.
- *Código postal → partido*: se agregó una tabla de códigos postales del
  GBA para mostrar el nombre del partido en vez de un número pelado
  (sección 19). Investigado a fondo antes de implementar: no hay ninguna
  API argentina oficial y gratis para el código postal viejo de 4
  dígitos. Decisión explícita de limitarlo al GBA con datos verificados
  en vez de intentar cubrir todo el país con un dataset abierto que tenía
  entradas históricas inconsistentes — mejor cubrir menos pero bien que
  arriesgarse a mostrarle a alguien un partido incorrecto.
- *"Envío a cargo del comprador"*: se sumó como cuarta opción de entrega
  (sección 13), a pedido explícito, para el caso en que el comprador paga
  el envío en vez del vendedor.
- *Avisos por campanita en vez de popup*: se evaluó mandar los avisos
  también por WhatsApp automático (a pedido explícito) y se descartó por
  ahora — requiere WhatsApp Business Platform, número de negocio dedicado,
  plantillas pre-aprobadas por Meta (días) y costo por conversación, nada
  parecido a las integraciones gratis del resto del sitio. En su lugar se
  reemplazó el viejo popup (`AuctionAlerts`, solo funcionaba con una
  pestaña abierta) por un sistema de avisos guardados en Firestore y
  generados del lado del servidor (Cloud Function `notifyOnAuctionChange`),
  mostrados con una campanita en el Navbar — así el aviso "te queda
  esperando" aunque no hayas estado navegando el sitio en el momento
  exacto, y de paso se sumaron dos casos que el popup viejo no cubría:
  que terminó tu subasta, y que ganaste una (sección 22).
- *Lote / Sleeves / Deckbox*: se agregaron 3 checkboxes para publicar algo
  que no es una carta suelta, saltando la búsqueda obligatoria contra la
  API de cartas (sección 18.1). Para lote, en vez de un campo de texto
  libre para describirlo, se armó un selector estructurado (cantidad +
  sets de Magic uno por uno, con checkbox de "sets variados" como
  alternativa) — decisión explícita de mantener el mismo criterio del
  resto del sitio de evitar texto libre.
- *Sugerir locales nuevos*: se agregó un cuadro al tildar "Otras tiendas"
  para que cualquiera pueda proponer un local con nombre + barrio/provincia
  (sección 19.1) — cae en una bandeja de moderación en `/admin` y, si se
  aprueba, se suma solo como checkbox nuevo para todos (colección
  `cardShops`), sin necesidad de tocar código ni desplegar de nuevo el
  sitio — a diferencia de la lista curada original, que sigue siendo fija.
- *Foil*: se agregó un checkbox "Es Foil" al publicar (sección 18.2), con
  una etiqueta junto al título en el listado, el preview y el detalle de
  la subasta cuando está tildado.
- *Navbar sin el título duplicado*: se sacó el logo/wordmark "The Black
  Market Connections" de la barra de navegación (Planes/Publicar
  carta/Perfil) porque se repetía con el título grande del Hero en el
  home. En su lugar se sumaron dos links a esa misma barra: "¿Tenés una
  sugerencia?" (va a `/nosotros`) y "Antes de subastar o ofertar, leé
  esto" (va a `/terminos`, sección 1 — ya deja claro que la plataforma es
  solo un nexo y que la operación es responsabilidad de las partes, así
  que no hizo falta tocar el contenido legal ya revisado por abogado). Se
  sumó "Subastas" (va a `/`) como primer link, porque al sacar el logo se
  perdió la forma de volver al inicio.
- *Navbar compacto en celular*: la barra pasó a mostrar un ícono de menú
  (☰) en pantallas chicas, que despliega todos los links en columna al
  tocarlo — antes algunos links se ocultaban directamente en celular
  (`hidden sm:inline`/`hidden md:inline`) para que entraran en una sola
  fila, y ya no se veían ahí. En escritorio no cambió nada (misma fila
  horizontal de siempre).
- *Provincia en vez de solo zona*: se agregó un selector de "Provincia"
  (sección 19) antes de la zona, y las tiendas de referencia ahora se
  filtran para mostrar solo las de la provincia elegida — antes se veían
  todos los locales conocidos (todos de Capital Federal) sin importar
  dónde estuviera el comprador. Se mantuvo el trabajo ya hecho de barrios
  de CABA y código postal → partido de Buenos Aires como el detalle extra
  que aparece según la provincia, en vez de descartarlo.
- *Guardar la forma de entrega habitual*: para no obligar a cargar lo
  mismo en cada publicación, se agregó un checkbox (tildado por defecto)
  que guarda la forma de entrega en el perfil y la precarga la próxima
  vez (sección 19.2). Se guarda como un solo objeto anidado en vez de
  campos sueltos, para no tener que tocar `firestore.rules` cada vez que
  se agregue un dato nuevo a la forma de entrega.
- *Set de Cartas*: se sumó como cuarta opción de "qué estás publicando"
  (sección 18.1), a pedido explícito, para varias cartas distintas en una
  misma foto — distinto de "Lote", que es una cantidad definida de cartas
  (con la opción de un set puntual de Magic). Igual que Sleeves/Deckbox,
  título fijo sin campos extra.
- *"Publicar carta" → "Publicar"*: se acortó el texto del link/título, en
  preparación para sumar juegos de mesa (que ya no son "cartas").
- *Juegos de mesa*: se evaluaron BoardGameGeek (bloquea pedidos
  automáticos con Cloudflare) y BoardGameAtlas (su API parece dada de
  baja) como fuente de datos, y ninguna resultó viable — a diferencia de
  las otras 4 APIs de cartas del sitio. Primera versión: título libre
  con revisión manual obligatoria del nombre antes de activarse (una
  bandeja nueva en `/admin`). **Se simplificó después** a pedido
  explícito, para no meter demoras: quedó como un quinto checkbox más
  (junto a Lote/Set de Cartas/Sleeves/Deckbox, sección 18.1), con título
  fijo `"BoardGame"` y sin ninguna revisión extra — se sacó del todo la
  bandeja de `/admin` y el campo `requiresManualReview` que se habían
  agregado para la primera versión.
- *Filtro de "Juegos de mesa" en el home*: como estas subastas no tienen
  un `game` real (guardan lo que haya quedado en ese dropdown, no algo
  significativo), se agregó una opción aparte al filtro de "Juego" que
  filtra por `itemType === 'board_game'` en vez de por el campo `game`.
- *Checkbox "Singles"*: se agregó como sexto checkbox de "qué estás
  publicando" (primero en el orden, sección 18.1), a pedido explícito —
  a diferencia de los otros cinco, no cambia ningún comportamiento: sigue
  exigiendo la búsqueda de carta contra la API, igual que no tildar
  ningún checkbox. Es solo una etiqueta explícita (`itemType: 'singles'`),
  pensada como base para un filtro futuro si hiciera falta.
- *Últimos usuarios registrados*: se sumó `createdAt` a `users/{uid}`
  (solo en la creación, nunca en un update, para que no se pueda falsear)
  y un cuadro nuevo en `/admin` con los últimos 10 (sección 12.1). Al
  implementarlo se encontró que `src/lib/users.js` había perdido varias
  funciones que otros archivos seguían usando (`isUserBanned`,
  `updateDeliveryPreferences`, `getActiveStrikes`/`getActiveStrikeCount`)
  — probablemente por una edición externa al editor, no por nada hecho en
  una conversación anterior — lo que rompía el build. Se reconstruyó el
  archivo completo antes de seguir.
