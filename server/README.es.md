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

La colección `pets` guarda los perfiles de mascota (etapa 2): `owner`, `name` (1–40), `species` (`dog`, `cat`, `bird`, `rabbit`, `rodent`, `reptile`, `fish`, `other`), `breed` (hasta 60), una fecha de nacimiento aproximada `birthDate` (no puede ser futura) y una `photo` (hasta 5 MB, con miniaturas). Cualquiera ve las mascotas; solo el dueño las crea, edita y borra, y no puede cambiar el dueño. Al eliminar una cuenta se borran sus mascotas.

## Publicaciones

La colección `posts` guarda las publicaciones (etapa 2):

| Campo    | Reglas                                                                                                                                                |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `author` | El usuario con sesión; no se puede cambiar. Al eliminar la cuenta se borran sus publicaciones.                                                        |
| `text`   | Hasta 2,200 caracteres.                                                                                                                               |
| `media`  | Hasta 10 archivos: fotos (JPEG, PNG, WebP, HEIC) de hasta 10 MB y videos (MP4, MOV) de hasta 50 MB. Las fotos tienen miniaturas `300x300` y `1080x0`. |
| `pets`   | Hasta 10 mascotas propias del autor. Al borrar una mascota se quita de las publicaciones.                                                             |

Una publicación necesita texto o al menos un archivo. Cualquiera ve y lista publicaciones; solo el autor las edita y borra. Las reglas que la colección no puede expresar están en `pb_hooks/posts.pb.js` y `pb_hooks/lib/posts.js`; los errores por campo usan los códigos `post_empty`, `photo_too_large` y `pet_not_owned`. La duración de los videos (60 segundos) se limita en la app, porque el servidor no puede leer la duración sin herramientas extra.

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

La colección `reports` guarda los reportes (etapa 3): `reporter` reporta exactamente una publicación (`post`), un comentario (`comment`) o un usuario (`user`), con un motivo (`reason`: `spam`, `offensive`, `animal_abuse`, `animal_sale` u `other`) y un detalle opcional (`details`). Solo los superusuarios los ven, en el panel de administración; su revisión llega en la etapa 7. Cada usuario reporta lo mismo una sola vez, y nadie se reporta a sí mismo ni a su contenido.

La colección `blocks` guarda los bloqueos: `blocker` bloquea a `blocked`. Solo quien bloquea ve y quita sus bloqueos. Mientras exista un bloqueo, ninguno puede seguir al otro y el bloqueado no puede comentar en las publicaciones de quien lo bloqueó; además, bloquear elimina los seguimientos entre ambos (`pb_hooks/moderation.pb.js`). La app oculta el contenido de los usuarios bloqueados.

## Mensajes directos

`conversations` guarda una conversación por par de usuarios (etapa 4), en orden (`userA` < `userB`). Solo sus dos participantes la ven. El servidor guarda una vista previa del último mensaje (`lastMessageText`, `lastMessageAt`, `lastSender`) y una fecha de "leído hasta" para cada participante (`readA`, `readB`): un participante la marca como leída con una actualización vacía, y ningún otro campo puede cambiar. `messages` guarda los mensajes: hasta 1000 caracteres y, opcionalmente, una publicación compartida (`post`); hace falta texto o publicación. Solo los participantes los leen y escriben, y nadie escribe si hay un bloqueo (`pb_hooks/messages.pb.js`). Si se borra una publicación compartida, `post` queda vacío y `hasPost` (lo pone el servidor) sigue en verdadero. Ambos se borran con la cuenta. Los reportes también pueden ser de un mensaje (`message`).

La app cuenta las conversaciones sin leer con este filtro:

```text
lastSender != "<id>" && lastMessageAt != '' && ((userA = "<id>" && (readA = '' || readA < lastMessageAt)) || (userB = "<id>" && (readB = '' || readB < lastMessageAt)))
```

## Notificaciones

`notifications` guarda las notificaciones dentro de la app (etapa 4): el destinatario (`recipient`), quién lo hizo (`actor`), el tipo (`type`: `paw`, `comment`, `follow` o `repost`), la publicación y el comentario relacionados (`post`, `comment`) y si ya se leyó (`read`). Solo el servidor las crea, después de cada acción (`pb_hooks/notifications.pb.js`): nadie recibe avisos de sí mismo ni de alguien a quien bloqueó, y las huellas, los seguimientos y las republicaciones avisan una sola vez por persona aunque se deshagan y se vuelvan a hacer. Solo el destinatario las ve, y `POST /api/pawly/notifications/read` marca como leídas todas las del usuario con sesión. Se borran con cualquiera de las dos cuentas y con la publicación o el comentario relacionados.

## Notificaciones push

`push_tokens` guarda los tokens de Expo Push de los dispositivos de cada usuario (etapa 4), con el idioma de la app (`language`) para el texto. Solo su dueño los ve, guarda y borra, y guardar un token que pertenece a otra cuenta lo mueve (una cuenta por dispositivo). Después de cada notificación dentro de la app y de cada mensaje directo, el servidor envía un push a todos los dispositivos del destinatario con Expo Push Service (`pb_hooks/push.pb.js`); los tokens que Expo marca como no registrados se borran, y un push fallido nunca hace fallar la acción. `notification_prefs` guarda qué push quiere cada usuario (`pawOff`, `commentOff`, `followOff`, `repostOff`, `messageOff`): un registro por usuario, solo su dueño lo ve y lo cambia, y sin él todos los tipos están encendidos. Un tipo apagado no envía push, pero la notificación dentro de la app se crea igual. `PAWLY_PUSH_URL` cambia la dirección del servicio: las pruebas apuntan a uno falso y nunca llaman a Expo.

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

Cualquiera las ve y las lista; solo quien publica las edita y las borra, y al editar no se puede cambiar la mascota ni el estado. Una mascota tiene a lo más una ficha `available`. Los textos se recortan. Las reglas están en `pb_hooks/adoptions.pb.js`; los errores de campo usan los códigos `pet_not_owned`, `pet_already_listed` y `photo_too_large`.

## Contadores

Cada publicación tiene un `pawCount`, un `commentCount` y un `repostCount`, y cada usuario un `followerCount` y un `followingCount`. Los contadores como estos solo los escribe el servidor (`pb_hooks/counters.pb.js`): las peticiones no pueden fijarlos y se recalculan desde la tabla de origen después de cada cambio, así nunca se desfasan.

## Cómo cambiar la base de datos

1. Cambia las colecciones en el panel de administración mientras corre `npm run dev`.
2. PocketBase escribe un archivo de migración en `pb_migrations/` por cada cambio.
3. Sube esos archivos junto con el cambio. Nunca edites la base de datos de producción a mano.

Al arrancar, PocketBase aplica las migraciones pendientes. Sus tipos de JavaScript se generan en `pb_data/types.d.ts` para el autocompletado del editor.

## Actualizar PocketBase

PocketBase aún no llega a la versión 1.0, así que una actualización puede romper cosas. Para actualizarlo, cambia `.pocketbase-version` en su propio pull request, lee el [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md) y comprueba que las pruebas pasen.
