import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, Loader2, Circle, AlertCircle } from "lucide-react";
import type { WSEvent } from "../hooks/useExecutionWS";
import clsx from "clsx";

const AGENTS = ["pm", "designer", "architect", "developer"] as const;
const AGENT_LABELS: Record<string, string> = {
  pm: "Project Manager",
  designer: "Designer",
  architect: "Architect",
  developer: "Developer",
};
const AGENT_COLORS: Record<string, string> = {
  pm:        "text-sky-400 border-sky-500/40 bg-sky-500/10",
  designer:  "text-violet-400 border-violet-500/40 bg-violet-500/10",
  architect: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  developer: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
};

interface Props {
  events: WSEvent[];
  executionName: string;
}

function deriveAgentStatus(agent: string, events: WSEvent[]) {
  const agentEvents = events.filter((e) => e.agent === agent);
  if (agentEvents.some((e) => e.type === "error")) return "error";
  if (agentEvents.some((e) => e.type === "agent_done")) return "done";
  if (agentEvents.some((e) => e.type === "agent_start")) return "running";
  return "pending";
}

function getAgentOutput(agent: string, events: WSEvent[]) {
  return events
    .filter((e) => e.agent === agent && e.type === "token")
    .map((e) => e.data)
    .join("");
}

export default function AgentProgress({ events, executionName }: Props) {
  const isDone = events.some((e) => e.type === "pipeline_done");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">{executionName}</h3>
        {isDone && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <CheckCircle size={12} /> Pipeline complete
          </span>
        )}
      </div>

      {AGENTS.map((agent, idx) => {
        const status = deriveAgentStatus(agent, events);
        const output = getAgentOutput(agent, events);
        const color = AGENT_COLORS[agent];

        return (
          <div key={agent} className={clsx("border rounded-xl overflow-hidden", color.split(" ").find(c => c.startsWith("border")))}>
            {/* Agent header */}
            <div className={clsx("flex items-center gap-2 px-3 py-2", color.split(" ").find(c => c.startsWith("bg")))}>
              <span className="text-xs font-mono font-medium" style={{ minWidth: 20 }}>
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span className={clsx("text-xs font-medium", color.split(" ").find(c => c.startsWith("text")))}>
                {AGENT_LABELS[agent]}
              </span>
              <div className="ml-auto">
                {status === "pending" && <Circle size={12} className="text-slate-600" />}
                {status === "running" && <Loader2 size={12} className="animate-spin text-blue-400" />}
                {status === "done"    && <CheckCircle size={12} className="text-emerald-400" />}
                {status === "error"   && <AlertCircle size={12} className="text-rose-400" />}
              </div>
            </div>

            {/* Streaming output */}
            <AnimatePresence>
              {(status === "running" || status === "done") && output && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-[#0a0e1a] px-3 py-2 max-h-40 overflow-y-auto"
                >
                  <pre className="text-[11px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">
                    {output}
                    {status === "running" && <span className="inline-block w-1.5 h-3 bg-slate-400 ml-0.5 animate-pulse" />}
                  </pre>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
