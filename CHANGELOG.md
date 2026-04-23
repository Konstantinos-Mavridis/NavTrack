# Changelog

All notable changes to NavTrack will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
NavTrack uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Added smoke tests for all 5 page components (PortfolioList, PortfolioDetail, InstrumentDetail, TemplatesPage, TransactionsPage).
- Added unit tests for `TransactionsService`, `InstrumentsService`, and `TransactionsController` in the backend.
- Added manual Snyk security scan workflow covering SCA and SAST for all three services; results uploaded to GitHub Security.

### Fixed
- Fixed positions table overflow causing a bottom scrollbar stripe in dark mode (`dark:bg-gray-900` on `overflow-x-auto` wrapper).
- Fixed accessibility violation in `FeeTooltip`: moved `onClick` from non-interactive `<span>` to the inner `<button>` (SonarCloud S6819).
- Fixed accessibility violation in `NavTooltip`: moved `onMouseEnter`/`onMouseLeave` handlers from wrapper `<span>` to inner `<button>`.
- Fixed frontend Dockerfile to remediate `SNYK-ALPINE323-LIBXPM-16117329` vulnerability.
- Fixed Snyk worker scan by replacing `snyk/actions/python` with direct CLI run steps to share the pip install environment.
- Fixed Snyk SARIF output paths and action invocation for all three services.
- Fixed SonarQube frontend scan: excluded `coverage/lcov-report/` to suppress Istanbul-generated false-positive XSS finding.
- Fixed CodeQL analysis: added config file excluding generated/vendored directories (`coverage`, `dist`, `node_modules`, `__pycache__`).
- Fixed Fee Consolidation modal: `NavTooltip` on Price / Unit (€) is now always rendered (shows a contextual message when fee consolidation is active) so the label row height stays stable when switching transaction types.
- Fixed Fee Consolidation modal: total-row height no longer collapses when switching to Fee Consolidation; the right-hand amount span now renders a non-breaking space instead of an empty string.

### CI
- Switched backend Jest test reporting to `--json` summary (no extra dependency).
- Added job summaries for backend (Jest) and worker (pytest) in the SonarQube workflow.

---

## [0.0.13] - 2026-04-23

---

## [0.0.12] - 2026-04-23

### Added
- Added high-coverage worker orchestration tests for bootstrap, scheduler, sync flow, and rollback paths.
- Added frontend tests for API client behavior, sync components, and shared UI helpers.
- Added Fee Consolidation transaction type.

### Changed
- Switched to native Node.js http module for backend healthcheck.
- Aligned InstrumentDetail container width with portfolio pages (max-w-4xl → max-w-6xl).
- Aligned PortfolioDetail container width with PortfolioList (max-w-7xl → max-w-6xl).
- Improved breadcrumb spacing relative to the sticky navbar.

---
## [0.0.11] – 2026-04-20

### Dependencies
- Bump `postcss` from 8.5.9 → 8.5.10 in `/frontend` (patch).
- Bump `autoprefixer` from 10.4.27 → 10.5.0 in `/frontend` (minor).
- Bump `react-router-dom` from 6.30.3 → 7.14.1 in `/frontend` (major).
- Bump `@types/express` to v5 in `/backend` (major).
- Bump `@types/supertest` from 6.0.3 → 7.2.0 in `/backend` (major, dev).
- Bump `typescript` from 6.0.2 → 6.0.3 in `/frontend` (patch, dev).

### Changed
- Renamed Templates → Allocation Templates; added Risk column to template fund table
- layout - max-w-6xl on PortfolioList and StrategyList + logo outside-left of max-w-6xl, nav links at its left edge, toggle outside-right
- Corrected API route documentation to match backend controllers.
- Fixed worker schedule times in documentation (16:05, 22:05, 23:05 — not :00).
- Updated SECURITY.md to reflect that versioned releases now exist.
- Aligned worker and backend DSN fallback defaults with `.env.example` naming.

---

## [0.0.1] – 2026-04-18

- Initial release of NavTrack.

### Added
- Documented API endpoints (positions CRUD, sync job detail, template NAV series, on-date NAV lookup).
- NestJS REST API (`backend`) with TypeORM + PostgreSQL.
- React / Vite frontend (`frontend`) with Recharts dashboards.
- Python worker service (`worker`) for background processing.
- Docker Compose configurations for development and production.
- GitHub Actions CI pipeline: SonarQube, CodeQL, CI Gate, Docker builds.
- Dependabot configuration for automated dependency updates.
- SemVer versioning strategy with automated `release.yml` workflow.

[Unreleased]: https://github.com/Konstantinos-Mavridis/NavTrack/compare/v0.0.13...HEAD
[0.0.13]: https://github.com/Konstantinos-Mavridis/NavTrack/compare/v0.0.13...v0.0.13
[0.0.12]: https://github.com/Konstantinos-Mavridis/NavTrack/compare/v0.0.11...v0.0.12
