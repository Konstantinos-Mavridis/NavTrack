## Summary

<!-- A concise description of what this PR does and why. -->

Closes #<!-- issue number, or remove this line if not applicable -->

---

## Type of change

<!-- Check all that apply. -->

- [ ] 🐛 Bug fix (PATCH)
- [ ] ✨ New feature (MINOR)
- [ ] 💥 Breaking change (MAJOR — API, DB schema, or architectural change)
- [ ] 🔧 Refactor / internal improvement (no behaviour change)
- [ ] 📦 Dependency update
- [ ] 📝 Documentation only
- [ ] 🔒 Security fix
- [ ] ⚙️ CI / workflow change

---

## Services affected

<!-- Check all that apply. -->

- [ ] `backend`
- [ ] `frontend`
- [ ] `worker`
- [ ] `db` (schema / migrations)
- [ ] CI / workflows
- [ ] Docs only

---

## Changes

<!-- Bullet-point list of the key changes made. -->

-

---

## Testing

<!-- Describe how you tested this. Delete any that don't apply. -->

- [ ] Ran `docker compose -f compose.dev.yml up --build` and verified the app boots cleanly
- [ ] Manually tested the affected feature(s) in the UI
- [ ] Verified relevant API endpoints with curl / Postman
- [ ] Checked the worker logs for scheduled jobs (if applicable)
- [ ] No testing required (docs / config only)

---

## Checklist

- [ ] CHANGELOG.md `[Unreleased]` section updated
- [ ] No secrets, credentials, or personal data introduced
- [ ] `.env.example` updated if new environment variables were added
- [ ] README / docs updated if behaviour or configuration changed
- [ ] `db/init.sql` updated if schema changed (and seed data adjusted if needed)
