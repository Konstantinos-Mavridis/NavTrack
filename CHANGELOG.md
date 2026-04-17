# Changelog

All notable changes to NavTrack will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
NavTrack uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Added `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, and `SECURITY.md` community documents.
- Added GitHub issue templates (`.github/ISSUE_TEMPLATE/`) and pull request template (`.github/PULL_REQUEST_TEMPLATE.md`).

---

## [0.0.7] – 2026-04-17

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

---

## [0.0.5] – 2026-04-16

### Added
- Initial release of NavTrack.
- NestJS REST API (`backend`) with TypeORM + PostgreSQL.
- React / Vite frontend (`frontend`) with Recharts dashboards.
- Python worker service (`worker`) for background processing.
- Docker Compose configurations for development and production.
- GitHub Actions CI pipeline: SonarQube, CodeQL, CI Gate, Docker builds.
- Dependabot configuration for automated dependency updates.
- SemVer versioning strategy with automated `release.yml` workflow.

[Unreleased]: https://github.com/Konstantinos-Mavridis/NavTrack/compare/v0.0.6...HEAD
[0.0.6]: https://github.com/Konstantinos-Mavridis/NavTrack/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/Konstantinos-Mavridis/NavTrack/releases/tag/v0.0.5
