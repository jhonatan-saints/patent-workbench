Private artifacts and on‑prem packaging

This document explains recommended approaches to keep the REG algorithm
and enterprise templates private while the rest of the project remains
open under Apache-2.0.

Recommended patterns

1. Private npm package (recommended)
- Publish `@your-scope/reg-algo` and `@your-scope/company-templates` to a
  private npm registry (GitHub Packages, GitLab, Nexus, Verdaccio).
- In the public repo, declare them as optional or peer dependencies and
  provide a public shim/fallback so the project builds without the
  private packages.

1. Git submodule or separate private repository
- Keep `reg-algo/` and `company-templates/` in a private repo. Add them
  as a submodule in an internal monorepo or clone them during internal CI.

1. Monorepo workspace with private workspaces
- Use Yarn/PNPM workspaces and keep private packages out of the public
  workspace. Internal deployments use the private workspace; public CI
  runs without it.

Security and operational notes
- Use `.npmrc` and environment variables to store registry credentials
  in CI; never check tokens into source control.
- Protect private repos with strict access control and audit logs.
- Consider signed license files for air‑gapped installs: the app checks
  for a signed license file before enabling proprietary features.

Developer workflow (example)
- Public contributors work on UI and generic templates in this repo.
- Internal engineers maintain a private repo with `reg-algo` and
  `company-templates` and publish to the private registry.
- Internal CI composes the final on‑prem build (containers or bundles)
  that include private artifacts and a commercial EULA.

Deployment
- Provide a containerized installer (Docker compose / Helm) for on‑prem
  customers, with configuration to point to internal model weights and
  compute resources.

Legal & license
- Keep EULA and license enforcement materials in the private repo and
  ensure customers sign the EULA before receiving private packages.

Contact
- For internal packaging templates and scripts used by your company,
  create a `private/ops` folder in the private repo and document CI/CD
  steps there.
