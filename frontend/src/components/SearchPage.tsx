import { useState } from "react";
import { searchIndex, type IndexSearchResult } from "../lib/api";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"semantic" | "keyword">("keyword");
  const [results, setResults] = useState<IndexSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = query.trim();
    if (!clean) {
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await searchIndex({ query: clean, mode, top_k: 8 });
      setResults(response.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setResults([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="feature-grid">
      <article className="dashboard-card">
        <h2>Search</h2>
        <p className="status-text">
          Keyword search is the fastest way to surface the local knowledge base. Use semantic mode
          when you want fuzzier matching.
        </p>
        <form onSubmit={run} className="admin-controls">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search indexed local content"
          />
          <select value={mode} onChange={(event) => setMode(event.target.value as "semantic" | "keyword")}>
            <option value="semantic">Semantic Search</option>
            <option value="keyword">Keyword Search</option>
          </select>
          <button type="submit" disabled={busy || !query.trim()}>
            {busy ? "Searching..." : "Run Search"}
          </button>
        </form>
        {error && <p className="error-banner">{error}</p>}
      </article>

      <article className="dashboard-card">
        <h2>Results</h2>
        <div className="search-results">
          {results.map((result, idx) => (
            <article key={`${result.fingerprint}-${idx}`} className="result-card">
              <strong>{result.title}</strong>
              <p className="status-text">source: {result.source_type} | {result.indexed_at}</p>
              <p>{result.content}</p>
            </article>
          ))}
          {results.length === 0 && (
            <p className="status-text">No results yet. Try keyword mode or index a document first.</p>
          )}
        </div>
      </article>
    </section>
  );
}
