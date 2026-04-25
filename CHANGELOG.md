# Changelog

All notable changes to NavTrack will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
NavTrack uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Added `FEE_CONSOLIDATION` transaction type: bank-initiated unit adjustment for portfolio maintenance fees with no cash flow recorded.

### Changed
- Narrowed all page containers from `max-w-6xl` to `max-w-5xl` (PortfolioList, PortfolioDetail, StrategyList, InstrumentDetail, TemplatesPage, Navbar).

### CI
- Switched backend Jest test reporting to `--json` summary (no extra dependency).
- Added job summaries for backend (Jest) and worker (pytest) in the SonarQube workflow.
- Fixed Snyk worker scan by replacing `snyk/actions/python` with direct CLI run steps to share the pip install environment.
- Fixed SonarQube frontend scan: excluded `coverage/lcov-report/` to suppress Istanbul-generated false-positive XSS finding.
- Fixed CodeQL analysis: added config file excluding generated/vendored directories (`coverage`, `dist`, `node_modules`, `__pycache__`).

---

## [0.0.13] - 2026-04-23

### Added
- Added smoke tests for all 5 page components (PortfolioList, PortfolioDetail, InstrumentDetail, TemplatesPage, TransactionsPage).
- Added smoke tests for 4 modal/form components (PortfolioFormModal, TransactionFormModal, ConfirmDialog, StrategyFormModal).
- Added smoke test for PortfolioAggregateChart component.
- Added `FEE_CONSOLIDATION` transaction type to the backend with dedicated service logic; fee transactions reduce unit count without recording a cash outflow.
- Added `FeeConsolidationModal` component for recording fee consolidation transactions in the frontend.
- Added E2E Playwright test for fee consolidation transaction flow.

### Changed
- Aligned InstrumentDetail container width with portfolio pages (max-w-4xl → max-w-6xl).
- Aligned PortfolioDetail container width with PortfolioList (max-w-7xl → max-w-6xl).

### Fixed
- Fixed fee display in TransactionFormModal: fee field now correctly shown/hidden based on transaction type selection.

---

## [0.0.12] - 2026-04-22

### Added
- Added Playwright E2E tests for portfolio CRUD, transaction management, and instrument detail flows.
- Added dedicated CI job (`e2e`) in GitHub Actions workflow for Playwright tests with Docker Compose service setup.

### Changed
- layout - max-w-6xl on PortfolioList and StrategyList + logo outside-left of max-w-6xl, nav links at its left edge, toggle outside-right

---

## [0.0.11] - 2026-04-21

### Added
- Added TemplatesPage for managing reusable allocation templates.
- Added TemplateFormModal for creating and editing templates with allocation rows.

### Fixed
- Fixed PortfolioImportExport button layout so it appears inline next to the New Portfolio button.

---

## [0.0.10] - 2026-04-18

### Added
- Added SonarQube/SonarCloud CI analysis for frontend, backend, and worker.
- Added Snyk security scanning for frontend (npm), backend (npm), and worker (pip) in CI.

---

## [0.0.9] - 2026-04-15

### Added
- Added portfolio import/export (JSON) via `PortfolioImportExport` component.
- Added `PortfolioAggregateChart` to `PortfolioList` page.

---

## [0.0.8] - 2026-04-14

### Added
- Added `PortfolioValueChart` to `PortfolioDetail` page.
- Added `InstrumentValueChart` to `InstrumentDetail` page.

---

## [0.0.7] - 2026-04-13

### Added
- Added performance range selector (1M / 3M / 6M / 1Y / ALL) to all chart components.

---

## [0.0.6] - 2026-04-11

### Added
- Added `StrategiesPage` listing all strategies with their allocations.
- Added `StrategyFormModal` for creating and editing strategies with allocation rows.

---

## [0.0.5] - 2026-04-10

### Added
- Added `InstrumentDetail` page showing latest price, period return, data point count, chart, and price history table.
- Added `InstrumentsPage` listing all instruments with search filter.

---

## [0.0.4] - 2026-04-08

### Added
- Added `TransactionsPage` component for per-portfolio transaction history with inline add/edit/delete.
- Added `TransactionFormModal` for creating and editing BUY/SELL transactions.

---

## [0.0.3] - 2026-04-07

### Added
- Added `PortfolioDetail` page with KPI strip (total value, cost, unrealised P&L, return), positions table, and transactions tab.

---

## [0.0.2] - 2026-04-05

### Added
- Added `PortfolioList` page with portfolio cards showing valuation data (total value, unrealised P&L, return).
- Added `PortfolioFormModal` for creating and editing portfolios.
- Added `ConfirmDialog` for delete confirmation.

---

## [0.0.1] - 2026-04-04

### Added
- Initial project scaffold: React/TypeScript frontend, NestJS backend, Python worker, PostgreSQL database.
- Docker Compose setup for local development.
- GitHub Actions CI pipeline.
