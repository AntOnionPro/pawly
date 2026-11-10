# Roadmap

**English** · [Español](roadmap.es.md)

Pawly is built in stages. Each stage ends with something that can be tried on a phone. Current status: [Project status](../README.md#project-status).

## How a stage works

1. **Start.** A stage starts only after the previous one is merged. Before starting, pull the latest `development`.
2. **Issues.** At the start of the stage, open one issue per feature using the templates, with acceptance criteria and an estimate.
3. **Work, one issue at a time.** Right before starting an issue, pull the latest `development` and create its branch from it (`<type>/<issue#>-<description>`). Open a pull request to `development` with tests. The next issue starts only after that pull request is merged, so no pull request ever needs "Update branch".
4. **Release.** At the end of the stage, mark it as done in the README and open a `development → main` pull request. After merging it, publish the release from GitHub's *Releases* page targeting `main`; that also creates the tag. Stage N is released as `v0.(N+1).0` (stage 7 is `v0.8.0`), and stage 7.5 as `v0.8.5`.

## Phase 1

| # | Stage | Scope | When it is done you can… |
| --- | --- | --- | --- |
| 0 | **Foundations** | `mobile/` and `server/` folders; Expo with TypeScript and Expo Router; PocketBase; colors, typography, icons and themes; Spanish and English; bottom bar with the 5 empty tabs; CI running real tests; local development guide. | Open the app, move between tabs, and change theme and language. |
| 1 | **Accounts** | Email sign-up and sign-in, verification, password recovery and change, visitor mode, profile, settings, account deletion, terms and minimum age. | Create your account, edit it and delete it. |
| 2 | **Pets and posts** | Pet profiles; posts with text, photos and videos (compressed on the phone); feed; user and pet profiles. | Post and see the feed. |
| 3 | **Social interaction** | Paw print reaction, comments, follows, sharing inside and outside the app, search, report and block. | Use Pawly as a social network. |
| 4 | **Messages and notifications** | Real-time one-to-one chat, in-app and push notifications, preferences. | Chat and get notified. |
| 5 | **Adoption** | Adoption profile, requests, accept or reject, pet transfer and follow-up reminders. | Give a pet up for adoption and adopt one, with follow-up. |
| 6 | **Rescue** | "Needs help", lost and found reports; location; list and map; "I can help" button; alerts to nearby users. | Report cases and see the ones nearby. |
| 7 | **Moderation** | Report review in the admin panel, content filter, user suspension and anti-spam limits. | Moderate content. |
| 7.5 | **Design and details** | Fixes seen on the iPhone (top bar, keyboard); logo, app icon and the "Pawly" wordmark; Ubuntu font and color palettes to choose in settings; posts with the text first, a new screen to post and edit photos and videos, paw print animation and videos that play on their own; Liquid Glass buttons on iOS; Adoption as a list, search and compact filters in Adoption and Rescue; the app name and watercolor cats on sign-in. | Use a Pawly with its own look. |
| 8 | **Infrastructure and web** | Mini PC in production (domain, Cloudflare Tunnel, off-site backups, real email); automatic deployment from `main`; web version with public pages (privacy, terms, account deletion, shared posts); Google and Apple sign-in. | Use Pawly from anywhere. |
| 9 | **Launch** | Final privacy notice and terms, store listings, beta testing (TestFlight and Google Play internal testing), store review and version 1.0. | Download Pawly from the stores. |

Stages 8 and 9 are postponed until the infrastructure (the mini PC) is ready. Meanwhile, stage 7.5 polishes the app, and stage 10 can be built because it needs no infrastructure.

## Phase 2

| # | Stage | Scope |
| --- | --- | --- |
| 10 | **Shelters and rescuers** | Verified accounts for shelters and independent rescuers, profile (location, hours and needs), rescue case handling and adoption listings in their name. |
| 11 | **Donations** | Choose a payment provider for Mexico where each receiver connects their own account, check the store rules and enable donations to people, rescuers and shelters: no commission, up to MXN 5,000 per donation, and a visible notice that taxes and deductibility are the responsibility of who gives and who receives. |

## Dependencies and costs

- **Stages 0–7.5** run on the local network at no cost.
- **Until stage 8**, merging into `main` creates a version but does not publish anything on the internet.
- **Stage 8** needs a domain (about USD 10–15 per year), an email (SMTP) provider, and the Apple Developer Program (USD 99 per year) for Sign in with Apple and iOS push notifications.
- **Stage 9** needs the Google Play Console (USD 25, one-time).
- **Stage 10** needs no infrastructure, so it can be built while stages 8 and 9 are postponed.
- **Stage 11** needs stage 8 (a public domain and the web version) for real payments, an account with the payment provider, and an accountant's confirmation of how donations are taxed in Mexico.

## Testing on phones

The development computer runs Arch Linux.

- **Android:** connected by USB with `adb`, using development builds (free).
- **iPhone:** with the Expo Go app over Wi‑Fi on the same network. Installing builds on an iPhone by USB requires a Mac with Xcode. Push notifications on iPhone can only be tested once the Apple Developer account exists (stage 8).
