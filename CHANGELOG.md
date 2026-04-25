# Changelog

All notable changes to NavTrack will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
NavTrack uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.0.14] - 2026-04-25

### Added
- Added `FEE_CONSOLIDATION` transaction type: bank-initiated unit adjustment for portfolio maintenance fees with no cash flow recorded.

### Changed
- Narrowed all page containers from `max-w-6xl` to `max-w-5xl` across `PortfolioList`, `PortfolioDetail`, `StrategyList` (including its embedded Allocation Templates section), `InstrumentDetail`, and `TemplatesPage`.
- Updated `Navbar` centre block from `max-w-6xl` to `max-w-5xl` to keep nav links aligned with the narrowed page content.

---
## [0.0.13] - 2026-04-23

### Added
- Added smoke tests for all 5 page components (PortfolioList, PortfolioDetail, InstrumentDetail, TemplatesPage, TransactionsPage).
- Added unit tests for `TransactionsService`, `InstrumentsService`, and `TransactionsController` in the backend.
- Added manual Snyk security scan workflow covering SCA and SAST for all three services; results uploaded to GitHub Security.

### Fixed
- Fixed positions table overflow causing a bottom scrollbar stripe in dark mode (`dark:bg-gray-900` on `overflow-x-auto` wrapper).
- Fixed frontend Dockerfile to remediate `SNYK-ALPINE323-LIBXPM-16117329` vulnerability.

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
- Updated SECURITY.md to reflect that versioned releases now exist.
- Aligned worker and backend DSN fallback defaults with `.env.example` naming.

---

## [0.0.1] – 2026-04-18

- Initial release of NavTrack.

### Added
- Initial project scaffold: React/TypeScript frontend, NestJS backend, Python worker, PostgreSQL database.
- NestJS REST API (`backend`) with TypeORM + PostgreSQL.
- React / Vite frontend (`frontend`) with Recharts dashboards.
- Python worker service (`worker`) for background processing.
- Docker Compose configurations for development and production.
- GitHub Actions CI pipeline: SonarQube, CodeQL, CI Gate, Docker builds.
- Dependabot configuration for automated dependency updates.
- SemVer versioning strategy with automated `release.yml` workflow.
- Documented API endpoints (positions CRUD, sync job detail, template NAV series, on-date NAV lookup).  
- Added SonarQube/SonarCloud CI analysis for frontend, backend, and worker.
- Added Snyk security scanning for frontend (npm), backend (npm), and worker (pip) in CI.
- Added `PortfolioList` page with portfolio cards showing valuation data (total value, unrealised P&L, return).  
- Added `PortfolioAggregateChart` to `PortfolioList` page. 
- Added `PortfolioFormModal` for creating and editing portfolios.  
- Added `ConfirmDialog` for delete confirmation.  
- Added `PortfolioDetail` page with KPI strip (total value, cost, unrealised P&L, return), positions table, and transactions tab.
- Added `PortfolioValueChart` to `PortfolioDetail` page.
- Added portfolio import/export (JSON) via `PortfolioImportExport` component.  
- Added `TransactionsPage` component for per-portfolio transaction history with inline add/edit/delete.
- Added `TransactionFormModal` for creating and editing BUY/SELL transactions.
- Added `StrategiesPage` listing all strategies with their allocations.
- Added `StrategyFormModal` for creating and editing strategies with allocation rows.  
- Added `TemplatesPage` for managing reusable allocation templates.
- Added `TemplateFormModal` for creating and editing templates with allocation rows.
- Added `InstrumentsPage` listing all instruments with search filter.
- Added `InstrumentDetail` page showing latest price, period return, data point count, chart, and price history table.
- Added `InstrumentValueChart` to `InstrumentDetail` page.
- Added performance range selector (1M / 3M / 6M / 1Y / ALL) to all chart components.

[Unreleased]: https://github.com/Konstantinos-Mavridis/NavTrack/compare/v0.0.14...HEAD
[0.0.14]: https://github.com/Konstantinos-Mavridis/NavTrack/compare/v0.0.13...v0.0.14
[0.0.13]: https://github.com/Konstantinos-Mavridis/NavTrack/compare/v0.0.12...v0.0.13
