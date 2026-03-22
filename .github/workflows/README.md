CI Workflows

This folder contains GitHub Actions workflows that run automated checks for the repository.

Current workflow
- `.github/workflows/ci.yml` — runs on push and pull requests to main/master and performs:
  - install dependencies
  - run repository linters (`npm run lint`)
  - build the server package

How to edit or extend
- Update or add workflows in `.github/workflows/`. Workflows use YAML and are executed by GitHub Actions.

Run checks locally
- Run linting locally from the repository root:
  - `npm run lint`
- Build the server locally (from repo root):
  - `cd server && npm ci && npm run build`

Best practices
- Keep workflows focused and fast. Use caching for dependencies when possible.
- When adding a new workflow, include a short README entry here describing purpose and triggers.

Where to find details
- Workflow definition: .github/workflows/ci.yml
