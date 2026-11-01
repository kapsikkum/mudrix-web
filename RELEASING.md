# Releasing Mudrix Web

The web client is released first. The desktop and mobile apps include this repository as a git
submodule and are released after it (see "Releasing all three").

## Versions

`YEAR.MONTH.N`, with `package.json` as the single source of truth. A stable release is `26.11.0`; a
pre-release adds a suffix and sorts below the stable version it leads up to:

```
26.11.0-next.1  <  26.11.0-next.2  <  26.11.0-rc.1  <  26.11.0
```

Use `-next.N` for test builds cut from the `next` branch. `-rc.N` and `-beta.N` work the same way. Any
tag with a `-` in it is a pre-release; the workflows decide on that alone.

## What a tag does

A `v*` tag runs three workflows. A pre-release tag changes what two of them do:

| workflow      | stable `v26.11.0`                                                                | pre-release `v26.11.0-next.1`                                              |
| ------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `release.yml` | GitHub release with `mudrix-web-<v>.zip`; Docker image tagged `<v>` and `latest` | marked as a **pre-release** (not "latest"); Docker image tagged `<v>` only |
| `pages.yml`   | deploys the hosted client at `https://kapsikkum.github.io/mudrix-web/`           | **skipped**: a test build never replaces the live site                     |
| `check.yml`   | typecheck, lint, build (pushes and pull requests, not tags)                      | same                                                                       |

`release.yml` also refuses to run when the tag and `package.json` disagree.

## Hosted builds: stable and next

Pages holds one site, so `pages.yml` always publishes two builds together:

| address                                        | what                                 | rebuilt                 |
| ---------------------------------------------- | ------------------------------------ | ----------------------- |
| `https://kapsikkum.github.io/mudrix-web/`      | the newest stable tag (no `-` in it) | on a stable tag push    |
| `https://kapsikkum.github.io/mudrix-web/next/` | the tip of the `next` branch         | on every push to `next` |

Each run builds both (Pages replaces the whole site, it cannot add to it): the stable build is the tag that
triggered the run, or the newest stable tag when `next` triggered it; the next build is always `origin/next`.
So a push to `next` rebuilds and redeploys the unchanged stable client as well. Run it by hand from
**Actions > Deploy to GitHub Pages > Run workflow**.

A pre-release tag (`v26.11.0-next.1`) does not deploy anything by itself. Its commit is what `next` already
serves, and the tag only produces the downloadable zip and Docker image.

**Deep links.** Pages serves a single `404.html` per site. `.github/pages/404.html` and `404-router.js`
(copied into the site with the real base path) load the `index.html` of the app a path belongs to, so
`/mudrix-web/r/!room` opens the stable client and `/mudrix-web/next/r/!room` the next build.

**One-time setup.** The `github-pages` environment only accepts deployments from the branches and tags it
lists, so `next` has to be on the list next to `main` and `v*` tags, or the deploy job is refused for pushes to
`next`. Done for `kapsikkum/mudrix-web` on 2026-11-01; for a fork or a new repository:

```sh
gh api repos/OWNER/mudrix-web/environments/github-pages/deployment-branch-policies          # what is allowed now
gh api -X POST repos/OWNER/mudrix-web/environments/github-pages/deployment-branch-policies   -f name=next -f type=branch
```

(Or Settings > Environments > github-pages > Deployment branches and tags.) The token needs repository admin
rights.

**Both builds share one browser origin.** `kapsikkum.github.io` is a single origin for `/mudrix-web/` and
`/mudrix-web/next/`, so they also share localStorage, IndexedDB and cookies. The client's storage names are
not prefixed by path (`matrix-store-<user>`, the crypto store, `mudrix-media-cache-<user>`, settings keys), so:

- a session signed in on one is signed in on the other, with the same encryption keys;
- if `next` upgrades a database (a higher IndexedDB version, a changed key format), the stable client can no
  longer open it and signs in again or fails to load until the site data is cleared;
- the two builds can write the same settings in different shapes.

This is accepted for now. Use a separate profile or browser for testing `next` if you want the stable site
untouched, and expect to clear site data after a risky change. The real fix is a different origin for `next`
(another host or a custom domain), or prefixing every storage name by the base path.

## Cut a pre-release from `next`

1. Merge what you want to test into `next` and make sure `check.yml` is green.
2. Set the version in `package.json` and `package-lock.json` (the top-level `version` and
   `packages[""].version`), then commit:
   ```sh
   git checkout next
   npm version 26.11.0-next.1 --no-git-tag-version
   git commit -am "chore(release): prepare v26.11.0-next.1"
   ```
3. Tag and push:
   ```sh
   git tag v26.11.0-next.1
   git push origin next v26.11.0-next.1
   ```
4. Wait for `release.yml`. The pre-release appears under Releases with the zip attached.
   (`next` itself is already live at `/mudrix-web/next/` from the push in step 3.)

Without a tag, run **Actions > Release (web) > Run workflow** on the `next` branch and enter the version
(it must match `package.json`). Tick "Also push the Docker image" if you want the image.

## Cut a stable release

Same steps from `main` with a version that has no suffix (`26.11.0`). `pages.yml` then deploys the site
and the Docker image gets `latest`.

## Releasing all three

Order matters, because the apps pin an exact web commit:

1. **Web:** tag as above and push the tag. The commit must be on GitHub before the apps build.
2. **Desktop** and **mobile:** point the `mudrix-web` submodule at that commit, set the same version in
   their `package.json`, then tag. See `RELEASING.md` in `mudrix-desktop` and `mudrix-mobile`.

Use the same version string in all three repositories.

## Rollback

Delete the GitHub release and its tag (`git push origin :refs/tags/v26.11.0-next.1`), and the Docker
tag from the package page. A pre-release never touched the hosted site or `latest`, so nothing else
needs undoing. For a stable release, redeploy the previous tag's Pages build from **Actions > Deploy to
GitHub Pages > Run workflow**.

## Upstream tags

This repository fetches from upstream WizardChat, which uses the same `-next.N` style and has tags such
as `v26.11.0-next.1`. The `upstream` remote is set to `--no-tags` so they are not copied here, and they
would clash with ours if they were. If one appears locally, delete it: `git tag -d v26.11.0-next.1`.
