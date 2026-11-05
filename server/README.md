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

| Command            | What it does                                                            |
| ------------------ | ----------------------------------------------------------------------- |
| `npm run download` | Downloads the pinned PocketBase version into `bin/`.                    |
| `npm run dev`      | Starts PocketBase for development.                                      |
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

## Accounts

The `users` collection holds the accounts (stage 1):

| Field             | Visible to      | Notes                                                                                |
| ----------------- | --------------- | ------------------------------------------------------------------------------------ |
| `username`        | Everyone        | 3–30 characters: lowercase letters, numbers, `.` and `_`. Unique regardless of case. |
| `bio`             | Everyone        | Up to 150 characters.                                                                |
| `avatar`          | Everyone        | JPEG, PNG, WebP or HEIC, up to 5 MB, with 100×100 and 400×400 thumbnails.            |
| `email`           | Owner only      |                                                                                      |
| `birthdate`       | Nobody (hidden) | Set at sign-up and cannot be changed.                                                |
| `termsAcceptedAt` | Nobody (hidden) | Set by the server at sign-up.                                                        |

Rules enforced in `pb_hooks/accounts.pb.js`:

- **Sign-up** sends `username`, `email`, `password`, `passwordConfirm`, `dateOfBirth` and `acceptTerms: true`. The birth date goes as `dateOfBirth` because PocketBase drops hidden fields from a user's request; the hook validates it (13 or older) and stores it in `birthdate`. Field errors: `dateOfBirth` (`birthdate_required`, `birthdate_invalid`, `too_young`) and `acceptTerms` (`terms_required`).
- **Verification:** the email is sent right after sign-up. Only verified accounts can sign in: an unverified account gets **403**, a wrong password gets **400**.
- **Profiles:** anyone can view one; listing them requires a session; each user edits and deletes only their own account.

### Emails during development

Without SMTP configured, emails are not sent: they are printed in the server console with their link, for example:

```text
[pawly-mail] to=luna@example.com subject="Verifica tu correo de Pawly / Verify your Pawly email" link=http://localhost:8090/_/#/auth/confirm-verification/…
```

Open the link in the computer's browser to verify the account or reset the password. Real email (SMTP) is configured in stage 8.

## Pets

The `pets` collection holds pet profiles (stage 2): `owner`, `name` (1–40), `species` (`dog`, `cat`, `bird`, `rabbit`, `rodent`, `reptile`, `fish`, `other`), `breed` (up to 60), an approximate `birthDate` (cannot be in the future) and a `photo` (up to 5 MB, with thumbnails). Anyone can see pets; only the owner creates, edits and deletes them, and cannot change the owner. Deleting an account deletes its pets.

## Posts

The `posts` collection holds posts (stage 2):

| Field    | Rules                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `author` | The signed-in user; cannot be changed. Deleting the account deletes its posts.                                                              |
| `text`   | Up to 2,200 characters.                                                                                                                     |
| `media`  | Up to 10 files: photos (JPEG, PNG, WebP, HEIC) up to 10 MB and videos (MP4, MOV) up to 50 MB. Photos get `300x300` and `1080x0` thumbnails. |
| `pets`   | Up to 10 of the author's own pets. Deleting a pet removes it from the posts.                                                                |

A post needs text or at least one file. Anyone can see and list posts; only the author edits and deletes them. The rules that the collection cannot express live in `pb_hooks/posts.pb.js` and `pb_hooks/lib/posts.js`; field errors use the codes `post_empty`, `photo_too_large` and `pet_not_owned`. Video length (60 seconds) is limited in the app, because the server cannot read video durations without extra tools.

## Paw prints and counters

The `paws` collection holds paw prints (stage 3): one per `user` and `post`. Anyone can see them; only the user adds or removes their own. They are deleted with the post or the account.

Each post has a `pawCount`. Counters like this one are written only by the server (`pb_hooks/counters.pb.js`): requests cannot set them, and they are recalculated from the source table after every change, so they never drift.

## How to change the database

1. Change the collections in the admin panel while `npm run dev` is running.
2. PocketBase writes a migration file in `pb_migrations/` for every change.
3. Commit those files with the change. Never edit the database by hand in production.

When PocketBase starts, it applies any pending migration. Its JavaScript type definitions are generated in `pb_data/types.d.ts` for editor autocompletion.

## Updating PocketBase

PocketBase is still before version 1.0, so updates can break things. To update it, change `.pocketbase-version` in its own pull request, read the [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md) and make sure the tests pass.
