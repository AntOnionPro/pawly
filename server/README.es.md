# Servidor de Pawly

[English](README.md) · **Español**

Backend hecho con [PocketBase](https://pocketbase.io): API REST, autenticación, tiempo real, almacenamiento de archivos y panel de administración, con SQLite. Volver al [README principal](../README.es.md).

## Requisitos (Arch Linux)

```bash
sudo pacman -S --needed nodejs-lts-krypton npm curl unzip
```

Node.js solo corre los scripts y las pruebas; PocketBase es un único ejecutable.

## Correr el servidor

```bash
cd server
```

```bash
npm run dev
```

La primera vez descarga en `bin/` la versión de PocketBase fijada en `.pocketbase-version` y verifica su checksum SHA-256. Después arranca el servidor en `http://127.0.0.1:8090` con las migraciones y los hooks del repositorio.

- Panel de administración: `http://127.0.0.1:8090/_/`
- Chequeo de salud de Pawly: `http://127.0.0.1:8090/api/pawly/health`

Para que los celulares de la misma red lleguen al servidor, arráncalo con `PB_HTTP=0.0.0.0:8090 npm run dev`.

## Primer superusuario

El panel de administración necesita un superusuario. Créalo con:

```bash
bin/pocketbase superuser upsert tu@ejemplo.com 'una-contraseña-larga' --dir pb_data
```

## Scripts

| Comando            | Qué hace                                                                         |
| ------------------ | -------------------------------------------------------------------------------- |
| `npm run download` | Descarga en `bin/` la versión fijada de PocketBase.                              |
| `npm run dev`      | Arranca PocketBase para desarrollo.                                              |
| `npm test`         | Arranca PocketBase con una base de datos temporal y corre las pruebas (`test/`). |

## Estructura

```text
server/
├── .pocketbase-version   Versión de PocketBase usada en todos lados (desarrollo, CI y producción)
├── pb_migrations/        Cambios de la base de datos, en orden (JavaScript)
├── pb_hooks/             Rutas y lógica propias (*.pb.js)
├── scripts/              download.sh y dev.sh
├── test/                 Pruebas con el test runner de Node.js
├── bin/                  Ejecutable de PocketBase (no va en git)
└── pb_data/              Base de datos y archivos locales (no van en git)
```

## Cuentas

La colección `users` guarda las cuentas (etapa 1):

| Campo             | Visible para   | Notas                                                                           |
| ----------------- | -------------- | ------------------------------------------------------------------------------- |
| `username`        | Todos          | 3–30 caracteres: minúsculas, números, `.` y `_`. Único sin importar mayúsculas. |
| `bio`             | Todos          | Hasta 150 caracteres.                                                           |
| `avatar`          | Todos          | JPEG, PNG, WebP o HEIC, hasta 5 MB, con miniaturas de 100×100 y 400×400.        |
| `email`           | Solo el dueño  |                                                                                 |
| `birthdate`       | Nadie (oculto) | Se guarda al registrarse y no se puede cambiar.                                 |
| `termsAcceptedAt` | Nadie (oculto) | Lo guarda el servidor al registrarse.                                           |

Reglas aplicadas en `pb_hooks/accounts.pb.js`:

- **Registro:** se envía `username`, `email`, `password`, `passwordConfirm`, `dateOfBirth` y `acceptTerms: true`. La fecha de nacimiento va como `dateOfBirth` porque PocketBase quita los campos ocultos de las peticiones de usuarios; el hook la valida (13 años o más) y la guarda en `birthdate`. Errores por campo: `dateOfBirth` (`birthdate_required`, `birthdate_invalid`, `too_young`) y `acceptTerms` (`terms_required`).
- **Verificación:** el correo se envía justo después del registro. Solo las cuentas verificadas inician sesión: una cuenta sin verificar recibe **403**, una contraseña incorrecta recibe **400**.
- **Perfiles:** cualquiera puede ver uno; para listarlos hace falta sesión; cada usuario edita y borra solo su propia cuenta.

### Correos durante el desarrollo

Sin SMTP configurado, los correos no se envían: se muestran en la consola del servidor con su enlace, por ejemplo:

```text
[pawly-mail] to=luna@example.com subject="Verifica tu correo de Pawly / Verify your Pawly email" link=http://localhost:8090/_/#/auth/confirm-verification/…
```

Abre el enlace en el navegador de la computadora para verificar la cuenta o restablecer la contraseña. El correo real (SMTP) se configura en la etapa 8.

## Mascotas

La colección `pets` guarda los perfiles de mascota (etapa 2): `owner`, `name` (1–40), `species` (`dog`, `cat`, `bird`, `rabbit`, `rodent`, `reptile`, `fish`, `other`), `breed` (hasta 60), una fecha de nacimiento aproximada `birthDate` (no puede ser futura) y una `photo` (hasta 5 MB, con miniaturas). Cualquiera ve las mascotas; solo el dueño las crea, edita y borra, y no puede cambiar el dueño. Al eliminar una cuenta se borran sus mascotas. Una mascota adoptada en Pawly también tiene `previousOwner` y `adoptedAt`, que solo pone el servidor (ver [Cerrar una adopción](#cerrar-una-adopción)).

## Publicaciones

La colección `posts` guarda las publicaciones (etapa 2):

| Campo    | Reglas                                                                                                                                                |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `author` | El usuario con sesión; no se puede cambiar. Al eliminar la cuenta se borran sus publicaciones.                                                        |
| `text`   | Hasta 2,200 caracteres.                                                                                                                               |
| `media`  | Hasta 10 archivos: fotos (JPEG, PNG, WebP, HEIC) de hasta 10 MB y videos (MP4, MOV) de hasta 50 MB. Las fotos tienen miniaturas `300x300` y `1080x0`. |
| `pets`   | Hasta 10 mascotas propias del autor. Al borrar una mascota se quita de las publicaciones.                                                             |

Una publicación necesita texto o al menos un archivo. Cualquiera ve y lista publicaciones; solo el autor las edita y borra. Las reglas que la colección no puede expresar están en `pb_hooks/posts.pb.js` y `pb_hooks/lib/posts.js`; los errores por campo usan los códigos `post_empty`, `photo_too_large` y `pet_not_owned` (solo las mascotas recién etiquetadas deben ser del autor, así una publicación conserva las que ya etiquetaba). La duración de los videos (60 segundos) se limita en la app, porque el servidor no puede leer la duración sin herramientas extra.

## Huellas

La colección `paws` guarda las huellas (etapa 3): una por `user` y `post`. Cualquiera las ve; solo el usuario da o quita la suya. Se borran con la publicación o con la cuenta.

## Comentarios

La colección `comments` guarda los comentarios de las publicaciones (etapa 3): `post`, `author` y `text` (de 1 a 500 caracteres, guardado sin espacios al principio ni al final). Cualquiera los ve. Solo el autor edita un comentario, y no puede moverlo a otra publicación. Lo pueden borrar el autor del comentario o el autor de la publicación. Se borran con la publicación o con la cuenta.

## Republicaciones

Una republicación es una publicación cuyo `repostOf` apunta a la original (etapa 3). Su `text` es un comentario opcional y no puede tener archivos ni mascotas. Republicar una republicación republica su original, cada usuario republica una publicación una sola vez y una republicación siempre sigue apuntando a la misma publicación. Borrar la republicación la deshace; borrar la original borra sus republicaciones.

## Seguidores

La colección `follows` guarda quién sigue a quién (etapa 3): `follower` sigue a `following`, una vez por par, y nadie se sigue a sí mismo. Cualquiera los ve; solo el seguidor crea o borra el suyo. Se borran con cualquiera de las dos cuentas.

El feed "Siguiendo" lista las publicaciones con el filtro `author.follows_via_following.follower ?= "<id del usuario>"`.

## Reportes y bloqueos

La colección `reports` guarda los reportes (etapa 3): `reporter` reporta exactamente una publicación (`post`), un comentario (`comment`), un usuario (`user`), un mensaje (`message`), una ficha de adopción (`adoption`) o un reporte de rescate (`rescue`), con un motivo (`reason`: `spam`, `offensive`, `animal_abuse`, `animal_sale`, `other`, o `adoption_followup` para un [seguimiento posadopción](#seguimiento-posadopción) no cumplido) y un detalle opcional (`details`). Solo los superusuarios los ven, en el panel de administración. Cada usuario reporta lo mismo una sola vez, y nadie se reporta a sí mismo ni a su contenido.

Cada reporte guarda una copia de lo reportado (etapa 7): el tipo (`targetKind`), el id (`targetId`), el autor o el usuario reportado (`targetAuthor`) y el texto (`targetText`), así que sigue en el historial aunque el contenido se borre. Empieza pendiente (`pending`), y solo los superusuarios cambian su estado (`status`: `actioned` o `dismissed`) y su nota (`reviewNote`); el servidor pone la fecha de revisión (`reviewedAt`), y nada más del reporte puede cambiar. Borrar el contenido o la cuenta de quien reportó solo vacía esa relación; borrar la cuenta de la persona reportada (`targetAuthor`) borra los reportes sobre ella.

### Revisar reportes

1. Abre el panel de administración (`/_/`) y la colección `moderation_queue`. Tiene una fila por contenido reportado con reportes pendientes: su tipo (`kind`), su id (`target`), su autor (`author`), cuántos reportes están pendientes (`pending`), sus motivos (`reasons`), la copia más reciente del texto (`text`) y las fechas del primer y del último reporte. Ordénala por `pending`, de más a menos.
2. Para ver el contenido, abre su colección (`posts`, `comments`, `messages`, `users`, `adoptions` o `rescue_reports`) y busca el id de `target`. Si ya se borró, queda la copia en `text`.
3. Abre la colección `reports`, filtra con `targetId = "<target>" && status = "pending"`, abre un reporte y cambia su `status`. Si quieres, escribe una nota en `reviewNote` (solo la ven los superusuarios). Guárdalo.
   - `actioned` en una publicación, comentario, mensaje, ficha o reporte de rescate borra el contenido y se lo avisa a su autor en la app ("Quitamos tu publicación…", con el motivo). En un usuario solo cierra el reporte: la [suspensión](#suspender-cuentas) se hace en el usuario.
   - `dismissed` deja el contenido.
   - En los dos casos, los demás reportes pendientes del mismo contenido quedan con el mismo estado, y todos los que lo reportaron reciben el resultado en la app. Estos avisos de Pawly no tienen `actor` ni push.
4. Regresar un reporte a `pending` borra `reviewedAt` y no hace nada más.

La colección `blocks` guarda los bloqueos: `blocker` bloquea a `blocked`. Solo quien bloquea ve y quita sus bloqueos. Mientras exista un bloqueo, ninguno puede seguir al otro y el bloqueado no puede comentar en las publicaciones de quien lo bloqueó; además, bloquear elimina los seguimientos entre ambos (`pb_hooks/moderation.pb.js`). La app oculta el contenido de los usuarios bloqueados.

## Filtro de contenido

`blocked_terms` guarda las palabras y frases que el servidor revisa en los textos que la gente guarda (etapa 7, `pb_hooks/content_filter.pb.js`): nombres de usuario y biografías, nombres y razas de mascotas, publicaciones, comentarios, mensajes, fichas de adopción y reportes de rescate. Cada término (`term`) tiene una acción (`action`):

- `block`: el texto no se guarda. El servidor responde 400 con el código `content_blocked` en el campo, y la app dice "Tu texto tiene palabras que no se permiten en Pawly." y conserva lo escrito.
- `review`: el texto se guarda, y el servidor lo manda a la [cola de moderación](#revisar-reportes) con un reporte automático: sin `reporter`, con el motivo del término (`reason`) y un `details` que dice qué término y qué campo coincidieron. Mientras esté pendiente, volver a guardar el mismo contenido no agrega otro. Una mascota se reporta a través de su dueño.

Los términos se comparan sin importar mayúsculas, acentos, letras repetidas ("puuuto") ni sustituciones comunes (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s), y solo como palabras o frases completas, así que las palabras inocentes que contienen uno ("computadora") no se marcan. Al editar, solo se revisan los textos que cambiaron, y los superusuarios no pasan por el filtro.

La migración agrega una lista inicial en español e inglés: insultos graves (`block`) y frases de venta de animales (`review`, `animal_sale`) o de peleas de animales (`review`, `animal_abuse`). Para cambiarla, abre `blocked_terms` en el panel de administración y agrega, edita o borra términos; los cambios aplican al momento. El filtro solo revisa texto: las fotos y los videos se moderan con los reportes.

## Suspender cuentas

Los superusuarios suspenden una cuenta desde el panel de administración (etapa 7), en la colección `users`: `suspendedUntil` (una fecha) o `suspendedForever`, y un motivo que la persona ve (`suspensionReason`). Los campos están ocultos, así que solo los superusuarios los ven y los cambian. Mientras la suspensión está vigente (`pb_hooks/suspension.pb.js`):

- La cuenta no puede iniciar sesión ni renovarla: el servidor responde 403 con el código `account_suspended` y `suspension` (`until`, `forever`, `reason`), solo después de la contraseña correcta. La app muestra "Tu cuenta está suspendida hasta el…" con el motivo.
- Una sesión que ya estaba abierta deja de servir en la siguiente petición (con la misma respuesta), y la app cierra la sesión y muestra el mismo mensaje.
- Se borran sus tokens de push, así que no recibe push.
- Su perfil y su contenido se quedan; el contenido se quita [revisando los reportes](#revisar-reportes) o, en casos graves, borrando la cuenta.

Al pasar `suspendedUntil`, la cuenta vuelve a funcionar sola. Para quitar la suspensión antes, vacía `suspendedUntil` y apaga `suspendedForever`.

## Mensajes directos

`conversations` guarda una conversación por par de usuarios (etapa 4), en orden (`userA` < `userB`). Solo sus dos participantes la ven. El servidor guarda una vista previa del último mensaje (`lastMessageText`, `lastMessageAt`, `lastSender`) y una fecha de "leído hasta" para cada participante (`readA`, `readB`): un participante la marca como leída con una actualización vacía, y ningún otro campo puede cambiar. `messages` guarda los mensajes: hasta 1000 caracteres y, opcionalmente, una publicación compartida (`post`); hace falta texto o publicación. Solo los participantes los leen y escriben, y nadie escribe si hay un bloqueo (`pb_hooks/messages.pb.js`). Si se borra una publicación compartida, `post` queda vacío y `hasPost` (lo pone el servidor) sigue en verdadero. Ambos se borran con la cuenta. Los reportes también pueden ser de un mensaje (`message`).

La app cuenta las conversaciones sin leer con este filtro:

```text
lastSender != "<id>" && lastMessageAt != '' && ((userA = "<id>" && (readA = '' || readA < lastMessageAt)) || (userB = "<id>" && (readB = '' || readB < lastMessageAt)))
```

## Notificaciones

`notifications` guarda las notificaciones dentro de la app (etapa 4): el destinatario (`recipient`), quién lo hizo (`actor`), el tipo (`type`: `paw`, `comment`, `follow`, `repost`, `adoption_request`, `request_accepted`, `request_rejected`, `adopted`, `followup_due`, `followup_posted`, `rescue_help`, `rescue_nearby`, o `content_removed`, `report_actioned` y `report_dismissed` para la [revisión de un reporte](#revisar-reportes), que no tienen `actor` y dicen qué se reportó en `contentKind` y por qué se quitó en `reportReason`), la publicación, el comentario o la ficha relacionados (`post`, `comment`, `adoption`, `followup`, `rescue`) y si ya se leyó (`read`). Solo el servidor las crea, después de cada acción (`pb_hooks/notifications.pb.js`): nadie recibe avisos de sí mismo ni de alguien a quien bloqueó, y las huellas, los seguimientos y las republicaciones avisan una sola vez por persona aunque se deshagan y se vuelvan a hacer. Solo el destinatario las ve, y `POST /api/pawly/notifications/read` marca como leídas todas las del usuario con sesión. Una solicitud de adopción nueva avisa a quien publica, aceptarla o rechazarla avisa al solicitante, cerrar la adopción felicita al adoptante, y el seguimiento le recuerda al adoptante cada fecha y avisa al dueño anterior de cada actualización. Se borran con cualquiera de las dos cuentas y con la publicación, el comentario o la ficha relacionados.

## Notificaciones push

`push_tokens` guarda los tokens de Expo Push de los dispositivos de cada usuario (etapa 4), con el idioma de la app (`language`) para el texto. Solo su dueño los ve, guarda y borra, y guardar un token que pertenece a otra cuenta lo mueve (una cuenta por dispositivo). Después de cada notificación dentro de la app y de cada mensaje directo, el servidor envía un push a todos los dispositivos del destinatario con Expo Push Service (`pb_hooks/push.pb.js`); los tokens que Expo marca como no registrados se borran, y un push fallido nunca hace fallar la acción. `notification_prefs` guarda qué push quiere cada usuario (`pawOff`, `commentOff`, `followOff`, `repostOff`, `messageOff`, y `adoptionOff` para todos los avisos de adopción): un registro por usuario, solo su dueño lo ve y lo cambia, y sin él todos los tipos están encendidos. Un tipo apagado no envía push, pero la notificación dentro de la app se crea igual. `PAWLY_PUSH_URL` cambia la dirección del servicio: las pruebas apuntan a uno falso y nunca llaman a Expo.

## Fichas de adopción

`adoptions` guarda las fichas de adopción (etapa 5). Cada una pone en adopción una mascota (`pet`) de quien publica (`publisher`); la especie, la raza y la edad salen del perfil de la mascota.

| Campo          | Reglas                                                                                  |
| -------------- | --------------------------------------------------------------------------------------- |
| `publisher`    | El usuario con sesión; no se puede cambiar. Borrar la cuenta borra sus fichas.          |
| `pet`          | Una mascota de quien publica; no se puede cambiar. Borrar la mascota borra sus fichas.  |
| `sex`          | `female` o `male`. Obligatorio.                                                         |
| `size`         | `small`, `medium` o `large`. Obligatorio.                                               |
| `vaccines`     | `complete`, `partial` o `none`. Obligatorio.                                            |
| `sterilized`   | Si la mascota está esterilizada.                                                        |
| `health`       | Hasta 500 caracteres.                                                                   |
| `zone`         | Zona aproximada en texto, como "Coyoacán, CDMX", hasta 80 caracteres. Obligatorio.      |
| `requirements` | Hasta 1,000 caracteres.                                                                 |
| `description`  | Hasta 2,200 caracteres.                                                                 |
| `media`        | Hasta 10 fotos o videos, con los mismos límites y miniaturas que las publicaciones.     |
| `status`       | `available` o `adopted`. Lo pone el servidor: una ficha nueva siempre está `available`. |

Cualquiera las ve y las lista; solo quien publica las edita y las borra mientras están disponibles, y al editar no se puede cambiar la mascota, el estado ni los datos de la adopción (`adopter`, `adoptedAt`). Una mascota tiene a lo más una ficha `available`. Los textos se recortan. Las reglas están en `pb_hooks/adoptions.pb.js`; los errores de campo usan los códigos `pet_not_owned`, `pet_already_listed` y `photo_too_large`.

## Solicitudes de adopción

`adoption_requests` guarda las solicitudes para adoptar (etapa 5): quien solicita (`applicant`) pide la mascota de una ficha (`adoption`) con un mensaje de presentación (`message`, obligatorio, hasta 1,000 caracteres). Solo el solicitante y quien publica ven una solicitud, y nadie la borra. El servidor pone el estado (`status`) y revisa cada cambio (`pb_hooks/adoption_requests.pb.js`):

- Una solicitud nueva queda `pending`. Nadie solicita su propia ficha (`own_adoption`), una que ya no está disponible (`adoption_closed`), con un bloqueo de por medio (`blocked`) ni dos veces la misma ficha (`already_requested`).
- Después solo cambia el estado, y solo mientras la ficha está disponible. El solicitante retira una solicitud `pending` o `accepted` (`withdrawn`, definitivo); quien publica acepta (`accepted`) o rechaza (`rejected`) cualquier solicitud que no se haya retirado. Lo demás falla con `invalid_status`.

Aceptar una solicitud no traspasa la mascota: eso pasa cuando quien publica la marca como adoptada. Las solicitudes se borran con la ficha y con la cuenta del solicitante.

## Cerrar una adopción

`POST /api/pawly/adoptions/{id}/adopt` con `{ "request": "<id>" }` marca una ficha como adoptada por una persona cuya solicitud aceptó quien publica (`pb_hooks/adoptions.pb.js`). Solo quien publica puede hacerlo, y solo una vez; si no, falla con `adoption_closed`, `request_not_accepted` o `pet_not_owned`. En una sola transacción:

- La ficha pasa a `adopted`, con el adoptante (`adopter`) y la fecha (`adoptedAt`). Quien publica ya no puede editar ni borrar una ficha adoptada: es parte de la historia de la mascota.
- La mascota pasa al adoptante. Guarda quién la tenía antes (`previousOwner`) y cuándo fue adoptada (`adoptedAt`); solo el servidor pone estos dos campos.
- Las demás solicitudes `pending` y `accepted` se rechazan, y sus solicitantes reciben una notificación `request_rejected`.

El adoptante recibe una notificación `adopted`. Las publicaciones anteriores que etiquetan a la mascota conservan su autor y la etiqueta, y su autor todavía puede editarlas; desde entonces solo el nuevo dueño etiqueta a la mascota en publicaciones nuevas.

## Seguimiento posadopción

`adoption_followups` guarda los seguimientos de cada ficha adoptada (etapa 5): cuatro por adopción (`milestone` `week1`, `month1`, `month3` y `month6`), para 7, 30, 90 y 180 días después (`dueAt`). Solo el servidor los crea y cambia (`pb_hooks/followups.pb.js` y `pb_hooks/lib/followups.js`); solo el adoptante y el dueño anterior los ven. Se borran con la ficha.

- **Recordatorios:** una tarea diaria (15:00 UTC, 9:00 en la Ciudad de México) envía al adoptante una notificación `followup_due` el día de cada seguimiento, una sola vez (`remindedAt`). `POST /api/pawly/followups/run` la corre al momento, opcionalmente como si fuera `{ "now": "<fecha ISO>" }`; solo los superusuarios pueden llamarla, y las pruebas la usan con fechas simuladas.
- **Actualizaciones:** una publicación del adoptante que etiqueta a la mascota cuenta como la actualización (`post`) del seguimiento cuya ventana está abierta, desde su fecha hasta 14 días después. El dueño anterior recibe una notificación `followup_posted`.
- **Vencidos:** un seguimiento sin actualización 14 días después de su fecha está vencido. Entonces el dueño anterior puede reportar al adoptante con el motivo `adoption_followup`; cualquier otra persona, o antes de eso, falla con `followup_not_overdue`.

## Reportes de rescate

`rescue_reports` guarda los reportes de rescate (etapa 6): quien reporta (`reporter`) avisa de un animal callejero que necesita ayuda (`kind` `help`), una mascota perdida (`lost`) o un animal encontrado (`found`).

| Campo         | Reglas                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| `reporter`    | El usuario con sesión; no se puede cambiar. Borrar la cuenta borra sus reportes.                             |
| `kind`        | `help`, `lost` o `found`; no se puede cambiar.                                                               |
| `description` | Obligatorio, hasta 2,200 caracteres.                                                                         |
| `media`       | Hasta 10 fotos o videos, con los mismos límites y miniaturas que las publicaciones.                          |
| `latitude`    | Ubicación GPS junto con `longitude`; las dos son obligatorias (no ambas en 0).                               |
| `place`       | Referencia del lugar en texto, hasta 120 caracteres.                                                         |
| `urgency`     | `low`, `medium` o `high`. Obligatoria en `help`; vacía en los demás tipos.                                   |
| `pet`         | Solo en `lost`: una mascota de quien reporta (opcional).                                                     |
| `lastSeenAt`  | Solo en `lost`, obligatoria: cuándo se vio por última vez (no puede ser futura).                             |
| `status`      | `open` (abierto, perdido o encontrado), `in_progress` (solo en `help`) o `closed` (resuelto o reencontrado). |

Un reporte nuevo siempre está `open`. La app busca los reportes cercanos pidiendo un área (`latitude` y `longitude` entre dos valores, con un índice) y se queda con los que caen dentro del radio. Cualquiera los ve y los lista; solo quien reporta los edita, cambia su estado y los borra. Los textos se recortan. Las reglas están en `pb_hooks/rescue.pb.js`; los errores de campo usan los códigos `location_required`, `date_future`, `pet_not_owned`, `invalid_status` y `photo_too_large`.

### Puedo ayudar

`rescue_helpers` guarda a las personas (`helper`) que se ofrecieron a ayudar con un reporte de un animal que necesita ayuda, con un mensaje opcional (`message`, hasta 500 caracteres). Una oferta por persona y reporte, nunca en tu propio reporte, en uno cerrado ni con un bloqueo de por medio (`own_report`, `report_closed`, `not_help`, `already_helping`, `blocked`). Quien ayuda retira su oferta borrándola, y nadie la edita. Solo quien ayuda y quien reportó ven una oferta; todos ven cuántas hay en `helperCount` del reporte, que solo escribe el servidor. La primera oferta pasa un reporte abierto a `in_progress`, y quien reportó recibe una notificación `rescue_help` (con el reporte en `rescue`; preferencia de push `rescueOff`).

### Avisos cercanos

`rescue_alerts` guarda, para cada persona que activó los avisos de casos de rescate cercanos, una ubicación aproximada (`latitude`, `longitude`, que el servidor redondea a unos 500 m) y su radio cercano (`radiusKm`: 1, 5, 10 o 25; si no, `invalid_radius`). Una por persona; solo su dueño la ve, la cambia y la borra, y se borra con la cuenta. La app la actualiza al abrirse y la borra al apagar los avisos (`pb_hooks/rescue_alerts.pb.js`, `pb_hooks/lib/geo.js`).

Cuando alguien crea un reporte de rescate, cada persona cuyo radio lo incluye recibe una notificación `rescue_nearby` con el reporte en `rescue` y a qué distancia está (`distanceKm`), en la app y por push ("Mascota perdida a 2 km de ti."). Nunca quien reporta, nadie con un bloqueo de por medio, y una sola vez por reporte: editar el reporte no vuelve a avisar.

## Contadores

Cada publicación tiene un `pawCount`, un `commentCount` y un `repostCount`, y cada usuario un `followerCount` y un `followingCount`. Los contadores como estos solo los escribe el servidor (`pb_hooks/counters.pb.js`): las peticiones no pueden fijarlos y se recalculan desde la tabla de origen después de cada cambio, así nunca se desfasan.

## Cómo cambiar la base de datos

1. Cambia las colecciones en el panel de administración mientras corre `npm run dev`.
2. PocketBase escribe un archivo de migración en `pb_migrations/` por cada cambio.
3. Sube esos archivos junto con el cambio. Nunca edites la base de datos de producción a mano.

Al arrancar, PocketBase aplica las migraciones pendientes. Sus tipos de JavaScript se generan en `pb_data/types.d.ts` para el autocompletado del editor.

## Actualizar PocketBase

PocketBase aún no llega a la versión 1.0, así que una actualización puede romper cosas. Para actualizarlo, cambia `.pocketbase-version` en su propio pull request, lee el [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md) y comprueba que las pruebas pasen.
