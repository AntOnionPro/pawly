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

## Seguidores

La colección `follows` guarda quién sigue a quién (etapa 3): `follower` sigue a `following`, una vez por par, y nadie se sigue a sí mismo. Cualquiera los ve; solo el seguidor crea o borra el suyo. Se borran con cualquiera de las dos cuentas.

El feed "Siguiendo" lista las publicaciones con el filtro `author.follows_via_following.follower ?= "<id del usuario>"`.

## Contadores

Cada publicación tiene un `pawCount` y un `commentCount`, y cada usuario un `followerCount` y un `followingCount`. Los contadores como estos solo los escribe el servidor (`pb_hooks/counters.pb.js`): las peticiones no pueden fijarlos y se recalculan desde la tabla de origen después de cada cambio, así nunca se desfasan.

## Cómo cambiar la base de datos

1. Cambia las colecciones en el panel de administración mientras corre `npm run dev`.
2. PocketBase escribe un archivo de migración en `pb_migrations/` por cada cambio.
3. Sube esos archivos junto con el cambio. Nunca edites la base de datos de producción a mano.

Al arrancar, PocketBase aplica las migraciones pendientes. Sus tipos de JavaScript se generan en `pb_data/types.d.ts` para el autocompletado del editor.

## Actualizar PocketBase

PocketBase aún no llega a la versión 1.0, así que una actualización puede romper cosas. Para actualizarlo, cambia `.pocketbase-version` en su propio pull request, lee el [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md) y comprueba que las pruebas pasen.
