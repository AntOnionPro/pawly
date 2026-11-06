# App de Pawly

[English](README.md) · **Español**

App de Expo (React Native) para iOS, Android y web. Volver al [README principal](../README.es.md).

## Requisitos (Arch Linux)

```bash
sudo pacman -S --needed nodejs-lts-krypton npm android-tools android-udev
```

```bash
sudo usermod -aG adbusers "$USER"
```

Cierra sesión y vuelve a entrar para que se aplique el grupo `adbusers`. Después instala **Expo Go** en los dos celulares (App Store y Google Play).

## Instalación

```bash
cd mobile
```

```bash
npm ci
```

## Correr la app en los celulares

```bash
npm start
```

Esto arranca el servidor de desarrollo y muestra un código QR.

- **iPhone (Wi‑Fi):** el iPhone y la computadora deben estar en la misma red. Escanea el QR con la app Cámara; se abre Expo Go. Instalar apps en un iPhone por USB requiere una Mac, así que el iPhone siempre se conecta por Wi‑Fi.
- **Android (USB):** activa _Opciones de desarrollador → Depuración por USB_ en el celular, conéctalo por USB-C y acepta el aviso. Compruébalo con `adb devices` y luego pulsa `a` en la terminal donde corre `npm start`. Expo instala Expo Go si hace falta y abre la app.

Si el iPhone no logra conectarse a la computadora (firewall o una red que aísla los dispositivos):

- Abre el puerto con `sudo ufw allow 8081/tcp` si usas `ufw`.
- O arranca con `npx expo start --tunnel`, que funciona entre redes distintas.

## Conectar con el servidor

Las cuentas necesitan el servidor de `server/` corriendo en la misma computadora. Arráncalo así para que los celulares lleguen a él:

```bash
cd server && PB_HTTP=0.0.0.0:8090 npm run dev
```

La app lo encuentra sola: usa la misma IP que Expo, en el puerto 8090. Para usar otro servidor, define `EXPO_PUBLIC_API_URL` (por ejemplo en `mobile/.env.local`):

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:8090
```

Los enlaces para compartir apuntan a la versión web (`/post/[id]`). Durante el desarrollo usan el servidor de desarrollo de Expo, que también sirve la versión web. Para otra dirección (el dominio real a partir de la etapa 8), define `EXPO_PUBLIC_WEB_URL`:

```bash
EXPO_PUBLIC_WEB_URL=https://pawly.example
```

Durante el desarrollo, los correos de verificación y de contraseña aparecen en la consola del servidor; abre el enlace en la computadora (ver `server/README.es.md`).

Si usas `ufw`, abre también el puerto del servidor con `sudo ufw allow 8090/tcp`.

## Notificaciones push

La app pide el permiso de notificaciones la primera vez que abres los mensajes o las notificaciones, y guarda en el servidor el token de Expo Push del celular. Los tokens de Expo Push necesitan un proyecto de EAS, ligado a tu cuenta de Expo (la misma que usas en Expo Go). Una sola vez, en `mobile/`:

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest init
```

`init` agrega `extra.eas.projectId` a `app.json`; súbelo en un pull request. Para probar antes, pon el id en `mobile/.env.local`:

```bash
EXPO_PUBLIC_EAS_PROJECT_ID=tu-id-de-proyecto
```

- **iPhone:** funciona en Expo Go.
- **Android:** Expo Go no recibe push desde el SDK 53; hace falta un build de desarrollo (EAS Build) con credenciales de Firebase (FCM). Mientras tanto, la app funciona igual sin push en Android.

| Comando                | Qué hace                                                 |
| ---------------------- | -------------------------------------------------------- |
| `npm start`            | Servidor de desarrollo (Expo Go).                        |
| `npm run web`          | Abre la app en el navegador.                             |
| `npm run lint`         | ESLint (sin advertencias permitidas).                    |
| `npm run format`       | Formatea el código con Prettier.                         |
| `npm run format:check` | Revisa el formato sin cambiar archivos.                  |
| `npm run typecheck`    | Revisión de tipos de TypeScript.                         |
| `npm test`             | Pruebas unitarias con Jest.                              |
| `npm run check`        | Todo lo que corre el CI: lint, formato, tipos y pruebas. |

Corre `npm run check` antes de abrir un pull request.

## Estructura

```text
mobile/
├── src/
│   ├── app/            Pantallas y navegación (Expo Router: un archivo por ruta)
│   │   ├── (tabs)/     Barra inferior: Inicio, Adopción, Publicar, Rescate, Perfil
│   │   └── settings.tsx
│   ├── api/            Cliente de PocketBase, URL del servidor, mensajes de error y caché de React Query
│   ├── auth/           Sesión (AuthProvider) y validación de formularios
│   ├── components/     Interfaz reutilizable (Icon, ThemedText, Screen, OptionGroup…)
│   ├── features/       Contenido de pantallas por funcionalidad (auth, profile, account, pets, posts, comments, follows, search, moderation, messages, notifications, push, adoption, rescue, users, legal, settings)
│   ├── i18n/           Traducciones (español e inglés)
│   ├── preferences/    Tema e idioma elegidos por el usuario, guardados en el celular
│   ├── theme/          Colores, íconos, tipografía y utilidades de contraste
│   └── utils/          Utilidades pequeñas (diálogo de confirmación, selector de fotos, subida de archivos)
├── __tests__/          Pruebas de Jest
├── test-utils/         Utilidades de prueba compartidas (providers y sesión simulada)
└── assets/             Íconos y pantalla de carga (provisionales hasta tener logo)
```

## Convenciones

- **Colores:** nunca escribas un color en una pantalla. Usa `useThemeColors()`; los tokens están en `src/theme/colors.ts` y una prueba revisa su contraste.
- **Texto:** usa `ThemedText`. El texto pequeño usa `text` o `textSecondary`, nunca el color de acento.
- **Íconos:** solo con `Icon` y `src/theme/icons.ts` (SF Symbols en iOS, Material Symbols en Android y web). Sin emojis en la interfaz.
- **Datos del servidor:** se leen y cambian con hooks de React Query por funcionalidad (por ejemplo `src/features/pets/hooks.ts`), así las pantallas comparten la caché y se actualizan después de cada cambio.
- **Traducciones:** todo texto va en `src/i18n/locales/es.ts` y `en.ts`. TypeScript falla si falta una clave en cualquiera de los dos idiomas.
- **Cambios al instante:** para acciones rápidas como una huella, cambia la publicación en todas las pantallas a la vez con `updateCachedPost` (`src/features/posts/cache.ts`) y deshazlo si la petición falla.
- **Barras sobre el teclado:** pon en el `footer` de `Screen` una barra que deba seguir a la vista mientras se escribe (como el campo de comentario). Queda debajo del contenido que se desplaza y encima del teclado.
- **Cambios en vivo:** escucha el tiempo real de PocketBase con `useRealtime` (`src/api/useRealtime.ts`). iOS y Android no tienen `EventSource`, así que `src/api/eventSource.native.ts` instala `react-native-sse`, que funciona en Expo Go.
- **Subidas:** agrega los archivos elegidos a un formulario con `appendFile` y envíalo con `{ fetch: uploadFetch }` (`src/utils/upload.ts`). En iOS y Android sube `{ uri, name, type }` con el XMLHttpRequest de React Native, porque el `fetch` global de Expo no acepta esos archivos; en la web manda un `File` real con el `fetch` del navegador.
- **Módulos nativos:** la etapa 0 solo usa módulos incluidos en Expo Go. Una librería con código nativo propio necesita una build de desarrollo.
- **Versión de Expo:** la app usa Expo SDK 58. Antes de usar una API de Expo, revisa la documentación de esa versión (ver `AGENTS.md`).
