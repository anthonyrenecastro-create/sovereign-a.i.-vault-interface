# Sovereign Vault Portable Deployment Kit

This folder is designed to run from a USB flash drive as an offline-first, online-assisted deployment package.

## What This Kit Covers

- Unified web interface and backend orchestration
- Persona profile templates for Re-Genesis, Aetherium, Amaterasu, and PowerCoder-Z
- Retrieval and indexing persistence
- Ollama setup/check/pull logic
- Hardware checks and minimum-memory mode
- Portable runtime folders (logs, exports, workspace, data, models)
- One-click startup/shutdown wrappers
- Update, repair, and replication workflows

## Thumb Drive Layout (In Repo)

This repository now includes a thumb-drive layout template at `portable-kit/thumbdrive-template`:

- `app/`: frontend, backend, launcher, configs
- `models/`: Ollama model payloads/manifests
- `data/system/`: runtime state, settings, metadata
- `data/vector/`: retrieval vector indexes
- `data/documents/`: local source documents and archives
- `data/conversations/`: chat/session artifacts
- `data/exports/`: generated exports
- `data/logs/`: diagnostics and service logs
- `cache/`: temp runtime files and PID state

Build a full portable bundle directly in this repo:

```bash
./scripts/build_thumbdrive_bundle.sh --model-source ~/.ollama/models --require-model-gb 20
```

This creates `portable-kit/thumbdrive` with full app payload plus seeded knowledge sources.

If `--knowledge-source` is not provided, the builder auto-seeds from `extracted/` and root `*.zip` archives.

## Import Pre-Zipped Model Archive (Container-Friendly)

If your model files are not directly visible inside the container, drop a model archive into `portable-kit/model-archives/`.

Then import it into the bundle models folder:

```bash
./scripts/import_model_archive.sh --require-gb 20
```

Optional explicit archive path:

```bash
./scripts/import_model_archive.sh --archive ./model-archives/ollama-models-20gb.tar.xz --require-gb 20
```

Default destination is `portable-kit/thumbdrive/models/ollama-models`.

## Automatic Startup Behavior

`./START-SOVEREIGN.sh` now performs the full startup path automatically:

- Detects hardware tier (`micro-pc` or `high-compute`) from CPU/RAM
- Initializes runtime directories and local document workspace
- Activates assistant profile file from template
- Connects to local Ollama if installed, or attempts auto-install when online
- Starts backend/frontend and opens browser UI
- Auto-indexes local documents folder into retrieval (`runtime/workspace/documents`)

Tier state is persisted in `runtime/runtime.env` and surfaced in admin diagnostics.

## Portable Source + Local Runtime (Recommended)

Use the USB as installer/updater/recovery, while running the node from Micro-PC SSD.

Install local runtime node on SSD:

```bash
./scripts/install_local_runtime.sh --target "$HOME/sovereign-vault-node"
```

Launch/shutdown local SSD runtime:

```bash
./scripts/launch_local_runtime.sh --target "$HOME/sovereign-vault-node"
./scripts/shutdown_local_runtime.sh --target "$HOME/sovereign-vault-node"
```

Update local runtime from USB package:

```bash
./scripts/update_local_runtime.sh --target "$HOME/sovereign-vault-node"
```

Backup and recover local runtime data via USB:

```bash
./scripts/backup_local_runtime.sh --target "$HOME/sovereign-vault-node"
./scripts/recover_local_runtime.sh --target "$HOME/sovereign-vault-node" --backup ./portable-kit/runtime/backups/node-backup-YYYYMMDD-HHMMSS
```

## Runtime Folder Layout

- `runtime/logs`: backend/frontend logs
- `runtime/pids`: service pid files
- `runtime/exports`: replication bundles
- `runtime/workspace`: local operator workspace
- `runtime/data`: retrieval/user/audit local data
- `runtime/models`: optional model cache staging
- `runtime/tmp`: temporary files

## First-Run Bootstrap

From USB-mounted project root:

```bash
cd portable-kit
chmod +x START-SOVEREIGN.sh STOP-SOVEREIGN.sh scripts/*.sh
./scripts/bootstrap.sh --install-ollama
./scripts/launch.sh
```

## One-Command Field Installer

Run bootstrap + launch + health checks with a final PASS/FAIL report:

```bash
./scripts/field_installer.sh
```

Optional flags:

```bash
./scripts/field_installer.sh --install-ollama
./scripts/field_installer.sh --skip-model-pull
./scripts/field_installer.sh --no-browser
```

If internet is unavailable, skip model pulling and bootstrap still prepares a minimum node:

```bash
./scripts/bootstrap.sh --skip-model-pull
./scripts/launch.sh
```

## Offline Field Runtime

- Uses local-only defaults (`SOVEREIGN_LOCAL_ONLY=1`)
- Uses local Ollama endpoint (`OLLAMA_BASE_URL=http://127.0.0.1:11434`)
- Retrieval/user/audit data persisted under `portable-kit/runtime/data`

## Model Check and Pull Logic

Check model readiness:

```bash
./scripts/model_manager.sh status
```

Pull missing models when internet is available:

```bash
./scripts/model_manager.sh pull
```

Pull a specific model tag (example):

```bash
./scripts/model_manager.sh pull-model gemma3:4b --install
```

If your local registry uses a different tag, replace `gemma3:4b` with the exact model name.

Install Ollama and pull (if CLI missing and internet available):

```bash
./scripts/model_manager.sh pull --install
```

Prepare a strict 20 GB model payload for the bundle:

```bash
./scripts/build_thumbdrive_bundle.sh --model-source ~/.ollama/models --require-model-gb 20
```

If your workspace filesystem is constrained, build to `/tmp` (example 12 GB threshold):

```bash
./scripts/build_thumbdrive_bundle.sh --output /tmp/sovereign-thumbdrive --model-source ~/.ollama/models --require-model-gb 12
```

Export/import Ollama model store for flash-drive replication:

```bash
./scripts/model_pack.sh export
./scripts/model_pack.sh import --source ./portable-kit/runtime/models/ollama-models --dest ~/.ollama/models
```

Create a single transferable archive from an existing thumbdrive bundle:

```bash
./scripts/replicate_export.sh thumbdrive --source /tmp/sovereign-thumbdrive --output-dir /tmp
```

Use `--compress` to create a `.tgz` archive instead of `.tar`.

Verify a built bundle folder or exported archive before transfer:

```bash
./scripts/verify_thumbdrive_bundle.sh --bundle-dir /tmp/sovereign-thumbdrive --require-model-gb 12 --require-models
./scripts/verify_thumbdrive_bundle.sh --archive /tmp/sovereign-thumbdrive-YYYYMMDD-HHMMSS.tar --require-models
```

Deploy on target machine from a transferred archive (verify + extract + bootstrap/launch):

```bash
./scripts/deploy_from_thumbdrive_archive.sh --archive /path/to/sovereign-thumbdrive-YYYYMMDD-HHMMSS.tar --target "$HOME/sovereign-node" --no-browser
```

Offline-safe extract/bootstrap only:

```bash
./scripts/deploy_from_thumbdrive_archive.sh --archive /path/to/sovereign-thumbdrive-YYYYMMDD-HHMMSS.tar --target "$HOME/sovereign-node" --extract-only
./scripts/deploy_from_thumbdrive_archive.sh --archive /path/to/sovereign-thumbdrive-YYYYMMDD-HHMMSS.tar --target "$HOME/sovereign-node" --no-launch
```

## Hardware Tier and Minimum-Memory Mode

Generate hardware report:

```bash
./scripts/hardware_check.sh
```

Bootstrap auto-selects capability tier and minimum-memory mode:

- Under 8 GB RAM: minimum-memory mode enabled
- Under 16 GB RAM or fewer than 8 CPU cores: `micro-pc` tier
- Otherwise: `high-compute` tier

Tier and mode are written to `runtime/runtime.env`.

## Launch and Shutdown

One-click style wrappers:

```bash
./START-SOVEREIGN.sh
./STOP-SOVEREIGN.sh
```

Or explicit control:

```bash
./scripts/launch.sh
./scripts/shutdown.sh
```

## Update and Repair

Apply update payloads from `portable-kit/updates`:

```bash
./scripts/update.sh
```

Repair broken runtime/dependencies/services:

```bash
./scripts/repair.sh
```

## Migration and Replication

Create a replication tarball for another micro-PC/site:

```bash
./scripts/replicate_export.sh
```

Then transfer the generated archive from `runtime/exports` to the next unit and unpack.

## Notes

- This kit cannot embed Ollama binaries or models unless they are available at bootstrap time.
- If Ollama is unavailable, core UI/backend still launch; chat/model operations will show actionable diagnostics.
- For true multi-device parity, copy `runtime/data` and keep auth/admin secrets aligned per deployment policy.
