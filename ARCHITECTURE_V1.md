# Sovereign Vault Architecture v1

## Source-of-Truth Folders

Live production paths:

- `frontend/`
- `backend/`
- `portable-kit/`
- `tools/emergency_console/`

Archive/reference-only paths:

- `extracted/`
- duplicated generated thumbdrive reference snapshots

## Runtime Path (Main Product)

Deterministic app path:

- Backend API: `http://127.0.0.1:8000`
- Frontend UI: `http://127.0.0.1:5173`
- Ollama runtime: `http://127.0.0.1:11434`
- Emergency console: optional separate Streamlit app under `tools/emergency_console/`

Execution flow:

1. Browser sends requests to frontend.
2. Frontend calls backend API.
3. Backend routes inference/embeddings to local Ollama.
4. Retrieval uses backend index services and local embedding model.

## Portable USB Flow v1

Deterministic stages:

1. `build`
2. `verify`
3. `export`
4. `deploy`
5. `launch`

Primary orchestrator:

- `portable-kit/scripts/flow_v1.sh`

Examples:

```bash
cd portable-kit
./scripts/flow_v1.sh build --bundle-dir /tmp/sovereign-thumbdrive --model-source ~/.ollama/models --require-model-gb 12
./scripts/flow_v1.sh verify --bundle-dir /tmp/sovereign-thumbdrive --require-model-gb 12
./scripts/flow_v1.sh export --bundle-dir /tmp/sovereign-thumbdrive --export-dir /tmp
./scripts/flow_v1.sh deploy --export-dir /tmp --target-dir /tmp/sovereign-thumbdrive-target --require-model-gb 12
./scripts/flow_v1.sh launch
```

## Validation Benchmarks v1

Required checks:

- Runtime ports: `8000`, `5173`, `11434`
- Ollama path: direct model prompt succeeds
- Retrieval path: index + semantic search succeeds
- USB flow: build/verify/export/deploy completes

Quick checks:

```bash
cd portable-kit
./scripts/flow_v1.sh runtime
./scripts/flow_v1.sh ollama
./scripts/flow_v1.sh retrieval
```
