# Changelog

All notable changes to NavTrack will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
NavTrack uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [1.0.0] – 2026-04-16

### Added
- Initial release of NavTrack.
- NestJS REST API (`backend`) with TypeORM + PostgreSQL.
- React / Vite frontend (`frontend`) with Recharts dashboards.
- Python worker service (`worker`) for background processing.
- Docker Compose configurations for development and production.
- GitHub Actions CI pipeline: SonarQube, CodeQL, CI Gate, Docker builds.
- Dependabot configuration for automated dependency updates.
- SemVer versioning strategy with automated `release.yml` workflow.

[Unreleased]: https://github.com/Konstantinos-Mavridis/NavTrack/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Konstantinos-Mavridis/NavTrack/releases/tag/v1.0.0
