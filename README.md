<img src="public/assets/images/logo.svg" alt="Mudrix Logo" width="128" />

# Mudrix - Simple, Secure, Muddy

[![pipeline status](https://gitlab.com/wizardchat/wizardchat-web/badges/main/pipeline.svg)](https://gitlab.com/wizardchat/wizardchat-web/-/pipelines)
[![release](https://img.shields.io/gitlab/v/release/wizardchat/wizardchat-web?sort=semver&logo=gitlab)](https://gitlab.com/wizardchat/wizardchat-web/-/releases)
![license](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)
[![chat](https://img.shields.io/matrix/wizardchat-app:matrix.org?logo=matrix)](https://matrix.to/#/#wizardchat-app:matrix.org)

Mudrix is a web-based Matrix client. End-to-end encrypted, open source, and works in your browser (and [your desktop](https://gitlab.com/wizardchat/wizardchat-desktop)).

Mudrix is a fork of WizardChat (AGPL-3.0).

<img align="center" src="https://gitlab.com/wizardchat/wizardchat-site/-/raw/main/assets/wizardchat-screenshot.png" height="320">

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

- **Stable**: [app.wizardchat.org](https://app.wizardchat.org)
- **Next** (pre-release): [next.wizardchat.org](https://next.wizardchat.org)

> The upstream WizardChat project also ships an Electron desktop app for Windows, macOS, and Linux. You can download it directly [here](https://wizardchat.org) or from the [GitLab releases page](https://gitlab.com/wizardchat/wizardchat-desktop/-/releases).

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
    git clone https://gitlab.com/wizardchat/wizardchat-web.git
    cd wizardchat-web
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

- Just pull the newest docker image from [Gitlab Container Registry](https://gitlab.com/wizardchat/wizardchat-web/container_registry/)

- GIF keys are build-time values: pass `VITE_GIPHY_API_KEY` / `VITE_KLIPY_API_KEY` to the image build (they end up in the bundle).
