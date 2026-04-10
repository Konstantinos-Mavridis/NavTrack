# Security Policy

## Supported Versions

NavTrack is currently in active development. Security fixes are applied to
the `main` branch only. There are no versioned releases at this time.

| Branch | Supported |
|---|---|
| `main` | ✅ Yes |
| Older forks / snapshots | ❌ No |

---

## Reporting a Vulnerability

If you discover a security vulnerability in NavTrack, **please do not open a
public GitHub issue.** Public disclosure before a fix is in place puts all
users of the project at risk.

Instead, please report it privately:

1. **GitHub private vulnerability reporting** (preferred) —
   use the [Security tab → Report a vulnerability](https://github.com/Konstantinos-Mavridis/NavTrack/security/advisories/new)
   feature on this repository.
2. **Email** — if you prefer, send details directly to the maintainer at the
   address listed on their [GitHub profile](https://github.com/Konstantinos-Mavridis).

Please include as much of the following as possible:

- A clear description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Affected component (backend, frontend, worker, database, Docker config)
- Any suggested fix or mitigation if you have one

You will receive an acknowledgement within **72 hours**. Once the issue has
been triaged we will aim to provide a fix or mitigation within **14 days**
for critical issues, or **30 days** for lower-severity findings.

---

## Scope

The following are **in scope** for security reports:

- SQL injection or ORM bypass in the NestJS backend
- Unauthorised access to API endpoints (broken access control)
- Remote code execution in any service
- Sensitive data exposure (credentials, PII, financial data) in API responses,
  logs, or exported files
- Insecure Docker Compose configuration that exposes services unintentionally
- Dependency vulnerabilities with a known CVE and a realistic attack path
  in this project's context
- Cross-site scripting (XSS) in the React frontend
- Path traversal or arbitrary file read/write in the backend

The following are **out of scope**:

- Vulnerabilities that require physical access to the host machine
- Denial-of-service attacks requiring sustained high traffic
- Issues in the default `.env.example` credentials (these are development
  defaults — operators are expected to change them before any deployment)
- Scanner output with no demonstrated exploitability in this project
- Social engineering

---

## Current Security Posture

NavTrack is designed as a **single-user, self-hosted tool**. The following
limitations are known and accepted for the current build:

| Area | Current State | Notes |
|---|---|---|
| Authentication | ❌ None | All API endpoints are unauthenticated. Do not expose the app to the public internet without adding auth (see HANDOVER.md). |
| Authorisation | ❌ None | Any client with network access can read or mutate all data. |
| HTTPS / TLS | ❌ Not configured | Terminate TLS at a reverse proxy (nginx, Traefik) in front of the stack before any non-local deployment. |
| Input validation | ⚠️ Partial | NestJS DTOs use `class-validator`. Coverage is not exhaustive. |
| Dependency scanning | ⚠️ Manual | No automated Dependabot or Snyk integration yet. Run `npm audit` and `pip-audit` periodically. |
| Secrets management | ⚠️ `.env` file | Credentials are read from `.env`. Never commit this file. Use Docker secrets or a vault for production. |
| Database exposure | ⚠️ Host port | PostgreSQL is exposed on `localhost:5432` by default. Restrict `POSTGRES_EXPOSE_PORT` or remove it if direct DB access is not needed. |

> **Important:** NavTrack should only be accessible on a trusted private
> network or localhost until authentication and TLS are added. See
> `HANDOVER.md → Recommended Next Steps` for guidance.

---

## Dependency Management

### Node.js (backend + frontend)

```bash
# Check for known vulnerabilities
cd backend && npm audit
cd frontend && npm audit

# Auto-fix non-breaking updates
npm audit fix
```

### Python (worker)

```bash
cd worker
pip install pip-audit
pip-audit -r requirements.txt
```

It is recommended to run these checks before any deployment and after pulling
new commits.

---

## Docker & Container Hardening (Recommended for Production)

- Run containers as **non-root users** (add `USER node` / `USER python` in
  Dockerfiles after dependency installation).
- Set `read_only: true` on containers where the filesystem does not need to
  be writable.
- Use `--no-new-privileges` in Docker security options.
- Pin base image versions to specific digests (`postgres:16@sha256:...`)
  rather than floating tags to prevent supply-chain surprises.
- Remove `POSTGRES_EXPOSE_PORT` from `docker-compose.yml` in production if
  direct database access from the host is not required.

---

## Acknowledgements

We appreciate the efforts of security researchers and users who responsibly
disclose vulnerabilities. Confirmed, in-scope reports will be credited in the
release notes (or a future `CHANGELOG.md`) unless the reporter prefers to
remain anonymous.
