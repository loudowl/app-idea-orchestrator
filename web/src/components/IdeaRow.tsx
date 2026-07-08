import { Info, Play, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import type { Idea, Execution } from "../api/client";
import clsx from "clsx";

interface Props {
  idea: Idea;
  execution?: Execution;
  onExecute: (idea: Idea) => void;
  onViewExecution: (executionId: string) => void;
  onInfo: (idea: Idea) => void;
}

const COMPLEXITY_STYLES = {
  simple:  { badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400" },
  medium:  { badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",       dot: "bg-amber-400"   },
  complex: { badge: "bg-rose-500/15 text-rose-300 border-rose-500/30",          dot: "bg-rose-400"    },
};

const STATUS_ICON = {
  pending: null,
  running: <Loader2 size={10} className="animate-spin" />,
  done:    <CheckCircle size={10} />,
  error:   <AlertCircle size={10} />,
  pushed:  <CheckCircle size={10} />,
};

export default function IdeaRow({ idea, execution, onExecute, onViewExecution, onInfo }: Props) {
  const styles = COMPLEXITY_STYLES[idea.complexity] ?? COMPLEXITY_STYLES.medium;
  const isExecuted = !!execution;
  const isRunning = execution?.status === "running";

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#0f1623] border border-white/8 rounded-xl hover:border-white/15 hover:bg-[#111827] transition-all group">
      {/* Complexity dot */}
      <span className={clsx("w-2 h-2 rounded-full flex-shrink-0", styles.dot)} />

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-200 truncate">{idea.name}</span>
          {execution?.project?.provider && (
            <span className="hidden xl:inline text-[10px] text-slate-700 border border-white/8 rounded-full px-1.5 py-0.5 capitalize flex-shrink-0">
              {execution.project.provider}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 truncate mt-0.5 leading-relaxed">{idea.description}</p>
      </div>

      {/* Category */}
      <span className="hidden sm:inline-flex text-[10px] text-slate-500 border border-white/8 rounded-full px-2 py-0.5 flex-shrink-0 whitespace-nowrap">
        {idea.category}
      </span>

      {/* Complexity badge */}
      <span className={clsx("hidden md:inline-flex text-[10px] px-2.5 py-0.5 rounded-full border font-medium flex-shrink-0", styles.badge)}>
        {idea.complexity}
      </span>

      {/* Platforms */}
      <span className="hidden lg:inline-flex text-[10px] text-slate-600 flex-shrink-0 whitespace-nowrap font-mono">
        {(idea.targetPlatforms ?? []).join(" · ")}
      </span>

      {/* Info button */}
      <button
        onClick={() => onInfo(idea)}
        className="p-1.5 text-slate-600 hover:text-indigo-300 transition-colors rounded-lg hover:bg-indigo-500/10 flex-shrink-0"
        title="View full details"
      >
        <Info size={13} />
      </button>

      {/* Execute / View button */}
      {!isExecuted ? (
        <button
          onClick={() => onExecute(idea)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-medium transition-colors flex-shrink-0"
        >
          <Play size={10} />
          Execute
        </button>
      ) : (
        <button
          onClick={() => onViewExecution(execution!.id)}
          className={clsx(
            "flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors flex-shrink-0",
            isRunning
              ? "bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30"
              : execution.status === "pushed"
              ? "bg-purple-600/20 border border-purple-500/40 text-purple-300 hover:bg-purple-600/30"
              : execution.status === "error"
              ? "bg-rose-600/20 border border-rose-500/40 text-rose-300 hover:bg-rose-600/30"
              : "bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30"
          )}
        >
          {STATUS_ICON[execution.status]}
          {isRunning ? "Running" : execution.status === "pushed" ? "GitHub" : "Result"}
        </button>
      )}
    </div>
  );
}
