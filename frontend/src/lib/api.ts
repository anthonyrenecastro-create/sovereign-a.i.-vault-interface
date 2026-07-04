export type Role = "user" | "assistant" | "system";

export interface Turn {
  role: Role;
  content: string;
}

export interface AssistantProfile {
  id: string;
  name: string;
  description: string;
  model: string;
  privileged: boolean;
  system_prompt: string;
}

export interface AuthUser {
  username: string;
  role: string;
}

export interface AuthUserRecord {
  username: string;
  role: string;
  disabled: boolean;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

export interface IndexStats {
  total_chunks: number;
  total_documents: number;
  vectorized_chunks: number;
  embedding_model: string;
  state_file: string;
  source_counts: Record<string, number>;
}

export interface IndexSearchResult {
  title: string;
  content: string;
  source_type: string;
  source_id: string;
  indexed_at: string;
  fingerprint: string;
}

function inferApiBase(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured && configured.trim()) {
    return configured.trim();
  }

  if (import.meta.env.DEV) {
    return "";
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    if (/^\d+-/.test(hostname)) {
      return `${protocol}//${hostname.replace(/^\d+-/, "8000-")}`;
    }
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${protocol}//${hostname}:8000`;
    }
  }

  return "http://127.0.0.1:8000";
}

const API_BASE = inferApiBase();

export function getApiBase(): string {
  return API_BASE || "/api (same-origin via Vite proxy)";
}

export async function fetchAssistants(): Promise<AssistantProfile[]> {
  const res = await fetch(`${API_BASE}/api/assistants`);
  if (!res.ok) {
    throw new Error("Failed to fetch assistants");
  }
  return res.json();
}

export async function getHealth(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) {
    throw new Error("Health check failed");
  }
  return res.json();
}

export async function sendChat(payload: {
  assistant_id: string;
  message: string;
  history: Turn[];
  use_retrieval: boolean;
  max_context_chunks?: number;
  retrieval_source_types?: string[];
}): Promise<{ response: string; model: string; retrieved_context: string[] }> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Chat request failed");
  }

  return res.json();
}

export async function indexDocument(
  title: string,
  content: string,
  source_type = "manual",
  source_id = ""
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/index/document`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content, source_type, source_id }),
  });
  if (!res.ok) {
    throw new Error("Failed to index document");
  }
}

export async function uploadIndexedDocument(payload: {
  file: File;
  title?: string;
  sourceType?: string;
  sourceId?: string;
}): Promise<{ status: string; parsed_type: string; chunks_added: number }> {
  const form = new FormData();
  form.append("file", payload.file);
  if (payload.title) {
    form.append("title", payload.title);
  }
  form.append("source_type", payload.sourceType || "upload");
  if (payload.sourceId) {
    form.append("source_id", payload.sourceId);
  }

  const res = await fetch(`${API_BASE}/api/index/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Upload indexing failed");
  }

  return res.json();
}

export async function getIndexStats(): Promise<IndexStats> {
  const res = await fetch(`${API_BASE}/api/index/stats`);
  if (!res.ok) {
    throw new Error("Failed to fetch index stats");
  }
  return res.json();
}

export async function searchIndex(payload: {
  query: string;
  mode: "semantic" | "keyword";
  top_k?: number;
  source_types?: string[];
}): Promise<{ status: string; mode: string; query: string; count: number; results: IndexSearchResult[] }> {
  const res = await fetch(`${API_BASE}/api/index/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Search failed");
  }

  return res.json();
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Login failed");
  }

  return res.json();
}

export async function verifyAdmin(options: {
  bearerToken?: string;
  legacyToken?: string;
}): Promise<boolean> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  let body: string;

  if (options.bearerToken?.trim()) {
    headers.Authorization = `Bearer ${options.bearerToken.trim()}`;
    body = JSON.stringify({ token: "" });
  } else {
    body = JSON.stringify({ token: options.legacyToken || "" });
  }

  const res = await fetch(`${API_BASE}/api/admin/verify`, {
    method: "POST",
    headers,
    body,
  });

  return res.ok;
}

export async function runAdminShell(payload: {
  command: string;
  bearerToken?: string;
  legacyToken?: string;
}): Promise<{ exit_code: number; stdout: string; stderr: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  let url = `${API_BASE}/api/admin/shell/run`;
  if (payload.bearerToken?.trim()) {
    headers.Authorization = `Bearer ${payload.bearerToken.trim()}`;
  } else if (payload.legacyToken?.trim()) {
    url = `${url}?token=${encodeURIComponent(payload.legacyToken.trim())}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ command: payload.command }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Admin command failed");
  }

  return res.json();
}

export async function getAdminDiagnostics(payload: {
  bearerToken?: string;
  legacyToken?: string;
}): Promise<any> {
  const headers: Record<string, string> = {};
  let url = `${API_BASE}/api/admin/diagnostics`;

  if (payload.bearerToken?.trim()) {
    headers.Authorization = `Bearer ${payload.bearerToken.trim()}`;
  } else if (payload.legacyToken?.trim()) {
    url = `${url}?token=${encodeURIComponent(payload.legacyToken.trim())}`;
  }

  const res = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Admin diagnostics failed");
  }

  return res.json();
}

export async function listAuthUsers(bearerToken: string): Promise<AuthUserRecord[]> {
  const res = await fetch(`${API_BASE}/api/auth/users`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to list users");
  }

  const data = await res.json();
  return (data.users || []) as AuthUserRecord[];
}

export async function createAuthUser(payload: {
  bearerToken: string;
  username: string;
  password: string;
  role: string;
}): Promise<AuthUserRecord> {
  const res = await fetch(`${API_BASE}/api/auth/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${payload.bearerToken}`,
    },
    body: JSON.stringify({
      username: payload.username,
      password: payload.password,
      role: payload.role,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to create user");
  }

  const data = await res.json();
  return data.user as AuthUserRecord;
}

export async function updateAuthUser(payload: {
  bearerToken: string;
  username: string;
  role?: string;
  disabled?: boolean;
}): Promise<AuthUserRecord> {
  const res = await fetch(`${API_BASE}/api/auth/users/${encodeURIComponent(payload.username)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${payload.bearerToken}`,
    },
    body: JSON.stringify({
      role: payload.role,
      disabled: payload.disabled,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to update user");
  }

  const data = await res.json();
  return data.user as AuthUserRecord;
}

export async function resetAuthUserPassword(payload: {
  bearerToken: string;
  username: string;
  password: string;
}): Promise<AuthUserRecord> {
  const res = await fetch(`${API_BASE}/api/auth/users/${encodeURIComponent(payload.username)}/password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${payload.bearerToken}`,
    },
    body: JSON.stringify({ password: payload.password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to reset password");
  }

  const data = await res.json();
  return data.user as AuthUserRecord;
}
