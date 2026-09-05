# Project Instructions

## Development

- Use Node.js 24.12 or newer.
- Run `npm run check-types` before committing TypeScript changes.
- Run `npm test` to build and execute the Node test suites.

## Releasing

Every push to `main` runs the release workflow. It:

- Builds a Docker image
- Pushes it to GitHub Container Registry (ghcr.io)
- Tags the image with:
  - The package version and unique build number (e.g., `1.1.0-build.42`)
  - `main`
  - Git SHA (e.g., `sha-abc123`)
  - `latest`
- Creates a GitHub release with generated release notes

The Docker image will be available at:
```
ghcr.io/russellporter/geocode-api:1.1.0-build.42
ghcr.io/russellporter/geocode-api:latest
```
