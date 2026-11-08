# Plan de trabajo

[English](roadmap.md) · **Español**

Pawly se construye por etapas. Cada etapa termina con algo que se puede probar en un celular. Estado actual: [Estado del proyecto](../README.es.md#estado-del-proyecto).

## Cómo funciona cada etapa

1. **Inicio.** Una etapa empieza solo cuando la anterior está mergeada. Antes de empezar se bajan los últimos cambios de `development`.
2. **Issues.** Al empezar la etapa se abre un issue por funcionalidad con las plantillas, con criterios de aceptación y estimación.
3. **Trabajo, un issue a la vez.** Justo antes de empezar un issue se bajan los últimos cambios de `development` y se crea su rama desde ahí (`<tipo>/<n°issue>-<descripcion>`). Se abre un pull request hacia `development` con pruebas. El siguiente issue empieza solo cuando ese pull request está mergeado, así ningún pull request necesita "Update branch".
4. **Release.** Al terminar la etapa se marca como hecha en el README y se abre un pull request `development → main`. Después de mergearlo se publica la release desde la página *Releases* de GitHub con destino `main`; eso también crea la etiqueta. La etapa N se publica como `v0.(N+1).0` (la etapa 7 es `v0.8.0`), y la etapa 7.5 como `v0.8.5`.

## Fase 1

| # | Etapa | Qué incluye | Al terminar puedes… |
| --- | --- | --- | --- |
| 0 | **Cimientos** | Carpetas `mobile/` y `server/`; Expo con TypeScript y Expo Router; PocketBase; colores, tipografía, íconos y temas; español e inglés; barra inferior con las 5 pestañas vacías; CI con pruebas reales; guía para correr el proyecto en local. | Abrir la app, moverte entre pestañas y cambiar tema e idioma. |
| 1 | **Cuentas** | Registro e inicio de sesión con email, verificación, recuperar y cambiar contraseña, modo visitante, perfil, ajustes, eliminar cuenta, términos y edad mínima. | Crear tu cuenta, editarla y borrarla. |
| 2 | **Mascotas y publicaciones** | Perfiles de mascota; publicaciones con texto, fotos y videos (comprimidos en el celular); feed; perfiles de usuario y de mascota. | Publicar y ver el feed. |
| 3 | **Interacción social** | Huella, comentarios, seguir, compartir dentro y fuera de la app, búsqueda, reportar y bloquear. | Usar Pawly como red social. |
| 4 | **Mensajes y notificaciones** | Chat 1 a 1 en tiempo real, notificaciones dentro de la app y push, preferencias. | Chatear y recibir avisos. |
| 5 | **Adopción** | Ficha de adopción, solicitudes, aceptar o rechazar, traspaso de la mascota y recordatorios de seguimiento. | Dar en adopción y adoptar, con seguimiento. |
| 6 | **Rescate** | Reportes de "necesita ayuda", perdidos y encontrados; ubicación; lista y mapa; botón "Puedo ayudar"; avisos a usuarios cercanos. | Reportar casos y ver los cercanos. |
| 7 | **Moderación** | Revisión de reportes en el panel, filtro de contenido, suspensión de usuarios y límites contra spam. | Moderar el contenido. |
| 7.5 | **Diseño y detalles** | Correcciones vistas en el iPhone (barra superior, teclado); logo, ícono de la app y "Pawly" con la P del logo; letra Ubuntu y paletas de color a elegir en ajustes; publicaciones con el texto primero, nueva pantalla para publicar y editar fotos y videos, animación de la huella y videos que se reproducen solos; botones con Liquid Glass en iOS; Adopción en lista, búsqueda y filtros compactos en Adopción y Rescate; el nombre de la app y gatos en acuarela al iniciar sesión. | Usar un Pawly con imagen propia. |
| 8 | **Infraestructura y web** | La mini PC en producción (dominio, Cloudflare Tunnel, respaldos fuera de la mini PC, email real); despliegue automático desde `main`; versión web con páginas públicas (privacidad, términos, eliminar cuenta, publicaciones compartidas); inicio de sesión con Google y Apple. | Usar Pawly desde cualquier lugar. |
| 9 | **Lanzamiento** | Aviso de privacidad y términos definitivos, fichas de tienda, pruebas beta (TestFlight y la prueba interna de Google Play), revisión de las tiendas y versión 1.0. | Descargar Pawly de las tiendas. |

Las etapas 8 y 9 se posponen hasta que esté lista la infraestructura (la mini PC). Mientras tanto, la etapa 7.5 pule la app.

## Fase 2

| # | Etapa | Qué incluye |
| --- | --- | --- |
| 10 | **Veterinarias** | Cuentas de veterinaria con verificación, perfil de negocio, atención de casos de rescate y promoción. |
| 11 | **Donaciones** | Elegir proveedor de pagos para México, revisar las reglas de las tiendas y donar a publicaciones. |

## Dependencias y costos

- **Etapas 0 a 7.5:** todo corre en la red local, sin costo.
- **Hasta la etapa 8**, mergear a `main` crea una versión, pero todavía no publica nada en internet.
- **Etapa 8:** necesita un dominio (unos 10–15 USD al año), un proveedor de email (SMTP) y el Apple Developer Program (99 USD al año) para el inicio de sesión con Apple y las notificaciones push en iPhone.
- **Etapa 9:** necesita la Google Play Console (25 USD, pago único).

## Pruebas en celulares

La computadora de desarrollo usa Arch Linux.

- **Android:** conectado por USB con `adb`, usando builds de desarrollo (gratis).
- **iPhone:** con la app Expo Go por Wi‑Fi en la misma red. Instalar builds en un iPhone por USB requiere una Mac con Xcode. Las notificaciones push en iPhone solo se pueden probar cuando exista la cuenta de Apple Developer (etapa 8).
