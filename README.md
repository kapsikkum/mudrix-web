<img src="public/assets/images/logo.svg" alt="WizardChat Logo" width="128" />

# WizardChat - Simple, Secure, Magical

[![pipeline status](https://gitlab.com/wizardchat/wizardchat-web/badges/main/pipeline.svg)](https://gitlab.com/wizardchat/wizardchat-web/-/pipelines)
![release](https://gitlab.com/wizardchat/wizardchat-web/-/badges/release.svg)
![License](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)

WizardChat is a web-based Matrix client. End-to-end encrypted, open source, and works in your browser.

## Features

- E2EE
- Direct messages and Spaces
- VoIP (1:1)
- Video calls (via Jitsi widget)
- File, image, and video sharing
- Pin messages
- Message search in rooms
- Global Message Search
- Message reactions, edits, and replies
- Advanced Message formatting
- Typing indicators
- Stickers and GIFs (via widget)
- SSO login
- Read receipts
- Themes (Carbon, Parrot, Ethereal)

## Try out WizardChat

- **Stable**: [app.wizardchat.org](https://app.wizardchat.org)
- **Next** (pre-release): [next.wizardchat.org](https://next.wizardchat.org)

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

### Using Docker

- Just pull the newest docker image from [Gitlab Container Registry](https://gitlab.com/wizardchat/wizardchat-web/container_registry/)
