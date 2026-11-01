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
