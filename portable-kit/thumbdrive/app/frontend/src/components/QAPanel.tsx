import { useEffect, useMemo, useState } from "react";
import {
  fetchAssistants,
  getApiBase,
  getHealth,
  getIndexStats,
  indexDocument,
  runAdminShell,
  searchIndex,
  uploadIndexedDocument,
  verifyAdmin,
} from "../lib/api";

type StepStatus = "idle" | "running" | "pass" | "fail" | "skip";

interface StepState {
  id: string;
  name: string;
  status: StepStatus;
  detail: string;
  durationMs?: number;
}

interface Props {
  activeAssistantId: string;
  legacyAdminToken: string;
}

const INITIAL_STEPS: StepState[] = [
  { id: "dashboard", name: "1. Dashboard", status: "idle", detail: "Pending" },
  {
    id: "assistant",
    name: "2. Unified Assistant",
    status: "idle",
    detail: "Pending",
  },
  { id: "library", name: "3. Library", status: "idle", detail: "Pending" },
  { id: "search", name: "4. Search", status: "idle", detail: "Pending" },
  { id: "admin", name: "5. Admin", status: "idle", detail: "Pending" },
];

export default function QAPanel({ activeAssistantId, legacyAdminToken }: Props) {
  const [steps, setSteps] = useState<StepState[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [autoSkipAdminWithoutToken, setAutoSkipAdminWithoutToken] = useState(true);
  const [runLabel, setRunLabel] = useState("Not run yet");
  const apiBaseDetected = getApiBase();

  const summary = useMemo(() => {
    const pass = steps.filter((step) => step.status === "pass").length;
    const fail = steps.filter((step) => step.status === "fail").length;
    const skip = steps.filter((step) => step.status === "skip").length;
    const runningNow = steps.some((step) => step.status === "running");
    return { pass, fail, skip, runningNow };
  }, [steps]);

  const setStep = (id: string, patch: Partial<StepState>) => {
    setSteps((current) =>
      current.map((step) => {
        if (step.id !== id) {
          return step;
        }
        return { ...step, ...patch };
      })
    );
  };

  const runStep = async (id: string, fn: () => Promise<string>) => {
    const started = Date.now();
    setStep(id, { status: "running", detail: "Running..." });
    try {
      const detail = await fn();
      setStep(id, {
        status: "pass",
        detail,
        durationMs: Date.now() - started,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown failure";
      setStep(id, {
        status: "fail",
        detail: message,
        durationMs: Date.now() - started,
      });
      return false;
    }
  };

  const runChecklist = async () => {
    if (running) {
      return;
    }

    setRunning(true);
    setRunLabel("Running QA checklist...");
    setSteps(INITIAL_STEPS);

    try {
      const qaId = `${Date.now()}`;
      const qaTitle = `qa-panel-doc-${qaId}`;
      const qaContent = `QA panel seed content ${qaId}: quantum lattice semantic keyword retrieval.`;

      let passCount = 0;
      let failCount = 0;
      let skippedCount = 0;
      let applicableCount = INITIAL_STEPS.length;

    if (await runStep("dashboard", async () => {
      const [health, stats] = await Promise.all([getHealth(), getIndexStats()]);
      if (health.status !== "ok") {
        throw new Error(`Unexpected health status: ${health.status}`);
      }
      return `ok, docs=${stats.total_documents}, chunks=${stats.total_chunks}`;
    })) {
      passCount += 1;
    } else {
      failCount += 1;
    }

    if (await runStep("assistant", async () => {
      const assistants = await fetchAssistants();
      if (assistants.length === 0) {
        throw new Error("No assistants returned");
      }
      const file = new File([`Attachment QA ${qaId}`], `qa-attach-${qaId}.txt`, {
        type: "text/plain",
      });
      await uploadIndexedDocument({ file, sourceType: "attachment", sourceId: `qa-${qaId}` });
      const hasActive = assistants.some((assistant) => assistant.id === activeAssistantId);
      return `assistants=${assistants.length}, attachment indexed, active=${hasActive}`;
    })) {
      passCount += 1;
    } else {
      failCount += 1;
    }

    if (await runStep("library", async () => {
      await indexDocument(qaTitle, qaContent, "manual", `qa-panel-${qaId}`);
      return `indexed ${qaTitle}`;
    })) {
      passCount += 1;
    } else {
      failCount += 1;
    }

    if (await runStep("search", async () => {
      const [keyword, semantic] = await Promise.all([
        searchIndex({ query: qaTitle, mode: "keyword", top_k: 5 }),
        searchIndex({ query: "semantic retrieval", mode: "semantic", top_k: 5 }),
      ]);
      if (keyword.count <= 0 || semantic.count <= 0) {
        throw new Error(`Unexpected result count keyword=${keyword.count} semantic=${semantic.count}`);
      }
      return `keyword=${keyword.count}, semantic=${semantic.count}`;
    })) {
      passCount += 1;
    } else {
      failCount += 1;
    }

      if (autoSkipAdminWithoutToken && !legacyAdminToken.trim()) {
        setStep("admin", {
          status: "skip",
          detail: "Skipped automatically: no admin token provided.",
        });
        skippedCount += 1;
        applicableCount -= 1;
      } else if (await runStep("admin", async () => {
        if (!legacyAdminToken.trim()) {
          throw new Error("Missing legacy admin token for admin QA step");
        }

        const verified = await verifyAdmin({ legacyToken: legacyAdminToken });
        if (!verified) {
          throw new Error("Admin verify failed");
        }

        const [modelList, status, disk, stats] = await Promise.all([
          runAdminShell({ command: "ollama list", legacyToken: legacyAdminToken }),
          runAdminShell({ command: "ollama ps", legacyToken: legacyAdminToken }),
          runAdminShell({ command: "df -h .", legacyToken: legacyAdminToken }),
          getIndexStats(),
        ]);

        if (modelList.exit_code !== 0 || status.exit_code !== 0 || disk.exit_code !== 0) {
          throw new Error("Admin shell checks failed");
        }

        return `ollama/list ok, disk ok, docs=${stats.total_documents}`;
      })) {
        passCount += 1;
      } else {
        failCount += 1;
      }

      setRunLabel(
        `Completed: ${passCount}/${applicableCount} applicable passed${failCount ? `, ${failCount} failed` : ""}${skippedCount ? `, ${skippedCount} skipped` : ""}`
      );
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    void runChecklist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="qa-panel">
      <header className="qa-panel-header">
        <div>
          <h2>QA Checklist Panel</h2>
          <p>{runLabel}</p>
          <p className="qa-api-base">API Base Detected: {apiBaseDetected}</p>
          <label className="qa-setting">
            <input
              type="checkbox"
              checked={autoSkipAdminWithoutToken}
              onChange={(event) => setAutoSkipAdminWithoutToken(event.target.checked)}
            />
            Auto-skip Admin step when token is empty
          </label>
        </div>
        <div className="qa-actions">
          <div className="qa-summary qa-summary-inline" aria-label="QA summary">
            <span>Pass: {summary.pass}</span>
            <span>Fail: {summary.fail}</span>
            <span>Skip: {summary.skip}</span>
            <span>{summary.runningNow ? "In progress" : "Idle"}</span>
          </div>
          <button type="button" onClick={() => setCollapsed((current) => !current)}>
            {collapsed ? "Expand" : "Collapse"}
          </button>
          <button type="button" onClick={() => void runChecklist()} disabled={running}>
            {running ? "Running..." : "Run Again"}
          </button>
        </div>
      </header>

      {!collapsed && (
        <div className="qa-body">
          {steps.map((step) => (
            <article key={step.id} className={`qa-step ${step.status}`}>
              <strong>{step.name}</strong>
              <p>{step.detail}</p>
              <span>
                {step.status.toUpperCase()}
                {typeof step.durationMs === "number" ? ` · ${step.durationMs}ms` : ""}
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
