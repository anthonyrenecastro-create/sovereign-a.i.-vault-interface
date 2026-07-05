import { useState } from "react";
import { uploadIndexedDocument } from "../lib/api";
import type { LibraryItem } from "../lib/uiTypes";

interface Props {
  items: LibraryItem[];
  onAddItem: (item: LibraryItem) => void;
  onAsk: (question: string) => Promise<void>;
  lastAnswer: string;
}

export default function LibraryPage({ items, onAddItem, onAsk, lastAnswer }: Props) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [askDraft, setAskDraft] = useState("");

  const selected = items.find((item) => item.id === selectedId) || items[0];

  const onUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadBusy(true);
    setUploadStatus("");
    try {
      const content = await file.text();
      await uploadIndexedDocument({ file, sourceType: "library" });
      const newId = `${Date.now()}-${file.name}`;
      onAddItem({
        id: newId,
        title: file.name,
        sourceType: "library",
        createdAt: new Date().toISOString(),
        preview: content.slice(0, 4000),
      });
      setSelectedId(newId);
      setUploadStatus("Upload and indexing complete.");
    } catch (error) {
      setUploadStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploadBusy(false);
      event.target.value = "";
    }
  };

  const ask = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = askDraft.trim();
    if (!message) {
      return;
    }

    const analysisPrompt = selected
      ? [
          `Document title: ${selected.title}`,
          selected.preview ? `Document preview:\n${selected.preview.slice(0, 4000)}` : "Document preview: unavailable",
          "Answer the user's question using the document context above. Use a structured format with summary, key findings, and any caveats.",
          `User question: ${message}`,
        ].join("\n\n")
      : message;

    await onAsk(analysisPrompt);
    setAskDraft("");
  };

  return (
    <section className="feature-grid library-grid">
      <article className="dashboard-card">
        <h2>Library</h2>
        <p className="status-text">
          Upload a file to index it locally, then ask questions grounded in the extracted document text.
        </p>
        <input type="file" onChange={onUpload} />
        {uploadBusy && <p className="status-text">Uploading and indexing...</p>}
        {!uploadBusy && uploadStatus && <p className="status-text">{uploadStatus}</p>}
        <ul className="simple-list library-list">
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => setSelectedId(item.id)}>
                {item.title}
              </button>
            </li>
          ))}
          {items.length === 0 && <li className="status-text">No documents uploaded yet.</li>}
        </ul>
      </article>

      <article className="dashboard-card">
        <h2>Preview</h2>
        {selected ? (
          <>
            <p className="status-text">{selected.title}</p>
            <pre className="terminal-output terminal-output-large">{selected.preview || "No preview available."}</pre>
          </>
        ) : (
          <p className="status-text">Select a document to preview.</p>
        )}
      </article>

      <article className="dashboard-card">
        <h2>Ask Questions On Documents</h2>
        <p className="status-text">
          The selected document preview is injected into the prompt so the answer can be more
          grounded and structured.
        </p>
        <form onSubmit={ask} className="composer">
          <textarea
            value={askDraft}
            onChange={(event) => setAskDraft(event.target.value)}
            placeholder="Ask a question grounded in your indexed library..."
            rows={3}
          />
          <button type="submit" disabled={!askDraft.trim()}>
            Ask
          </button>
        </form>
        <pre className="terminal-output terminal-output-large analysis-output">
          {lastAnswer || "Answer output will appear here."}
        </pre>
      </article>
    </section>
  );
}
