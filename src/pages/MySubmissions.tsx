import { useState, useEffect } from "react";
import { analyticsApi } from "../services/api";
import StatusBadge from "../components/StatusBadge";
import "../styles/pages.css";

const APP_STATUSES = ["", "SENT", "L1_SELECTED", "L2_SELECTED", "HR_ROUND", "SELECTED", "HOLD", "JOINED", "REJECTED"];

function fmtDate(v?: string | null) {
    if (!v) return "—";
    try { return new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return v as string; }
}

function fmtDateTime(v?: string | null) {
    if (!v) return "—";
    try {
        return new Date(v).toLocaleString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit", hour12: true,
        });
    } catch { return v as string; }
}

function dash(v: any) { return v == null || v === "" ? "—" : v; }

function npColor(notice?: string | null): string {
    if (!notice) return "var(--text-secondary)";
    const l = notice.toLowerCase();
    if (l.includes("immediate") || l.includes("serving") || l === "0") return "#16a34a";
    const n = parseInt(l);
    if (!isNaN(n)) { if (n <= 15) return "#16a34a"; if (n <= 60) return "#d97706"; return "#dc2626"; }
    return "var(--text-secondary)";
}

function SubmissionModal({ sub, onClose }: { sub: any; onClose: () => void }) {
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [onClose]);

    const Field = ({ label, value }: { label: string; value?: any }) => (
        <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.45 }}>
                {value ?? <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>—</span>}
            </div>
        </div>
    );

    return (
        <div
            style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.52)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
            onClick={onClose}
        >
            <div
                style={{ background: "var(--bg-primary)", borderRadius: 14, boxShadow: "0 24px 80px rgba(0,0,0,0.35)", width: "100%", maxWidth: 540, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--border-subtle)" }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ padding: "1.1rem 1.4rem", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", flexShrink: 0 }}>
                    <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)" }}>{sub.candidate_name || "—"}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3, display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                            <StatusBadge status={sub.status} />
                            <span style={{ color: "var(--text-muted)" }}>· {fmtDateTime(sub.sent_at)}</span>
                            {sub.requirement_name && <span style={{ color: "var(--text-muted)" }}>· {sub.requirement_name}</span>}
                            {sub.company_name && <span style={{ color: "var(--text-muted)" }}>· {sub.company_name}</span>}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 8, cursor: "pointer", fontSize: 18, color: "var(--text-secondary)", lineHeight: 1, padding: "4px 9px", flexShrink: 0, marginTop: 2 }} title="Close (Esc)">×</button>
                </div>

                <div style={{ padding: "1.1rem 1.4rem", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem 1.5rem" }}>
                        <Field label="Current Role" value={sub.current_role} />
                        <Field label="Current Company" value={sub.current_company} />
                        <Field label="Current CTC" value={sub.current_ctc != null ? `${sub.current_ctc} LPA` : undefined} />
                        <Field label="Expected CTC" value={sub.expected_ctc != null ? `${sub.expected_ctc} LPA` : undefined} />
                        <Field label="Notice Period" value={sub.notice_period ? <span style={{ color: npColor(sub.notice_period) }}>{sub.notice_period}</span> : undefined} />
                        <Field label="Total Experience" value={sub.total_experience} />
                    </div>
                    {sub.relevant_experience && (
                        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>Relevant Experience</div>
                            <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.55 }}>{sub.relevant_experience}</div>
                        </div>
                    )}
                    {sub.reason_for_change && (
                        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>Reason for Change</div>
                            <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.55 }}>{sub.reason_for_change}</div>
                        </div>
                    )}
                    {sub.recruiter_comments && (
                        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>Recruiter Comments</div>
                            <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.55 }}>{sub.recruiter_comments}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function MySubmissions() {
    const [subs, setSubs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [selected, setSelected] = useState<any>(null);
    const [statusFilter, setStatusFilter] = useState("");
    const [clientFilter, setClientFilter] = useState("");
    const [appliedFilters, setAppliedFilters] = useState({ status: "", client: "" });

    const load = (filters: { status: string; client: string }, skip: number, append: boolean) => {
        setLoading(true);
        setError(null);
        analyticsApi.getSubmissions({ status: filters.status || undefined, client: filters.client || undefined, my_only: true, skip, limit: 50 })
            .then((res: any[]) => {
                const items = res || [];
                if (append) setSubs(p => [...p, ...items]);
                else setSubs(items);
                setHasMore(items.length === 50);
            })
            .catch((e: any) => setError(e?.detail || "Failed to load submissions"))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load({ status: "", client: "" }, 0, false); }, []);

    const apply = () => {
        const f = { status: statusFilter, client: clientFilter };
        setAppliedFilters(f);
        setSubs([]);
        load(f, 0, false);
    };

    const loadMore = () => load(appliedFilters, subs.length, true);

    const CELL: React.CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 0 };

    return (
        <>
            {selected && <SubmissionModal sub={selected} onClose={() => setSelected(null)} />}

            <div className="page-header">
                <div>
                    <h1>My Submissions</h1>
                    <p className="page-header-sub">Your complete submission history</p>
                </div>
            </div>

            <div className="filter-bar" style={{ marginBottom: "1rem" }}>
                <input
                    type="text"
                    placeholder="Client name…"
                    value={clientFilter}
                    onChange={e => setClientFilter(e.target.value)}
                    style={{ minWidth: 180 }}
                    onKeyDown={e => e.key === "Enter" && apply()}
                />
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    {APP_STATUSES.map(s => <option key={s} value={s}>{s || "All statuses"}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" onClick={apply} disabled={loading}>
                    {loading ? "Loading…" : "Apply"}
                </button>
                {(appliedFilters.status || appliedFilters.client) && (
                    <button className="btn btn-ghost btn-sm" onClick={() => {
                        setStatusFilter(""); setClientFilter("");
                        setAppliedFilters({ status: "", client: "" });
                        setSubs([]); load({ status: "", client: "" }, 0, false);
                    }}>Clear</button>
                )}
            </div>

            {error && <div style={{ padding: "2rem", color: "#dc2626", textAlign: "center", fontSize: 13 }}>{error}</div>}

            {subs.length === 0 && !loading ? (
                <div className="data-table-wrap">
                    <div className="table-empty">No submissions found.</div>
                </div>
            ) : (
                <div className="data-table-wrap">
                    <div style={{ overflowX: "auto" }}>
                        <table className="data-table" style={{ tableLayout: "fixed", minWidth: 900, width: "100%" }}>
                            <colgroup>
                                <col style={{ width: "90px" }} />
                                <col style={{ width: "110px" }} />
                                <col style={{ width: "150px" }} />
                                <col style={{ width: "130px" }} />
                                <col style={{ width: "140px" }} />
                                <col style={{ width: "70px" }} />
                                <col style={{ width: "70px" }} />
                                <col style={{ width: "90px" }} />
                                <col style={{ width: "90px" }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th style={{ fontSize: 12 }}>Date</th>
                                    <th style={{ fontSize: 12 }}>Client</th>
                                    <th style={{ fontSize: 12 }}>Requirement</th>
                                    <th style={{ fontSize: 12 }}>Candidate</th>
                                    <th style={{ fontSize: 12 }}>Role</th>
                                    <th style={{ fontSize: 12 }}>CTC</th>
                                    <th style={{ fontSize: 12 }}>Exp CTC</th>
                                    <th style={{ fontSize: 12 }}>Notice</th>
                                    <th style={{ fontSize: 12 }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading && subs.length === 0
                                    ? Array.from({ length: 6 }).map((_, i) => (
                                        <tr key={i}>
                                            {Array.from({ length: 9 }).map((_, j) => (
                                                <td key={j}><div style={{ height: 14, background: "var(--bg-secondary)", borderRadius: 4, width: j === 0 ? "80%" : "60%" }} /></td>
                                            ))}
                                        </tr>
                                    ))
                                    : subs.map((s: any) => (
                                        <tr
                                            key={s.application_id}
                                            onClick={() => setSelected(s)}
                                            style={{ cursor: "pointer" }}
                                            title="Click to view details"
                                        >
                                            <td style={{ ...CELL, fontSize: 12 }}>{fmtDate(s.sent_at)}</td>
                                            <td style={{ ...CELL, fontSize: 13, fontWeight: 600 }}>{dash(s.company_name)}</td>
                                            <td style={{ ...CELL, fontSize: 12 }}>{dash(s.requirement_name)}</td>
                                            <td style={{ ...CELL, fontSize: 13, fontWeight: 600 }}>{dash(s.candidate_name)}</td>
                                            <td style={{ ...CELL, fontSize: 12 }}>{dash(s.current_role)}</td>
                                            <td style={{ ...CELL, fontSize: 12 }}>{dash(s.current_ctc)}</td>
                                            <td style={{ ...CELL, fontSize: 12 }}>{dash(s.expected_ctc)}</td>
                                            <td style={{ ...CELL, fontSize: 12, color: npColor(s.notice_period), fontWeight: 500 }}>{dash(s.notice_period)}</td>
                                            <td><StatusBadge status={s.status} /></td>
                                        </tr>
                                    ))
                                }
                            </tbody>
                        </table>
                    </div>
                    {hasMore && (
                        <div style={{ padding: "0.65rem 1rem", borderTop: "1px solid var(--border-subtle)", display: "flex", justifyContent: "center" }}>
                            <button className="btn btn-ghost btn-sm" onClick={loadMore} disabled={loading}>
                                {loading ? "Loading…" : "Load more"}
                            </button>
                        </div>
                    )}
                    <div style={{ padding: "0.5rem 1rem", borderTop: "1px solid var(--border-subtle)", fontSize: 12, color: "var(--text-muted)" }}>
                        {subs.length} submission{subs.length !== 1 ? "s" : ""}{hasMore ? "+" : ""}
                    </div>
                </div>
            )}
        </>
    );
}
