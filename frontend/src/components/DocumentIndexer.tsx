import { useState } from "react";
import { indexDocument } from "../lib/api";

export default function DocumentIndexer() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanContent = content.trim();
    if (!cleanTitle || !cleanContent) {
      setStatus("Provide both title and content.");
      return;
    }

    try {
      await indexDocument(cleanTitle, cleanContent);
      setStatus("Indexed successfully.");
      setTitle("");
      setContent("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Indexing failed");
    }
  };

  return (
    <section className="indexer-shell">
      <header className="panel-header">
        <h2>Local Knowledge Index</h2>
      </header>
      <form onSubmit={onSubmit} className="indexer-form">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Document title"
        />
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={6}
          placeholder="Paste local text to make it available to retrieval"
        />
        <button type="submit">Index Document</button>
      </form>
      {status && <p className="status-text">{status}</p>}
    </section>
  );
}
