import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { X, Github, ExternalLink, CheckCircle, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { fetchExecution, pushToGithub, retryExecution, type Provider } from "../api/client";
import AgentProgress from "../components/AgentProgress";
import { useExecutionWS } from "../hooks/useExecutionWS";
import clsx from "clsx";

interface Props {
  executionId: string;
  onClose: () => void;
}

export default function ExecutionPanel({ executionId, onClose }: Props) {
  const qc = useQueryClient();
  const [retryProvider, setRetryProvider] = useState<Provider>("openai");

  const { data, isLoading } = useQuery({
    queryKey: ["execution", executionId],
    queryFn: () => fetchExecution(executionId),
    staleTime: 5_000,
    refetchInterval: (query) => {
      const s = (query.state.data as any)?.execution?.status;
      return s === "running" || s === "pending" ? 3_000 : false;
    },
  });

  const { events, connected, reset } = useExecutionWS(
    data?.execution?.status === "running" ? executionId : null
  );

  const pushMutation = useMutation({
    mutationFn: () => pushToGithub(executionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["execution", executionId] });
      qc.invalidateQueries({ queryKey: ["executions"] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: () => retryExecution(executionId, retryProvider),
    onSuccess: () => {
      reset(); // clear stale WS events from the failed run
      qc.invalidateQueries({ queryKey: ["execution", executionId] });
      qc.invalidateQueries({ queryKey: ["executions"] });
    },
  });

  const ex = data?.execution;
  const project = data?.project;
  const agents = data?.agents ?? [];
  const isDone = ex?.status === "done" || ex?.status === "pushed";
  const isRunning = ex?.status === "running";
  const isPushed = ex?.status === "pushed";
  const isError = ex?.status === "error";
  const errorReason =
    agents.find((a) => a.status === "error")?.output?.trim() ||
    "The execution failed before completing. You can retry the attempt below.";

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 h-full w-full max-w-2xl bg-[#0a0e1a] border-l border-white/8 z-40 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              {ex?.idea_name ?? "Execution"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{ex?.idea_tagline}</p>
            {project?.provider && (
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-slate-500 border border-white/8 rounded-full px-2 py-0.5">
                <span className="capitalize text-slate-400">{project.provider}</span>
                {project.model && <span className="text-slate-600">· {project.model}</span>}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Status badge */}
            {ex && (
              <span className={clsx(
                "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border",
                isRunning ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                : isDone   ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : isPushed ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
                : "border-rose-500/40 bg-rose-500/10 text-rose-300"
              )}>
                {isRunning && <Loader2 size={11} className="animate-spin" />}
                {isDone    && <CheckCircle size={11} />}
                {ex.status === "error" && <AlertCircle size={11} />}
                <span className="capitalize">{ex.status}</span>
              </span>
            )}
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <>
              {/* Error banner */}
              {isError && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-rose-300">
                    <AlertCircle size={13} />
                    Execution failed
                  </div>
                  <pre className="mt-2 text-[11px] text-rose-200/80 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {errorReason.slice(0, 1200)}{errorReason.length > 1200 ? "\n…" : ""}
                  </pre>
                  <p className="mt-2 text-[11px] text-slate-400">
                    Retry below — switch the model provider if one is rate-limited.
                  </p>
                </div>
              )}

              {/* WS connection indicator */}
              {isRunning && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className={clsx("w-1.5 h-1.5 rounded-full", connected ? "bg-green-400 animate-pulse" : "bg-slate-600")} />
                  {connected ? "Live stream connected" : "Connecting to agent stream…"}
                </div>
              )}

              {/* Agent progress — live stream takes priority, then DB snapshot */}
              {(events.length > 0 || isRunning) ? (
                <AgentProgress events={events} executionName={ex?.idea_name ?? ""} />
              ) : agents.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="text-xs font-medium text-slate-400">Agent Outputs</h4>
                  {agents.map((a) => (
                    <div key={a.id} className="border border-white/8 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-white/3">
                        <span className="text-xs font-mono text-slate-400 capitalize">{a.agent}</span>
                        <span className={clsx(
                          "ml-auto text-[10px] px-1.5 py-0.5 rounded-full",
                          a.status === "done"    ? "bg-emerald-500/15 text-emerald-400"
                          : a.status === "error" ? "bg-rose-500/15 text-rose-400"
                          : "bg-blue-500/15 text-blue-400"
                        )}>{a.status}</span>
                      </div>
                      {a.output && (
                        <div className="px-3 py-2 bg-[#080c14] max-h-48 overflow-y-auto">
                          <pre className="text-[11px] text-slate-400 font-mono whitespace-pre-wrap">
                            {a.output.slice(0, 1500)}{a.output.length > 1500 ? "\n…" : ""}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-600 text-sm">
                  Waiting for agent pipeline to start…
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-white/8 flex items-center gap-3">
          {isError && (
            <>
              <div className="flex rounded-xl border border-white/10 overflow-hidden text-xs">
                {(["openai", "anthropic", "ollama"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setRetryProvider(p)}
                    disabled={retryMutation.isPending}
                    className={clsx(
                      "px-2.5 py-2.5 font-medium capitalize transition-colors disabled:opacity-60",
                      retryProvider === p
                        ? "bg-indigo-600/30 text-indigo-200"
                        : "bg-transparent text-slate-500 hover:text-slate-300"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                onClick={() => retryMutation.mutate()}
                disabled={retryMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors disabled:opacity-60"
              >
                <RefreshCw size={15} className={retryMutation.isPending ? "animate-spin" : ""} />
                {retryMutation.isPending ? "Retrying…" : "Retry"}
              </button>
            </>
          )}
          {isDone && !isPushed && (
            <button
              onClick={() => pushMutation.mutate()}
              disabled={pushMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-sm font-medium text-slate-200 transition-colors disabled:opacity-60"
            >
              <Github size={15} />
              {pushMutation.isPending ? "Pushing…" : "Push to GitHub"}
            </button>
          )}
          {isPushed && ex?.github_url && (
            <a
              href={ex.github_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-sm font-medium text-purple-300 transition-colors"
            >
              <ExternalLink size={15} />
              View on GitHub
            </a>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-white/8 text-xs text-slate-500 hover:text-slate-300 hover:border-white/15 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </>
  );
}
