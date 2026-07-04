import { useMemo, useState } from "react";
import type { Turn } from "../lib/api";

interface Props {
  activeAssistantName: string;
  turns: Turn[];
  onSend: (message: string) => Promise<void>;
  busy: boolean;
  retrievedContext: string[];
}

export default function ChatPanel({ activeAssistantName, turns, onSend, busy, retrievedContext }: Props) {
  const [draft, setDraft] = useState("");

  const orderedTurns = useMemo(() => turns.filter((turn) => turn.role !== "system"), [turns]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) {
      return;
    }
    setDraft("");
    await onSend(message);
  };

  return (
    <section className="chat-shell">
      <header className="panel-header">
        <h2>{activeAssistantName} Mode</h2>
      </header>

      <div className="chat-log">
        {orderedTurns.map((turn, index) => (
          <article key={`${turn.role}-${index}`} className={`bubble ${turn.role}`}>
            <span className="bubble-role">{turn.role}</span>
            <p>{turn.content}</p>
          </article>
        ))}

        {busy && <p className="thinking">Thinking locally through Ollama...</p>}
      </div>

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

      <form onSubmit={submit} className="composer">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask a question, summarize a local source, or request a workflow..."
          rows={3}
        />
        <button type="submit" disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
