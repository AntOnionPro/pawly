# Pawly server

**English** · [Español](README.es.md)

Backend built on [PocketBase](https://pocketbase.io): REST API, authentication, realtime, file storage and admin panel, with SQLite. Back to the [main README](../README.md).

## Requirements (Arch Linux)

```bash
sudo pacman -S --needed nodejs-lts-krypton npm curl unzip
```

Node.js only runs the scripts and tests; PocketBase is a single binary.

## Run

```bash
cd server
```

```bash
npm run dev
```

The first time, this downloads the PocketBase version pinned in `.pocketbase-version` into `bin/` and checks its SHA-256 checksum. Then it starts the server on `http://127.0.0.1:8090` with the repository's migrations and hooks.

- Admin panel: `http://127.0.0.1:8090/_/`
- Pawly health check: `http://127.0.0.1:8090/api/pawly/health`

To reach the server from the phones on the same network, start it with `PB_HTTP=0.0.0.0:8090 npm run dev`.

## First superuser

The admin panel needs a superuser. Create it with:

```bash
bin/pocketbase superuser upsert you@example.com 'a-long-password' --dir pb_data
```

## Scripts

| Command            | What it does                                                         |
| ------------------ | -------------------------------------------------------------------- |
| `npm run download` | Downloads the pinned PocketBase version into `bin/`.                 |
| `npm run dev`      | Starts PocketBase for development.                                   |
| `npm test`         | Starts PocketBase on a temporary database and runs the tests (`test/`). |

## Structure

```text
server/
├── .pocketbase-version   PocketBase version used everywhere (development, CI and production)
├── pb_migrations/        Database changes, in order (JavaScript)
├── pb_hooks/             Custom routes and logic (*.pb.js)
├── scripts/              download.sh and dev.sh
├── test/                 Tests with the Node.js test runner
├── bin/                  PocketBase binary (not in git)
└── pb_data/              Local database and files (not in git)
```

## How to change the database

1. Change the collections in the admin panel while `npm run dev` is running.
2. PocketBase writes a migration file in `pb_migrations/` for every change.
3. Commit those files with the change. Never edit the database by hand in production.

When PocketBase starts, it applies any pending migration. Its JavaScript type definitions are generated in `pb_data/types.d.ts` for editor autocompletion.

## Updating PocketBase

PocketBase is still before version 1.0, so updates can break things. To update it, change `.pocketbase-version` in its own pull request, read the [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md) and make sure the tests pass.
