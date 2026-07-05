# Production Source Of Truth

This repository has both live runtime code and archived reference material.

## Live Production Folders

These are authoritative for runtime behavior and deployment:

- `frontend/`
- `backend/`
- `portable-kit/`
- `tools/emergency_console/`

## Archive / Reference-Only Folders

These are non-production and must not be imported by runtime logic:

- `extracted/`
- duplicated thumbdrive reference payloads from older generated bundles

## Hard Rules

- Do not import application modules from `extracted/`.
- Do not treat files under generated thumbdrive app payloads as development source.
- Use `frontend/`, `backend/`, and `portable-kit/` as the only runtime code paths.

## Packaging Guidance

- `portable-kit/scripts/build_thumbdrive_bundle.sh` is the source for generating deployable payloads.
- Archive/reference assets may be copied only as documents (for retrieval seeding), not as executable app source.