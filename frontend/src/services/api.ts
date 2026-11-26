import type { Assessment, AssessmentSummary, Dashboard, DemoScenario, ProductSpec, Reference } from "../types";

export class ApiError extends Error {
  status: number;
  fields: { field: string; message: string }[];
  constructor(message: string, status: number, fields: { field: string; message: string }[] = []) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

const TOKEN_KEY = "wbw.token";
export const SESSION_ENDED = "wbw:session-ended";
export const authToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** JSON request to the backend. Sends the signed-in user's token when there is one. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  const token = authToken.get();
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError("Cannot reach the assessment service. Is the backend running on port 8000?", 0);
  }
  if (res.status === 401 && token) {
    // The server no longer accepts this sign-in: drop it so the app shows the sign-in prompt.
    authToken.clear();
    window.dispatchEvent(new Event(SESSION_ENDED));
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status}).`;
    let fields: { field: string; message: string }[] = [];
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
      if (Array.isArray(body.errors)) fields = body.errors;
    } catch {
      if (res.status >= 500) detail = "The assessment service is unavailable. Is the backend running on port 8000?";
    }
    throw new ApiError(detail, res.status, fields);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

async function download(path: string, fallbackName: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`);
  } catch {
    throw new ApiError("Cannot reach the assessment service.", 0);
  }
  if (!res.ok) throw new ApiError(`Download failed (${res.status}).`, res.status);
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return name;
}

export const api = {
  health: () => request<{ status: string }>("/health"),
  reference: () => request<Reference>("/reference"),
  demoScenarios: () => request<DemoScenario[]>("/demo-scenarios"),
  dashboard: () => request<Dashboard>("/dashboard"),
  listAssessments: () => request<AssessmentSummary[]>("/assessments"),
  getAssessment: (id: number | string) => request<Assessment>(`/assessments/${id}`),
  createAssessment: (spec: ProductSpec) =>
    request<Assessment>("/assessments", { method: "POST", body: JSON.stringify(spec) }),
  deleteAssessment: (id: number) => request<void>(`/assessments/${id}`, { method: "DELETE" }),
  optimize: (id: number, recommendation_ids: string[]) =>
    request<Assessment>(`/assessments/${id}/optimize`, {
      method: "POST",
      body: JSON.stringify({ recommendation_ids }),
    }),
  resetDemo: () => request<{ seeded: number }>("/demo/reset", { method: "POST" }),
  downloadPdf: (id: number) => download(`/assessments/${id}/report.pdf`, `wbw-report-${id}.pdf`),
  downloadJson: (id: number) => download(`/assessments/${id}/export.json`, `wbw-report-${id}.json`),
};
