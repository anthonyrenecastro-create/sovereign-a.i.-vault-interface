# Thumb Drive Layout Template

This template mirrors the portable Sovereign Vault structure required for a 64 GB deployment profile.

- `app/`: full Sovereign app and launch tooling
- `models/`: Ollama model payloads or model manifests
- `data/system/`: system metadata and runtime state
- `data/vector/`: vector index payloads
- `data/documents/`: local knowledge/document packs
- `data/conversations/`: chat/session artifacts
- `data/exports/`: generated exports and replication bundles
- `data/logs/`: logs and diagnostics
- `cache/`: temporary runtime, PID, and transient files

Build a complete runnable bundle with:

```bash
cd portable-kit
./scripts/build_thumbdrive_bundle.sh
```
