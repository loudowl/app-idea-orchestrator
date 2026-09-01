/**
 * AgentSettingsModal — configure per-step model + thinking parameters
 * for the app-idea-agent pipeline. Mirrors the settings modal in the
 * app-idea-agent's own UI, proxied through the orchestrator backend.
 */
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Cpu } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAgentSettings, saveAgentSettings } from "../api/client";
import type { StepConfig } from "../api/client";
import clsx from "clsx";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PRESET_ORDER = [
  { id: "economy",     label: "Most economical" },
  { id: "recommended", label: "Recommended" },
  { id: "highest",     label: "Highest models" },
];

const TIER_COLOR: Record<string, string> = {
  premium:  "text-rose-400",
  balanced: "text-amber-400",
  economy:  "text-emerald-400",
};

export default function AgentSettingsModal({ open, onClose }: Props) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["agent-settings"],
    queryFn: fetchAgentSettings,
    enabled: open,
    staleTime: 10_000,
  });

  const [preset, setPreset] = useState<string>("recommended");
  const [steps, setSteps] = useState<Record<string, StepConfig> | null>(null);

  // Sync local state when fresh data arrives
  useMemo(() => {
    if (data && !steps) {
      setPreset(data.preset ?? "recommended");
      setSteps(data.steps);
    }
  }, [data]);

  const applyPreset = (pid: string) => {
    if (!data) return;
    const base = data.presets[pid] ?? {};
    const next: Record<string, StepConfig> = {};
    for (const meta of data.stepsMeta) {
      const b = (base as Record<string, Partial<StepConfig>>)[meta.id] ?? {};
      next[meta.id] = {
        model: b.model ?? data.catalog[0]?.id ?? "",
        think: meta.canThink ? !!b.think : false,
        effort: b.effort ?? "high",
      };
    }
    setPreset(pid);
    setSteps(next);
  };

  const updateStep = (stepId: string, patch: Partial<StepConfig>) => {
    setSteps((prev) => prev ? { ...prev, [stepId]: { ...prev[stepId], ...patch } } : prev);
    setPreset("custom");
  };

  const costOf = (modelId: string) => data?.catalog.find((m) => m.id === modelId)?.cost ?? 2;

  const costPct = useMemo(() => {
    if (!steps || !data) return 0;
    const ids = data.stepsMeta.map((s) => s.id);
    let total = 0;
    for (const id of ids) {
      const s = steps[id];
      if (!s) continue;
      total += costOf(s.model) * (s.think ? 2.2 : 1);
    }
    const min = ids.length * 1;
    const max = ids.length * 5 * 2.2;
    return Math.round(((total - min) / (max - min)) * 100);
  }, [steps, data]);

  const costLabel = costPct < 33 ? "Low" : costPct < 66 ? "Moderate" : "High";
  const costColor  = costPct < 33 ? "text-emerald-400" : costPct < 66 ? "text-amber-400" : "text-rose-400";
  const barColor   = costPct < 33 ? "bg-emerald-400" : costPct < 66 ? "bg-amber-400" : "bg-rose-400";

  const saveMutation = useMutation({
    mutationFn: () => saveAgentSettings({ preset, steps: steps! }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-settings"] });
      onClose();
    },
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-10 pb-10 overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative w-full max-w-xl bg-[#0a0e1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-7 pt-6 pb-5 border-b border-white/8 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Cpu size={15} className="text-indigo-400" />
                  <h2 className="text-base font-semibold text-slate-100">Model Settings</h2>
                </div>
                <p className="text-xs text-slate-600">
                  Tune model + thinking per pipeline step · applies to manual and scheduled runs
                </p>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 mt-1 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-7 py-6 space-y-6">
              {isLoading || !steps ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 rounded-full border-2 border-white/15 border-t-indigo-400 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Presets */}
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_ORDER.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => applyPreset(p.id)}
                        className={clsx(
                          "flex-1 min-w-28 py-2.5 px-3 rounded-xl border text-[11px] font-mono uppercase tracking-wide transition-all",
                          preset === p.id
                            ? "bg-indigo-500/15 border-indigo-500/50 text-indigo-300"
                            : "bg-white/3 border-white/8 text-slate-600 hover:text-slate-400 hover:border-white/15"
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                    <button
                      disabled
                      className={clsx(
                        "flex-1 min-w-20 py-2.5 px-3 rounded-xl border text-[11px] font-mono uppercase tracking-wide",
                        preset === "custom"
                          ? "bg-indigo-500/15 border-indigo-500/50 text-indigo-300"
                          : "bg-white/2 border-white/5 text-slate-700 opacity-50"
                      )}
                    >
                      Custom
                    </button>
                  </div>

                  {/* Cost meter */}
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] uppercase tracking-widest text-slate-600 font-mono whitespace-nowrap">
                      Est. relative cost
                    </span>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={clsx("h-full rounded-full transition-all duration-300", barColor)}
                        style={{ width: `${Math.max(4, costPct)}%` }}
                      />
                    </div>
                    <span className={clsx("text-[11px] font-mono whitespace-nowrap", costColor)}>
                      {costLabel}
                    </span>
                  </div>

                  {/* Per-step config */}
                  <div className="space-y-2">
                    {data!.stepsMeta.map((meta) => {
                      const s = steps[meta.id];
                      if (!s) return null;
                      return (
                        <div key={meta.id} className="flex items-center gap-4 p-3.5 bg-white/3 border border-white/8 rounded-xl">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium text-slate-300">{meta.label}</span>
                              <span className={clsx("text-[9px] uppercase tracking-widest font-mono", TIER_COLOR[meta.recommendedTier])}>
                                rec: {meta.recommendedTier}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600">{meta.desc}</div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {/* Model selector */}
                            <select
                              value={s.model}
                              onChange={(e) => updateStep(meta.id, { model: e.target.value })}
                              className="text-[11px] px-2.5 py-1.5 bg-[#0f1623] border border-white/10 rounded-lg text-slate-300 focus:outline-none focus:border-indigo-500/50"
                            >
                              {data!.catalog.map((m) => (
                                <option key={m.id} value={m.id}>{m.label}</option>
                              ))}
                            </select>
                            {/* Thinking toggle */}
                            {meta.canThink ? (
                              <>
                                <label className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={!!s.think}
                                    onChange={(e) => updateStep(meta.id, { think: e.target.checked })}
                                    className="accent-indigo-400"
                                  />
                                  think
                                </label>
                                <select
                                  value={s.effort}
                                  disabled={!s.think}
                                  onChange={(e) => updateStep(meta.id, { effort: e.target.value })}
                                  className={clsx(
                                    "text-[10px] px-2 py-1.5 bg-[#0f1623] border border-white/10 rounded-lg text-slate-400 focus:outline-none focus:border-indigo-500/50 transition-opacity",
                                    !s.think && "opacity-40"
                                  )}
                                >
                                  {(data!.effortLevels ?? ["low","medium","high","xhigh","max"]).map((e) => (
                                    <option key={e} value={e}>{e}</option>
                                  ))}
                                </select>
                              </>
                            ) : (
                              <span className="text-[9px] font-mono text-slate-700">no thinking</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-7 py-4 border-t border-white/8 flex items-center justify-between gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:text-slate-300 bg-white/5 hover:bg-white/8 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!steps || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {saveMutation.isPending ? "Saving…" : "Save settings"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
