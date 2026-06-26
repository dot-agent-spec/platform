# Agent Dependencies

This document tracks dependencies between agents built with the `dot-agent` CLI and external agent services.

## Structure

Each agent that requires services from other agents or external APIs should be documented below with:
- **Agent ID** — Qualified name (domain/name:version)
- **Requires** — List of agent services or APIs needed
- **Status** — Deployment or development status
- **Notes** — Additional context or constraints

## Template

When adding a new agent, use this format:

```markdown
### agent-name (domain/agent-name:v1.0)

**Requires:**
- `ServiceAgent` — Provides X functionality
- External API: `https://api.example.com` — Rate limited to 100 req/min

**Status:** Development

**Notes:** Add any important integration notes, authentication requirements, or deployment constraints.
```

---

## Example Agents

### doctor (entelekheia.ai/doctor:v1.0)

**Requires:**
- `UserProfile` — Patient data and medical history
- EMR API — Electronic medical records system

**Status:** Production

**Notes:** 
- Requires HIPAA compliance verification
- Patient consent tokens must be present in context
- Knowledge base includes latest clinical guidelines

---

### assistant (example.com/assistant:v1.0)

**Requires:**
- `FileSystem` — Read/write operations
- `SearchAPI` — Query external knowledge bases

**Status:** Development

**Notes:** Early prototype, not for production use yet

---

## Common Dependencies

### System Capabilities

- **UserProfile** — User identity, preferences, history
- **FileSystem** — Disk I/O, document storage
- **Memory** — Session/context memory (internal)
- **Clock** — Time-aware features

### External Integrations

- **SearchAPI** — Web search or knowledge base queries
- **EmailService** — Send/receive emails
- **SlackBot** — Slack workspace integration
- **PaymentGateway** — Transaction processing

---

## Publishing

Publishing to npm happens automatically via GitHub Actions (`.github/workflows/`) when a GitHub Release is published.
**Do not run `npm publish` manually.**

Steps to release a new version:
1. Bump `version` in `package.json`
2. Commit and push
3. Create a GitHub Release — the workflow runs `npm ci`, `npm run build`, `npm test`, and publishes to npm

---

## Absolute Rules

**License headers are mandatory on every source file.** Before committing any `.ts`, `.tsx`, `.js`, or `.jsx` file you must ensure the correct header is present at the very top of the file:
- **New file** (all files in this project): full Apache 2.0 header, sole copyright Danilo Borges 2026.

The pre-commit hook (`scripts/ensure-license-headers.sh`, registered in `.githooks/pre-commit` via `git config core.hooksPath`) applies the headers automatically and re-stages patched files. After cloning the repository, run `npm install` to activate the hook. If you add a file programmatically and bypass the hook, inject the header manually before staging. Never remove or alter existing copyright notices.

---

## Orchestration Rules

When composing agents that have dependencies:

1. **Initialization Order** — Load agents bottom-up (services before clients)
2. **Error Handling** — Graceful degradation if optional dependencies unavailable
3. **Timeout Policy** — Set reasonable timeouts for inter-agent calls
4. **Logging** — Log all external service calls for debugging

---

## Notes for Developers

- Update this file when adding new agents or changing dependencies
- Document breaking changes when upgrading agent versions
- Use semantic versioning (v1.0, v2.1, etc.) for reproducibility
- Keep a `requires[]` field in your agent's `.description` file in sync with this document
