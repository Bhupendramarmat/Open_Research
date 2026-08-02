// API configuration — uses the Vite dev-server proxy (/api -> localhost:8000)
// so that all requests stay same-origin, avoiding CORS issues.
export const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export const API_ENDPOINTS = {
  SEARCH: `${API_BASE_URL}/api/search`,
  HEALTH: `${API_BASE_URL}/api/health`,
};

export async function searchPapers(
  payload: {
  query: string;
  num_papers: number;
  year_range: string;
  peer_reviewed_only: boolean;
  },
  options?: { signal?: AbortSignal }
) {
  const res = await fetch(API_ENDPOINTS.SEARCH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: options?.signal,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to fetch research data");
  }

  return res.json();
}
