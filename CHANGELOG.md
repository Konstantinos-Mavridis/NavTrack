# Changelog

All notable changes to NavTrack will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
NavTrack uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.0.12] – 2026-04-20

### Dependencies
- Bump `postcss` from 8.5.9 → 8.5.10 in `/frontend` (patch).
- Bump `autoprefixer` from 10.4.27 → 10.5.0 in `/frontend` (minor).
- Bump `react-router-dom` from 6.30.3 → 7.14.1 in `/frontend` (major).
- Bump `@types/supertest` from 6.0.3 → 7.2.0 in `/backend` (major, dev).
- Bump `typescript` from 6.0.2 → 6.0.3 in `/frontend` (patch, dev).

### Fixed
- Corrected API route documentation to match actual backend controllers.
- Fixed worker schedule times in documentation (16:05, 22:05, 23:05 — not :00).
- Removed references to non-existent weekly Monday 07:00 NAV sync job.
- Removed documentation for non-existent `/templates` and `/sync-jobs` frontend pages.
- Updated SECURITY.md to reflect that versioned releases now exist.
- Fixed database table name in documentation (`portfolio_positions`, not `positions`).
- Aligned worker and backend DSN fallback defaults with `.env.example` naming.
- Synced README.md with the current transaction-create API route and payload fields.
- Synced README.md and HANDOVER.md with the current frontend nginx listener port (`8080` inside the container).
- Synced HANDOVER.md trigger-source values with current sync implementation (`API`, `API_ALL`, `API_ALL_FORCE`, `WORKER_STARTUP`, `SCHEDULER_AFTERNOON`, `SCHEDULER_EVENING`).
- Corrected HANDOVER.md data-model table name to `portfolio_positions`.

---

## [0.0.1] – 2026-04-18

- Initial release of NavTrack.

### Added
- Documented previously undocumented API endpoints (positions CRUD, sync job detail, template NAV series, on-date NAV lookup).
- NestJS REST API (`backend`) with TypeORM + PostgreSQL.
- React / Vite frontend (`frontend`) with Recharts dashboards.
- Python worker service (`worker`) for background processing.
- Docker Compose configurations for development and production.
- GitHub Actions CI pipeline: SonarQube, CodeQL, CI Gate, Docker builds.
- Dependabot configuration for automated dependency updates.
- SemVer versioning strategy with automated `release.yml` workflow.

[Unreleased]: https://github.com/Konstantinos-Mavridis/NavTrack/compare/v0.0.12...HEAD
[0.0.12]: https://github.com/Konstantinos-Mavridis/NavTrack/compare/v0.0.1...v0.0.12
