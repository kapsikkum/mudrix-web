<img src="public/assets/images/logo.svg" alt="Mudrix Logo" width="128" />

# Mudrix - Simple, Secure, Muddy

[![CI](https://github.com/kapsikkum/mudrix-web/actions/workflows/check.yml/badge.svg)](https://github.com/kapsikkum/mudrix-web/actions/workflows/check.yml)
[![release](https://img.shields.io/github/v/release/kapsikkum/mudrix-web?sort=semver&logo=github)](https://github.com/kapsikkum/mudrix-web/releases)
![license](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)

Mudrix is a web-based Matrix client. End-to-end encrypted, open source, and works in your browser (and [your desktop](https://github.com/kapsikkum/mudrix-desktop)).

Mudrix is a fork of WizardChat (AGPL-3.0).

## Features

- E2EE
- Direct messages and Spaces
- Voice and video calls (1:1 and group, via MatrixRTC / Element Call)
- File, image, and video sharing
- Pin messages
- In-room message search (server-side full history in unencrypted rooms; already-loaded messages only in encrypted rooms)
- Jump to date, edit history viewer, mark room as unread, low-priority rooms
- Threads
- Message reactions, edits, and replies
- Advanced Message formatting
- Typing indicators
- Custom Stickers and Emojis
- GIFs
- SSO login
- Read receipts
- Themes (Carbon, Parrot, Hallow, Ethereal)

## Try out Mudrix

There is no hosted instance of Mudrix yet. Clone the repository and run it locally (see [Local Development](#local-development) below).

## Desktop app

Mudrix has a desktop app (Tauri v2, tray, notifications, unread badge, deep links) in the separate [mudrix-desktop](https://github.com/kapsikkum/mudrix-desktop) repository, which includes this repository as a git submodule. The desktop-specific code on this side is `src/util/desktop.ts` (a no-op in a browser), the "Desktop app" section in Settings > Preferences (shown only inside the desktop app) and the unread/notification hooks. The Tauri API is imported dynamically, so the web build is unaffected.

CI: `.github/workflows/check.yml` (typecheck, lint, build) and `release.yml` (tag `v*`: `mudrix-web-<version>.zip` plus an optional Docker image on GHCR). `.gitlab-ci.yml` is upstream WizardChat's pipeline and is not used here.

## Local Development

### Manual Setup

#### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or higher)
- [npm](https://www.npmjs.com/)

1.  Clone the repository:

    ```bash
    git clone https://github.com/kapsikkum/mudrix-web.git
    cd mudrix-web
    ```

2.  Install dependencies and start development server:

    ```bash
    npm ci
    npm start
    ```

    The app will be available at **http://localhost:8080**

#### Optional: GIF search (GIPHY / KLIPY)

The GIF picker calls GIPHY and KLIPY directly from the client. API keys are supplied at **build time** via a git-ignored `.env.local` (see `.env.example`):

```bash
VITE_GIPHY_API_KEY=your_giphy_key
VITE_KLIPY_API_KEY=your_klipy_key
```

Restart `npm start` after changing them. A provider without a key has its tab disabled ("No API key configured in this build").

Note: `VITE_` values are embedded in the built bundle, so the keys are visible to anyone who can load the app. KLIPY keys are tied to your KLIPY account, and a GIPHY key should be your own (create one at developers.giphy.com).

### Using Docker

- Just pull the newest docker image from the GHCR image published by `release.yml` on `v*` tags (GitHub Container Registry)

- GIF keys are build-time values: pass `VITE_GIPHY_API_KEY` / `VITE_KLIPY_API_KEY` to the image build (they end up in the bundle).
