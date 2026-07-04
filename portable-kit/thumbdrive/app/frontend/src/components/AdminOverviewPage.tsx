import { useState } from "react";
import { getAdminDiagnostics, getIndexStats, runAdminShell, verifyAdmin } from "../lib/api";

interface Props {
  legacyToken: string;
  onLegacyTokenChange: (token: string) => void;
}

export default function AdminOverviewPage({ legacyToken, onLegacyTokenChange }: Props) {
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusOutput, setStatusOutput] = useState("No status data loaded.");

  const unlock = async () => {
    setBusy(true);
    try {
      const ok = await verifyAdmin({ legacyToken });
      setVerified(ok);
      setStatusOutput(ok ? "Admin session unlocked." : "Invalid token.");
    } catch (err) {
      setStatusOutput(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (!verified) {
      setStatusOutput("Unlock admin mode first.");
      return;
    }

    setBusy(true);
    try {
      const [models, running, disk, stats, diag] = await Promise.all([
        runAdminShell({ command: "ollama list", legacyToken }),
        runAdminShell({ command: "ollama ps", legacyToken }),
        runAdminShell({ command: "df -h .", legacyToken }),
        getIndexStats(),
        getAdminDiagnostics({ legacyToken }),
      ]);

      setStatusOutput(
        [
          "Diagnostics API:",
          JSON.stringify(diag, null, 2),
          "",
          "Ollama Model List:",
          models.stdout || "(none)",
          "",
          "Ollama Running Models:",
          running.stdout || "(none)",
          "",
          "Disk Usage:",
          disk.stdout || "(none)",
          "",
          "Indexing Jobs / Storage Summary:",
          `documents=${stats.total_documents} chunks=${stats.total_chunks} vectorized=${stats.vectorized_chunks}`,
        ].join("\n")
      );
    } catch (err) {
      setStatusOutput(err instanceof Error ? err.message : "Failed to fetch admin status");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="feature-grid">
      <article className="dashboard-card">
        <h2>Admin</h2>
        <div className="admin-controls">
          <input
            type="password"
            placeholder="Legacy admin token"
            value={legacyToken}
            onChange={(event) => onLegacyTokenChange(event.target.value)}
          />
          <button type="button" onClick={unlock} disabled={busy || !legacyToken.trim()}>
            Unlock
          </button>
          <button type="button" onClick={refresh} disabled={busy || !verified}>
            {busy ? "Refreshing..." : "Refresh Status"}
          </button>
        </div>
        <p className="status-text">
          Required view: Ollama status, model list, indexing jobs, and disk usage.
        </p>
      </article>

      <article className="dashboard-card">
        <h2>Admin Output</h2>
        <pre className="terminal-output">{statusOutput}</pre>
      </article>
    </section>
  );
}
