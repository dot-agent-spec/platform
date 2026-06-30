# NPM Publish Troubleshooting - @dot-agent Scope

This document summarizes the attempts and technical findings regarding the NPM publish failures for the `@dot-agent` packages via GitHub Actions and Trusted Publishers (OIDC).

## Current Status
- **Handshake OIDC:** SUCCESSFUL (Verified in logs).
- **Provenance Signing:** SUCCESSFUL (Verified in logs).
- **NPM Registry Response:** `404 Not Found` on `PUT` request.

## Attempted Fixes (GitHub Actions)

1. **Authentication Conflict:** 
   - *Problem:* `actions/setup-node` with `registry-url` was creating an `.npmrc` that required `NODE_AUTH_TOKEN`.
   - *Fix:* Removed `registry-url` and eventually aligned with the official NPM recommended YAML structure.
   - *Result:* Authentication moved from "Anonymous/Token" to OIDC.

2. **NPM Version Compatibility:**
   - *Problem:* Older npm versions (10.x) had inconsistent OIDC support.
   - *Fix:* Upgraded to Node.js 22 and forced `npm install -g npm@latest` (v11+).
   - *Result:* Robust OIDC handshake and successful Sigstore provenance signing.

3. **Workflow Structure:**
   - *Fix:* Moved `permissions` to top-level and ensured `id-token: write` and `contents: read` are present.

## Root Cause (Identified)

The `404 Not Found` during the `PUT` phase (after successful authentication) indicates a **Scope Permission Issue** on the NPM side. 

NPM returns 404 instead of 403 (Forbidden) for scoped packages when the authenticated user/token does not have explicit write permissions for that specific scope or package to avoid leaking package existence information.

## Recommended Final Steps (NPM Panel)

Since the GitHub Actions side is now 100% compliant with OIDC standards, the remaining configuration is on `npmjs.com`:

1. **Trusted Publisher Mapping:**
   - Package: `@dot-agent/language-server` -> Repo: `dot-agent-spec/language-server`.
   - Package: `@dot-agent/tree-sitter` -> Repo: `dot-agent-spec/tree-sitter`.
   - **Note:** Ensure "Workflow Filename" is exactly `publish.yml`.

2. **Organization Permissions:**
   - In the `@dot-agent` NPM organization, ensure that the "Trusted Publisher" or the GitHub Organization `dot-agent-spec` has been granted **Write** or **Admin** access.

3. **Package-Level Access:**
   - If the package was first published manually, you may need to go to the package's **"Access"** tab and explicitly add the Trusted Publisher there, as it might not have inherited permissions from the organization level.

4. **2FA Conflict:**
   - If "Require 2FA for publishing" is enabled in the organization settings, ensure it doesn't conflict with "Trusted Publishers" (OIDC tokens are generally exempt, but verification is recommended).

## Verified Success in Logs
The last run (`ID: 26853755838`) confirmed:
- `npm notice publish Signed provenance statement...`
- `npm notice publish Provenance statement published to transparency log...`

This confirms the "pipe" is open; only the "permission to write" to the `@dot-agent` slot is missing.
----Solução:
Consegui ativar colocando node-version: '24.x', nesta versao ele instala o npm com suporte ao OIDC