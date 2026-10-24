# Local test server

A throwaway Matrix homeserver with calls, seeded with people, rooms and cosmetics, plus headless
browser "participants" that join calls with fake cameras. Use it to test call layouts and take
README screenshots without touching a real server.

Needs Podman, Node 22+, and Edge or Chrome.

| Service | What it is                                                                 |
| ------- | -------------------------------------------------------------------------- |
| tuwunel | Homeserver for `mudrix.test`, port 6167                                    |
| LiveKit | Call media, ports 7880 / 7881 tcp / 7882 udp                               |
| lk-jwt  | Hands out LiveKit tokens for Matrix logins, port 8090                      |
| Caddy   | HTTPS for `mudrix.test` (443, 8448) with its own CA; lk-jwt and EC need it |

Containers use host networking: on Windows, Podman's port forwarding fails under WSL, so they are
reached on the Podman VM's IP instead of `localhost` (`MUDRIX_TEST_HOST` overrides it).

## Use

```sh
node dev/test-server/up.mjs              # start; writes .generated/env.json
node dev/test-server/seed.mjs            # accounts, rooms, avatars, cosmetics (once)
npm start                                # the app, on http://localhost:8080

# Bots join the room's call; `:nocam` keeps a camera off. Ctrl+C or `stop` ends them.
node dev/test-server/participants.mjs general ash:nocam juno mira:nocam wren theo:nocam

# Look at or drive a bot's browser (the first bot, ash here, makes a good viewer).
MUDRIX_VIEWPORT=1440x900 node dev/test-server/cdp.mjs ash shot out.png
node dev/test-server/cdp.mjs ash eval "return document.title"

# README hero image: the chat in several themes, cut diagonally.
node dev/test-server/theme-hero.mjs docs/screenshots/themes.png

node dev/test-server/up.mjs down         # stop (keeps data)
node dev/test-server/up.mjs reset        # stop and delete data
```

Every account's password is in `.generated/seed.json`; log in at `http://<host>:6167` to look around
as one of them. Room keys for `participants.mjs` (`general`, `dmJuno`, ...) are in the same file.

Bots reuse their device between runs (`.generated/sessions.json`), so restarting them replaces
their call memberships instead of leaving ghost tiles behind for five minutes.
