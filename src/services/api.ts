export const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export const getToken = (): string | null => localStorage.getItem("token");
export const getRefreshToken = (): string | null => localStorage.getItem("refresh_token");
export const setTokens = (access: string, refresh: string) => {
    localStorage.setItem("token", access);
    localStorage.setItem("refresh_token", refresh);
};
export const clearTokens = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
};

// ── Silent refresh ────────────────────────────────────────────────────────
// Single in-flight refresh: concurrent 401s share one promise instead of
// firing N parallel /auth/refresh calls.
let _refreshPromise: Promise<string> | null = null;

async function _doRefresh(): Promise<string> {
    const rt = getRefreshToken();
    if (!rt) throw new Error("No refresh token");

    const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
    });

    if (!res.ok) {
        clearTokens();
        window.location.href = "/login";
        throw new Error("Session expired");
    }

    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return data.access_token;
}

function refreshOnce(): Promise<string> {
    if (!_refreshPromise) {
        _refreshPromise = _doRefresh().finally(() => { _refreshPromise = null; });
    }
    return _refreshPromise;
}

// ── Core fetch ────────────────────────────────────────────────────────────

export const apiFetch = async (url: string, options: any = {}, _retry = true): Promise<any> => {
    const token = getToken();
    const isFormData = options.body instanceof FormData;
    const headers: any = { ...options.headers };

    if (!isFormData && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${url}`, { ...options, headers });

    if (response.status === 401 && _retry) {
        // Try silent refresh once, then replay the original request
        try {
            const newToken = await refreshOnce();
            return apiFetch(url, {
                ...options,
                headers: { ...options.headers, Authorization: `Bearer ${newToken}` },
            }, false);
        } catch {
            // refreshOnce already cleared tokens + redirected
            throw new Error("Session expired");
        }
    }

    if (response.status === 401) {
        clearTokens();
        window.location.href = "/login";
        throw new Error("Session expired");
    }

    if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Something went wrong" }));
        throw err;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
};

export const api = {
    get: (url: string) => apiFetch(url),
    post: (url: string, body: any) =>
        apiFetch(url, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body) }),
    patch: (url: string, body: any) =>
        apiFetch(url, { method: "PATCH", body: body instanceof FormData ? body : JSON.stringify(body) }),
    put: (url: string, body: any) =>
        apiFetch(url, { method: "PUT", body: body instanceof FormData ? body : JSON.stringify(body) }),
    delete: (url: string) => apiFetch(url, { method: "DELETE" }),
};

export const candidateApi = {
    fetchNew: () => api.get("/candidates/new"),
    fetchFromEmail: (credentials: any) => api.post("/candidates/fetch-from-email", credentials),
};

export const analyticsApi = {
    getOverview: () => api.get("/analytics/overview"),
    getRequirementsTracker: () => api.get("/analytics/requirements-tracker"),
    getSubmissions: (params: Record<string, any> = {}) => {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => { if (v != null && v !== "") qs.set(k, String(v)); });
        const q = qs.toString();
        return api.get(`/analytics/submissions${q ? `?${q}` : ""}`);
    },
    getInterviews: () => api.get("/analytics/interviews"),
    getSelections: () => api.get("/analytics/selections"),
    getRecruiterMetrics: () => api.get("/analytics/recruiters"),
    getInsights: () => api.get("/analytics/insights"),
};
