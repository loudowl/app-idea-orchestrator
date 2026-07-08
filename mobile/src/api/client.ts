import { Platform } from "react-native";

// On Android emulator, localhost is 10.0.2.2
const BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === "android" ? "http://10.0.2.2:3003" : "http://localhost:3003");

export const WS_BASE = BASE.replace(/^http/, "ws");

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export interface Idea {
  _id: string;
  name: string;
  tagline: string;
  description: string;
  complexity: "simple" | "medium" | "complex";
  category: string;
  techStack: string[];
  keyFeatures: string[];
  monetizationStrategy: string;
  estimatedRevenueModel: string;
  easeOfMonetization: number;
  timeToMVP: string;
  createdAt: string;
}

export interface Execution {
  id: string;
  idea_id: string;
  idea_name: string;
  idea_tagline: string;
  idea_complexity: string;
  idea_category: string;
  status: "pending" | "running" | "done" | "error" | "pushed";
  github_url: string | null;
  created_at: string;
}

export const fetchIdeas = (params: Record<string, string> = {}) => {
  const q = new URLSearchParams({ limit: "30", sort: "-createdAt", ...params }).toString();
  return req<{ ideas: Idea[]; total: number }>(`/api/ideas?${q}`);
};

export const fetchExecutions = () =>
  req<{ executions: Execution[] }>("/api/executions");

export const createExecution = (idea: Idea) =>
  req<{ execution: Execution }>("/api/executions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea }),
  });

export const pushToGithub = (id: string) =>
  req<{ github_url: string }>(`/api/executions/${id}/push`, { method: "POST" });

export const forceRun = () =>
  req<{ message: string }>("/api/force-run", { method: "POST" });

export const SSE_URL = `${BASE}/api/events`;
