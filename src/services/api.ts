export const API_BASE = import.meta.env.VITE_API_BASE || "/api";

export const getToken = (): string | null => localStorage.getItem("token");

export const apiFetch = async (url: string, options: any = {}) => {
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

    if (response.status === 401) {
        localStorage.removeItem("token");
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
