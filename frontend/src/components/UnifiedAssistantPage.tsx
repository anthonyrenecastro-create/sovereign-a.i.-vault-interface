import { useMemo, useState } from "react";
import type { AssistantProfile, Turn } from "../lib/api";

interface Props {
  assistants: AssistantProfile[];
  activeId: string;
  onSelectAssistant: (id: string) => void;
  turns: Turn[];
  busy: boolean;
  onSend: (message: string) => Promise<void>;
  onAttachFiles: (files: FileList) => Promise<void>;
  attachedFiles: string[];
  retrievedContext: string[];
  activeModel: string;
}

export default function UnifiedAssistantPage({
  assistants,
  activeId,
  onSelectAssistant,
  turns,
  busy,
  onSend,
  onAttachFiles,
  attachedFiles,
  retrievedContext,
  activeModel,
}: Props) {
  const [draft, setDraft] = useState("");
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachStatus, setAttachStatus] = useState("");

  const activeAssistant = useMemo(
    () => assistants.find((item) => item.id === activeId),
    [assistants, activeId]
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) {
      return;
    }
    setDraft("");
    await onSend(message);
  };

  const attach = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setAttachBusy(true);
    setAttachStatus("");
    try {
      await onAttachFiles(files);
      setAttachStatus(`Indexed ${files.length} attachment${files.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setAttachStatus(error instanceof Error ? error.message : "Attachment indexing failed.");
    } finally {
      setAttachBusy(false);
      event.target.value = "";
    }
  };

  return (
    <section className="feature-grid assistant-grid">
      <article className="dashboard-card">
        <h2>Assistant Selector</h2>
        <select value={activeId} onChange={(event) => onSelectAssistant(event.target.value)}>
          {assistants.map((assistant) => (
            <option key={assistant.id} value={assistant.id}>
              {assistant.name}
            </option>
          ))}
        </select>
        <p className="status-text">{activeAssistant?.description || "Select a mode"}</p>
        <p className="status-text">Execution path: browser to backend api to local ollama runtime</p>
        <p className="status-text">Active served model: {activeModel}</p>

        <label className="status-text">Attach files for retrieval context</label>
        <input type="file" multiple onChange={attach} />
        {attachBusy && <p className="status-text">Indexing attachments...</p>}
        {!attachBusy && attachStatus && <p className="status-text">{attachStatus}</p>}
        {attachedFiles.length > 0 && (
          <ul className="simple-list">
            {attachedFiles.map((name, idx) => (
              <li key={`${name}-${idx}`}>{name}</li>
            ))}
          </ul>
        )}
      </article>

      <article className="dashboard-card">
        <h2>Unified Chat Workspace</h2>
        <p className="status-text">
          Responses are shown in a larger scrollable transcript so longer local reasoning stays visible.
        </p>
        <div className="chat-log">
          {turns.map((turn, index) => (
            <article key={`${turn.role}-${index}`} className={`bubble ${turn.role}`}>
              <span className="bubble-role">{turn.role}</span>
              <p>{turn.content}</p>
            </article>
          ))}
          {busy && <p className="thinking">Backend api is requesting local Ollama inference...</p>}
        </div>

        <form onSubmit={submit} className="composer composer-expanded">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask the selected assistant..."
            rows={5}
          />
          <button type="submit" disabled={busy || !draft.trim()}>
            Send
          </button>
        </form>

        {retrievedContext.length > 0 && (
          <aside className="retrieval-box">
            <h4>Retrieved Local Context</h4>
            <ul>
              {retrievedContext.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </aside>
        )}
      </article>
    </section>
  );
}
