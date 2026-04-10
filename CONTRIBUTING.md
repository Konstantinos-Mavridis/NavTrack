# Contributing to NavTrack

Thank you for your interest in contributing! This document explains how to get involved, from reporting a bug to submitting a pull request.

By participating you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).

---

## Table of Contents

- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Guidelines](#coding-guidelines)
- [Commit Style](#commit-style)
- [Pull Request Process](#pull-request-process)
- [Versioning & Changelog](#versioning--changelog)
- [Reporting Security Issues](#reporting-security-issues)

---

## Getting Started

Before contributing, please familiarise yourself with the project:

- **[README.md](./README.md)** — quick start, architecture overview, API reference, and environment variables.
- **[HANDOVER.md](./HANDOVER.md)** — the definitive deep-dive: architecture decisions, data flows, feature inventory, known limitations, and recommended next improvements. **Read this before writing any code.**
- **[CHANGELOG.md](./CHANGELOG.md)** — release history.

> **First time?** The [Short Takeover Checklist in HANDOVER.md §19](./HANDOVER.md#19-short-takeover-checklist) is the fastest way to verify the stack runs correctly on your machine before touching anything.

---

## How to Contribute

### Report a bug

Open a [Bug Report](https://github.com/Konstantinos-Mavridis/NavTrack/issues/new?template=bug_report.yml). Include reproduction steps, the affected service, and relevant container logs (`docker compose logs <service>`).

### Request a feature

Open a [Feature Request](https://github.com/Konstantinos-Mavridis/NavTrack/issues/new?template=feature_request.yml). Describe the problem it solves and indicate the likely SemVer impact (PATCH / MINOR / MAJOR).

### Ask a question

Open a [Question / Help](https://github.com/Konstantinos-Mavridis/NavTrack/issues/new?template=question.yml) issue. Check the README and HANDOVER.md first — most operational questions are answered there.

### Submit a fix or feature

1. Open or find an issue that describes the change.
2. Comment to signal you are working on it.
3. Fork the repo and create a branch (see [Development Setup](#development-setup)).
4. Make your changes, following the [Coding Guidelines](#coding-guidelines).
5. Open a pull request using the PR template.

---

## Development Setup

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose v2)
- Git

No local Node.js, Python, or PostgreSQL installation is required — everything runs inside containers.

### Running the stack locally

```bash
# 1. Fork and clone
git clone https://github.com/<your-fork>/NavTrack.git
cd NavTrack

# 2. Create your local env file
cp .env.example .env

# 3. Build and start all services from source
docker compose -f compose.dev.yml up --build

# 4. Open the app
open http://localhost:3000
```

The first build takes 2–3 minutes. Subsequent starts without `--build` take ~15 seconds.

### Useful commands

```bash
# Tail logs for a specific service
docker compose -f compose.dev.yml logs -f backend
docker compose -f compose.dev.yml logs -f worker

# Restart a single service after code changes
docker compose -f compose.dev.yml up --build backend

# Wipe all data and start fresh (reruns db/init.sql)
docker compose -f compose.dev.yml down -v
docker compose -f compose.dev.yml up --build
```

### Branch naming

```
fix/<short-description>        # bug fixes
feat/<short-description>       # new features
chore/<short-description>      # maintenance, deps, CI
docs/<short-description>       # documentation only
```

---

## Project Structure

A quick map — full detail is in [HANDOVER.md §15](./HANDOVER.md#15-repo-structure-guide).

| Path | Purpose |
|---|---|
| `backend/` | NestJS 11 REST API (TypeScript, TypeORM) |
| `frontend/` | React 19 SPA (Vite, Tailwind CSS) |
| `worker/` | Python 3.14 background worker (APScheduler, yfinance) |
| `worker/VERSION` | Worker version file — bumped automatically by `release.yml` |
| `db/init.sql` | Full schema + seed data — **the schema source of truth** |
| `compose.dev.yml` | Local development Compose file (builds from source) |
| `compose.yml` | Production Compose file (pulls GHCR images) |
| `.github/workflows/` | CI/CD GitHub Actions workflows |

### Files to read before making changes

From [HANDOVER.md §15.1](./HANDOVER.md#151-files-worth-reading-first):

1. `db/init.sql` — before any schema change
2. `worker/worker.py` — before any scheduling or sync change
3. `backend/src/app.module.ts` — before adding a new backend module
4. `frontend/src/App.tsx` — before adding a new frontend route

---

## Coding Guidelines

### General

- **Keep changes focused.** One logical change per PR. Unrelated fixes belong in a separate branch.
- **Match the existing style.** Each service has its own linting config — do not change formatter settings in the same PR as a feature.
- **Do not introduce secrets.** No API keys, passwords, or personal data in committed code. Use `.env` variables.
- **Update `db/init.sql` for schema changes.** TypeORM `synchronize` is disabled intentionally. Do not enable it. See [HANDOVER.md §13](./HANDOVER.md#13-current-operational-notes) for why.
- **Keep imports idempotent.** All import endpoints skip existing records — preserve this behaviour when adding new import paths.

### Backend (NestJS)

- Follow the existing module pattern: controller → service → TypeORM repository.
- Add DTOs with `class-validator` decorators for all new endpoints.
- Do not use TypeORM `synchronize: true`.

### Frontend (React / Vite)

- The API base path is always `/api` (proxied by nginx). Never hardcode a backend hostname.
- New pages need a route entry in `App.tsx`.
- Keep components co-located with their page where practical.

### Worker (Python)

- New scheduled jobs go in `worker/worker.py` using `scheduler.add_job()`.
- Always set `max_instances=1, coalesce=True` to prevent job pile-up.
- Write a new trigger source string to `sync_jobs` if adding a new sync trigger.
- See [HANDOVER.md §6](./HANDOVER.md#6-worker-behaviour) for the worker's startup sequence and schedule details.

### Database

- All schema changes go in `db/init.sql`.
- Adjust seed data if new columns or tables are added.
- Note that there is currently no migrations framework — document schema changes clearly in the PR and CHANGELOG. See [HANDOVER.md §16](./HANDOVER.md#16-known-limitations) for this known limitation.

---

## Commit Style

NavTrack uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>
```

| Type | When to use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Maintenance, dependency bumps, CI tweaks |
| `docs` | Documentation only |
| `refactor` | Code restructure with no behaviour change |
| `test` | Adding or updating tests |
| `perf` | Performance improvement |

**Scopes** (optional but helpful): `backend`, `frontend`, `worker`, `db`, `ci`, `release`

```bash
# Examples
git commit -m "feat(backend): add valuation snapshot endpoint"
git commit -m "fix(worker): handle 429 rate limit on startup sync"
git commit -m "docs: add contributing guidelines"
git commit -m "chore(deps): bump yfinance to 0.2.55"
```

> Commits prefixed `[skip ci]` are reserved for the automated release version-bump commit. Do not use `[skip ci]` manually.

---

## Pull Request Process

1. **Open against `main`.** All contributions target the `main` branch.
2. **Fill in the PR template.** Every section exists for a reason — incomplete PRs may be sent back.
3. **Indicate the SemVer impact.** The PR template includes a *Type of change* section labelled with PATCH / MINOR / MAJOR. This helps determine the next release version.
4. **Update the CHANGELOG.** Add a bullet under `[Unreleased]` in `CHANGELOG.md` describing your change. Follow the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format (`Added`, `Changed`, `Fixed`, `Removed`, `Security`).
5. **Verify the stack boots cleanly.** Run `docker compose -f compose.dev.yml up --build` and confirm no startup errors.
6. **No credentials.** The PR will be rejected if secrets or personal data are found in the diff.
7. **CI must pass.** SonarQube and CodeQL analyses run automatically on PRs to `main`. Address any findings before requesting a review.

---

## Versioning & Changelog

NavTrack uses a single **Semantic Versioning** (`vX.Y.Z`) tag shared across all three services. All Docker images are released together.

| Change type | Version bump |
|---|---|
| Bug fixes, dependency updates, minor infra changes | `PATCH` |
| New features, non-breaking API additions | `MINOR` |
| Breaking API changes, major DB migrations, architectural changes | `MAJOR` |

Releases are cut via **Actions → Release → Run workflow**. Contributors do not cut releases directly — maintainers do. Full release process is documented in [HANDOVER.md §11](./HANDOVER.md#11-versioning--release-process).

Your responsibility as a contributor:
- Add your changes to the `[Unreleased]` section of `CHANGELOG.md` in your PR.
- Do not modify version files (`backend/package.json`, `frontend/package.json`, `worker/VERSION`) manually — those are managed by the release workflow.

---

## Reporting Security Issues

Please **do not** open a public issue for security vulnerabilities. Report them privately by contacting the [author via GitHub](https://github.com/Konstantinos-Mavridis) with a description of the issue and steps to reproduce. You will receive a response as promptly as possible.
