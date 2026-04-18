/**
 * Training platform API client.
 * Derives the HTTP base URL from VITE_BACKEND_WSS_URL.
 */

function getBaseUrl() {
  const wss = import.meta.env.VITE_BACKEND_WSS_URL;
  if (!wss) return "";
  try {
    const url = new URL(wss);
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    url.pathname = "";
    return url.origin;
  } catch {
    return "";
  }
}

async function apiFetch(path, opts = {}) {
  const base = getBaseUrl();
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function fetchScenarios() {
  return apiFetch("/api/training/scenarios");
}

export function createSession(scenario_id, tester_name) {
  return apiFetch("/api/training/sessions", {
    method: "POST",
    body: JSON.stringify({ scenario_id, tester_name }),
  });
}

export function endSession(id, { rating, feedback_text, duration_ms }) {
  return apiFetch(`/api/training/sessions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ rating, feedback_text, duration_ms }),
  });
}

export function createFlag(session_id, timestamp_ms, note, flag_type = "general") {
  return apiFetch("/api/training/flags", {
    method: "POST",
    body: JSON.stringify({ session_id, timestamp_ms, note, flag_type }),
  });
}

// Admin endpoints
export function fetchAdminSessions(adminKey, { limit, offset, scenario_id } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", limit);
  if (offset) params.set("offset", offset);
  if (scenario_id) params.set("scenario_id", scenario_id);
  return apiFetch(`/api/training/admin/sessions?${params}`, {
    headers: { "x-admin-key": adminKey },
  });
}

export function fetchAdminSessionDetail(adminKey, id) {
  return apiFetch(`/api/training/admin/sessions/${id}`, {
    headers: { "x-admin-key": adminKey },
  });
}

export function fetchAdminStats(adminKey) {
  return apiFetch("/api/training/admin/stats", {
    headers: { "x-admin-key": adminKey },
  });
}
