# Pawly app

**English** · [Español](README.es.md)

Expo (React Native) app for iOS, Android and web. Back to the [main README](../README.md).

## Requirements (Arch Linux)

```bash
sudo pacman -S --needed nodejs-lts-krypton npm android-tools android-udev
```

```bash
sudo usermod -aG adbusers "$USER"
```

Log out and back in so the `adbusers` group applies. Then install **Expo Go** on both phones (App Store and Google Play).

## Install

```bash
cd mobile
```

```bash
npm ci
```

## Run on the phones

```bash
npm start
```

This starts the development server and shows a QR code.

- **iPhone (Wi‑Fi):** the iPhone and the computer must be on the same network. Scan the QR code with the Camera app; it opens Expo Go. Installing apps on an iPhone over USB requires a Mac, so the iPhone always connects over Wi‑Fi.
- **Android (USB):** enable _Developer options → USB debugging_ on the phone, connect it by USB-C and accept the prompt. Check it with `adb devices`, then press `a` in the terminal where `npm start` is running. Expo installs Expo Go if needed and opens the app.

If the iPhone cannot reach the computer (firewall or a network that isolates devices):

- Allow the port with `sudo ufw allow 8081/tcp` if you use `ufw`.
- Or start with `npx expo start --tunnel`, which works across networks.

## Connect to the server

Accounts need the server from `server/` running on the same computer. Start it so the phones can reach it:

```bash
cd server && PB_HTTP=0.0.0.0:8090 npm run dev
```

The app finds it on its own: it uses the same IP as Expo, on port 8090. To use another server, set `EXPO_PUBLIC_API_URL` (for example in `mobile/.env.local`):

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:8090
```

Share links point to the web version (`/post/[id]`). During development they use the Expo dev server, which also serves the web version. Set `EXPO_PUBLIC_WEB_URL` for another address (the real domain from stage 8):

```bash
EXPO_PUBLIC_WEB_URL=https://pawly.example
```

During development, verification and password emails are printed in the server console; open the link on the computer (see `server/README.md`).

If you use `ufw`, also allow the server port with `sudo ufw allow 8090/tcp`.

## Scripts

| Command                | What it does                                           |
| ---------------------- | ------------------------------------------------------ |
| `npm start`            | Development server (Expo Go).                          |
| `npm run web`          | Opens the app in the browser.                          |
| `npm run lint`         | ESLint (no warnings allowed).                          |
| `npm run format`       | Formats the code with Prettier.                        |
| `npm run format:check` | Checks the format without changing files.              |
| `npm run typecheck`    | TypeScript type check.                                 |
| `npm test`             | Unit tests with Jest.                                  |
| `npm run check`        | Everything the CI runs: lint, format, types and tests. |

Run `npm run check` before opening a pull request.

## Structure

```text
mobile/
├── src/
│   ├── app/            Screens and navigation (Expo Router: one file per route)
│   │   ├── (tabs)/     Bottom bar: Home, Adoption, Post, Rescue, Profile
│   │   └── settings.tsx
│   ├── api/            PocketBase client, server URL, error messages and React Query cache
│   ├── auth/           Session (AuthProvider) and form validation
│   ├── components/     Reusable UI (Icon, ThemedText, Screen, OptionGroup…)
│   ├── features/       Screen content grouped by feature (auth, profile, account, pets, posts, comments, follows, search, users, legal, settings)
│   ├── i18n/           Translations (Spanish and English)
│   ├── preferences/    Theme and language chosen by the user, saved on the phone
│   ├── theme/          Colors, icons, typography and contrast helpers
│   └── utils/          Small helpers (confirmation dialog, photo picker, file upload)
├── __tests__/          Jest tests
├── test-utils/         Shared test helpers (providers and a fake session)
└── assets/             Icons and splash screen (placeholders until there is a logo)
```

## Conventions

- **Colors:** never write a color in a screen. Use `useThemeColors()`; the tokens live in `src/theme/colors.ts` and a test checks their contrast.
- **Text:** use `ThemedText`. Small text uses `text` or `textSecondary`, never the accent color.
- **Icons:** only through `Icon` and `src/theme/icons.ts` (SF Symbols on iOS, Material Symbols on Android and web). No emojis in the interface.
- **Server data:** read and change it with React Query hooks per feature (for example `src/features/pets/hooks.ts`), so screens share the cache and refresh after changes.
- **Translations:** every text goes in `src/i18n/locales/es.ts` and `en.ts`. TypeScript fails if a key is missing in either language.
- **Instant updates:** for quick actions such as a paw print, change the cached post everywhere at once with `updateCachedPost` (`src/features/posts/cache.ts`) and roll back if the request fails.
- **Bars above the keyboard:** put a bar that must stay visible while typing (such as the comment field) in the `footer` of `Screen`. It stays under the scrolling content and above the keyboard.
- **Uploads:** add picked files to a form with `appendFile` (`src/utils/upload.ts`). It uploads `{ uri, name, type }` on iOS and Android and a real `File` on the web.
- **Native modules:** stage 0 only uses modules included in Expo Go. A library with its own native code needs a development build.
- **Expo version:** the app uses Expo SDK 58. Before using an Expo API, check the docs for that version (see `AGENTS.md`).
