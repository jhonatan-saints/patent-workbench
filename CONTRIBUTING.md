Contributing to Patent Workbench

Thank you for your interest in contributing. This project intentionally
separates public components (UI, utilities, generic templates) from
proprietary enterprise artifacts (REG algorithm and company templates).
Please follow these guidelines to keep the public repository license‑clean.

1. Licensing
- Public code is licensed under Apache-2.0. Do not add proprietary
  code or secrets to the public repo.

1. Contribution flow
- Open focused, small PRs that include tests and linting updates.
- Describe the change, rationale, and any migration steps in the PR body.

1. Proprietary/artifact separation
- Do NOT add the REG algorithm or company-specific templates to this
  repository. If a change depends on proprietary artifacts, open an
  issue first to discuss how to provide a public fallback or an API
  shim that keeps private code out of the public tree.
- If you must reference private packages, add clear comments and
  feature flags; use dependency injection so public tests do not require
  the private package.

1. Accepting contributions
- We accept PRs that only touch public components. If a PR touches or
  references proprietary systems, maintainers will request a design or
  an issue linking to a private implementation.
- A Contributor License Agreement (CLA) may be required for major
  contributions—maintainers will request it when necessary.

1. Security and sensitive data
- Never commit credentials, API keys, or model weights. Use secrets
  management in CI and local `.env` files kept out of source control.

1. Communication
- For roadmap or enterprise integration questions, open an issue or
  contact the maintainers directly.

Thanks! We review PRs regularly—small, focused changes are fastest to land.
