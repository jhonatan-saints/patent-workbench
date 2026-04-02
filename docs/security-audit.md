# Security Audit

Audit date: 2026-04-01
Scope: full codebase — Express server, React client, middleware, LLM bridge, export pipeline.

---

## Summary

| Severity | Count |
| --- | --- |
| Critical | 3 |
| High | 3 |
| Medium | 4 |
| Low | 3 |
| **Total** | **13** |

---

## Critical

### C-1 — XSS via LLM output in PDF export (iframe srcdoc)

**File:** `client/src/components/ExportPanel.tsx` ~line 370

The PDF generation appends an `<iframe srcdoc="…">` to `document.body` containing LLM-generated content. If the content escaping has any gap — attribute context, SVG event handlers, crafted Unicode — arbitrary JavaScript executes in the page's origin.

**Fix:** Add the `sandbox` attribute to the iframe with no `allow-scripts` token:

```typescript
iframe.sandbox.add('allow-same-origin');
// do NOT add 'allow-scripts'
```

Long-term: generate PDFs server-side or via a library that does not use an inline iframe renderer.

---

### C-2 — Prompt injection detection is trivially bypassed

**File:** `server/src/middleware/sanitize.ts` lines 6–15

The current regex list only matches specific English phrases with simple case-insensitivity. Bypasses include Unicode lookalikes, character substitution (`ig n0re`), synonym use (`forget`, `override`, `disregard`), and newline insertion.

**Fix (short-term):** Expand the pattern list and normalise input before matching:

```typescript
// Normalise before testing
const normalised = prompt.normalize('NFKC').replace(/\s+/g, ' ').toLowerCase();
```

**Fix (long-term):** Regex-based jailbreak detection is fundamentally limited. The primary defence should be prompt engineering (system prompts hardened against override), with the regex as a secondary signal only — not a security guarantee.

---

### C-3 — SVG figures stored and rendered as raw data URLs

**File:** `client/src/types/index.ts` line 99 (`FigureItem.dataUrl`)

SVG files accepted via the figures uploader can contain `<script>` tags and event handlers. These are stored as base64 data URLs in state and later embedded in exports. An `escapeHtml` pass does not sanitise SVG internals.

**Fix:** Reject SVG uploads entirely or sanitise them with DOMPurify before storage:

```typescript
import DOMPurify from 'dompurify';

if (file.type === 'image/svg+xml') {
  const raw = await file.text();
  const safe = DOMPurify.sanitize(raw, { USE_PROFILES: { svg: true, svgFilters: true } });
  // re-encode safe as data URL
}
```

---

## High

### H-1 — Prompt truncation instead of rejection

**File:** `server/src/middleware/sanitize.ts` lines 26–31

When a prompt exceeds `maxLen`, it is silently truncated. An attacker can craft a prompt where the malicious payload sits near the end of the string, expecting the server to silently discard it rather than flag it.

**Fix:** Reject with a 400 instead of truncating:

```typescript
if (prompt.length > maxLen) {
  return res.status(400).json({ success: false, error: 'Prompt exceeds maximum length' });
}
```

---

### H-2 — File upload validation is client-side only

**File:** `client/src/components/workflow/IdeaInputStep.tsx` lines 42–54

The `accept` attribute and 500 KB size check are browser-enforced only. A direct HTTP request bypasses both. Any file type and any size can reach the prompt builder.

**Fix:** Add a server-side `/validate-context-file` endpoint that:

1. Checks `Content-Type` header against an allowlist
2. Reads the first 512 bytes to verify the content matches the declared type
3. Enforces the 500 KB hard limit
4. Returns the sanitised text content for the client to use

---

### H-3 — Rate limiting key defaults to unverified IP

**File:** `server/src/app.ts` lines 54–67

`express-rate-limit` keys on `req.ip`. Without `app.set('trust proxy', 1)`, requests through a reverse proxy all share the proxy's IP and exhaust the same bucket. With it set incorrectly, the `X-Forwarded-For` header can be spoofed.

**Fix:** Configure proxy trust explicitly:

```typescript
// Only if the app runs behind a known proxy (nginx, etc.)
app.set('trust proxy', 1);
```

Document the expected deployment topology in `.env.example` so operators know whether to set this.

---

## Medium

### M-1 — CORS falls back to localhost in production

**File:** `server/src/app.ts` line 21

`CORS_ORIGIN` defaults to `http://localhost:5173`. If this variable is unset in a production deployment, the server silently accepts requests from any localhost client.

**Fix:** Add a startup assertion:

```typescript
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  throw new Error('CORS_ORIGIN must be set in production');
}
```

---

### M-2 — Error responses may expose internal detail

**File:** `server/src/middleware/errorHandler.ts` line 12

Validation error messages from Zod are forwarded to the client. Detailed field-level errors can disclose schema structure and internal field names.

**Fix:** Map status codes to generic messages for all non-validation errors. For 400 validation errors, return only the field name and a generic constraint description — not the raw Zod message.

---

### M-3 — Helmet CSP uses permissive defaults

**File:** `server/src/app.ts` lines 30–38

`contentSecurityPolicy: true` applies Helmet's built-in defaults, which may allow `'unsafe-inline'` for styles and do not restrict `connect-src` to the Ollama endpoint explicitly.

**Fix:** Provide an explicit directive object:

```typescript
contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'", "http://localhost:11434"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
  },
},
```

---

### M-4 — No authentication on any endpoint

**File:** `server/src/app.ts` (all routes)

Any process with network access to the server port can call `/generate` and exhaust Ollama resources. The only protection is rate limiting by IP.

**Fix (minimum):** A shared secret via a header:

```typescript
app.use((req, res, next) => {
  if (req.headers['x-api-key'] !== process.env.API_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
});
```

Document that the server must not be exposed beyond localhost without this set.

---

## Low

### L-1 — Dependencies use caret versioning; no audit in CI

**File:** `package.json`, `server/package.json`, `client/package.json`

All packages use `^`, allowing minor-version drift. No automated vulnerability scanning is configured.

**Fix:** Add to CI:

```bash
npm audit --audit-level=moderate
```

Consider Dependabot or Renovate for automated update PRs.

---

### L-2 — No HTTPS configuration

**File:** `server/src/server.ts`

The server binds plain HTTP. Acceptable for localhost-only use; must not be exposed externally without TLS termination.

**Fix:** Document explicitly in README that external deployment requires a TLS-terminating reverse proxy (nginx, Caddy). Add a check that warns at startup if `NODE_ENV=production` and the listening address is not loopback.

---

### L-3 — Pino logger does not filter URL query parameters

**File:** `server/src/app.ts` lines 70–88

Request URLs are logged including query strings. If query parameters ever carry tokens or keys (future feature), they would appear in plaintext in log output.

**Fix:** Add a `customProps` or `serializers.req` override to strip known sensitive parameter names before logging.

---

## Remediation priority

| Phase | Items |
| --- | --- |
| Immediate | C-1, C-2, C-3, H-1 |
| Within 2 weeks | H-2, H-3, M-1, M-2 |
| Before any non-localhost deployment | M-3, M-4, L-2 |
| Ongoing | L-1, L-3 |
