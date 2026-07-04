import { useEffect, useMemo, useState } from "react";
import DashboardPage from "./components/DashboardPage";
import UnifiedAssistantPage from "./components/UnifiedAssistantPage";
import LibraryPage from "./components/LibraryPage";
import SearchPage from "./components/SearchPage";
import AdminOverviewPage from "./components/AdminOverviewPage";
import QAPanel from "./components/QAPanel";
import {
  fetchAssistants,
  sendChat,
  uploadIndexedDocument,
  type AssistantProfile,
  type Turn,
} from "./lib/api";
import type { LibraryItem } from "./lib/uiTypes";

type Screen = "dashboard" | "assistant" | "library" | "search" | "admin";

const starterTurns: Turn[] = [
  {
    role: "assistant",
    content:
      "Sovereign Vault local intelligence is online. Select a mode and ask your first question.",
  },
];

export default function App() {
  const [assistants, setAssistants] = useState<AssistantProfile[]>([]);
  const [activeId, setActiveId] = useState("re-genesis");
  const [activeScreen, setActiveScreen] = useState<Screen>("dashboard");
  const [turnsByAssistant, setTurnsByAssistant] = useState<Record<string, Turn[]>>({
    "re-genesis": [...starterTurns],
    aetherium: [...starterTurns],
    amaterasu: [...starterTurns],
    "powercoder-z": [...starterTurns],
  });
  const [retrievedContext, setRetrievedContext] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [libraryAnswer, setLibraryAnswer] = useState("");
  const [legacyAdminToken, setLegacyAdminToken] = useState("");

  useEffect(() => {
    fetchAssistants()
      .then((data) => {
        setAssistants(data);
        if (data.length > 0 && !data.find((a) => a.id === activeId)) {
          setActiveId(data[0].id);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load assistant profiles");
      });
  }, [activeId]);

  const activeAssistant = useMemo(
    () => assistants.find((assistant) => assistant.id === activeId),
    [assistants, activeId]
  );

  const turns = turnsByAssistant[activeId] || [...starterTurns];

  const send = async (
    message: string,
    options?: { onResponse?: (response: string) => void }
  ): Promise<void> => {
    setBusy(true);
    setError("");

    const nextTurns = [...turns, { role: "user" as const, content: message }];
    setTurnsByAssistant((current) => ({ ...current, [activeId]: nextTurns }));

    try {
      const result = await sendChat({
        assistant_id: activeId,
        message,
        history: turns,
        use_retrieval: true,
      });
      setRetrievedContext(result.retrieved_context);
      setTurnsByAssistant((current) => ({
        ...current,
        [activeId]: [...nextTurns, { role: "assistant", content: result.response }],
      }));
      options?.onResponse?.(result.response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed";
      setError(message);
      setTurnsByAssistant((current) => ({
        ...current,
        [activeId]: [
          ...nextTurns,
          {
            role: "assistant",
            content: `Request failed: ${message}`,
          },
        ],
      }));
    } finally {
      setBusy(false);
    }
  };

  const attachFiles = async (files: FileList) => {
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      await uploadIndexedDocument({
        file,
        sourceType: "attachment",
        sourceId: file.name,
      });
      uploaded.push(file.name);
    }
    setAttachedFiles((current) => [...uploaded, ...current].slice(0, 30));
  };

  const addLibraryItem = (item: LibraryItem) => {
    setLibraryItems((current) => [item, ...current].slice(0, 200));
  };

  const askLibrary = async (question: string) => {
    await send(question, { onResponse: setLibraryAnswer });
  };

  return (
    <main className="aetherium-shell">
      <header className="aetherium-topbar">
        <div className="brand-block">
          <div className="brand-orb">
            <div className="brand-orb-core" />
          </div>
          <div>
            <h1>AETHERIUM VAULT</h1>
            <p>Sovereign offline intelligence substrate</p>
          </div>
        </div>

        <nav className="aetherium-nav">
          <button
            className={`aetherium-nav-item${activeScreen === "dashboard" ? " active" : ""}`}
            onClick={() => setActiveScreen("dashboard")}
            type="button"
          >
            Dashboard
          </button>
          <button
            className={`aetherium-nav-item${activeScreen === "assistant" ? " active" : ""}`}
            onClick={() => setActiveScreen("assistant")}
            type="button"
          >
            Unified Assistant
          </button>
          <button
            className={`aetherium-nav-item${activeScreen === "library" ? " active" : ""}`}
            onClick={() => setActiveScreen("library")}
            type="button"
          >
            Library
          </button>
          <button
            className={`aetherium-nav-item${activeScreen === "search" ? " active" : ""}`}
            onClick={() => setActiveScreen("search")}
            type="button"
          >
            Search
          </button>
          <button
            className={`aetherium-nav-item${activeScreen === "admin" ? " active" : ""}`}
            onClick={() => setActiveScreen("admin")}
            type="button"
          >
            Admin
          </button>
        </nav>

        <div className="status-block">
          <span className="status-dot" />
          <div>
            <p>System Status</p>
            <strong>Nominal</strong>
          </div>
        </div>
      </header>

      {error && <p className="error-banner">{error}</p>}

      <QAPanel activeAssistantId={activeId} legacyAdminToken={legacyAdminToken} />

      {activeScreen === "dashboard" && (
        <DashboardPage
          activeAssistantName={activeAssistant?.name || "N/A"}
          onQuickAction={(target) => {
            if (target === "assistant") {
              setActiveScreen("assistant");
            } else if (target === "library") {
              setActiveScreen("library");
            } else if (target === "search") {
              setActiveScreen("search");
            } else {
              setActiveScreen("admin");
            }
          }}
        />
      )}

      {activeScreen === "assistant" && (
        <UnifiedAssistantPage
          assistants={assistants}
          activeId={activeId}
          onSelectAssistant={(id) => {
            setActiveId(id);
            setRetrievedContext([]);
          }}
          turns={turns}
          busy={busy}
          onSend={(message) => send(message)}
          onAttachFiles={attachFiles}
          attachedFiles={attachedFiles}
          retrievedContext={retrievedContext}
        />
      )}

      {activeScreen === "library" && (
        <LibraryPage
          items={libraryItems}
          onAddItem={addLibraryItem}
          onAsk={askLibrary}
          lastAnswer={libraryAnswer}
        />
      )}

      {activeScreen === "search" && <SearchPage />}

      {activeScreen === "admin" && (
        <AdminOverviewPage
          legacyToken={legacyAdminToken}
          onLegacyTokenChange={setLegacyAdminToken}
        />
      )}
    </main>
  );
}
