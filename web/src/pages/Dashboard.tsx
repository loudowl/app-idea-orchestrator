import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, Zap, Search, LayoutGrid, List, Cpu } from "lucide-react";
import { fetchIdeas, fetchExecutions, createExecution, forceRun, fetchModels, type Idea, type Execution, type Provider } from "../api/client";
import IdeaCard from "../components/IdeaCard";
import IdeaRow from "../components/IdeaRow";
import IdeaDetailModal from "../components/IdeaDetailModal";
import RunProgressPanel from "../components/RunProgressPanel";
import AgentSettingsModal from "../components/AgentSettingsModal";
import StatsBar from "../components/StatsBar";
import ExecutionPanel from "./ExecutionPanel";
import clsx from "clsx";

type Complexity = "all" | "simple" | "medium" | "complex";
type ViewMode = "grid" | "compact";
type PageSize = 10 | 50 | 100 | 200 | 300 | "all";

const PAGE_SIZE_OPTIONS: { value: PageSize; label: string }[] = [
  { value: 10,    label: "10"  },
  { value: 50,    label: "50"  },
  { value: 100,   label: "100" },
  { value: 200,   label: "200" },
  { value: 300,   label: "300" },
  { value: "all", label: "All" },
];

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "ollama", label: "Ollama" },
];

function loadProvider(): Provider {
  const v = localStorage.getItem("orchestrator:provider");
  return v === "openai" || v === "anthropic" || v === "ollama" ? v : "openai";
}

export default function Dashboard() {
  const qc = useQueryClient();
  const [complexity, setComplexity] = useState<Complexity>("all");
  const [search, setSearch] = useState("");
  const [activeExecution, setActiveExecution] = useState<string | null>(null);
  const [forceToast, setForceToast] = useState(false);
  const [provider, setProvider] = useState<Provider>(loadProvider);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Reset to page 1 when filters or page size change
  useEffect(() => { setPage(1); }, [complexity, search, pageSize]);

  const modelsQuery = useQuery({
    queryKey: ["models"],
    queryFn: fetchModels,
    staleTime: 60_000,
  });

  const selectProvider = (p: Provider) => {
    setProvider(p);
    localStorage.setItem("orchestrator:provider", p);
  };

  const ideasQuery = useQuery({
    queryKey: ["ideas", complexity, search, pageSize, page],
    queryFn: () => fetchIdeas({
      ...(complexity !== "all" ? { complexity } : {}),
      ...(search ? { search } : {}),
      limit: pageSize === "all" ? "9999" : String(pageSize),
      page: String(page),
      sort: "-createdAt",
    }),
    staleTime: 30_000,
  });

  const executionsQuery = useQuery({
    queryKey: ["executions"],
    queryFn: fetchExecutions,
    staleTime: 10_000,
    refetchInterval: 8_000, // poll for status updates
  });

  // Map idea_id → execution for quick lookup
  const executionMap: Record<string, Execution> = {};
  (executionsQuery.data?.executions ?? []).forEach((ex) => {
    executionMap[ex.idea_id] = ex;
  });

  const forceMutation = useMutation({
    mutationFn: forceRun,
    onSuccess: () => {
      setShowProgress(true);
      setForceToast(true);
      setTimeout(() => setForceToast(false), 3000);
    },
  });

  const executeMutation = useMutation({
    mutationFn: (idea: Idea) => createExecution(idea, provider),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["executions"] });
      setActiveExecution(data.execution.id);
    },
  });

  const ideas = ideasQuery.data?.ideas ?? [];
  const totalPages = ideasQuery.data?.pages ?? 1;
  const totalIdeas = ideasQuery.data?.total ?? 0;
  const showPagination = pageSize !== "all" && totalPages > 1;

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 font-sans">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-white/8 bg-[#0a0e1a]/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2.5 mr-4">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-semibold text-sm text-slate-100 tracking-tight">Idea Orchestrator</span>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-sm relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ideas…"
              className="w-full bg-[#111827] border border-white/8 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
            />
          </div>

          {/* Complexity filter */}
          <div className="flex gap-1">
            {(["all", "simple", "medium", "complex"] as Complexity[]).map((c) => (
              <button
                key={c}
                onClick={() => setComplexity(c)}
                className={clsx(
                  "px-3 py-1 text-xs rounded-lg border transition-colors capitalize",
                  complexity === c
                    ? c === "simple"  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                    : c === "medium"  ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                    : c === "complex" ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
                    : "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                    : "border-white/8 text-slate-500 hover:text-slate-300 hover:border-white/15"
                )}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Provider selector — playground: run pipelines on any provider */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-slate-600 hidden lg:inline">Model</span>
            <div className="flex rounded-xl border border-white/8 overflow-hidden">
              {PROVIDERS.map((p) => {
                const info = modelsQuery.data?.providers?.[p.id];
                const available = info ? info.available : true;
                return (
                  <button
                    key={p.id}
                    onClick={() => selectProvider(p.id)}
                    title={
                      info
                        ? `${available ? "Available" : "Not configured"} — ${info.model}`
                        : p.label
                    }
                    className={clsx(
                      "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                      provider === p.id
                        ? "bg-indigo-600/30 text-indigo-200"
                        : "text-slate-500 hover:text-slate-300"
                    )}
                  >
                    <span
                      className={clsx(
                        "w-1.5 h-1.5 rounded-full",
                        available ? "bg-emerald-400" : "bg-amber-400"
                      )}
                    />
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Settings button */}
          <button
            onClick={() => setShowSettings(true)}
            title="Agent model settings"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/8 text-slate-500 hover:text-slate-300 hover:border-white/15 text-xs transition-colors"
          >
            <Cpu size={13} />
            <span className="hidden lg:inline">Models</span>
          </button>

          {/* Force run */}
          <button
            onClick={() => forceMutation.mutate()}
            disabled={forceMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-xs font-medium transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40"
          >
            <RefreshCw size={13} className={forceMutation.isPending ? "animate-spin" : ""} />
            Force Idea
          </button>
        </div>
      </header>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {forceToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white text-xs px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2"
          >
            <RefreshCw size={12} className="animate-spin" />
            Agent dispatched — new ideas incoming…
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <StatsBar />

        {/* ── View controls toolbar ──────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-5">
          {/* Left: view toggle */}
          <div className="flex items-center gap-3">
            <div className="flex rounded-xl border border-white/8 overflow-hidden">
              <button
                onClick={() => setViewMode("grid")}
                title="Grid view"
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                  viewMode === "grid"
                    ? "bg-indigo-600/30 text-indigo-200"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                <LayoutGrid size={13} />
                Grid
              </button>
              <button
                onClick={() => setViewMode("compact")}
                title="Compact list"
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                  viewMode === "compact"
                    ? "bg-indigo-600/30 text-indigo-200"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                <List size={13} />
                Compact
              </button>
            </div>
            {totalIdeas > 0 && (
              <span className="text-xs text-slate-600 font-mono">{totalIdeas} ideas</span>
            )}
          </div>

          {/* Right: page-size selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-slate-600 hidden sm:inline">Show</span>
            <div className="flex rounded-xl border border-white/8 overflow-hidden">
              {PAGE_SIZE_OPTIONS.map(({ value, label }) => (
                <button
                  key={label}
                  onClick={() => setPageSize(value)}
                  className={clsx(
                    "px-2.5 py-1.5 text-xs font-mono transition-colors",
                    pageSize === value
                      ? "bg-indigo-600/30 text-indigo-200"
                      : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Ideas content ──────────────────────────────────────────────── */}
        {ideasQuery.isLoading ? (
          viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-72 bg-[#0f1623] border border-white/8 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 bg-[#0f1623] border border-white/8 rounded-xl animate-pulse" />
              ))}
            </div>
          )
        ) : ideas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-600">
            <Zap size={32} className="mb-3 opacity-40" />
            <p className="text-sm">No ideas yet. Hit <strong>Force Idea</strong> to kick off the agent.</p>
          </div>
        ) : viewMode === "grid" ? (
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {ideas.map((idea) => (
                <IdeaCard
                  key={idea._id}
                  idea={idea}
                  execution={executionMap[idea._id]}
                  onExecute={(idea) => executeMutation.mutate(idea)}
                  onViewExecution={setActiveExecution}
                  onInfo={setSelectedIdea}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-2">
            {ideas.map((idea) => (
              <IdeaRow
                key={idea._id}
                idea={idea}
                execution={executionMap[idea._id]}
                onExecute={(idea) => executeMutation.mutate(idea)}
                onViewExecution={setActiveExecution}
                onInfo={setSelectedIdea}
              />
            ))}
          </div>
        )}

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        {showPagination && !ideasQuery.isLoading && ideas.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 mt-8">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/8 text-slate-500 hover:text-slate-300 hover:border-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
            >
              ‹
            </button>
            {Array.from({ length: Math.min(totalPages, 9) }, (_, i) => {
              let p: number;
              if (totalPages <= 9) {
                p = i + 1;
              } else if (page <= 5) {
                p = i + 1;
              } else if (page >= totalPages - 4) {
                p = totalPages - 8 + i;
              } else {
                p = page - 4 + i;
              }
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={clsx(
                    "w-8 h-8 flex items-center justify-center rounded-lg border text-xs font-mono transition-colors",
                    page === p
                      ? "bg-indigo-600/30 border-indigo-500/40 text-indigo-200"
                      : "border-white/8 text-slate-500 hover:text-slate-300 hover:border-white/15"
                  )}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/8 text-slate-500 hover:text-slate-300 hover:border-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
            >
              ›
            </button>
          </div>
        )}
      </main>

      {/* ── Execution slide-over panel ────────────────────────────────────── */}
      <AnimatePresence>
        {activeExecution && (
          <ExecutionPanel
            executionId={activeExecution}
            onClose={() => setActiveExecution(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Idea detail modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedIdea && (
          <IdeaDetailModal
            idea={selectedIdea}
            onClose={() => setSelectedIdea(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Agent run progress panel ──────────────────────────────────────── */}
      <RunProgressPanel
        open={showProgress}
        onClose={() => setShowProgress(false)}
        onViewNewIdeas={() => {
          qc.invalidateQueries({ queryKey: ["ideas"] });
          qc.invalidateQueries({ queryKey: ["stats"] });
        }}
      />

      {/* ── Agent model settings modal ────────────────────────────────────── */}
      <AgentSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}
