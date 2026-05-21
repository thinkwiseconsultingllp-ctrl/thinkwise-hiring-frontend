import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";

interface AssignmentRequest {
    id: string;
    requirement_id: string;
    requirement_name: string;
    recruiter_id: string;
    recruiter_name: string | null;
    status: "pending" | "approved" | "rejected";
    message: string | null;
    decision_note: string | null;
    decided_by: string | null;
    decided_at: string | null;
    created_at: string;
}

function fmtDate(value?: string | null): string {
    if (!value) return "";
    try { return new Date(value).toLocaleString(); }
    catch { return String(value); }
}

export default function AssignmentRequests() {
    const { isAdmin, user } = useAuth();
    const [requests, setRequests] = useState<AssignmentRequest[]>([]);
    const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "all">("pending");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [acting, setActing] = useState<Set<string>>(new Set());
    const [noteFor, setNoteFor] = useState<{ id: string; mode: "approve" | "reject" } | null>(null);
    const [noteText, setNoteText] = useState("");

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (tab !== "all") params.set("status", tab);
            const rows = await api.get(`/assignment-requests${params.toString() ? `?${params.toString()}` : ""}`);
            setRequests(rows || []);
        } catch (e: any) {
            setError(e?.detail || e?.message || "Failed to load requests");
        } finally {
            setLoading(false);
        }
    }, [tab]);

    useEffect(() => { void fetchRequests(); }, [fetchRequests]);

    const decide = async (id: string, mode: "approve" | "reject", note?: string) => {
        setActing(prev => new Set(prev).add(id));
        setError(null);
        try {
            await api.post(`/assignment-requests/${id}/${mode}`, { note: note?.trim() || undefined });
            await fetchRequests();
        } catch (e: any) {
            setError(e?.detail || e?.message || `Could not ${mode}`);
        } finally {
            setActing(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            setNoteFor(null);
            setNoteText("");
        }
    };

    const filtered = useMemo(() => requests, [requests]);

    const Tab = ({ k, label }: { k: typeof tab; label: string }) => (
        <button
            onClick={() => setTab(k)}
            className="btn btn-ghost btn-sm"
            style={{
                background: tab === k ? "var(--accent)" : "transparent",
                color: tab === k ? "#fff" : "var(--text-secondary)",
                fontWeight: tab === k ? 600 : 400,
                borderRadius: 999, padding: "4px 14px",
            }}
        >{label}</button>
    );

    return (
        <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: 20 }}>Assignment Requests</h2>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                        {isAdmin ? "Approve or reject recruiter requests to be assigned to requirements." : "Your assignment requests and their decisions."}
                    </div>
                </div>
                <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    <Tab k="pending" label="Pending" />
                    <Tab k="approved" label="Approved" />
                    <Tab k="rejected" label="Rejected" />
                    <Tab k="all" label="All" />
                </div>
            </div>

            {error && <div style={{ fontSize: 13, color: "#dc2626" }}>{error}</div>}

            <div className="data-table-wrap">
                <table className="data-table" style={{ tableLayout: "fixed", width: "100%" }}>
                    <colgroup>
                        {isAdmin && <col style={{ width: "18%" }} />}
                        <col style={{ width: "26%" }} />
                        <col style={{ width: "28%" }} />
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "16%" }} />
                        <col style={{ width: isAdmin ? "15%" : "15%" }} />
                    </colgroup>
                    <thead>
                        <tr>
                            {isAdmin && <th>Recruiter</th>}
                            <th>Requirement</th>
                            <th>Message / Decision</th>
                            <th>Status</th>
                            <th>Date</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan={isAdmin ? 6 : 5} className="text-sm text-muted" style={{ padding: "1rem" }}>Loading…</td>
                            </tr>
                        )}
                        {!loading && filtered.length === 0 && (
                            <tr>
                                <td colSpan={isAdmin ? 6 : 5}>
                                    <div className="table-empty">
                                        <Icon name="info" size={18} style={{ marginBottom: 4 }} />
                                        <div>No {tab !== "all" ? tab : ""} assignment requests.</div>
                                    </div>
                                </td>
                            </tr>
                        )}
                        {!loading && filtered.map(r => {
                            const isPending = r.status === "pending";
                            const isMine = r.recruiter_id === user?.id;
                            return (
                                <tr key={r.id}>
                                    {isAdmin && (
                                        <td style={{ wordBreak: "break-word" }}>
                                            <div style={{ fontWeight: 500 }}>{r.recruiter_name || r.recruiter_id}</div>
                                        </td>
                                    )}
                                    <td>
                                        <Link to={`/requirements/${r.requirement_id}`} style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                                            {r.requirement_name || r.requirement_id}
                                        </Link>
                                    </td>
                                    <td className="text-sm" style={{ color: "var(--text-secondary)" }}>
                                        {r.message && <div>{r.message}</div>}
                                        {r.decision_note && <div style={{ fontStyle: "italic", marginTop: 2 }}>{r.decision_note}</div>}
                                        {!r.message && !r.decision_note && <span className="text-muted">—</span>}
                                    </td>
                                    <td>
                                        <span style={{
                                            fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                                            background:
                                                r.status === "approved" ? "rgba(22, 163, 74, 0.15)" :
                                                r.status === "rejected" ? "rgba(220, 38, 38, 0.15)" :
                                                "rgba(202, 138, 4, 0.15)",
                                            color:
                                                r.status === "approved" ? "#16a34a" :
                                                r.status === "rejected" ? "#dc2626" :
                                                "#ca8a04",
                                            textTransform: "uppercase", letterSpacing: 0.4,
                                        }}>{r.status}</span>
                                    </td>
                                    <td className="text-sm text-muted">
                                        {fmtDate(r.created_at)}
                                    </td>
                                    <td>
                                        {isAdmin && isPending && (
                                            <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => decide(r.id, "approve")}
                                                    disabled={acting.has(r.id)}
                                                    title="Approve"
                                                ><Icon name="check" size={12} /></button>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => { setNoteFor({ id: r.id, mode: "reject" }); setNoteText(""); }}
                                                    disabled={acting.has(r.id)}
                                                    title="Reject"
                                                    style={{ color: "#dc2626" }}
                                                ><Icon name="x" size={12} /></button>
                                            </div>
                                        )}
                                        {!isAdmin && isMine && isPending && (
                                            <span className="text-sm text-muted">Awaiting</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {noteFor && (
                <div
                    onClick={() => setNoteFor(null)}
                    style={{
                        position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
                        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100,
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: "var(--bg-primary)", borderRadius: 8,
                            width: "min(420px, 92vw)", padding: "1.25rem",
                            border: "1px solid var(--border-subtle)",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                        }}
                    >
                        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: "0.85rem" }}>
                            {noteFor.mode === "reject" ? "Reject request" : "Approve request"}
                        </div>
                        <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
                            Note (optional)
                        </label>
                        <textarea
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            rows={3}
                            placeholder={noteFor.mode === "reject" ? "Why this can't be approved..." : "Optional note..."}
                            style={{
                                width: "100%", padding: "0.5rem 0.65rem", fontSize: 13,
                                border: "1px solid var(--border-subtle)", borderRadius: 4,
                                background: "var(--bg-input, var(--bg-secondary))", color: "var(--text-primary)",
                                fontFamily: "inherit", resize: "vertical",
                            }}
                        />
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
                            <button className="btn btn-ghost" onClick={() => setNoteFor(null)}>Cancel</button>
                            <button
                                className={noteFor.mode === "reject" ? "btn btn-primary" : "btn btn-primary"}
                                style={noteFor.mode === "reject" ? { background: "#dc2626", borderColor: "#dc2626" } : undefined}
                                onClick={() => decide(noteFor.id, noteFor.mode, noteText)}
                                disabled={acting.has(noteFor.id)}
                            >{noteFor.mode === "reject" ? "Reject" : "Approve"}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
