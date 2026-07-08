import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, DollarSign, Zap, Target, Copy, Check } from "lucide-react";
import type { Idea } from "../api/client";
import clsx from "clsx";

interface Props {
  idea: Idea;
  onClose: () => void;
}

const COMPLEXITY_STYLES = {
  simple:  { badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400", bar: "bg-emerald-400" },
  medium:  { badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",       dot: "bg-amber-400",   bar: "bg-amber-400"   },
  complex: { badge: "bg-rose-500/15 text-rose-300 border-rose-500/30",          dot: "bg-rose-400",    bar: "bg-rose-400"    },
};

function ScoreDots({ score }: { score: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            "w-2 h-2 rounded-full transition-colors",
            i < score ? "bg-indigo-400" : "bg-white/8"
          )}
        />
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-slate-600 mb-2 font-mono">{title}</div>
      {children}
    </div>
  );
}

export default function IdeaDetailModal({ idea, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const styles = COMPLEXITY_STYLES[idea.complexity] ?? COMPLEXITY_STYLES.medium;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const copyPrompt = () => {
    navigator.clipboard.writeText(idea.buildPrompt ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-10 pb-10 overflow-y-auto bg-black/70 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="relative w-full max-w-2xl bg-[#0a0e1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Complexity colour bar */}
          <div className={clsx("h-0.5 w-full", styles.bar)} />

          {/* Header */}
          <div className="px-7 pt-6 pb-5 border-b border-white/8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={clsx("text-xs px-2.5 py-0.5 rounded-full border font-medium", styles.badge)}>
                    <span className={clsx("inline-block w-1.5 h-1.5 rounded-full mr-1.5", styles.dot)} />
                    {idea.complexity}
                  </span>
                  <span className="text-xs text-slate-500 border border-white/8 rounded-full px-2 py-0.5">
                    {idea.category}
                  </span>
                  {(idea.targetPlatforms ?? []).map((p) => (
                    <span key={p} className="text-xs text-slate-600 border border-white/5 rounded-full px-2 py-0.5">
                      {p}
                    </span>
                  ))}
                </div>
                <h2 className="text-xl font-bold text-slate-100 leading-tight mb-1">{idea.name}</h2>
                <p className="text-sm text-slate-400 italic leading-relaxed">{idea.tagline}</p>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 mt-1 p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-7 py-6 space-y-6">

            {/* Quick-stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: <Clock size={11} />, label: "Time to MVP",    value: idea.timeToMVP },
                { icon: <DollarSign size={11} />, label: "Revenue",   value: idea.estimatedRevenueModel },
                { icon: <Zap size={11} />, label: "Monetise ease",    value: `${idea.easeOfMonetization}/10` },
              ].map(({ icon, label, value }) => (
                <div key={label} className="bg-white/3 border border-white/8 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-600 mb-1 font-mono">
                    {icon} {label}
                  </div>
                  <div className="text-sm font-medium text-slate-300 capitalize">{value}</div>
                </div>
              ))}
            </div>

            {/* Description */}
            <Section title="Concept">
              <p className="text-sm text-slate-400 leading-relaxed">{idea.description}</p>
            </Section>

            {/* Trend signal */}
            <Section title="Trend Signal">
              <p className="text-sm text-slate-400 leading-relaxed">{idea.trendBasis}</p>
              {(idea.trendSources ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(idea.trendSources ?? []).map((s, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 bg-white/5 border border-white/8 rounded text-slate-500 font-mono">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </Section>

            {/* Features + Tech */}
            <div className="grid grid-cols-2 gap-6">
              <Section title="Key Features">
                <div className="flex flex-col gap-2">
                  {(idea.keyFeatures ?? []).map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                      <span className="text-indigo-400 mt-0.5 flex-shrink-0 font-mono">▸</span>
                      {f}
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="Tech Stack">
                <div className="flex flex-wrap gap-1.5">
                  {(idea.techStack ?? []).map((t, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded font-mono">
                      {t}
                    </span>
                  ))}
                  {(idea.thirdPartyAPIs ?? []).map((a, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded font-mono">
                      {a}
                    </span>
                  ))}
                </div>
              </Section>
            </div>

            {/* Monetization */}
            <div className="bg-indigo-500/5 border border-indigo-500/15 rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-widest text-slate-600 mb-3 font-mono">Monetization</div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[10px] uppercase tracking-wide text-slate-600 font-mono">Ease</span>
                <ScoreDots score={idea.easeOfMonetization} />
                <span className="text-xs text-indigo-300 font-semibold font-mono ml-1">
                  {idea.easeOfMonetization}/10
                </span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{idea.monetizationStrategy}</p>
            </div>

            {/* Complexity rationale */}
            <Section title="Complexity Rationale">
              <p className="text-sm text-slate-400 leading-relaxed">{idea.complexityRationale}</p>
            </Section>

            {/* Build prompt */}
            {idea.buildPrompt && (
              <Section title="Build Prompt">
                <div className="relative">
                  <div className="bg-[#070b12] border border-white/8 rounded-xl p-4 text-xs text-slate-400 font-mono leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto">
                    {idea.buildPrompt}
                  </div>
                  <button
                    onClick={copyPrompt}
                    className="absolute top-3 right-3 flex items-center gap-1 text-[10px] px-2 py-1 bg-white/5 border border-white/8 rounded text-slate-500 hover:text-indigo-300 hover:border-indigo-500/30 transition-colors font-mono"
                  >
                    {copied ? <Check size={10} /> : <Copy size={10} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </Section>
            )}

            {/* Footer */}
            <div className="text-[10px] text-slate-700 font-mono pt-2 border-t border-white/5">
              Generated {new Date(idea.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              {idea.category && ` · ${idea.category}`}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
