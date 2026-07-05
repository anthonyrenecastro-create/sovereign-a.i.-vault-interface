# Sovereign Vault Unified Interface (Ollama Edition)

This repository now contains a unified offline-first platform that merges the strongest patterns from Aetherium, Amaterasu, PowerCoder-Z, and Re-Genesis into one system.

## Production Source Of Truth

Live production folders:

- `frontend/`
- `backend/`
- `portable-kit/`
- `tools/emergency_console/`

Archive/reference-only folders:

- `extracted/`
- duplicated thumbdrive reference payloads from generated bundles

See `SOURCE_OF_TRUTH.md` for policy details.

## v1 Architecture Lock

Runtime path is fixed to:

- Backend API: `127.0.0.1:8000`
- Frontend UI: `127.0.0.1:5173`
- Ollama runtime: `127.0.0.1:11434`
- Emergency console: optional separate app under `tools/emergency_console/`

Detailed stack and deterministic workflow are documented in `ARCHITECTURE_V1.md`.

## What Changed

- Replaced cloud Gemini coupling with a local orchestration API that routes to Ollama.
- Unified user experience into four assistant modes in one web app:
  - Re-Genesis: primary multi-tool workspace.
  - Aetherium: concise dashboards and quick insights.
  - Amaterasu: document-centered reasoning workflows.
  - PowerCoder-Z: admin/operator workflows.
- Added local retrieval indexing to support document-grounded responses.
- Added hybrid vector retrieval with local Ollama embeddings.
- Added role-based authentication (multi-user) for privileged operations.
- Added file ingestion endpoints for PDF, DOCX, and CSV parsing workflows.

## Architecture

- Frontend: React + Vite single interface with mode cards and shared chat workspace.
- Backend: FastAPI service handling:
  - Assistant profile orchestration.
  - Prompt routing and model selection.
  - Hybrid retrieval context injection (vector + lexical).
  - Admin-gated file/shell operations with role-based auth.
  - File upload ingestion pipeline for structured document formats.
- Model Runtime: Ollama on host machine (`http://127.0.0.1:11434` by default).

## Project Layout

- `frontend/`: unified web interface.
- `backend/`: local API and orchestration layer.
- `tools/emergency_console/`: optional Streamlit field console for Kiwix + Ollama emergency workflows.
- `portable-kit/`: USB-ready deployment kit with bootstrap/launch/repair/update/replication scripts.

## Sovereign Vault Portable Deployment Kit

Use this when deploying to field micro-PCs from a flash drive.

### Portable Source + Local Runtime

Recommended field pattern:

- USB carries installer/update/recovery package.
- Install node runtime onto Micro-PC SSD for speed and durability.
- Keep USB for updates, backups, model packs, and replication.

Example:

```bash
cd portable-kit
./scripts/install_local_runtime.sh --target "$HOME/sovereign-vault-node"
./scripts/launch_local_runtime.sh --target "$HOME/sovereign-vault-node"
```

Build an in-repo thumb-drive bundle with your requested layout and a strict model payload requirement:

```bash
cd portable-kit
./scripts/build_thumbdrive_bundle.sh --model-source ~/.ollama/models --require-model-gb 20
```

Output bundle path: `portable-kit/thumbdrive`

If the workspace filesystem is tight (for example in dev containers), build to `/tmp` instead:

```bash
cd portable-kit
./scripts/build_thumbdrive_bundle.sh --output /tmp/sovereign-thumbdrive --model-source ~/.ollama/models --require-model-gb 12
```

If model files are not directly accessible from the current shell/container, drop a pre-zipped model archive into `portable-kit/model-archives/` and import with:

```bash
cd portable-kit
./scripts/import_model_archive.sh --require-gb 20
```

Create one transferable archive from a built thumbdrive bundle:

```bash
cd portable-kit
./scripts/replicate_export.sh thumbdrive --source /tmp/sovereign-thumbdrive --output-dir /tmp
```

Verify bundle integrity before transfer:

```bash
cd portable-kit
./scripts/verify_thumbdrive_bundle.sh --bundle-dir /tmp/sovereign-thumbdrive --require-model-gb 12 --require-models
./scripts/verify_thumbdrive_bundle.sh --archive /tmp/sovereign-thumbdrive-YYYYMMDD-HHMMSS.tar --require-models
```

Target machine deployment from transferred archive:

```bash
cd portable-kit
./scripts/deploy_from_thumbdrive_archive.sh --archive /path/to/sovereign-thumbdrive-YYYYMMDD-HHMMSS.tar --target "$HOME/sovereign-node" --no-browser
```

For strict offline handoff, run extract/bootstrap without model pulls:

```bash
cd portable-kit
./scripts/deploy_from_thumbdrive_archive.sh --archive /path/to/sovereign-thumbdrive-YYYYMMDD-HHMMSS.tar --target "$HOME/sovereign-node" --no-launch
```

### First-run bootstrap

```bash
cd portable-kit
chmod +x START-SOVEREIGN.sh STOP-SOVEREIGN.sh scripts/*.sh
./scripts/bootstrap.sh --install-ollama
./scripts/launch.sh
```

Offline-first bootstrap (no internet/model pull):

```bash
./scripts/bootstrap.sh --skip-model-pull
./scripts/launch.sh
```

### Operations

```bash
./scripts/hardware_check.sh
./scripts/model_manager.sh status
./scripts/model_manager.sh pull
./scripts/repair.sh
./scripts/update.sh
./scripts/replicate_export.sh
./scripts/shutdown.sh
```

`./START-SOVEREIGN.sh` automatically detects host tier (`micro-pc` vs `high-compute`), initializes runtime folders, activates assistant profiles, connects/installs Ollama when possible, enables local-document retrieval indexing, and launches the web interface.

## Quick Start

### 1) Run Ollama locally

Install and start Ollama on the Sovereign Vault host machine, then pull models:

```bash
ollama pull gemma4:2b
ollama pull qwen2.5:7b
ollama pull qwen2.5-coder:7b
ollama pull nomic-embed-text
```

### 2) Start Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3) Start Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev -- --host 0.0.0.0 --port 5173
```

Open from local network browser:

- `http://<host-ip>:5173`

### 4) Optional Emergency Console (Streamlit)

This optional module is useful for field operators who need a focused emergency UX with Kiwix lookup and emergency Q/A.
It supports two AI routes:

- Preferred: route through the unified Sovereign API orchestrator at `http://<host-ip>:8000`.
- Fallback: direct Ollama access at `http://<host-ip>:11434`.

When routed through Sovereign API, the console can auto-index loaded Kiwix articles into backend retrieval so responses can blend Kiwix evidence with previously indexed local documents.
It also supports direct PDF/DOCX/CSV upload ingestion into the same local index.

```bash
cd tools/emergency_console
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py --server.address 0.0.0.0 --server.port 8501
```

Open from local network browser:

- `http://<host-ip>:8501`

## Key API Endpoints

- `GET /api/health`
- `GET /api/assistants`
- `POST /api/chat`
- `POST /api/index/document`
- `POST /api/index/path`
- `POST /api/index/upload` (PDF/DOCX/CSV)
- `GET /api/index/stats`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/auth/users` (admin)
- `POST /api/auth/users` (admin)
- `GET /api/auth/audit` (admin)
- `POST /api/admin/verify`
- `POST /api/admin/files/list?token=...`
- `POST /api/admin/files/read?token=...`
- `POST /api/admin/shell/run?token=...`

## Security Model

- General users: chat, retrieval, summaries, and document reasoning.
- Operator capabilities require bearer auth with role `operator` or `admin`.
- User management requires role `admin`.
- Legacy `SOVEREIGN_ADMIN_TOKEN` support is retained for compatibility during migration.
- Rotate auth secret and bootstrap admin credentials before production.

## Notes

- Retrieval is hybrid semantic + lexical (Ollama embeddings plus term overlap).
- Retrieval state (chunks + document fingerprints) is persisted to `backend/data/retrieval_state.json` for duplicate prevention across restarts.
- Account mutation audit events are persisted to `backend/data/auth_audit.json` for governance traceability.
- Indexed documents now carry `source_type`, `source_id`, and `indexed_at` metadata.
- Chat retrieval can be filtered by source using `retrieval_source_types` in `POST /api/chat`.
- This baseline is designed for the single-device pilot architecture and LAN access.
- You can evolve retrieval to embedding/vector search while preserving the same API contract.
- The Streamlit emergency console is intentionally optional and can coexist with the unified React interface on the same host machine.
