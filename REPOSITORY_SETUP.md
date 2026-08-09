# Repository import notes

This archive is intended to be extracted into the existing Osmium GitHub
repository. It deliberately omits `LICENSE` because that repository already has
the GPL version 3 license selected by the project owner.

Before publishing:

1. Extract the archive at the repository root without deleting the existing
   `LICENSE` file.
2. Replace the placeholder repository URL in `README.md`'s clone command.
3. If the GitHub owner or repository name differs from `RedGale7/osmium`, update
   the CI badge URL near the top of `README.md`.
4. Enable **GitHub Actions** for CI and **Private vulnerability reporting** for
   the workflow described in `SECURITY.md`.
5. Add a real Sites project ID to `.openai/hosting.json` only in the deployment
   environment. The included file is intentionally unbound.

