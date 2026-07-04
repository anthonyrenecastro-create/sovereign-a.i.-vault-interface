import { useEffect, useMemo, useState } from "react";
import type { Turn } from "../lib/api";
import { INITIAL_TASKS, type AetherTask } from "../lib/aetheriumConstants";

interface Props {
  activeAssistantName: string;
  turns: Turn[];
  onSend: (message: string) => Promise<void>;
  busy: boolean;
  retrievedContext: string[];
}

function TaskItem({ task }: { task: AetherTask }) {
  return (
    <div className="aether-task-item">
      <span>{task.name}</span>
      <span className={`status ${task.status.toLowerCase()}`}>{task.status}</span>
    </div>
  );
}

export default function AetheriumCommandConsole({
  activeAssistantName,
  turns,
  onSend,
  busy,
  retrievedContext,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("Awaiting command...");
  const [tasks] = useState<AetherTask[]>(INITIAL_TASKS);

  const latestAssistantReply = useMemo(() => {
    const reversed = [...turns].reverse();
    return reversed.find((turn) => turn.role === "assistant")?.content;
  }, [turns]);

  useEffect(() => {
    if (latestAssistantReply) {
      setOutput(latestAssistantReply);
    }
  }, [latestAssistantReply]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = prompt.trim();
    if (!message || busy) {
      return;
    }

    setOutput("Processing command through the symbolic interpreter...");
    await onSend(message);
    setPrompt("");
  };

  return (
    <section className="aether-command-grid">
      <div className="aether-command-main">
        <article className="aether-card">
          <header>
            <h3>Main Prompt Interface</h3>
            <p>{activeAssistantName}</p>
          </header>
          <form onSubmit={submit} className="aether-command-form">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Type commands, ask questions, or provide text for the AI..."
              className="aether-console-textarea"
              disabled={busy}
            />
            <button type="submit" disabled={busy || !prompt.trim()}>
              {busy ? "TRANSMITTING..." : "EXECUTE"}
            </button>
          </form>
        </article>

        <article className="aether-card">
          <header>
            <h3>Output Canvas</h3>
          </header>
          <div className="aether-output-canvas">{output}</div>
          {retrievedContext.length > 0 && (
            <div className="aether-mini-context">
              <h4>Retrieved Context</h4>
              <ul>
                {retrievedContext.slice(0, 5).map((item, index) => (
                  <li key={`${item.slice(0, 24)}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </article>
      </div>

      <aside className="aether-command-side">
        <article className="aether-card">
          <header>
            <h3>Task Manager</h3>
          </header>
          <div className="aether-task-list">
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </div>
        </article>
      </aside>
    </section>
  );
}
