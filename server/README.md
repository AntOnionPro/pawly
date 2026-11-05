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

## Paw prints

The `paws` collection holds paw prints (stage 3): one per `user` and `post`. Anyone can see them; only the user adds or removes their own. They are deleted with the post or the account.

## Comments

The `comments` collection holds comments on posts (stage 3): `post`, `author` and `text` (1 to 500 characters, stored without surrounding spaces). Anyone can see them. Only the author edits a comment, and it cannot move to another post. The author of the comment or the author of the post can delete it. They are deleted with the post or the account.

## Reposts

A repost is a post whose `repostOf` points to the original post (stage 3). Its `text` is an optional comment, and it cannot have files or pets. Reposting a repost reposts its original, each user reposts a post once, and a repost always keeps pointing to the same post. Deleting the repost undoes it; deleting the original deletes its reposts.

## Follows

The `follows` collection holds who follows whom (stage 3): `follower` follows `following`, once per pair, and nobody follows themselves. Anyone can see them; only the follower creates or deletes theirs. They are deleted with either account.

The "Following" feed lists posts with the filter `author.follows_via_following.follower ?= "<user id>"`.

## Reports and blocks

The `reports` collection holds reports (stage 3): the `reporter` reports exactly one `post`, `comment` or `user`, with a `reason` (`spam`, `offensive`, `animal_abuse`, `animal_sale` or `other`) and optional `details`. Only superusers see them, in the admin panel; reviewing them comes in stage 7. Each user reports the same thing once, and nobody reports themselves or their own content.

The `blocks` collection holds blocks: `blocker` blocks `blocked`. Only the blocker sees and removes their blocks. While a block exists, neither user can follow the other and the blocked user cannot comment on the blocker's posts; blocking also removes the follows between both (`pb_hooks/moderation.pb.js`). The app hides the content of blocked users.

## Direct messages

`conversations` holds one conversation per pair of users (stage 4), stored in order (`userA` < `userB`). Only its two participants see it. The server keeps a preview of the last message (`lastMessageText`, `lastMessageAt`, `lastSender`) and a "read up to" date for each participant (`readA`, `readB`): a participant marks it as read with an empty update, and no other field can change. `messages` holds the messages: up to 1000 characters and optionally a shared `post` (text or a post is required). Only the participants read and write them, and nobody writes across a block (`pb_hooks/messages.pb.js`). If a shared post is deleted, `post` becomes empty and `hasPost` (set by the server) stays true. Both are deleted with the account. Reports can also be about a `message`.

The app counts unread conversations with this filter:

```text
lastSender != "<id>" && lastMessageAt != '' && ((userA = "<id>" && (readA = '' || readA < lastMessageAt)) || (userB = "<id>" && (readB = '' || readB < lastMessageAt)))
```

## Notifications

`notifications` holds the in-app notifications (stage 4): the `recipient`, who did it (`actor`), the `type` (`paw`, `comment`, `follow` or `repost`), the related `post` and `comment`, and whether it was `read`. Only the server creates them, after each action (`pb_hooks/notifications.pb.js`): nobody is notified about themselves or by someone they blocked, and paw prints, follows and reposts notify once per person even if they are undone and done again. Only the recipient sees them, and `POST /api/pawly/notifications/read` marks all of the signed-in user's notifications as read. They are deleted with either account and with the related post or comment.

## Push notifications

`push_tokens` holds the Expo push tokens of each user's devices (stage 4), with the app `language` for the text. Only the owner sees, saves and deletes theirs, and saving a token that belongs to another account moves it (one account per device). After each in-app notification and each direct message, the server sends a push to every device of the recipient with Expo Push Service (`pb_hooks/push.pb.js`); tokens Expo reports as no longer registered are deleted, and a failed push never makes the action fail. `notification_prefs` holds which pushes each user wants (`pawOff`, `commentOff`, `followOff`, `repostOff`, `messageOff`): one record per user, only the owner sees and changes it, and without it every type is on. A type turned off sends no push, but the in-app notification is still created. `PAWLY_PUSH_URL` changes the address of the service: the tests point it to a fake one and never call Expo.

## Counters

Each post has a `pawCount`, a `commentCount` and a `repostCount`, and each user a `followerCount` and a `followingCount`. Counters like these are written only by the server (`pb_hooks/counters.pb.js`): requests cannot set them, and they are recalculated from the source table after every change, so they never drift.

## How to change the database

1. Change the collections in the admin panel while `npm run dev` is running.
2. PocketBase writes a migration file in `pb_migrations/` for every change.
3. Commit those files with the change. Never edit the database by hand in production.

When PocketBase starts, it applies any pending migration. Its JavaScript type definitions are generated in `pb_data/types.d.ts` for editor autocompletion.

## Updating PocketBase

PocketBase is still before version 1.0, so updates can break things. To update it, change `.pocketbase-version` in its own pull request, read the [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md) and make sure the tests pass.
