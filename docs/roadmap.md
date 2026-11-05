# Roadmap

**English** · [Español](roadmap.es.md)

Pawly is built in stages. Each stage ends with something that can be tried on a phone. Current status: [Project status](../README.md#project-status).

## How a stage works

1. **Start.** A stage starts only after the previous one is merged. Before starting, pull the latest `development`.
2. **Issues.** At the start of the stage, open one issue per feature using the templates, with acceptance criteria and an estimate.
3. **Work, one issue at a time.** Right before starting an issue, pull the latest `development` and create its branch from it (`<type>/<issue#>-<description>`). Open a pull request to `development` with tests. The next issue starts only after that pull request is merged, so no pull request ever needs "Update branch".
4. **Release.** At the end of the stage, mark it as done in the README and open a `development → main` pull request. After merging it, publish the release `v0.N.0` (N is the stage number) from GitHub's *Releases* page targeting `main`; that also creates the tag.

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
| 8 | **Infrastructure and web** | Mini PC in production (domain, Cloudflare Tunnel, off-site backups, real email); automatic deployment from `main`; web version with public pages (privacy, terms, account deletion, shared posts); Google and Apple sign-in. | Use Pawly from anywhere. |
| 9 | **Launch** | Final privacy notice and terms, store listings, beta testing (TestFlight and Google Play internal testing), store review and version 1.0. | Download Pawly from the stores. |

## Phase 2

| # | Stage | Scope |
| --- | --- | --- |
| 10 | **Veterinary clinics** | Clinic accounts with verification, business profile, rescue case handling and promotion. |
| 11 | **Donations** | Choose a payment provider for Mexico, review store rules and enable donations to posts. |

## Dependencies and costs

- **Stages 0–7** run on the local network at no cost.
- **Until stage 8**, merging into `main` creates a version but does not publish anything on the internet.
- **Stage 8** needs a domain (about USD 10–15 per year), an email (SMTP) provider, and the Apple Developer Program (USD 99 per year) for Sign in with Apple and iOS push notifications.
- **Stage 9** needs the Google Play Console (USD 25, one-time).

## Testing on phones

The development computer runs Arch Linux.

- **Android:** connected by USB with `adb`, using development builds (free).
- **iPhone:** with the Expo Go app over Wi‑Fi on the same network. Installing builds on an iPhone by USB requires a Mac with Xcode. Push notifications on iPhone can only be tested once the Apple Developer account exists (stage 8).
