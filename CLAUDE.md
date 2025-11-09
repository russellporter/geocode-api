# Project Instructions

## Releasing

To create a new release:

1. Update the version in `package.json` if needed
2. Commit and push any pending changes
3. Create a GitHub release (which creates and pushes the tag):
   ```bash
   gh release create v1.0.0 --generate-notes
   ```

   Or with custom notes:
   ```bash
   gh release create v1.0.0 --notes "Release notes here"
   ```

This will trigger the GitHub Actions release workflow which:
- Builds a Docker image
- Pushes it to GitHub Container Registry (ghcr.io)
- Tags the image with:
  - Full semver version (e.g., `1.0.0`)
  - Major.minor version (e.g., `1.0`)
  - Major version (e.g., `1`)
  - Git SHA (e.g., `sha-abc123`)
  - `latest` (if on main branch)

The Docker image will be available at:
```
ghcr.io/russellporter/geocode-api:1.0.0
ghcr.io/russellporter/geocode-api:latest
```
