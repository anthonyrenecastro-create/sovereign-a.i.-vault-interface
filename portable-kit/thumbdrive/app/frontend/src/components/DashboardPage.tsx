import { useEffect, useState } from "react";
import { getApiBase, getHealth, getIndexStats, type IndexStats } from "../lib/api";

interface Props {
  activeAssistantName: string;
  activeModel: string;
  onQuickAction: (target: "assistant" | "library" | "search" | "admin") => void;
}

export default function DashboardPage({ activeAssistantName, activeModel, onQuickAction }: Props) {
  const [health, setHealth] = useState("unknown");
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [h, s] = await Promise.all([getHealth(), getIndexStats()]);
      setHealth(h.status);
      setStats(s);
    } catch {
      setHealth("offline");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section className="feature-grid">
      <article className="dashboard-card">
        <h2>System Status</h2>
        <div className="metric-list">
          <article>
            <span>Backend</span>
            <strong>{health}</strong>
          </article>
          <article>
            <span>Inference Route</span>
            <strong>{health === "ok" ? "backend api -> ollama" : "unavailable"}</strong>
          </article>
          <article>
            <span>Storage Chunks</span>
            <strong>{stats?.total_chunks ?? 0}</strong>
          </article>
          <article>
            <span>Active Assistant</span>
            <strong>{activeAssistantName}</strong>
          </article>
          <article>
            <span>Active Served Model</span>
            <strong>{activeModel}</strong>
          </article>
        </div>
      </article>

      <article className="dashboard-card">
        <h2>Storage</h2>
        <div className="metric-list">
          <article>
            <span>Total Documents</span>
            <strong>{stats?.total_documents ?? 0}</strong>
          </article>
          <article>
            <span>Vectorized Chunks</span>
            <strong>{stats?.vectorized_chunks ?? 0}</strong>
          </article>
          <article>
            <span>Embedding Model</span>
            <strong>{stats?.embedding_model ?? "n/a"}</strong>
          </article>
          <article>
            <span>Backend API Base</span>
            <strong>{getApiBase()}</strong>
          </article>
        </div>
      </article>

      <article className="dashboard-card">
        <h2>Quick Actions</h2>
        <div className="quick-actions">
          <button type="button" onClick={() => onQuickAction("assistant")}>Open Unified Assistant</button>
          <button type="button" onClick={() => onQuickAction("library")}>Open Library</button>
          <button type="button" onClick={() => onQuickAction("search")}>Open Search</button>
          <button type="button" onClick={() => onQuickAction("admin")}>Open Admin</button>
          <button type="button" onClick={() => void refresh()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh Status"}
          </button>
        </div>
      </article>
    </section>
  );
}
