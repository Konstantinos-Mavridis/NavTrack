# Changelog

All notable changes to NavTrack will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
NavTrack uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Fixed
- Synced README.md with the current transaction-create API route and payload fields.
- Synced README.md and HANDOVER.md with the current frontend nginx listener port (`8080` inside the container).
- Synced HANDOVER.md trigger-source values with current sync implementation (`API`, `API_ALL`, `API_ALL_FORCE`, `WORKER_STARTUP`, `SCHEDULER_AFTERNOON`, `SCHEDULER_EVENING`).
- Corrected HANDOVER.md data-model table name to `portfolio_positions`.

---
## [0.0.2] – 2026-04-18

### Fixed
- Corrected API route documentation to match actual backend controllers.
- Fixed worker schedule times in documentation (16:05, 22:05, 23:05 — not :00).
- Removed references to non-existent weekly Monday 07:00 NAV sync job.
- Removed documentation for non-existent `/templates` and `/sync-jobs` frontend pages.
- Updated SECURITY.md to reflect that versioned releases now exist.
- Fixed database table name in documentation (`portfolio_positions`, not `positions`).
- Aligned worker and backend DSN fallback defaults with `.env.example` naming.

### Added
- Documented previously undocumented API endpoints (positions CRUD, sync job detail, template NAV series, on-date NAV lookup).
- NestJS REST API (`backend`) with TypeORM + PostgreSQL.
- React / Vite frontend (`frontend`) with Recharts dashboards.
- Python worker service (`worker`) for background processing.
- Docker Compose configurations for development and production.
- GitHub Actions CI pipeline: SonarQube, CodeQL, CI Gate, Docker builds.
- Dependabot configuration for automated dependency updates.
- SemVer versioning strategy with automated `release.yml` workflow.

---

## [0.0.1] – 2026-04-18

- Initial release of NavTrack.

[Unreleased]: https://github.com/Konstantinos-Mavridis/NavTrack/compare/v0.0.2...HEAD

