/**
 * RunProgressPanel — right-side slide-in panel that subscribes to the
 * app-idea-agent SSE stream and renders live pipeline progress.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { AGENT_STREAM_URL } from "../api/client";
import clsx from "clsx";

// ── Types ─────────────────────────────────────────────────────────────────────

type StepStatus = "pending" | "active" | "done" | "error";

interface PipelineStep {
  id: string;
  label: string;
  status: StepStatus;
  detail?: string | null;
}

interface RunState {
  status: "idle" | "running" | "success" | "error";
  trigger: "manual" | "cron";
  steps: PipelineStep[];
  artifacts: Record<string, unknown>;
  summary?: { candidatesConsidered?: number; ideasGenerated?: number };
  errorMessage?: string;
}

const INITIAL_STEPS: PipelineStep[] = [
  { id: "research",   label: "Deep research",         status: "pending" },
  { id: "niches",     label: "Niche & market analysis", status: "pending" },
  { id: "candidates", label: "Candidate generation",  status: "pending" },
  { id: "critique",   label: "Critique & scoring",    status: "pending" },
  { id: "refine",     label: "Select & refine",       status: "pending" },
  { id: "save",       label: "Save to database",      status: "pending" },
];

function makeIdle(): RunState {
  return { status: "idle", trigger: "manual", steps: INITIAL_STEPS, artifacts: {} };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <div
      className="border-2 border-white/15 border-t-indigo-400 rounded-full animate-spin flex-shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "active") return <Spinner size={16} />;
  if (status === "done")   return <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />;
  if (status === "error")  return <AlertCircle size={16} className="text-rose-400 flex-shrink-0" />;
  return <div className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0" />;
}

const COMPLEXITY_COLORS: Record<string, string> = {
  simple:  "text-emerald-400",
  medium:  "text-amber-400",
  complex: "text-rose-400",
};

function StepArtifact({ stepId, art }: { stepId: string; art: unknown }) {
  if (!art) return null;

  if (stepId === "research") {
    const a = art as { preview?: string; length?: number; sources?: string[] };
    return (
      <div className="mt-3 pt-3 border-t border-white/8">
        <div className="text-[9px] uppercase tracking-widest text-slate-600 mb-1.5 font-mono">
          Research brief ({a.sources?.length ?? 0} sources)
        </div>
        <div className="text-[11px] text-slate-500 font-mono bg-white/3 rounded-lg p-2.5 max-h-28 overflow-y-auto whitespace-pre-wrap leading-relaxed">
          {a.preview}{(a.length ?? 0) > (a.preview?.length ?? 0) ? "…" : ""}
        </div>
      </div>
    );
  }

  if (stepId === "niches") {
    const a = art as { niches?: { niche: string; targetUser?: string; opportunityScore?: number }[] };
    return (
      <div className="mt-3 pt-3 border-t border-white/8 space-y-2">
        {(a.niches ?? []).map((n, i) => (
          <div key={i} className="flex items-start justify-between gap-2 text-xs">
            <div>
              <div className="text-slate-300">{n.niche}</div>
              {n.targetUser && <div className="text-[10px] text-slate-600 mt-0.5">{n.targetUser}</div>}
            </div>
            {typeof n.opportunityScore === "number" && (
              <span className="text-[10px] font-mono text-indigo-400 flex-shrink-0">{n.opportunityScore}/10</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (stepId === "candidates") {
    const a = art as { candidates?: { name: string; complexity: string }[] };
    return (
      <div className="mt-3 pt-3 border-t border-white/8 flex flex-wrap gap-1.5">
        {(a.candidates ?? []).map((c, i) => (
          <span key={i} className={clsx("text-[10px] px-2 py-0.5 bg-white/5 border border-white/8 rounded font-mono", COMPLEXITY_COLORS[c.complexity] ?? "text-slate-400")}>
            {c.name} · {c.complexity}
          </span>
        ))}
      </div>
    );
  }

  if (stepId === "critique") {
    const a = art as { scored?: { name: string; overall?: number }[] };
    return (
      <div className="mt-3 pt-3 border-t border-white/8 space-y-2">
        {(a.scored ?? []).map((c, i) => (
          <div key={i} className={clsx("flex items-center gap-2 text-xs", i === 0 ? "font-semibold" : "")}>
            <span className="truncate text-slate-400 w-32">{c.name}</span>
            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${((c.overall ?? 0) / 10) * 100}%` }} />
            </div>
            <span className={clsx("text-[10px] font-mono w-5 text-right", i === 0 ? "text-indigo-400" : "text-slate-500")}>
              {c.overall}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (stepId === "refine") {
    const a = art as { ideas?: { name: string; tagline?: string; complexity: string }[] };
    return (
      <div className="mt-3 pt-3 border-t border-white/8 space-y-2">
        {(a.ideas ?? []).map((idea, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <div className={clsx("w-2 h-2 rounded-full mt-0.5 flex-shrink-0", COMPLEXITY_COLORS[idea.complexity]?.replace("text-", "bg-") ?? "bg-slate-400")} />
            <div>
              <span className="font-semibold text-slate-200">{idea.name}</span>
              {idea.tagline && <span className="text-slate-500 ml-1.5">— {idea.tagline}</span>}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onViewNewIdeas: () => void;
}

export default function RunProgressPanel({ open, onClose, onViewNewIdeas }: Props) {
  const [run, setRun] = useState<RunState>(makeIdle());
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!open) return;

    const es = new EventSource(AGENT_STREAM_URL);
    esRef.current = es;

    es.onmessage = (ev) => {
      try {
        const event = JSON.parse(ev.data);
        handleEvent(event);
      } catch {
        // malformed event — ignore
      }
    };

    es.onerror = () => {
      // The SSE connection will auto-retry; show nothing alarming
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [open]);

  function handleEvent(event: Record<string, unknown>) {
    switch (event.type) {
      case "snapshot": {
        const snap = event.run as RunState | null;
        if (snap) setRun(normalizeSnapshot(snap));
        break;
      }
      case "run:start":
        setRun({
          status: "running",
          trigger: (event.trigger as "manual" | "cron") ?? "manual",
          steps: ((event.steps as PipelineStep[]) ?? INITIAL_STEPS).map((s) => ({ ...s, status: "pending" as StepStatus })),
          artifacts: {},
        });
        break;
      case "step":
        setRun((prev) => ({
          ...prev,
          steps: prev.steps.map((s) =>
            s.id === event.stepId
              ? { ...s, status: event.status as StepStatus, detail: (event.detail as string) ?? s.detail }
              : s
          ),
        }));
        break;
      case "artifact":
        setRun((prev) => ({
          ...prev,
          artifacts: { ...prev.artifacts, [event.stepId as string]: event.payload },
        }));
        break;
      case "run:complete":
        setRun((prev) => ({
          ...prev,
          status: "success",
          summary: event.summary as RunState["summary"],
          steps: prev.steps.map((s) => (s.status === "active" ? { ...s, status: "done" } : s)),
        }));
        break;
      case "run:error":
        setRun((prev) => ({
          ...prev,
          status: "error",
          errorMessage: event.errorMessage as string,
        }));
        break;
      case "run:meta":
        // runId assigned — nothing to display
        break;
    }
  }

  function normalizeSnapshot(snap: Partial<RunState>): RunState {
    return {
      status: snap.status ?? "idle",
      trigger: snap.trigger ?? "manual",
      steps: (snap.steps ?? INITIAL_STEPS).map((s) => ({
        id: s.id,
        label: s.label,
        status: s.status ?? "pending",
        detail: s.detail ?? null,
      })),
      artifacts: {},
      summary: snap.summary,
      errorMessage: snap.errorMessage,
    };
  }

  const isRunning = run.status === "running";
  const elapsed = run.steps.filter((s) => s.status === "done" || s.status === "active").length;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => { if (!isRunning) onClose(); }}
          />

          {/* Panel */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[#0a0e1a] border-l border-white/10 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
              <div>
                <div className="flex items-center gap-2.5">
                  {isRunning ? <Spinner size={18} /> : run.status === "success" ? <CheckCircle size={18} className="text-emerald-400" /> : run.status === "error" ? <AlertCircle size={18} className="text-rose-400" /> : <Clock size={18} className="text-slate-600" />}
                  <h2 className="text-base font-semibold text-slate-100">
                    {isRunning ? "Agent is thinking…" : run.status === "success" ? "Run complete" : run.status === "error" ? "Run failed" : "Agent pipeline"}
                  </h2>
                  <span className={clsx(
                    "text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border",
                    run.trigger === "cron"
                      ? "text-amber-400 border-amber-500/30"
                      : "text-sky-400 border-sky-500/30"
                  )}>
                    {run.trigger === "cron" ? "⏱ cron" : "▶ manual"}
                  </span>
                </div>
                {isRunning && (
                  <p className="text-[11px] text-slate-600 mt-1 ml-7">
                    {elapsed} of {run.steps.length} steps done
                  </p>
                )}
                {run.status === "success" && run.summary && (
                  <p className="text-[11px] text-slate-500 mt-1 ml-7">
                    {run.summary.candidatesConsidered
                      ? `Considered ${run.summary.candidatesConsidered} candidates · `
                      : ""}
                    Saved {run.summary.ideasGenerated ?? "?"} ideas
                  </p>
                )}
              </div>
              {!isRunning && (
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Steps */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              {run.steps.map((step) => (
                <div
                  key={step.id}
                  className={clsx(
                    "border rounded-xl p-4 transition-all duration-200",
                    step.status === "active" ? "border-indigo-500/40 bg-indigo-500/5" :
                    step.status === "done"   ? "border-emerald-500/20 bg-white/2" :
                    step.status === "error"  ? "border-rose-500/40 bg-rose-500/5" :
                    "border-white/8 bg-white/1"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <StepIcon status={step.status} />
                    <span className={clsx(
                      "text-sm font-medium",
                      step.status === "active" ? "text-slate-200" :
                      step.status === "done"   ? "text-slate-300" :
                      step.status === "error"  ? "text-rose-300" :
                      "text-slate-600"
                    )}>
                      {step.label}
                    </span>
                    {step.detail && (
                      <span className="ml-auto text-[10px] font-mono text-slate-600 text-right">{step.detail}</span>
                    )}
                  </div>
                  {(step.status === "active" || step.status === "done") && (
                    <StepArtifact stepId={step.id} art={run.artifacts[step.id]} />
                  )}
                </div>
              ))}

              {run.status === "idle" && (
                <div className="text-center text-slate-700 text-sm mt-10 font-mono">
                  Waiting for next run…
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/8 flex items-center gap-3">
              {run.status === "error" && (
                <div className="flex-1 text-[11px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {run.errorMessage ?? "Unknown error"}
                </div>
              )}
              {run.status === "success" && (
                <button
                  onClick={() => { onViewNewIdeas(); onClose(); }}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
                >
                  View new ideas →
                </button>
              )}
              {!isRunning && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:text-slate-300 bg-white/5 hover:bg-white/8 transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
