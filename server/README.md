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

The `pets` collection holds pet profiles (stage 2): `owner`, `name` (1–40), `species` (`dog`, `cat`, `bird`, `rabbit`, `rodent`, `reptile`, `fish`, `other`), `breed` (up to 60), an approximate `birthDate` (cannot be in the future) and a `photo` (up to 5 MB, with thumbnails). Anyone can see pets; only the owner creates, edits and deletes them, and cannot change the owner. Deleting an account deletes its pets. A pet adopted in Pawly also has `previousOwner` and `adoptedAt`, set only by the server (see [Completing an adoption](#completing-an-adoption)).

## Posts

The `posts` collection holds posts (stage 2):

| Field    | Rules                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `author` | The signed-in user; cannot be changed. Deleting the account deletes its posts.                                                              |
| `text`   | Up to 2,200 characters.                                                                                                                     |
| `media`  | Up to 10 files: photos (JPEG, PNG, WebP, HEIC) up to 10 MB and videos (MP4, MOV) up to 50 MB. Photos get `300x300` and `1080x0` thumbnails. |
| `pets`   | Up to 10 of the author's own pets. Deleting a pet removes it from the posts.                                                                |

A post needs text or at least one file. Anyone can see and list posts; only the author edits and deletes them. The rules that the collection cannot express live in `pb_hooks/posts.pb.js` and `pb_hooks/lib/posts.js`; field errors use the codes `post_empty`, `photo_too_large` and `pet_not_owned` (only newly tagged pets must be the author's, so a post keeps the pets it already tagged). Video length (60 seconds) is limited in the app, because the server cannot read video durations without extra tools.

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

The `reports` collection holds reports (stage 3): the `reporter` reports exactly one `post`, `comment`, `user`, `message`, `adoption` listing or `rescue` report, with a `reason` (`spam`, `offensive`, `animal_abuse`, `animal_sale`, `other`, or `adoption_followup` for a missed [adoption follow-up](#adoption-follow-up)) and optional `details`. Only superusers see them, in the admin panel. Each user reports the same thing once, and nobody reports themselves or their own content.

Each report keeps a copy of what was reported (stage 7): its kind (`targetKind`), id (`targetId`), author or reported user (`targetAuthor`) and text (`targetText`), so it stays in the history after the content is deleted. It starts `pending`, and only superusers change its `status` (`actioned` or `dismissed`) and `reviewNote`; the server sets `reviewedAt`, and nothing else about a report can change. Deleting the content or the account of whoever reported only empties that relation; deleting the account of the reported person (`targetAuthor`) deletes the reports about them.

### Reviewing reports

1. Open the admin panel (`/_/`) and the `moderation_queue` collection. It has one row per reported content with pending reports: its `kind`, `target` (id), `author`, how many reports are `pending`, their `reasons`, the latest copy of the `text`, and the dates of the first and last report. Sort it by `pending`, from most to fewest.
2. To see the content itself, open its collection (`posts`, `comments`, `messages`, `users`, `adoptions` or `rescue_reports`) and search for the `target` id. If it was already deleted, the copy in `text` remains.
3. Open the `reports` collection, filter by `targetId = "<target>" && status = "pending"`, open one report and change its `status`. Optionally write a `reviewNote` (only superusers see it). Save it.
   - `actioned` on a post, comment, message, listing or rescue report deletes the content and tells its author in the app ("We removed your post…", with the reason). On a user, it only closes the report: [suspend the account](#account-suspension) on the user.
   - `dismissed` keeps the content.
   - In both cases, every other pending report about the same content gets the same status, and everyone who reported it is told the result in the app. These notices from Pawly have no `actor` and no push.
4. Setting a report back to `pending` clears `reviewedAt` and does nothing else.

The `blocks` collection holds blocks: `blocker` blocks `blocked`. Only the blocker sees and removes their blocks. While a block exists, neither user can follow the other and the blocked user cannot comment on the blocker's posts; blocking also removes the follows between both (`pb_hooks/moderation.pb.js`). The app hides the content of blocked users.

## Content filter

`blocked_terms` holds the words and phrases the server checks in the texts people save (stage 7, `pb_hooks/content_filter.pb.js`): usernames and bios, pet names and breeds, posts, comments, messages, adoption listings and rescue reports. Each `term` has an `action`:

- `block`: the text is not saved. The server answers 400 with the code `content_blocked` on the field, and the app says "Your text has words that are not allowed in Pawly." and keeps what was written.
- `review`: the text is saved, and the server sends it to the [moderation queue](#reviewing-reports) with an automatic report: no `reporter`, the term's `reason`, and `details` that say which term and field matched. While it is pending, saving the same content again does not add another one. A pet is reported through its owner.

Terms are compared without case, accents, repeated letters ("puuuto") or common look-alikes (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s), and only as whole words or phrases, so innocent words that contain one ("computadora") are not marked. On an update, only the texts that changed are checked, and superusers are not filtered.

The migration adds a starting list in Spanish and English: serious insults and slurs (`block`), and phrases about selling animals (`review`, `animal_sale`) or animal fights (`review`, `animal_abuse`). To change it, open `blocked_terms` in the admin panel and add, edit or delete terms; changes apply at once. The filter only reads text: photos and videos are moderated through reports.

## Limits against spam

Each account can only create so much in a period (stage 7, `pb_hooks/limits.pb.js`; the table is `LIMITS` in `pb_hooks/lib/limits.js`). Accounts less than 24 hours old get half of each limit (rounded up), and superusers have none:

| What | Limit |
| --- | --- |
| Posts (reposts included) | 10 per hour and 30 per day |
| Comments | 30 per 10 minutes and 300 per day |
| Direct messages | 60 per 10 minutes and 600 per day |
| New conversations (`startedBy`, set by the server) | 20 per day |
| Follows | 60 per hour and 300 per day |
| Reports | 20 per day |
| Adoption listings | 5 per day |
| Adoption requests | 10 per day |
| Rescue reports | 10 per day |
| "I can help" offers | 20 per day |

The same comment or message of 20 characters or more can only be sent 3 times in 10 minutes; short ones ("So cute!") are not affected.

Per connection (IP address), PocketBase's rate limiter covers signing in (20 per minute, any method), signing up (10 per hour) and asking for a password reset, a verification email or a code (10 per hour each). Its rules are in the admin panel (Settings → Rate limits) and start from `pb_migrations/…_rate_limits.js`. They are generous because many phones can share one address on mobile networks. Behind Cloudflare Tunnel (stage 8) the real address comes in the `CF-Connecting-IP` header, which is set as trusted.

Over a limit, the server answers 429 (per account, with the code `rate_limited`), and the app says "You are going too fast. Try again in a few minutes." without losing what was written. The limits are meant to be loose for normal use; adjust them after the beta (stage 9). `PAWLY_LIMITS=off` turns both off: the tests do it (except `test/limits.test.mjs`), since they create many accounts and records quickly.

## Account suspension

Superusers suspend an account from the admin panel (stage 7), in the `users` collection: `suspendedUntil` (a date) or `suspendedForever`, and a `suspensionReason` the person sees. The fields are hidden, so only superusers see and change them. While the suspension is in force (`pb_hooks/suspension.pb.js`):

- The account cannot sign in or renew its session: the server answers 403 with the code `account_suspended` and `suspension` (`until`, `forever`, `reason`), only after the right password. The app shows "Your account is suspended until…" with the reason.
- A session that was already open stops working on its next request (same answer), and the app signs out and shows the same message.
- Its push tokens are deleted, so it gets no pushes.
- Its profile and content stay; remove the content by [reviewing reports](#reviewing-reports) or, in serious cases, delete the account.

When `suspendedUntil` passes, the account works again by itself. To lift a suspension earlier, empty `suspendedUntil` and turn off `suspendedForever`.

## Direct messages

`conversations` holds one conversation per pair of users (stage 4), stored in order (`userA` < `userB`). Only its two participants see it. The server keeps a preview of the last message (`lastMessageText`, `lastMessageAt`, `lastSender`) and a "read up to" date for each participant (`readA`, `readB`): a participant marks it as read with an empty update, and no other field can change. `messages` holds the messages: up to 1000 characters and optionally a shared `post` (text or a post is required). Only the participants read and write them, and nobody writes across a block (`pb_hooks/messages.pb.js`). If a shared post is deleted, `post` becomes empty and `hasPost` (set by the server) stays true. Both are deleted with the account. Reports can also be about a `message`.

The app counts unread conversations with this filter:

```text
lastSender != "<id>" && lastMessageAt != '' && ((userA = "<id>" && (readA = '' || readA < lastMessageAt)) || (userB = "<id>" && (readB = '' || readB < lastMessageAt)))
```

## Notifications

`notifications` holds the in-app notifications (stage 4): the `recipient`, who did it (`actor`), the `type` (`paw`, `comment`, `follow`, `repost`, `adoption_request`, `request_accepted`, `request_rejected`, `adopted`, `followup_due`, `followup_posted`, `rescue_help`, `rescue_nearby`, or `content_removed`, `report_actioned` and `report_dismissed` for a [report review](#reviewing-reports), which have no `actor` and say what was reported in `contentKind` and why it was removed in `reportReason`), the related `post`, `comment`, `adoption`, `followup` or `rescue`, and whether it was `read`. Only the server creates them, after each action (`pb_hooks/notifications.pb.js`): nobody is notified about themselves or by someone they blocked, and paw prints, follows and reposts notify once per person even if they are undone and done again. Only the recipient sees them, and `POST /api/pawly/notifications/read` marks all of the signed-in user's notifications as read. A new adoption request notifies the publisher, accepting or rejecting it notifies the applicant, and completing the adoption congratulates the adopter, and follow-ups remind the adopter and tell the previous owner about each update. They are deleted with either account and with the related post, comment or listing.

## Push notifications

`push_tokens` holds the Expo push tokens of each user's devices (stage 4), with the app `language` for the text. Only the owner sees, saves and deletes theirs, and saving a token that belongs to another account moves it (one account per device). After each in-app notification and each direct message, the server sends a push to every device of the recipient with Expo Push Service (`pb_hooks/push.pb.js`); tokens Expo reports as no longer registered are deleted, and a failed push never makes the action fail. `notification_prefs` holds which pushes each user wants (`pawOff`, `commentOff`, `followOff`, `repostOff`, `messageOff`, and `adoptionOff` for every adoption notification): one record per user, only the owner sees and changes it, and without it every type is on. A type turned off sends no push, but the in-app notification is still created. `PAWLY_PUSH_URL` changes the address of the service: the tests point it to a fake one and never call Expo.

## Adoption listings

`adoptions` holds the adoption listings (stage 5). Each one puts one of the `publisher`'s own `pet`s up for adoption; the pet's species, breed and age come from its profile.

| Field          | Rules                                                                                  |
| -------------- | -------------------------------------------------------------------------------------- |
| `publisher`    | The signed-in user; cannot be changed. Deleting the account deletes their listings.    |
| `pet`          | One of the publisher's pets; cannot be changed. Deleting the pet deletes its listings. |
| `sex`          | `female` or `male`. Required.                                                          |
| `size`         | `small`, `medium` or `large`. Required.                                                |
| `vaccines`     | `complete`, `partial` or `none`. Required.                                             |
| `sterilized`   | Whether the pet is spayed or neutered.                                                 |
| `health`       | Up to 500 characters.                                                                  |
| `zone`         | Approximate area as text, such as "Coyoacán, CDMX", up to 80 characters. Required.     |
| `requirements` | Up to 1,000 characters.                                                                |
| `description`  | Up to 2,200 characters.                                                                |
| `media`        | Up to 10 photos or videos, with the same limits and thumbnails as posts.               |
| `status`       | `available` or `adopted`. Set by the server: a new listing is always `available`.      |

Anyone can see and list them; only the publisher edits and deletes them while they are available, and editing cannot change the pet, the status or the adoption data (`adopter`, `adoptedAt`). A pet has at most one `available` listing. Texts are trimmed. The rules live in `pb_hooks/adoptions.pb.js`; field errors use the codes `pet_not_owned`, `pet_already_listed` and `photo_too_large`.

## Adoption requests

`adoption_requests` holds the requests to adopt (stage 5): the `applicant` asks for the pet of an `adoption` listing with a presentation `message` (required, up to 1,000 characters). Only the applicant and the publisher see a request, and nobody deletes it. The server sets the `status` and checks every change (`pb_hooks/adoption_requests.pb.js`):

- A new request is `pending`. Nobody asks for their own listing (`own_adoption`), for one that is no longer available (`adoption_closed`), across a block (`blocked`) or twice for the same listing (`already_requested`).
- Only the status changes afterwards, and only while the listing is available. The applicant withdraws a `pending` or `accepted` request (`withdrawn`, final); the publisher accepts (`accepted`) or rejects (`rejected`) any request that was not withdrawn. Anything else fails with `invalid_status`.

Accepting a request does not move the pet: that happens when the publisher marks it as adopted. Requests are deleted with the listing and with the applicant's account.

## Completing an adoption

`POST /api/pawly/adoptions/{id}/adopt` with `{ "request": "<id>" }` marks a listing as adopted by someone whose request the publisher accepted (`pb_hooks/adoptions.pb.js`). Only the publisher can do it, and only once; otherwise it fails with `adoption_closed`, `request_not_accepted` or `pet_not_owned`. In one transaction:

- The listing becomes `adopted`, with the `adopter` and the date (`adoptedAt`). An adopted listing can no longer be edited or deleted by the publisher: it is part of the pet's history.
- The pet moves to the adopter. It keeps who had it before (`previousOwner`) and when it was adopted (`adoptedAt`); only the server sets these two fields.
- The other `pending` and `accepted` requests are rejected, and their applicants get a `request_rejected` notification.

The adopter gets an `adopted` notification. Earlier posts that tag the pet keep their author and the tag, and their author can still edit them; from then on only the new owner tags the pet in new posts.

## Adoption follow-up

`adoption_followups` holds the follow-ups of each adopted listing (stage 5): four per adoption (`milestone` `week1`, `month1`, `month3` and `month6`), due 7, 30, 90 and 180 days after it (`dueAt`). Only the server creates and changes them (`pb_hooks/followups.pb.js` and `pb_hooks/lib/followups.js`); only the adopter and the previous owner see them. They are deleted with the listing.

- **Reminders:** a daily task (15:00 UTC, 9:00 in Mexico City) sends the adopter a `followup_due` notification on each follow-up's day, once (`remindedAt`). `POST /api/pawly/followups/run` runs it at once, optionally as if it were `{ "now": "<ISO date>" }`; only superusers can call it, and the tests use it with simulated dates.
- **Updates:** a post by the adopter that tags the pet counts as the update (`post`) of the follow-up whose window is open, from its date until 14 days later. The previous owner gets a `followup_posted` notification.
- **Overdue:** a follow-up without an update 14 days after its date is overdue. Then the previous owner can report the adopter with the reason `adoption_followup`; anyone else, or before that, fails with `followup_not_overdue`.

## Rescue reports

`rescue_reports` holds the rescue reports (stage 6): the `reporter` reports a stray that needs help (`kind` `help`), a lost pet (`lost`) or a found animal (`found`).

| Field         | Rules                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------- |
| `reporter`    | The signed-in user; cannot be changed. Deleting the account deletes their reports.                |
| `kind`        | `help`, `lost` or `found`; cannot be changed.                                                     |
| `species`     | The animal (optional), with the values of pets. A `lost` report with a `pet` takes its species.   |
| `description` | Required, up to 2,200 characters.                                                                 |
| `media`       | Up to 10 photos or videos, with the same limits and thumbnails as posts.                          |
| `latitude`    | GPS location with `longitude`; both are required (not both 0).                                    |
| `place`       | Place reference in text, up to 120 characters.                                                    |
| `urgency`     | `low`, `medium` or `high`. Required for `help`; empty for the other kinds.                        |
| `pet`         | Only for `lost`: one of the reporter's pets (optional).                                           |
| `lastSeenAt`  | Only for `lost`, required: when the pet was last seen (not in the future).                        |
| `status`      | `open` (open, lost or found), `in_progress` (only for `help`) or `closed` (resolved or reunited). |

A new report is always `open`. The app finds nearby reports by asking for an area (`latitude` and `longitude` between two values, with an index) and keeps the ones inside the radius. Anyone can see and list them; only the reporter edits, changes the status and deletes them. Texts are trimmed. The rules live in `pb_hooks/rescue.pb.js`; field errors use the codes `location_required`, `date_future`, `pet_not_owned`, `invalid_status` and `photo_too_large`.

### I can help

`rescue_helpers` holds the people (`helper`) who offered to help with a report of an animal that needs help, with an optional `message` (up to 500 characters). One offer per person and report, never on your own report, on a closed one or across a block (`own_report`, `report_closed`, `not_help`, `already_helping`, `blocked`). The helper withdraws by deleting the offer, and nobody edits it. Only the helper and the reporter see an offer; everyone sees how many there are in the report's `helperCount`, which only the server writes. The first offer moves an open report to `in_progress`, and the reporter gets a `rescue_help` notification (with the related `rescue`; push preference `rescueOff`).

### Nearby alerts

`rescue_alerts` holds, for each person who turned on alerts for nearby rescue cases, an approximate location (`latitude`, `longitude`, rounded by the server to about 500 m) and their nearby radius (`radiusKm`: 1, 5, 10 or 25; `invalid_radius` otherwise). One per person; only its owner sees, changes and deletes it, and it goes away with the account. The app updates it when it opens and deletes it when the alerts are turned off (`pb_hooks/rescue_alerts.pb.js`, `pb_hooks/lib/geo.js`).

When someone creates a rescue report, everyone whose radius includes it gets a `rescue_nearby` notification with the related `rescue` and how far it is (`distanceKm`), in the app and by push ("Lost pet 2 km from you."). Never the reporter, nobody across a block, and once per report: editing the report does not alert again.

## Counters

Each post has a `pawCount`, a `commentCount` and a `repostCount`, and each user a `followerCount` and a `followingCount`. Counters like these are written only by the server (`pb_hooks/counters.pb.js`): requests cannot set them, and they are recalculated from the source table after every change, so they never drift.

## How to change the database

1. Change the collections in the admin panel while `npm run dev` is running.
2. PocketBase writes a migration file in `pb_migrations/` for every change.
3. Commit those files with the change. Never edit the database by hand in production.

When PocketBase starts, it applies any pending migration. Its JavaScript type definitions are generated in `pb_data/types.d.ts` for editor autocompletion.

## Updating PocketBase

PocketBase is still before version 1.0, so updates can break things. To update it, change `.pocketbase-version` in its own pull request, read the [changelog](https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md) and make sure the tests pass.
