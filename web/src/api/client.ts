const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3003";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.detail || `API ${res.status}`);
  }
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type Provider = "openai" | "anthropic" | "ollama";

export interface OllamaModel {
  name: string;
  size?: number;
}

export interface ModelsResponse {
  ollama: OllamaModel[];
  providers: Record<Provider, { available: boolean; model: string }>;
}

export interface Idea {
  _id: string;
  name: string;
  tagline: string;
  description: string;
  complexity: "simple" | "medium" | "complex";
  category: string;
  keyFeatures: string[];
  techStack: string[];
  thirdPartyAPIs: string[];
  monetizationStrategy: string;
  estimatedRevenueModel: string;
  easeOfMonetization: number;
  complexityRationale: string;
  timeToMVP: string;
  targetPlatforms: string[];
  trendBasis: string;
  trendSources: string[];
  buildPrompt: string;
  createdAt: string;
}

export interface IdeasResponse {
  total: number;
  page: number;
  pages: number;
  ideas: Idea[];
}

export interface Execution {
  id: string;
  idea_id: string;
  idea_name: string;
  idea_tagline: string;
  idea_brief: string;
  idea_complexity: string;
  idea_category: string;
  project_id: string | null;
  status: "pending" | "running" | "done" | "error" | "pushed";
  github_url: string | null;
  created_at: string;
  updated_at: string;
  project?: any;
}

export interface AgentRun {
  id: number;
  project_id: string;
  agent: "pm" | "designer" | "architect" | "developer";
  status: "pending" | "running" | "done" | "error";
  output: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface Stats {
  total: number;
  byComplexity: { _id: string; count: number }[];
  byCategory: { _id: string; count: number }[];
  recent: Idea[];
}

// ── Ideas ─────────────────────────────────────────────────────────────────────

export const fetchIdeas = (params: Record<string, string> = {}): Promise<IdeasResponse> => {
  const q = new URLSearchParams(params).toString();
  return req(`/api/ideas${q ? "?" + q : ""}`);
};

export const fetchStats = (): Promise<Stats> => req("/api/ideas/stats");

export const fetchIdea = (id: string): Promise<Idea> => req(`/api/ideas/${id}`);

export const fetchCategories = (): Promise<string[]> => req("/api/categories");

export const forceRun = (): Promise<{ message: string }> =>
  req("/api/force-run", { method: "POST" });

// ── Executions ────────────────────────────────────────────────────────────────

export const fetchExecutions = (): Promise<{ executions: Execution[] }> =>
  req("/api/executions");

export const fetchExecution = (id: string): Promise<{ execution: Execution; project: any; agents: AgentRun[] }> =>
  req(`/api/executions/${id}`);

export const createExecution = (idea: Idea, provider: Provider = "openai"): Promise<{ execution: Execution; project: any }> =>
  req("/api/executions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea, provider }),
  });

export const pushToGithub = (executionId: string): Promise<{ github_url: string }> =>
  req(`/api/executions/${executionId}/push`, { method: "POST" });

export const retryExecution = (
  executionId: string,
  provider: Provider = "openai"
): Promise<{ execution: Execution }> =>
  req(`/api/executions/${executionId}/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider }),
  });

// ── Models / providers ──────────────────────────────────────────────────────────

export const fetchModels = (): Promise<ModelsResponse> => req("/api/models");

// ── SSE ───────────────────────────────────────────────────────────────────────

export const SSE_URL = `${BASE}/api/events`;
export const WS_URL = BASE.replace(/^http/, "ws") + "/ws";
