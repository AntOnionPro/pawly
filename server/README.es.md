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

| Comando            | Qué hace                                                                       |
| ------------------ | ------------------------------------------------------------------------------ |
| `npm run download` | Descarga en `bin/` la versión fijada de PocketBase.                            |
| `npm run dev`      | Arranca PocketBase para desarrollo.                                            |
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

## Cómo cambiar la base de datos

1. Cambia las colecciones en el panel de administración mientras corre `npm run dev`.
2. PocketBase escribe un archivo de migración en `pb_migrations/` por cada cambio.
3. Sube esos archivos junto con el cambio. Nunca edites la base de datos de producción a mano.

Al arrancar, PocketBase aplica las migraciones pendientes. Sus tipos de JavaScript se generan en `pb_data/types.d.ts` para el autocompletado del editor.

## Actualizar PocketBase

PocketBase aún no llega a la versión 1.0, así que una actualización puede romper cosas. Para actualizarlo, cambia `.pocketbase-version` en su propio pull request, lee el [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md) y comprueba que las pruebas pasen.
