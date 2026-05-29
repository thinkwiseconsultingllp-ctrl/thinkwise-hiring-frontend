import { useState, useEffect, useRef, createContext, useContext } from "react";
import type { CSSProperties } from "react";

// ── Global filter context shared across all tabs ──────────────────────────
interface AppliedFilters { client: string; search: string; status: string; recruiterId: string; }
interface FilterCtxShape {
    applied: AppliedFilters;
    recruiterOptions: { id: string; name: string }[];
    setRecruiterOptions: (opts: { id: string; name: string }[]) => void;
}
const FilterCtx = createContext<FilterCtxShape>({
    applied: { client: "", search: "", status: "", recruiterId: "" },
    recruiterOptions: [],
    setRecruiterOptions: () => {},
});
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { analyticsApi } from "../services/api";
import StatusBadge from "../components/StatusBadge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import "../styles/pages.css";

// ── Design helpers ────────────────────────────────────────────────────────

const SLA_COLOR: Record<string, string> = {
    ON_TRACK: "#16a34a", AT_RISK: "#d97706", BREACHED: "#dc2626", MET: "#0891b2",
};
const SLA_LABEL: Record<string, string> = {
    ON_TRACK: "On Track", AT_RISK: "At Risk", BREACHED: "Breached", MET: "Met",
};
const FUNNEL_COLORS = ["#3b82f6", "#8b5cf6", "#16a34a", "#0891b2"];


function fmtDate(v?: string | null) {
    if (!v) return "—";
    try { return new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return v as string; }
}

function dash(v: any) { return v == null || v === "" ? "—" : v; }

function noticePeriodColor(notice?: string | null): string {
    if (!notice) return "var(--text-secondary)";
    const l = notice.toLowerCase();
    if (l.includes("immediate") || l.includes("serving") || l === "0") return "#16a34a";
    const n = parseInt(l);
    if (!isNaN(n)) {
        if (n <= 15) return "#16a34a";
        if (n <= 60) return "#d97706";
        return "#dc2626";
    }
    return "var(--text-secondary)";
}

function SlaChip({ status }: { status: string }) {
    const color = SLA_COLOR[status] || "var(--text-secondary)";
    const label = SLA_LABEL[status] || status;
    return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
            {label}
        </span>
    );
}

function PillCount({ n, color }: { n: number; color: string }) {
    return (
        <span style={{
            display: "inline-block", minWidth: 28, padding: "1px 8px", borderRadius: 999,
            fontSize: 12, fontWeight: 700, textAlign: "center",
            background: `${color}18`, color, border: `1px solid ${color}30`,
        }}>{n}</span>
    );
}

// ── Skeleton ─────────────────────────────────────────────────────────────

function Skel({ h = 16, w = "100%" }: { h?: number; w?: string }) {
    return <div className="ana-skel" style={{ height: h, width: w, borderRadius: 4 }} />;
}
function SkeletonRows({ cols, rows = 6 }: { cols: number; rows?: number }) {
    return (
        <>
            {Array.from({ length: rows }).map((_, i) => (
                <tr key={i}>
                    {Array.from({ length: cols }).map((_, j) => (
                        <td key={j}><Skel h={14} w={j === 0 ? "80%" : "60%"} /></td>
                    ))}
                </tr>
            ))}
        </>
    );
}

// ── Tab nav (PillNav) ─────────────────────────────────────────────────────

function PillNav({ tabs, active, onSelect }: { tabs: { key: string; label: string }[]; active: string; onSelect: (k: string) => void }) {
    const idx = Math.max(0, tabs.findIndex(t => t.key === active));
    const pct = 100 / tabs.length;
    return (
        <div style={{
            position: "relative", display: "grid",
            gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
            background: "var(--bg-secondary)", borderRadius: 999,
            padding: 4, border: "1px solid var(--border-subtle)",
            marginBottom: "1.5rem",
        }}>
            <div style={{
                position: "absolute", top: 4, bottom: 4,
                width: `calc(${pct}% - 4px)`, borderRadius: 999,
                background: "var(--accent)",
                transform: `translateX(calc(${idx * 100}% + ${idx * 4}px))`,
                transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)",
                pointerEvents: "none",
            }} />
            {tabs.map(t => {
                const isActive = t.key === active;
                return (
                    <button key={t.key} onClick={() => onSelect(t.key)} style={{
                        position: "relative", zIndex: 1, padding: "5px 12px", borderRadius: 999,
                        border: "none", cursor: "pointer", fontSize: 13,
                        fontWeight: isActive ? 600 : 400, background: "transparent",
                        color: isActive ? "#fff" : "var(--text-secondary)",
                        whiteSpace: "nowrap", textAlign: "center",
                        transition: "color 0.22s ease",
                    }}>{t.label}</button>
                );
            })}
        </div>
    );
}

function ErrMsg({ msg }: { msg: string }) {
    return <div style={{ padding: "2rem", color: "#dc2626", textAlign: "center", fontSize: 13 }}>{msg}</div>;
}

// ────────────────────────────────────────────────────────────────────────────
// TAB 1 — Overview
// ────────────────────────────────────────────────────────────────────────────

function OverviewTab() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        analyticsApi.getOverview()
            .then(setData)
            .catch((e: any) => setError(e?.detail || "Failed to load overview"))
            .finally(() => setLoading(false));
    }, []);

    if (error) return <ErrMsg msg={error} />;

    const d = data || {};
    const funnelData = [
        { name: "Submitted", value: d.total_submissions || 0 },
        { name: "Interviews", value: d.in_interview || 0 },
        { name: "Selected", value: d.selected || 0 },
        { name: "Joined", value: d.joined || 0 },
    ];

    return (
        <>
            {/* KPI row */}
            <div className="stats-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                {[
                    { label: "Active Requirements", val: loading ? null : d.active_requirements ?? 0 },
                    { label: "Total Submissions", val: loading ? null : d.total_submissions ?? 0 },
                    { label: "In Interview", val: loading ? null : d.in_interview ?? 0 },
                    { label: "Selected / Joined", val: loading ? null : `${d.selected ?? 0} / ${d.joined ?? 0}` },
                    { label: "SLA Breached", val: loading ? null : d.sla_breached ?? 0, danger: true },
                ].map(kpi => (
                    <div key={kpi.label} className="stat-box">
                        <div className="stat-box-value" style={kpi.danger ? { color: "#dc2626" } : {}}>
                            {loading ? <Skel h={28} w="60%" /> : kpi.val}
                        </div>
                        <div className="stat-box-label">{kpi.label}</div>
                    </div>
                ))}
            </div>

            {/* Funnel chart + SLA grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

                {/* Funnel */}
                <div className="card" style={{ padding: "1.25rem" }}>
                    <div className="card-title" style={{ fontSize: 14, marginBottom: "1rem" }}>Hiring Funnel</div>
                    {loading ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {[80, 55, 40, 25].map((w, i) => <Skel key={i} h={32} w={`${w}%`} />)}
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={funnelData} layout="vertical" margin={{ left: 10, right: 20 }}>
                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={70} />
                                <Tooltip cursor={{ fill: "var(--bg-secondary)" }} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Count">
                                    {funnelData.map((_, i) => <Cell key={i} fill={FUNNEL_COLORS[i]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Right column: by client + SLA health */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                    <div className="card" style={{ padding: "1.25rem", flex: 1 }}>
                        <div className="card-title" style={{ fontSize: 14, marginBottom: "0.75rem" }}>Open by Client</div>
                        {loading ? <Skel h={80} /> : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {(d.clients || []).length === 0
                                    ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>No open requirements</span>
                                    : (d.clients as string[]).map((c: string) => (
                                        <div key={c} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", flexShrink: 0 }} />
                                            {c}
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>

                    <div className="card" style={{ padding: "1.25rem", flex: 0 }}>
                        <div className="card-title" style={{ fontSize: 14, marginBottom: "0.75rem" }}>SLA Health</div>
                        {loading ? <Skel h={60} /> : (
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                {[
                                    { label: "On Track", val: d.sla_on_track ?? 0, color: "#16a34a" },
                                    { label: "At Risk", val: d.sla_at_risk ?? 0, color: "#d97706" },
                                    { label: "Breached", val: d.sla_breached ?? 0, color: "#dc2626" },
                                ].map(s => (
                                    <span key={s.label} style={{
                                        padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                                        background: `${s.color}18`, color: s.color, border: `1px solid ${s.color}30`,
                                    }}>
                                        {s.val} {s.label}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

function AssignedPopover({ names }: { names: string[] }) {
    const [rect, setRect] = useState<DOMRect | null>(null);
    const btnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!rect) return;
        const handler = (e: MouseEvent) => {
            if (btnRef.current && !btnRef.current.contains(e.target as Node)) setRect(null);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [rect]);

    if (names.length === 0) return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>;

    const toggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setRect(r => r ? null : btnRef.current!.getBoundingClientRect());
    };

    return (
        <>
            <button
                ref={btnRef}
                onClick={toggle}
                style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "2px 9px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", border: "1px solid var(--border-subtle)",
                    background: rect ? "var(--bg-secondary)" : "var(--bg-card)",
                    color: "var(--text-primary)",
                }}
            >
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                {names.length}
            </button>
            {rect && (
                <div
                    style={{
                        position: "fixed",
                        top: rect.top - 8,
                        left: rect.left + rect.width / 2,
                        transform: "translate(-50%, -100%)",
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                        padding: "6px 0",
                        minWidth: 160, maxWidth: 240,
                        zIndex: 9999,
                    }}
                    onMouseDown={e => e.stopPropagation()}
                >
                    <div style={{
                        position: "absolute", bottom: -5, left: "50%",
                        transform: "translateX(-50%) rotate(45deg)",
                        width: 9, height: 9, background: "#ffffff",
                        borderRight: "1px solid #e2e8f0",
                        borderBottom: "1px solid #e2e8f0",
                    }} />
                    {names.map((n, i) => (
                        <div key={i} style={{ padding: "5px 14px", fontSize: 12, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {n}
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// TAB 2 — Requirements Tracker
// ────────────────────────────────────────────────────────────────────────────

function TrackerTab() {
    const { applied: { client, search } } = useContext(FilterCtx);
    const navigate = useNavigate();
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<string>("submitted");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    useEffect(() => {
        analyticsApi.getRequirementsTracker()
            .then(setRows)
            .catch((e: any) => setError(e?.detail || "Failed to load"))
            .finally(() => setLoading(false));
    }, []);

    const filtered = rows.filter(r => {
        const matchesClient = !client || r.company_name === client;
        const matchesSearch = !search
            || r.company_name?.toLowerCase().includes(search.toLowerCase())
            || r.requirement_name?.toLowerCase().includes(search.toLowerCase())
            || r.req_id?.toLowerCase().includes(search.toLowerCase());
        return matchesClient && matchesSearch;
    });

    const sorted = [...filtered].sort((a, b) => {
        const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
        if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
        return sortDir === "asc" ? av - bv : bv - av;
    });

    const toggleSort = (k: string) => {
        if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(k); setSortDir("desc"); }
    };

    const Th = ({ k, label }: { k: string; label: string }) => (
        <th style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }} onClick={() => toggleSort(k)}>
            {label} {sortKey === k ? (sortDir === "asc" ? "▲" : "▼") : ""}
        </th>
    );

    if (error) return <ErrMsg msg={error} />;

    return (
        <>
            <div className="data-table-wrap">
                <table className="data-table" style={{ tableLayout: "fixed", width: "100%" }}>
                    <colgroup>
                        <col style={{ width: "8%" }} /><col style={{ width: "13%" }} /><col style={{ width: "16%" }} />
                        <col style={{ width: "6%" }} /><col style={{ width: "10%" }} /><col style={{ width: "8%" }} />
                        <col style={{ width: "8%" }} /><col style={{ width: "13%" }} /><col style={{ width: "14%" }} />
                        <col style={{ width: "6%" }} /><col style={{ width: "8%" }} /><col style={{ width: "7%" }} />
                        <col style={{ width: "7%" }} /><col style={{ width: "7%" }} /><col style={{ width: "6%" }} />
                        <col style={{ width: "7%" }} /><col style={{ width: "7%" }} /><col style={{ width: "4%" }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Req ID</th><th>Client</th><th>Role</th><th>Type</th>
                            <Th k="sla_status" label="SLA" /><Th k="submitted" label="Subm." />
                            <Th k="in_interview" label="Intvw" /><Th k="selected" label="Sel." />
                            <Th k="joined" label="Jnd" /><Th k="status" label="Status" />
                            <th>Assigned</th><th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? <SkeletonRows cols={12} /> : sorted.length === 0 ? (
                            <tr><td colSpan={12} className="table-empty">No requirements found.</td></tr>
                        ) : sorted.map(r => (
                            <tr key={r.id} style={{ cursor: "pointer" }}
                                onClick={(e) => { if (e.ctrlKey || e.metaKey) { window.open(`/requirements/${r.id}`, '_blank'); } else { navigate(`/requirements/${r.id}`); } }}>
                                <td><span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--accent)" }}>{r.req_id}</span></td>
                                <td style={{ fontWeight: 500 }}>{r.company_name || "—"}</td>
                                <td>
                                    <div style={{ fontSize: 13 }}>{r.requirement_name}</div>
                                    {r.years_of_experience && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.years_of_experience} yrs</div>}
                                </td>
                                <td>
                                    {r.is_rollover
                                        ? <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>Rollover</span>
                                        : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}
                                </td>
                                <td><SlaChip status={r.sla_status} /></td>
                                <td><PillCount n={r.submitted} color="#3b82f6" /></td>
                                <td><PillCount n={r.in_interview} color="#8b5cf6" /></td>
                                <td><PillCount n={r.selected} color="#16a34a" /></td>
                                <td><PillCount n={r.joined} color="#0891b2" /></td>
                                <td><StatusBadge status={r.status} /></td>
                                <td><AssignedPopover names={r.assigned_recruiters || []} /></td>
                                <td onClick={e => e.stopPropagation()}>
                                    <a href={`/requirements/${r.id}`} target="_blank" rel="noreferrer" title="Open in new tab"
                                        style={{ fontSize: 14, color: "var(--text-muted)", textDecoration: "none", padding: "2px 4px", display: "inline-block" }}>↗</a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

const APP_STATUSES = ["", "SENT", "L1_SELECTED", "L2_SELECTED", "HR_ROUND", "SELECTED", "HOLD", "JOINED", "REJECTED"];

// ────────────────────────────────────────────────────────────────────────────
// TAB 3 — Submissions
// ────────────────────────────────────────────────────────────────────────────

function firstNameOnly(name?: string | null): string {
    if (!name) return "—";
    return name.split(" ")[0];
}

const CELL: CSSProperties = {
    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    maxWidth: 0,
};

function SubmissionDetailModal({ sub, isAdmin, onClose }: { sub: any; isAdmin: boolean; onClose: () => void }) {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onClose]);

    const Field = ({ label, value }: { label: string; value?: any }) => (
        <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.45 }}>
                {value ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
            </div>
        </div>
    );

    return (
        <div
            style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.52)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
            onClick={onClose}
        >
            <div className="filter-bar" style={{ marginBottom: "1rem" }}>
                <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} style={{ minWidth: 180 }}>
                    <option value="">All clients</option>
                    {clients.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input
                    type="text" placeholder="Search by role or req ID…"
                    value={search} onChange={e => setSearch(e.target.value)}
                    style={{ minWidth: 220 }}
                />
            </div>
            <div
                style={{ background: "var(--bg-primary)", borderRadius: 14, boxShadow: "0 24px 80px rgba(0,0,0,0.35)", width: "100%", maxWidth: 560, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--border-subtle)" }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ padding: "1.1rem 1.4rem", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
                    <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>{sub.candidate_name || "—"}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3, display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                            <StatusBadge status={sub.status} />
                            <span style={{ color: "var(--text-muted)" }}>·</span>
                            <span>{fmtDate(sub.sent_at)}</span>
                            {isAdmin && sub.recruiter_name && <>
                                <span style={{ color: "var(--text-muted)" }}>· by</span>
                                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{sub.recruiter_name}</span>
                            </>}
                        </div>
                        {(sub.requirement_name || sub.company_name) && (
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                                {sub.requirement_name}{sub.company_name ? ` · ${sub.company_name}` : ""}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 8, cursor: "pointer", fontSize: 18, color: "var(--text-secondary)", lineHeight: 1, padding: "4px 9px", flexShrink: 0, marginTop: 2 }}
                        title="Close (Esc)"
                    >×</button>
                </div>

                {/* Scrollable body */}
                <div style={{ padding: "1.1rem 1.4rem", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {/* Key details grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem 1.5rem" }}>
                        <Field label="Current Role" value={sub.current_role} />
                        <Field label="Current Company" value={sub.current_company} />
                        <Field label="Current CTC" value={sub.current_ctc != null ? `${sub.current_ctc} LPA` : undefined} />
                        <Field label="Expected CTC" value={sub.expected_ctc != null ? `${sub.expected_ctc} LPA` : undefined} />
                        <Field label="Notice Period" value={
                            sub.notice_period
                                ? <span style={{ color: noticePeriodColor(sub.notice_period), fontWeight: 600 }}>{sub.notice_period}</span>
                                : undefined
                        } />
                        <Field label="Total Experience" value={sub.total_experience} />
                    </div>

                    {/* Relevant Experience */}
                    {sub.relevant_experience && (
                        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>Relevant Experience</div>
                            <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.55 }}>{sub.relevant_experience}</div>
                        </div>
                    )}

                    {/* Reason for Change */}
                    {sub.reason_for_change && (
                        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>Reason for Change</div>
                            <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.55 }}>{sub.reason_for_change}</div>
                        </div>
                    )}

                    {/* Recruiter Comments */}
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

function SubmissionsTab({ isAdmin }: { isAdmin: boolean }) {
    const { applied, setRecruiterOptions } = useContext(FilterCtx);
    const [subs, setSubs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [selected, setSelected] = useState<any>(null);

    const load = (filters: AppliedFilters, skip: number, append: boolean) => {
        setLoading(true);
        setError(null);
        analyticsApi.getSubmissions({
            client: filters.client,
            status: filters.status,
            recruiter_id: filters.recruiterId,
            skip,
            limit: 50,
        })
            .then((res: any[]) => {
                const items = res || [];
                if (append) {
                    setSubs(p => [...p, ...items]);
                } else {
                    setSubs(items);
                    const opts = Array.from(
                        new Map(items.filter((s: any) => s.recruiter_id && s.recruiter_name).map((s: any) => [s.recruiter_id, s.recruiter_name])).entries()
                    ).map(([id, name]) => ({ id: id as string, name: name as string })).sort((a, b) => a.name.localeCompare(b.name));
                    setRecruiterOptions(opts);
                }
                setHasMore(items.length === 50);
            })
            .catch((e: any) => setError(e?.detail || "Failed to load submissions"))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        setSubs([]);
        load(applied, 0, false);
    }, [applied]); // eslint-disable-line react-hooks/exhaustive-deps

    const displayed = applied.search
        ? subs.filter(s =>
            s.candidate_name?.toLowerCase().includes(applied.search.toLowerCase()) ||
            s.requirement_name?.toLowerCase().includes(applied.search.toLowerCase()) ||
            s.recruiter_name?.toLowerCase().includes(applied.search.toLowerCase())
        )
        : subs;

    const loadMore = () => load(applied, subs.length, true);
    const colCount = 11;

    return (
        <>
            {selected && <SubmissionDetailModal sub={selected} isAdmin={isAdmin} onClose={() => setSelected(null)} />}

            {error && <ErrMsg msg={error} />}

            <div className="data-table-wrap">
                <div style={{ overflowX: "auto" }}>
                    <table className="data-table" style={{ tableLayout: "fixed", minWidth: 860, width: "100%" }}>
                        <colgroup>
                            <col style={{ width: "88px" }} />
                            <col style={{ width: "110px" }} />
                            <col style={{ width: "80px" }} />
                            <col style={{ width: "130px" }} />
                            <col style={{ width: "130px" }} />
                            <col style={{ width: "62px" }} />
                            <col style={{ width: "110px" }} />
                            <col style={{ width: "68px" }} />
                            <col style={{ width: "68px" }} />
                            <col style={{ width: "88px" }} />
                            <col style={{ width: "80px" }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th style={{ fontSize: 12 }}>Date</th>
                                <th style={{ fontSize: 12 }}>Client</th>
                                <th style={{ fontSize: 12 }}>Recruiter</th>
                                <th style={{ fontSize: 12 }}>Role</th>
                                <th style={{ fontSize: 12 }}>Candidate</th>
                                <th style={{ fontSize: 12 }}>Exp</th>
                                <th style={{ fontSize: 12 }}>Rel. Exp</th>
                                <th style={{ fontSize: 12 }}>CTC</th>
                                <th style={{ fontSize: 12 }}>Exp CTC</th>
                                <th style={{ fontSize: 12 }}>Notice</th>
                                <th style={{ fontSize: 12 }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && subs.length === 0
                                ? <SkeletonRows cols={colCount} />
                                : displayed.length === 0
                                    ? <tr><td colSpan={colCount} className="table-empty">No submissions found.</td></tr>
                                    : displayed.map((s: any) => (
                                        <tr
                                            key={s.application_id}
                                            onClick={() => setSelected(s)}
                                            style={{ cursor: "pointer" }}
                                            title="Click to view full details"
                                        >
                                            <td style={{ ...CELL, fontSize: 12 }} title={fmtDate(s.sent_at)}>{fmtDate(s.sent_at)}</td>
                                            <td style={{ ...CELL, fontSize: 13, fontWeight: 600 }} title={s.company_name}>{dash(s.company_name)}</td>
                                            <td style={{ ...CELL, fontSize: 12 }} title={s.recruiter_name}>{firstNameOnly(s.recruiter_name)}</td>
                                            <td style={{ ...CELL, fontSize: 12 }} title={s.requirement_name}>{dash(s.requirement_name)}</td>
                                            <td style={{ ...CELL }} title={s.candidate_name}>
                                                <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dash(s.candidate_name)}</div>
                                            </td>
                                            <td style={{ ...CELL, fontSize: 12 }} title={s.total_experience}>{dash(s.total_experience)}</td>
                                            <td style={{ ...CELL, fontSize: 12 }} title={s.relevant_experience}>{dash(s.relevant_experience)}</td>
                                            <td style={{ ...CELL, fontSize: 12 }} title={String(s.current_ctc ?? "")}>{dash(s.current_ctc)}</td>
                                            <td style={{ ...CELL, fontSize: 12 }} title={String(s.expected_ctc ?? "")}>{dash(s.expected_ctc)}</td>
                                            <td style={{ ...CELL, fontSize: 12, color: noticePeriodColor(s.notice_period), fontWeight: 600 }} title={s.notice_period}>{dash(s.notice_period)}</td>
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
            </div>
        </>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// TAB 4 — Interviews
// ────────────────────────────────────────────────────────────────────────────

function InterviewsTab() {
    const { applied: { client, search } } = useContext(FilterCtx);
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        analyticsApi.getInterviews()
            .then(setRows)
            .catch((e: any) => setError(e?.detail || "Failed to load"))
            .finally(() => setLoading(false));
    }, []);

    if (error) return <ErrMsg msg={error} />;

    const displayed = rows.filter(r => {
        const mc = !client || r.company_name === client;
        const ms = !search || r.candidate_name?.toLowerCase().includes(search.toLowerCase()) || r.requirement_name?.toLowerCase().includes(search.toLowerCase());
        return mc && ms;
    });

    const roundBadge = (round: any) => {
        if (!round) return <span style={{ color: "var(--text-muted)" }}>—</span>;
        const status = round.status || round;
        const colors: Record<string, string> = {
            shortlisted: "#16a34a", selected: "#16a34a", pass: "#16a34a",
            rejected: "#dc2626", fail: "#dc2626",
            "no show": "#d97706", rescheduled: "#d97706",
        };
        const color = colors[String(status).toLowerCase()] || "var(--accent)";
        return (
            <span style={{
                fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 999,
                background: `${color}18`, color, border: `1px solid ${color}30`,
            }}>{status}</span>
        );
    };

    return (
        <div className="data-table-wrap">
            <table className="data-table" style={{ tableLayout: "fixed", width: "100%" }}>
                <colgroup>
                    <col style={{ width: "9%" }} /><col style={{ width: "12%" }} /><col style={{ width: "14%" }} />
                    <col style={{ width: "13%" }} /><col style={{ width: "12%" }} /><col style={{ width: "11%" }} />
                    <col style={{ width: "11%" }} /><col style={{ width: "10%" }} /><col style={{ width: "8%" }} />
                </colgroup>
                <thead>
                    <tr>
                        <th>Date</th><th>Client</th><th>Role</th><th>Candidate</th><th>Recruiter</th>
                        <th>L1</th><th>L2</th><th>L3/HR</th><th>Stage</th>
                    </tr>
                </thead>
                <tbody>
                    {loading ? <SkeletonRows cols={9} /> : displayed.length === 0 ? (
                        <tr><td colSpan={9} className="table-empty">No interviews found.</td></tr>
                    ) : displayed.map((r: any) => {
                        const rounds: any[] = r.interview_rounds || [];
                        return (
                            <tr key={r.application_id}>
                                <td style={{ fontSize: 12 }}>{fmtDate(r.l1_selected_at)}</td>
                                <td style={{ fontWeight: 500, fontSize: 13 }}>{dash(r.company_name)}</td>
                                <td style={{ fontSize: 13 }}>{dash(r.requirement_name)}</td>
                                <td style={{ fontWeight: 500 }}>{dash(r.candidate_name)}</td>
                                <td style={{ fontSize: 12 }}>{dash(r.recruiter_name)}</td>
                                <td>{r.l1_selected_at ? roundBadge(rounds[0] || "Reached") : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                                <td>{r.l2_selected_at ? roundBadge(rounds[1] || "Reached") : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                                <td>{r.hr_round_at ? roundBadge(rounds[2] || "Reached") : <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                                <td><StatusBadge status={r.current_status} /></td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// TAB 5 — Selections
// ────────────────────────────────────────────────────────────────────────────

function SelectionsTab() {
    const { applied: { client, search } } = useContext(FilterCtx);
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        analyticsApi.getSelections()
            .then(setRows)
            .catch((e: any) => setError(e?.detail || "Failed to load"))
            .finally(() => setLoading(false));
    }, []);

    if (error) return <ErrMsg msg={error} />;

    const displayed = rows.filter(r => {
        const mc = !client || r.company_name === client;
        const ms = !search || r.candidate_name?.toLowerCase().includes(search.toLowerCase()) || r.requirement_name?.toLowerCase().includes(search.toLowerCase()) || r.recruiter_name?.toLowerCase().includes(search.toLowerCase());
        return mc && ms;
    });

    const statusStyle = (s: string): React.CSSProperties => {
        const map: Record<string, React.CSSProperties> = {
            SELECTED: { background: "#fef3c718", color: "#d97706", border: "1px solid #d9780630" },
            JOINED: { background: "#16a34a18", color: "#16a34a", border: "1px solid #16a34a30" },
            HOLD: { background: "#71717a18", color: "#71717a", border: "1px solid #71717a30" },
        };
        return map[s] || {};
    };

    return (
        <div className="data-table-wrap">
            <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Recruiter</th><th>Client</th><th>Candidate</th><th>Role</th>
                            <th>Exp</th><th>Cur CTC</th><th>Offered</th><th>Notice</th><th>DOJ</th><th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? <SkeletonRows cols={10} /> : displayed.length === 0 ? (
                            <tr><td colSpan={10} className="table-empty">No selections found.</td></tr>
                        ) : displayed.map((r: any, i: number) => (
                            <tr key={i}>
                                <td style={{ fontSize: 12 }}>{dash(r.recruiter_name)}</td>
                                <td style={{ fontWeight: 500, fontSize: 13 }}>{dash(r.company_name)}</td>
                                <td style={{ fontWeight: 500 }}>{dash(r.candidate_name)}</td>
                                <td style={{ fontSize: 13 }}>{dash(r.requirement_name)}</td>
                                <td style={{ fontSize: 12 }}>{dash(r.total_experience)}</td>
                                <td style={{ fontSize: 12 }}>{dash(r.current_ctc)}</td>
                                <td style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>{dash(r.offered_ctc)}</td>
                                <td style={{ fontSize: 12, color: noticePeriodColor(r.notice_period), fontWeight: 500 }}>{dash(r.notice_period)}</td>
                                <td style={{ fontSize: 12 }}>{fmtDate(r.date_of_joining)}</td>
                                <td>
                                    <span style={{
                                        fontSize: 11, fontWeight: 600, padding: "2px 9px",
                                        borderRadius: 999, display: "inline-block",
                                        ...statusStyle(r.status),
                                    }}>{r.status || "—"}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// TAB 6 — Recruiter Metrics (admin only)
// ────────────────────────────────────────────────────────────────────────────

function RecruitersTab() {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        analyticsApi.getRecruiterMetrics()
            .then(setRows)
            .catch((e: any) => setError(e?.detail || "Failed to load"))
            .finally(() => setLoading(false));
    }, []);

    if (error) return <ErrMsg msg={error} />;

    if (loading) {
        return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="card"><Skel h={90} /></div>
                ))}
            </div>
        );
    }

    if (rows.length === 0) {
        return <div className="data-table-wrap"><div className="table-empty">No recruiter data yet.</div></div>;
    }

    return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1rem" }}>
            {rows.map(r => (
                <div key={r.recruiter_id} className="card" style={{ padding: "1.25rem" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: "0.75rem", color: "var(--text-primary)" }}>
                        {r.recruiter_name}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem 0.75rem", marginBottom: "0.85rem" }}>
                        {[
                            { label: "Submitted", val: r.submitted, color: "#3b82f6" },
                            { label: "Interviews", val: r.in_interview, color: "#8b5cf6" },
                            { label: "Selected", val: r.selected, color: "#16a34a" },
                            { label: "Joined", val: r.joined, color: "#0891b2" },
                        ].map(item => (
                            <div key={item.label}>
                                <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.val}</div>
                                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{item.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Interview conversion rate bar */}
                    <div style={{ marginBottom: "0.5rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
                            <span>Interview conversion</span>
                            <span style={{ fontWeight: 600 }}>{r.interview_conversion_rate}%</span>
                        </div>
                        <div style={{ height: 5, background: "var(--border-subtle)", borderRadius: 999, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.min(r.interview_conversion_rate, 100)}%`, background: "#8b5cf6", borderRadius: 999 }} />
                        </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)" }}>
                        <span>Selection rate</span>
                        <span style={{ fontWeight: 600, color: "#16a34a" }}>{r.selection_rate}%</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// TAB 7 — Insights (admin only)
// ────────────────────────────────────────────────────────────────────────────

function InsightsTab() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        analyticsApi.getInsights()
            .then(setData)
            .catch((e: any) => setError(e?.detail || "Failed to load insights"))
            .finally(() => setLoading(false));
    }, []);

    if (error) return <ErrMsg msg={error} />;

    const d = data || {};

    const fmtHrs = (h: number | null | undefined) => {
        if (h == null) return "—";
        if (h < 24) return `${h}h`;
        return `${(h / 24).toFixed(1)}d`;
    };

    const funnel: { stage: string; count: number }[] = d.funnel_with_conversion || [];
    const topTotal = funnel[0]?.count || 0;

    return (
        <>
            {/* KPI row */}
            <div className="stats-row" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: "1.5rem" }}>
                {[
                    { label: "Total Submissions", val: loading ? null : d.total_submissions ?? 0 },
                    { label: "Total Selected", val: loading ? null : d.total_selected ?? 0 },
                    { label: "Conversion Rate", val: loading ? null : `${d.conversion_pct ?? 0}%` },
                ].map(kpi => (
                    <div key={kpi.label} className="stat-box">
                        <div className="stat-box-value">{loading ? <Skel h={28} w="60%" /> : kpi.val}</div>
                        <div className="stat-box-label">{kpi.label}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.5rem" }}>
                {/* Stage funnel */}
                <div className="card" style={{ padding: "1.25rem" }}>
                    <div className="card-title" style={{ fontSize: 14, marginBottom: "1rem" }}>Stage Conversion Funnel</div>
                    {loading ? <Skel h={180} /> : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                            {funnel.map((row, i) => {
                                const pct = topTotal > 0 ? Math.round(row.count / topTotal * 100) : 0;
                                return (
                                    <div key={row.stage}>
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                                            <span style={{ color: "var(--text-secondary)" }}>{row.stage}</span>
                                            <span style={{ fontWeight: 600 }}>{row.count} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({pct}%)</span></span>
                                        </div>
                                        <div style={{ height: 8, background: "var(--bg-secondary)", borderRadius: 4, overflow: "hidden" }}>
                                            <div style={{ width: `${pct}%`, height: "100%", background: FUNNEL_COLORS[i % FUNNEL_COLORS.length], borderRadius: 4 }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Avg time between stages */}
                <div className="card" style={{ padding: "1.25rem" }}>
                    <div className="card-title" style={{ fontSize: 14, marginBottom: "1rem" }}>Avg Time Between Stages</div>
                    {loading ? <Skel h={180} /> : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                            {[
                                { label: "Submission → L1 Selected", val: fmtHrs(d.avg_hours_sent_to_l1) },
                                { label: "L1 Selected → L2 Selected", val: fmtHrs(d.avg_hours_l1_to_l2) },
                                { label: "L2 Selected → HR Round", val: fmtHrs(d.avg_hours_l2_to_hr) },
                            ].map(row => (
                                <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0", borderBottom: "1px solid var(--border-subtle)" }}>
                                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{row.label}</span>
                                    <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>{row.val}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Rejection patterns */}
            <div className="card" style={{ padding: "1.25rem" }}>
                <div className="card-title" style={{ fontSize: 14, marginBottom: "1rem" }}>Top Rejection Reasons</div>
                {loading ? <SkeletonRows cols={2} rows={5} /> : (
                    d.top_rejection_reasons?.length > 0 ? (
                        <div className="data-table-wrap">
                            <table className="data-table">
                                <thead><tr><th>Reason</th><th style={{ width: 80 }}>Count</th></tr></thead>
                                <tbody>
                                    {d.top_rejection_reasons.map((r: any, i: number) => (
                                        <tr key={i}>
                                            <td>{r.reason}</td>
                                            <td><PillCount n={r.count} color="#dc2626" /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : <div className="table-empty">No rejections with reasons recorded yet.</div>
                )}
            </div>
        </>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────────────────────

const FILTER_TABS = ["tracker", "submissions", "interviews", "selections"];

export default function Analytics() {
    const { isAdmin } = useAuth();
    const [activeTab, setActiveTab] = useState("overview");

    const emptyFilters: AppliedFilters = { client: "", search: "", status: "", recruiterId: "" };
    const [draft, setDraft] = useState<AppliedFilters>(emptyFilters);
    const [applied, setApplied] = useState<AppliedFilters>(emptyFilters);
    const [clientOptions, setClientOptions] = useState<string[]>([]);
    const [recruiterOptions, setRecruiterOptions] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        analyticsApi.getRequirementsTracker()
            .then((rows: any[]) => {
                const names = [...new Set((rows || []).map((r: any) => r.company_name).filter(Boolean))].sort() as string[];
                setClientOptions(names);
            })
            .catch(() => {});
    }, []);

    const handleApply = () => setApplied({ ...draft });
    const handleClear = () => { setDraft(emptyFilters); setApplied(emptyFilters); };
    const hasFilters = Object.values(applied).some(v => v !== "");

    const tabs = [
        { key: "overview", label: "Overview" },
        { key: "tracker", label: "Requirements" },
        { key: "submissions", label: "Submissions" },
        { key: "interviews", label: "Interviews" },
        { key: "selections", label: "Selections" },
        ...(isAdmin ? [
            { key: "recruiters", label: "Recruiters" },
            { key: "insights", label: "Insights" },
        ] : []),
    ];

    return (
        <FilterCtx.Provider value={{ applied, recruiterOptions, setRecruiterOptions }}>
            <style>{`
                @keyframes ana-pulse { 0%,100%{opacity:.45} 50%{opacity:.9} }
                .ana-skel { background: var(--bg-secondary); animation: ana-pulse 1.5s ease-in-out infinite; }
            `}</style>

            <div className="page-header">
                <div>
                    <h1>Analytics</h1>
                    <p className="page-header-sub">Live hiring pipeline, refreshes each time you open a tab</p>
                </div>
            </div>

            <PillNav tabs={tabs} active={activeTab} onSelect={setActiveTab} />

            {FILTER_TABS.includes(activeTab) && (
                <div className="filter-bar" style={{ marginBottom: "1.25rem" }}>
                    <select value={draft.client} onChange={e => setDraft(p => ({ ...p, client: e.target.value }))} style={{ minWidth: 180 }}>
                        <option value="">All clients</option>
                        {clientOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input
                        type="text"
                        placeholder="Search…"
                        value={draft.search}
                        onChange={e => setDraft(p => ({ ...p, search: e.target.value }))}
                        onKeyDown={e => e.key === "Enter" && handleApply()}
                        style={{ minWidth: 200 }}
                    />
                    {activeTab === "submissions" && (
                        <>
                            <select value={draft.status} onChange={e => setDraft(p => ({ ...p, status: e.target.value }))}>
                                {APP_STATUSES.map(s => <option key={s} value={s}>{s || "All statuses"}</option>)}
                            </select>
                            <select value={draft.recruiterId} onChange={e => setDraft(p => ({ ...p, recruiterId: e.target.value }))} style={{ minWidth: 150 }}>
                                <option value="">All recruiters</option>
                                {recruiterOptions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={handleApply}>Apply</button>
                    {hasFilters && (
                        <button className="btn btn-ghost btn-sm" onClick={handleClear}>Clear</button>
                    )}
                </div>
            )}

            {activeTab === "overview" && <OverviewTab />}
            {activeTab === "tracker" && <TrackerTab />}
            {activeTab === "submissions" && <SubmissionsTab isAdmin={isAdmin} />}
            {activeTab === "interviews" && <InterviewsTab />}
            {activeTab === "selections" && <SelectionsTab />}
            {activeTab === "recruiters" && isAdmin && <RecruitersTab />}
            {activeTab === "insights" && isAdmin && <InsightsTab />}
        </FilterCtx.Provider>
    );
}
