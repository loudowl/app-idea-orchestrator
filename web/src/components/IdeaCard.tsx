import { motion } from "framer-motion";
import { Zap, Clock, DollarSign, Play, CheckCircle, Loader2, AlertCircle, Info } from "lucide-react";
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
  simple:  { border: "border-emerald-500/40", glow: "shadow-emerald-500/10", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400" },
  medium:  { border: "border-amber-500/40",   glow: "shadow-amber-500/10",   badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",   dot: "bg-amber-400"   },
  complex: { border: "border-rose-500/40",    glow: "shadow-rose-500/10",    badge: "bg-rose-500/15 text-rose-300 border-rose-500/30",    dot: "bg-rose-400"    },
};

const STATUS_ICON = {
  pending: null,
  running: <Loader2 size={14} className="animate-spin text-blue-400" />,
  done:    <CheckCircle size={14} className="text-emerald-400" />,
  error:   <AlertCircle size={14} className="text-rose-400" />,
  pushed:  <CheckCircle size={14} className="text-purple-400" />,
};

export default function IdeaCard({ idea, execution, onExecute, onViewExecution, onInfo }: Props) {
  const styles = COMPLEXITY_STYLES[idea.complexity] ?? COMPLEXITY_STYLES.medium;
  const isExecuted = !!execution;
  const isRunning = execution?.status === "running";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className={clsx(
        "relative flex flex-col bg-[#0f1623] border rounded-2xl p-5 shadow-lg",
        styles.border, styles.glow,
        "hover:shadow-xl transition-shadow duration-300"
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={clsx("text-xs px-2.5 py-0.5 rounded-full border font-medium", styles.badge)}>
            <span className={clsx("inline-block w-1.5 h-1.5 rounded-full mr-1.5", styles.dot)} />
            {idea.complexity}
          </span>
          <span className="text-xs text-slate-500 border border-white/8 rounded-full px-2 py-0.5">
            {idea.category}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onInfo(idea); }}
            className="text-slate-600 hover:text-indigo-300 transition-colors rounded p-0.5 hover:bg-indigo-500/10"
            title="View full details"
          >
            <Info size={13} />
          </button>
        </div>
        {execution && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            {execution.project?.provider && (
              <span className="capitalize text-[10px] text-slate-600 border border-white/8 rounded-full px-1.5 py-0.5">
                {execution.project.provider}
              </span>
            )}
            {STATUS_ICON[execution.status]}
            <span className="capitalize">{execution.status === "pushed" ? "On GitHub" : execution.status}</span>
          </div>
        )}
      </div>

      {/* Name + tagline */}
      <h3 className="text-base font-semibold text-slate-100 mb-1 leading-tight">{idea.name}</h3>
      <p className="text-xs text-slate-400 mb-3 leading-relaxed">{idea.tagline}</p>

      {/* Description */}
      <p className="text-xs text-slate-500 leading-relaxed mb-4 line-clamp-3 flex-1">{idea.description}</p>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs text-slate-600 mb-4">
        <span className="flex items-center gap-1">
          <Clock size={11} />
          {idea.timeToMVP}
        </span>
        <span className="flex items-center gap-1">
          <DollarSign size={11} />
          {idea.estimatedRevenueModel}
        </span>
        <span className="flex items-center gap-1">
          <Zap size={11} />
          Ease {idea.easeOfMonetization}/10
        </span>
      </div>

      {/* Tech stack pills */}
      <div className="flex flex-wrap gap-1 mb-4">
        {(idea.techStack ?? []).slice(0, 4).map((t) => (
          <span key={t} className="text-[10px] px-1.5 py-0.5 bg-white/5 text-slate-500 rounded">
            {t}
          </span>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-auto">
        {!isExecuted ? (
          <button
            onClick={() => onExecute(idea)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
          >
            <Play size={12} />
            Execute Idea
          </button>
        ) : (
          <button
            onClick={() => onViewExecution(execution!.id)}
            className={clsx(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors",
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
            {isRunning ? "View Progress" : execution.status === "pushed" ? "View on GitHub" : "View Result"}
          </button>
        )}
      </div>
    </motion.div>
  );
}
