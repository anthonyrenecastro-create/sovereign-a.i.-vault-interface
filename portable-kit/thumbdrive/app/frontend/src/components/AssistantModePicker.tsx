import type { AssistantProfile } from "../lib/api";

interface Props {
  assistants: AssistantProfile[];
  activeId: string;
  onChange: (id: string) => void;
}

export default function AssistantModePicker({ assistants, activeId, onChange }: Props) {
  return (
    <section className="mode-grid">
      {assistants.map((assistant) => {
        const active = assistant.id === activeId;
        return (
          <button
            key={assistant.id}
            className={`mode-card${active ? " active" : ""}`}
            onClick={() => onChange(assistant.id)}
            type="button"
          >
            <div className="mode-title-row">
              <h3>{assistant.name}</h3>
              {assistant.privileged && <span className="mode-tag">Admin</span>}
            </div>
            <p>{assistant.description}</p>
          </button>
        );
      })}
    </section>
  );
}
