import { useState, useEffect, useRef, useMemo, createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";

// ── Global filter context shared across all tabs ──────────────────────────
interface AppliedFilters { client: string; search: string; status: string; recruiterId: string; }
interface FilterCtxShape {
    applied: AppliedFilters;
    recruiterOptions: { id: string; name: string }[];
    setRecruiterOptions: (opts: { id: string; name: string }[]) => void;
    setCounts: (nodes: React.ReactNode) => void;
}
const FilterCtx = createContext<FilterCtxShape>({
    applied: { client: "", search: "", status: "", recruiterId: "" },
    recruiterOptions: [],
    setRecruiterOptions: () => { },
    setCounts: () => { },
});
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

function toSlug(s: string) {
    return (s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
import { useAuth } from "../context/AuthContext";
import { analyticsApi, api, API_BASE, getToken } from "../services/api";
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
    const { applied: { client, search }, setCounts } = useContext(FilterCtx);
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

    useEffect(() => {
        const totalClients = new Set(filtered.map(r => r.company_name).filter(Boolean)).size;
        const openReqs = filtered.filter(r => r.status === "OPEN").length;
        const closedReqs = filtered.filter(r => r.status === "CLOSED").length;

        setCounts(
            <>
                {!client && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Clients: <strong style={{ color: "var(--text-primary)" }}>{totalClients}</strong></div>}
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Open Reqs: <strong style={{ color: "var(--text-primary)" }}>{openReqs}</strong></div>
                {client && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Closed Reqs: <strong style={{ color: "var(--text-primary)" }}>{closedReqs}</strong></div>}
            </>
        );
        return () => setCounts(null);
    }, [filtered, client, setCounts]);

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
                <div style={{ overflowX: "auto" }}>
                    <table className="data-table" style={{ tableLayout: "fixed", width: "100%", minWidth: 900 }}>
                        <colgroup>
                            <col style={{ width: "8%" }} />
                            <col style={{ width: "14%" }} />
                            <col style={{ width: "18%" }} />
                            <col style={{ width: "5%" }} />
                            <col style={{ width: "10%" }} />
                            <col style={{ width: "7%" }} />
                            <col style={{ width: "7%" }} />
                            <col style={{ width: "7%" }} />
                            <col style={{ width: "6%" }} />
                            <col style={{ width: "9%" }} />
                            <col style={{ width: "9%" }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>Req ID</th><th>Client</th><th>Role</th><th>Type</th>
                                <Th k="sla_status" label="SLA" /><Th k="submitted" label="Subm." />
                                <Th k="in_interview" label="Intvw" /><Th k="selected" label="Sel." />
                                <Th k="joined" label="Jnd" /><Th k="status" label="Status" />
                                <th>Assigned</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? <SkeletonRows cols={11} /> : sorted.length === 0 ? (
                                <tr><td colSpan={11} className="table-empty">No requirements found.</td></tr>
                            ) : sorted.map(r => (
                                <tr key={r.id} style={{ cursor: "pointer" }}
                                    onClick={() => navigate(`/dashboard/${toSlug(r.company_name)}/${toSlug(r.requirement_name)}`, { state: { reqId: r.id } })}>
                                    <td>
                                        <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--accent)" }}>
                                            {r.req_id}
                                        </span>
                                    </td>
                                    <td style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.company_name || "—"}</td>
                                    <td style={{ overflow: "hidden" }}>
                                        <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.requirement_name}</div>
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
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
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

// Shortlisted cell — collapsed shows the current value (or a gray "Update" placeholder when
// unset); pressing it (admin only) reveals the Yes / No choices.
function ShortlistCell({ value, editable, onChange }: { value: boolean | null; editable: boolean; onChange: (val: boolean | null) => void }) {
    const [open, setOpen] = useState(false);
    const base: CSSProperties = { fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 4, display: "inline-block", whiteSpace: "nowrap", border: "1px solid" };

    if (open && editable) {
        return (
            <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
                <button onClick={() => { onChange(true); setOpen(false); }}
                    style={{ ...base, cursor: "pointer", background: "#dcfce7", color: "#16a34a", borderColor: "#16a34a" }}>✓ Yes</button>
                <button onClick={() => { onChange(false); setOpen(false); }}
                    style={{ ...base, cursor: "pointer", background: "#fee2e2", color: "#dc2626", borderColor: "#dc2626" }}>✗ No</button>
                {value !== null && (
                    <button onClick={() => { onChange(null); setOpen(false); }}
                        style={{ ...base, cursor: "pointer", background: "var(--bg-secondary)", color: "var(--text-muted)", borderColor: "var(--border-subtle)" }}>× Clear</button>
                )}
            </span>
        );
    }

    const style: CSSProperties = value === true
        ? { background: "#dcfce7", color: "#16a34a", borderColor: "#86efac" }
        : value === false
            ? { background: "#fee2e2", color: "#dc2626", borderColor: "#fca5a5" }
            : { background: "var(--bg-secondary)", color: "var(--text-muted)", borderColor: "var(--border-subtle)" };
    const label = value === true ? "✓ Yes" : value === false ? "✗ No" : "Update";

    return (
        <span
            onClick={editable ? () => setOpen(true) : undefined}
            title={editable ? "Click to set shortlisted status" : "Set automatically from interview progress"}
            style={{ ...base, ...style, cursor: editable ? "pointer" : "default" }}
        >{label}</span>
    );
}

// Focused side drawer for a submission — shows only the recruiter-submitted details
// (already present in the list response, so no extra fetch), plus resume + comments.
function SubmissionDrawer({ sub, isAdmin, onClose, onShortlist }: { sub: any; isAdmin: boolean; onClose: () => void; onShortlist?: (appId: string, val: boolean | null) => void }) {
    const [comments, setComments] = useState<any[]>([]);
    const [draft, setDraft] = useState("");
    const [posting, setPosting] = useState(false);
    const [resumeUrl, setResumeUrl] = useState<string | null>(null);
    const [resumeErr, setResumeErr] = useState<string | null>(null);
    const [resumeMime, setResumeMime] = useState("application/pdf");
    const [shortlisted, setShortlisted] = useState<boolean | null>(sub.client_shortlisted ?? null);
    const [savingSL, setSavingSL] = useState(false);

    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [onClose]);

    const loadComments = () => {
        if (!sub.candidate_id) return;
        api.get(`/candidates/${sub.candidate_id}/profile-comments`)
            .then((d: any) => setComments(d.comments || []))
            .catch(() => setComments([]));
    };
    useEffect(loadComments, [sub.candidate_id]);

    // Resume — fetch the binary with auth (iframe can't send headers) and show it as a blob URL.
    useEffect(() => {
        if (!sub.candidate_id) return;
        let url: string | null = null;
        let cancelled = false;
        (async () => {
            setResumeErr(null);
            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE}/candidates/${sub.candidate_id}/resume`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (!res.ok) throw new Error(res.status === 404 ? "No resume on file" : `Failed (HTTP ${res.status})`);
                const blob = await res.blob();
                if (cancelled) return;
                setResumeMime(res.headers.get("Content-Type") || "application/pdf");
                url = URL.createObjectURL(blob);
                setResumeUrl(url);
            } catch (e: any) {
                if (!cancelled) setResumeErr(e?.message || "Failed to load resume");
            }
        })();
        return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
    }, [sub.candidate_id]);

    // Shortlisted — admin/client-manager sets Yes / No / null (clear). Optimistic, reverts on failure.
    const setShortlist = async (val: boolean | null) => {
        if (savingSL || shortlisted === val) return;
        const prev = shortlisted;
        setSavingSL(true);
        setShortlisted(val);
        try {
            await api.patch(`/applications/${sub.application_id}/shortlist`, { shortlisted: val });
            onShortlist?.(sub.application_id, val);
        } catch {
            setShortlisted(prev);
        } finally {
            setSavingSL(false);
        }
    };

    const postComment = async () => {
        const text = draft.trim();
        if (!text || posting || !sub.requirement_id || !sub.candidate_id) return;
        setPosting(true);
        try {
            await api.post(`/requirements/${sub.requirement_id}/profiles/${sub.candidate_id}/comments`, { comment: text });
            setDraft("");
            loadComments();
        } catch { /* ignore */ } finally {
            setPosting(false);
        }
    };

    const Field = ({ label, value }: { label: string; value?: any }) => (
        <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.45 }}>
                {value ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
            </div>
        </div>
    );

    return (
        <>
            <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.18)" }} />
            <aside style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(55vw, 720px)", background: "var(--bg-primary)", borderLeft: "1px solid var(--border-subtle)", boxShadow: "-4px 0 16px rgba(0,0,0,0.08)", zIndex: 1000, display: "flex", flexDirection: "column" }}>
                <header style={{ padding: "0.95rem 1.2rem", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>{sub.candidate_name || "—"}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                            <StatusBadge status={sub.status} />
                            <span style={{ color: "var(--text-muted)" }}>·</span>
                            <span>{fmtDate(sub.sent_at)}</span>
                            {isAdmin && sub.recruiter_name && <span>· by <strong style={{ color: "var(--text-primary)" }}>{sub.recruiter_name}</strong></span>}
                        </div>
                        {(sub.requirement_name || sub.company_name) && (
                            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{sub.requirement_name}{sub.company_name ? ` · ${sub.company_name}` : ""}</div>
                        )}
                    </div>
                    <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: "4px 9px" }} title="Close (Esc)">×</button>
                </header>

                <div style={{ flex: 1, overflowY: "auto", padding: "1.1rem 1.2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {/* Recruiter-submitted details */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem 1.5rem" }}>
                        <Field label="Current Role" value={sub.current_role} />
                        <Field label="Current Company" value={sub.current_company} />
                        <Field label="Total Experience" value={sub.total_experience} />
                        <Field label="Notice Period" value={sub.notice_period ? <span style={{ color: noticePeriodColor(sub.notice_period), fontWeight: 600 }}>{sub.notice_period}</span> : undefined} />
                        <Field label="Current CTC" value={sub.current_ctc != null ? `${sub.current_ctc} LPA` : undefined} />
                        <Field label="Expected CTC" value={sub.expected_ctc != null ? `${sub.expected_ctc} LPA` : undefined} />
                    </div>

                    {/* Shortlisted — admin/client-manager toggles Yes / No */}
                    <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem", display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>Shortlisted</div>
                        {isAdmin ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                {shortlisted == null && (
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6, background: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>Not set</span>
                                )}
                                <button onClick={() => setShortlist(true)} disabled={savingSL}
                                    style={{
                                        fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 6, cursor: "pointer",
                                        background: shortlisted === true ? "#dcfce7" : "transparent", color: "#16a34a",
                                        border: `1px solid ${shortlisted === true ? "#16a34a" : "var(--border-subtle)"}`
                                    }}>✓ Yes</button>
                                <button onClick={() => setShortlist(false)} disabled={savingSL}
                                    style={{
                                        fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 6, cursor: "pointer",
                                        background: shortlisted === false ? "#fee2e2" : "transparent", color: "#dc2626",
                                        border: `1px solid ${shortlisted === false ? "#dc2626" : "var(--border-subtle)"}`
                                    }}>✗ No</button>
                                {shortlisted !== null && (
                                    <button onClick={() => setShortlist(null)} disabled={savingSL}
                                        style={{
                                            fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 6, cursor: "pointer",
                                            background: "transparent", color: "var(--text-muted)",
                                            border: "1px solid var(--border-subtle)"
                                        }}>× Clear</button>
                                )}
                            </div>
                        ) : (
                            <span style={{ fontSize: 12, fontWeight: 700, color: shortlisted === true ? "#16a34a" : shortlisted === false ? "#dc2626" : "var(--text-muted)" }}>
                                {shortlisted === true ? "✓ Yes" : shortlisted === false ? "✗ No" : "—"}
                            </span>
                        )}
                    </div>

                    {/* Flags */}
                    {Array.isArray(sub.flags) && sub.flags.length > 0 && (
                        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6 }}>Flags</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                {sub.flags.map((f: any, i: number) => {
                                    const warn = f.severity === "warning";
                                    return (
                                        <div key={i} style={{
                                            fontSize: 12.5, padding: "5px 9px", borderRadius: 6, lineHeight: 1.4,
                                            background: warn ? "#fef3c7" : "#dbeafe", color: warn ? "#92400e" : "#1d4ed8",
                                            border: `1px solid ${warn ? "#fde68a" : "#bfdbfe"}`
                                        }}>{f.message}</div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

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

                    {/* Comments */}
                    <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6 }}>Comments</div>
                        {isAdmin && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                                <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={2} placeholder="Add a comment about this candidate…"
                                    style={{ resize: "vertical", padding: "0.5rem", fontSize: 13, border: "1px solid var(--border-subtle)", borderRadius: 6, background: "var(--bg-input)", color: "var(--text-primary)" }} />
                                <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={postComment} disabled={posting || !draft.trim()}>{posting ? "Posting…" : "Post comment"}</button>
                            </div>
                        )}
                        {comments.length === 0
                            ? <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No comments yet.</div>
                            : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {comments.map((c: any, i: number) => (
                                    <div key={i} style={{ background: "var(--bg-secondary)", borderRadius: 6, padding: "0.55rem 0.7rem" }}>
                                        <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{c.comment}</div>
                                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3 }}>
                                            <strong style={{ color: "var(--text-primary)" }}>{c.author_name || "Unknown"}</strong>
                                            {c.date && <> · {fmtDate(c.date)}</>}
                                            {c.requirement_name && <> · {c.requirement_name}</>}
                                        </div>
                                    </div>
                                ))}
                            </div>}
                    </div>

                    {/* Resume — always shown at the bottom */}
                    <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>Resume</div>
                            {resumeUrl && (
                                <div style={{ display: "flex", gap: 8 }}>
                                    <a href={resumeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Open in new tab ↗</a>
                                    <a href={resumeUrl} download={sub.candidate_name || "resume"} className="btn btn-ghost btn-sm">Download</a>
                                </div>
                            )}
                        </div>
                        <div style={{ height: "72vh", border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "hidden", background: "var(--bg-secondary)" }}>
                            {resumeErr
                                ? <div style={{ padding: "1rem", fontSize: 13, color: "#dc2626" }}>{resumeErr}</div>
                                : !resumeUrl
                                    ? <div style={{ padding: "1rem", fontSize: 13, color: "var(--text-secondary)" }}>Loading resume…</div>
                                    : resumeMime.includes("pdf")
                                        ? <iframe src={resumeUrl} title="Resume" style={{ width: "100%", height: "100%", border: "none" }} />
                                        : <div style={{ padding: "1rem", fontSize: 13, color: "var(--text-secondary)" }}>Preview is only available for PDFs — use “Open in new tab” or “Download”.</div>}
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}

function SubmissionsTab({ isAdmin }: { isAdmin: boolean }) {
    const { applied, setRecruiterOptions, setCounts } = useContext(FilterCtx);
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
    }, [applied.client, applied.search, applied.status, applied.recruiterId]); // eslint-disable-line react-hooks/exhaustive-deps

    const displayed = applied.search
        ? subs.filter(s =>
            s.candidate_name?.toLowerCase().includes(applied.search.toLowerCase()) ||
            s.requirement_name?.toLowerCase().includes(applied.search.toLowerCase()) ||
            s.recruiter_name?.toLowerCase().includes(applied.search.toLowerCase())
        )
        : subs;

    useEffect(() => {
        setCounts(
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Total Submissions: <strong style={{ color: "var(--text-primary)" }}>{displayed.length}</strong>
            </div>
        );
        return () => setCounts(null);
    }, [displayed.length, setCounts]);

    const loadMore = () => load(applied, subs.length, true);
    const colCount = 11; // Date Client Recruiter Role Candidate Exp CTC ExpCTC Notice Status Shortlisted

    // Set shortlisted to Yes / No, or clear to null (optimistic, reverts on failure).
    const setShortlistValue = async (appId: string, val: boolean | null) => {
        const prev = subs.find(s => s.application_id === appId)?.client_shortlisted ?? null;
        setSubs(p => p.map(s => s.application_id === appId ? { ...s, client_shortlisted: val } : s));
        try {
            await api.patch(`/applications/${appId}/shortlist`, { shortlisted: val });
        } catch {
            setSubs(p => p.map(s => s.application_id === appId ? { ...s, client_shortlisted: prev } : s));
        }
    };

    const handleShortlistChange = (appId: string, val: boolean | null) => {
        setSubs(prev => prev.map(s => s.application_id === appId ? { ...s, client_shortlisted: val } : s));
        setSelected((sel: any) => (sel && sel.application_id === appId ? { ...sel, client_shortlisted: val } : sel));
    };

    return (
        <>
            {selected && <SubmissionDrawer sub={selected} isAdmin={isAdmin} onClose={() => setSelected(null)} onShortlist={handleShortlistChange} />}

            {error && <ErrMsg msg={error} />}

            <div className="data-table-wrap">
                <div style={{ overflowX: "auto" }}>
                    <table className="data-table" style={{ tableLayout: "fixed", minWidth: 860, width: "100%" }}>
                        <colgroup>
                            <col style={{ width: "82px" }} />
                            <col style={{ width: "100px" }} />
                            <col style={{ width: "76px" }} />
                            <col style={{ width: "120px" }} />
                            <col style={{ width: "120px" }} />
                            <col style={{ width: "58px" }} />
                            <col style={{ width: "64px" }} />
                            <col style={{ width: "64px" }} />
                            <col style={{ width: "80px" }} />
                            <col style={{ width: "80px" }} />
                            <col style={{ width: "76px" }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th style={{ fontSize: 12 }}>Date</th>
                                <th style={{ fontSize: 12 }}>Client</th>
                                <th style={{ fontSize: 12 }}>Recruiter</th>
                                <th style={{ fontSize: 12 }}>Role</th>
                                <th style={{ fontSize: 12 }}>Candidate</th>
                                <th style={{ fontSize: 12 }}>Exp</th>
                                <th style={{ fontSize: 12 }}>CTC</th>
                                <th style={{ fontSize: 12 }}>Exp CTC</th>
                                <th style={{ fontSize: 12 }}>Notice</th>
                                <th style={{ fontSize: 12 }} title="Client shortlisted for interview">Shortlisted</th>
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
                                            <td style={{ ...CELL, fontSize: 12 }} title={String(s.current_ctc ?? "")}>{dash(s.current_ctc)}</td>
                                            <td style={{ ...CELL, fontSize: 12 }} title={String(s.expected_ctc ?? "")}>{dash(s.expected_ctc)}</td>
                                            <td style={{ ...CELL, fontSize: 12, color: noticePeriodColor(s.notice_period), fontWeight: 600 }} title={s.notice_period}>{dash(s.notice_period)}</td>
                                            <td onClick={e => e.stopPropagation()} style={{ textAlign: "center" }}>
                                                {/* Editable only by admin while at SENT; locked/derived afterward. */}
                                                <ShortlistCell
                                                    value={s.client_shortlisted ?? null}
                                                    editable={isAdmin && s.status === "SENT"}
                                                    onChange={(v) => setShortlistValue(s.application_id, v)}
                                                />
                                            </td>
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

const SCHEDULE_STATUSES = [
    { value: "yet_to_schedule", label: "Yet to Schedule" },
    { value: "scheduled", label: "Scheduled" },
    { value: "rescheduled", label: "Rescheduled" },
    { value: "no_show", label: "No Show" },
    { value: "clear", label: "— Clear Round —" },
];

const ROUND_ARROW: Record<string, string> = { L1: "→ L2", L2: "→ L3", L3: "→ HR" };

// Small truncated text cell with title tooltip
function Trunc({ text, style }: { text: any; style?: React.CSSProperties }) {
    const v = text == null || text === "" ? "—" : String(text);
    return (
        <div title={v} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...style }}>
            {v}
        </div>
    );
}

function RoundCell({ appId, round, data, onSave, readOnly, onPassedFinal }: {
    appId: string; round: string; data: any;
    onSave: (appId: string, round: string, patch: any) => Promise<void>;
    readOnly?: boolean;
    onPassedFinal?: () => void;
}) {
    const savedOutcome = data?.outcome || "";
    const savedStatus = data?.schedule_status || "yet_to_schedule";
    const savedDate = data?.scheduled_date || "";
    const savedTime = data?.scheduled_time || "";

    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState(savedStatus);
    const [date, setDate] = useState(savedDate);
    const [time, setTime] = useState(savedTime);
    const [comment, setComment] = useState("");
    const [commentErr, setCommentErr] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [pos, setPos] = useState({ top: 0, left: 0 });
    const anchorRef = useRef<HTMLDivElement>(null);

    // Re-sync when parent data changes (after save)
    useEffect(() => {
        setStatus(data?.schedule_status || "yet_to_schedule");
        setDate(data?.scheduled_date || "");
        setTime(data?.scheduled_time || "");
    }, [data]);

    // Outside-click closes popover
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const popEl = document.getElementById(`round-popover-${appId}-${round}`);
            if (popEl?.contains(e.target as Node)) return;
            if (anchorRef.current?.contains(e.target as Node)) return;
            handleDiscard();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const openPopover = () => {
        if (readOnly) return;  // only admins / client managers may edit interview rounds
        if (anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const popH = 320;
            const top = spaceBelow < popH ? rect.top + window.scrollY - popH - 6 : rect.bottom + window.scrollY + 6;
            setPos({ top, left: rect.left + window.scrollX });
        }
        setOpen(o => !o);
    };

    // Save with the given outcome (called immediately when Passed/Rejected/Clear clicked)
    const saveWithOutcome = async (newOutcome: string) => {
        const c = comment.trim();
        if (newOutcome === "rejected" && !c) {
            setCommentErr("A comment is required when rejecting.");
            return;
        }
        setCommentErr(null);
        setSaving(true);
        await onSave(appId, round, {
            schedule_status: savedStatus,
            scheduled_date: savedDate || null,
            scheduled_time: savedTime || null,
            outcome: newOutcome || null,
            comment: c || null,
        });
        setSaving(false);
        setComment("");
        setOpen(false);
        // After L3/HR passes, prompt for selection details
        if (newOutcome === "passed" && (round === "L3" || round === "HR")) {
            onPassedFinal?.();
        }
    };

    // Save schedule fields only
    const saveSchedule = async () => {
        setSaving(true);
        const isClearRound = status === "clear";
        await onSave(appId, round, {
            schedule_status: isClearRound ? "yet_to_schedule" : status,
            scheduled_date: isClearRound ? null : (date || null),
            scheduled_time: isClearRound ? null : (time || null),
            outcome: isClearRound ? null : (savedOutcome || null),
        });
        setSaving(false);
        if (isClearRound) setStatus("yet_to_schedule");
        setOpen(false);
    };

    const handleDiscard = () => {
        setStatus(savedStatus);
        setDate(savedDate);
        setTime(savedTime);
        setComment("");
        setCommentErr(null);
        setOpen(false);
    };

    const needsSave = status !== savedStatus || date !== savedDate || time !== savedTime;

    // ── Badge shown in the cell ───────────────────────────────────────────
    const base: CSSProperties = { fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 4, cursor: "pointer", display: "inline-block", whiteSpace: "nowrap" };
    const badge = () => {
        if (savedOutcome === "passed")
            return <span style={{ ...base, background: "#ede9fe", color: "#7c3aed", border: "1px solid #c4b5fd" }}>{ROUND_ARROW[round] || "→"}</span>;
        if (savedOutcome === "rejected")
            return <span style={{ ...base, background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5" }}>Rejected</span>;
        if (savedStatus === "scheduled" || savedStatus === "rescheduled") {
            const d = savedDate ? new Date(savedDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "";
            return <span style={{ ...base, background: "#fef9c3", color: "#a16207", border: "1px solid #fde68a" }}>
                {savedStatus === "rescheduled" ? "Rescheduled" : "Scheduled"}{d ? ` · ${d}` : ""}{savedTime ? ` ${savedTime}` : ""}
            </span>;
        }
        if (savedStatus === "no_show")
            return <span style={{ ...base, background: "#f3f4f6", color: "#6b7280", border: "1px solid #d1d5db" }}>No Show</span>;
        return <span style={{ ...base, background: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>+ Schedule</span>;
    };

    const btnBase: CSSProperties = { fontSize: 12, padding: "7px 0", borderRadius: 6, cursor: "pointer", fontWeight: 600, border: "1px solid", flex: 1 };

    const popover = open ? createPortal(
        <div id={`round-popover-${appId}-${round}`}
            onClick={e => e.stopPropagation()}
            style={{ position: "absolute", top: pos.top, left: pos.left, zIndex: 9999, background: "var(--bg-primary)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "1rem", width: 244, boxShadow: "0 8px 32px rgba(0,0,0,0.22)" }}>

            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{round} Interview</span>
                <button onClick={handleDiscard} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-muted)", lineHeight: 1, padding: 0 }}>×</button>
            </div>

            {/* Schedule status */}
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Schedule Status</div>
            <select value={status} onChange={e => setStatus(e.target.value)}
                style={{ width: "100%", fontSize: 13, padding: "7px 10px", marginBottom: 10, border: "1px solid var(--border-subtle)", borderRadius: 6, background: "var(--bg-input)", color: "var(--text-primary)" }}>
                {SCHEDULE_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            {(status === "scheduled" || status === "rescheduled") && (
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)}
                        style={{ flex: 1, fontSize: 12, padding: "6px 8px", border: "1px solid var(--border-subtle)", borderRadius: 6, background: "var(--bg-input)", color: "var(--text-primary)" }} />
                    <input type="text" placeholder="3 PM" value={time} onChange={e => setTime(e.target.value)}
                        style={{ width: 70, fontSize: 12, padding: "6px 8px", border: "1px solid var(--border-subtle)", borderRadius: 6, background: "var(--bg-input)", color: "var(--text-primary)" }} />
                </div>
            )}

            {/* Divider */}
            <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "10px 0" }} />

            {/* Outcome */}
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Outcome</div>
            {savedOutcome && (
                <button onClick={() => !saving && saveWithOutcome("")} disabled={saving}
                    style={{
                        width: "100%", marginBottom: 8, fontSize: 12, padding: "5px 0", borderRadius: 4,
                        cursor: saving ? "not-allowed" : "pointer", fontWeight: 600,
                        background: "#fff5f5", color: "#dc2626", border: "1px solid #fca5a5"
                    }}>
                    × Clear outcome ({savedOutcome})
                </button>
            )}

            {/* Comment — optional on pass, required on reject. Routed to the unified comment store. */}
            <textarea
                value={comment}
                onChange={e => { setComment(e.target.value); if (commentErr) setCommentErr(null); }}
                rows={2}
                placeholder="Comment (required to reject)…"
                style={{ width: "100%", boxSizing: "border-box", fontSize: 12, padding: "6px 8px", marginBottom: commentErr ? 3 : 8, border: `1px solid ${commentErr ? "#fca5a5" : "var(--border-subtle)"}`, borderRadius: 6, background: "var(--bg-input)", color: "var(--text-primary)", resize: "vertical" }}
            />
            {commentErr && <div style={{ fontSize: 11, color: "#dc2626", marginBottom: 8 }}>{commentErr}</div>}

            {/* Outcome buttons — click saves immediately */}
            <div style={{ display: "flex", gap: 6, marginBottom: needsSave ? 10 : 0 }}>
                <button onClick={() => !saving && saveWithOutcome("passed")} disabled={saving}
                    style={{ ...btnBase, background: savedOutcome === "passed" ? "#dcfce7" : "transparent", color: "#16a34a", borderColor: savedOutcome === "passed" ? "#16a34a" : "#86efac" }}>
                    {saving ? "…" : "✓ Passed"}
                </button>
                <button onClick={() => !saving && saveWithOutcome("rejected")} disabled={saving}
                    style={{ ...btnBase, background: savedOutcome === "rejected" ? "#fee2e2" : "transparent", color: "#dc2626", borderColor: savedOutcome === "rejected" ? "#dc2626" : "#fca5a5" }}>
                    {saving ? "…" : "✗ Rejected"}
                </button>
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: needsSave ? 10 : 4 }}>Click to save outcome immediately</div>

            {/* Save / Cancel for schedule changes or clearing */}
            {needsSave && (
                <>
                    {needsSave && (
                        <div style={{ fontSize: 11, color: "#d97706", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#d97706", flexShrink: 0 }} />
                            Schedule changes not yet saved
                        </div>
                    )}
                    <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={saveSchedule} disabled={saving}
                            style={{ ...btnBase, background: "var(--accent)", color: "#fff", borderColor: "transparent", opacity: saving ? 0.7 : 1 }}>
                            {saving ? "Saving…" : "Save Changes"}
                        </button>
                        <button onClick={handleDiscard} disabled={saving}
                            style={{ fontSize: 12, padding: "7px 14px", borderRadius: 6, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>
                            Discard
                        </button>
                    </div>
                </>
            )}
        </div>,
        document.body
    ) : null;

    return (
        <div ref={anchorRef} style={{ display: "inline-block" }} onClick={openPopover}>
            {badge()}
            {popover}
        </div>
    );
}

// ── Selection Details Drawer ──────────────────────────────────────────────
// Opened after L3/HR passes to collect offer + joining details.
function SelectionDetailsDrawer({ appId, candidateName, onClose, onSaved }: {
    appId: string; candidateName?: string; onClose: () => void; onSaved: (patch: any) => void;
}) {
    const [offeredCtc, setOfferedCtc] = useState("");
    const [doj, setDoj] = useState("");
    const [status, setStatus] = useState("SELECTED");
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [onClose]);

    const handleSave = async () => {
        setSaving(true);
        setErr(null);
        try {
            await api.patch(`/applications/${appId}/selection-details`, {
                offered_ctc: offeredCtc ? parseFloat(offeredCtc) : undefined,
                date_of_joining: doj || undefined,
                status,
            });
            onSaved({ offered_ctc: offeredCtc ? parseFloat(offeredCtc) : null, date_of_joining: doj || null, status });
            onClose();
        } catch (e: any) {
            setErr(e?.detail || "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    const labelStyle: CSSProperties = { fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.6px", display: "block", marginBottom: 4 };
    const inputStyle: CSSProperties = { width: "100%", boxSizing: "border-box" as const, fontSize: 13, padding: "7px 10px", border: "1px solid var(--border-subtle)", borderRadius: 6, background: "var(--bg-input)", color: "var(--text-primary)" };

    return (
        <>
            <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1099, background: "rgba(0,0,0,0.18)" }} />
            <aside style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(420px, 95vw)", background: "var(--bg-primary)", borderLeft: "1px solid var(--border-subtle)", boxShadow: "-4px 0 20px rgba(0,0,0,0.12)", zIndex: 1100, display: "flex", flexDirection: "column" }}>
                <header style={{ padding: "1rem 1.2rem", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text-primary)" }}>Selection Details</div>
                        {candidateName && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>{candidateName}</div>}
                    </div>
                    <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: "4px 9px" }}>×</button>
                </header>
                <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <div style={{ padding: "0.75rem 1rem", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 13, color: "#1d4ed8", lineHeight: 1.5 }}>
                        Candidate cleared the final interview round. Fill in the offer details below.
                    </div>
                    <div>
                        <label style={labelStyle}>Offered CTC (LPA)</label>
                        <input type="number" min={0} step={0.1} value={offeredCtc} onChange={e => setOfferedCtc(e.target.value)}
                            placeholder="e.g. 12.5" style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Date of Joining</label>
                        <input type="date" value={doj} onChange={e => setDoj(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Status</label>
                        <select value={status} onChange={e => setStatus(e.target.value)} style={inputStyle}>
                            <option value="SELECTED">Selected</option>
                            <option value="HOLD">Hold</option>
                            <option value="JOINED">Joined</option>
                        </select>
                    </div>
                    {err && <div style={{ fontSize: 12, color: "#dc2626" }}>{err}</div>}
                </div>
                <footer style={{ padding: "1rem 1.2rem", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                        {saving ? "Saving…" : "Save Details"}
                    </button>
                    <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Skip for now</button>
                </footer>
            </aside>
        </>
    );
}

function InterviewsTab({ isAdmin }: { isAdmin: boolean }) {
    const { applied: { client, search }, setCounts } = useContext(FilterCtx);
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectionDrawer, setSelectionDrawer] = useState<{ appId: string; candidateName?: string } | null>(null);

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

    useEffect(() => {
        let l1 = 0, l2 = 0, l3 = 0;
        displayed.forEach(r => {
            const sched = r.interview_schedule || {};
            if (sched.L1 && Object.keys(sched.L1).length > 0) l1++;
            if (sched.L2 && Object.keys(sched.L2).length > 0) l2++;
            if (sched.L3 && Object.keys(sched.L3).length > 0) l3++;
        });
        setCounts(
            <>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>L1: <strong style={{ color: "var(--text-primary)" }}>{l1}</strong></div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>L2: <strong style={{ color: "var(--text-primary)" }}>{l2}</strong></div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>L3/HR: <strong style={{ color: "var(--text-primary)" }}>{l3}</strong></div>
            </>
        );
        return () => setCounts(null);
    }, [displayed, setCounts]);

    const handleRoundSave = async (appId: string, round: string, patch: any) => {
        try {
            const res = await api.patch(`/applications/${appId}/interview-round`, { round, ...patch });
            // Apply the saved round + any cascaded rounds (L1/L2 auto-passed when L2/L3 updated)
            setRows(prev => prev.map(r => {
                if (r.application_id !== appId) return r;
                const updated = { ...(r.interview_schedule || {}), [round]: patch };
                // Back-fill cascaded rounds returned by the server
                if (res?.data && round !== "L1") updated.L1 = res.data.L1 ?? updated.L1;
                if (res?.data && round === "L3") updated.L2 = res.data.L2 ?? updated.L2;

                return {
                    ...r,
                    interview_schedule: updated,
                    client_shortlisted: true,
                    current_status: res?.status || r.current_status
                };
            }));
        } catch (e: any) {
            alert(e?.detail || "Failed to save");
        }
    };

    const outcomeBadge = (status: string) => {
        const map: Record<string, [string, string, string]> = {
            SELECTED: ["Selected", "#dcfce7", "#16a34a"],
            JOINED: ["Joined", "#dcfce7", "#16a34a"],
            OFFER_RELEASED: ["Offered", "#ede9fe", "#7c3aed"],
            OFFER_ACCEPTED: ["Offered", "#ede9fe", "#7c3aed"],
            REJECTED: ["Rejected", "#fee2e2", "#dc2626"],
        };
        const s = map[status];
        if (!s) return <span style={{ color: "var(--text-muted)" }}>—</span>;
        return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: s[1], color: s[2], border: `1px solid ${s[2]}30` }}>{s[0]}</span>;
    };

    const COLS = 10; // added Warning column and phone number
    return (
        <>
            {selectionDrawer && (
                <SelectionDetailsDrawer
                    appId={selectionDrawer.appId}
                    candidateName={selectionDrawer.candidateName}
                    onClose={() => setSelectionDrawer(null)}
                    onSaved={(patch) => {
                        setRows(prev => prev.map(r =>
                            r.application_id === selectionDrawer.appId
                                ? { ...r, offered_ctc: patch.offered_ctc, date_of_joining: patch.date_of_joining, current_status: patch.status }
                                : r
                        ));
                        setSelectionDrawer(null);
                    }}
                />
            )}
            <div className="data-table-wrap" style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ tableLayout: "fixed", width: "100%", minWidth: 960 }}>
                    <colgroup>
                        <col style={{ width: "9%" }} />
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "12%" }} />
                        <col style={{ width: "10%" }} />
                        <col style={{ width: "8%" }} />
                        <col style={{ width: "15%" }} />
                        <col style={{ width: "15%" }} />
                        <col style={{ width: "15%" }} />
                        <col style={{ width: "9%" }} />
                        <col style={{ width: "4%" }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Client</th><th>Role</th><th>Candidate</th><th>Phone</th><th>Recruiter</th>
                            <th>L1</th><th>L2</th><th>L3 / HR</th>
                            <th>Outcome</th><th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? <SkeletonRows cols={COLS} /> : displayed.length === 0 ? (
                            <tr><td colSpan={COLS} className="table-empty">No interviews found.</td></tr>
                        ) : displayed.map((r: any) => {
                            const sched = r.interview_schedule || {};
                            // Show warning when L3/HR passed but selection details not yet filled
                            const needsSelectionDetails = r.current_status === "HR_ROUND" && !r.offered_ctc;
                            return (
                                <tr key={r.application_id}>
                                    <td><Trunc text={r.company_name} style={{ fontWeight: 500, fontSize: 13 }} /></td>
                                    <td><Trunc text={r.requirement_name} style={{ fontSize: 12 }} /></td>
                                    <td><Trunc text={r.candidate_name} style={{ fontWeight: 600, fontSize: 13 }} /></td>
                                    <td><span style={{ fontSize: 12, fontFamily: "monospace", color: r.candidate_phone ? "var(--text-primary)" : "var(--text-muted)" }}>{r.candidate_phone || "—"}</span></td>
                                    <td><Trunc text={r.recruiter_name} style={{ fontSize: 12 }} /></td>
                                    <td>
                                        <RoundCell appId={r.application_id} round="L1" data={sched.L1} onSave={handleRoundSave} readOnly={!isAdmin} />
                                    </td>
                                    <td>
                                        <RoundCell appId={r.application_id} round="L2" data={sched.L2} onSave={handleRoundSave} readOnly={!isAdmin} />
                                    </td>
                                    <td>
                                        <RoundCell appId={r.application_id} round="L3" data={sched.L3} onSave={handleRoundSave} readOnly={!isAdmin}
                                            onPassedFinal={() => setSelectionDrawer({ appId: r.application_id, candidateName: r.candidate_name })} />
                                    </td>
                                    <td>{outcomeBadge(r.current_status)}</td>
                                    <td style={{ textAlign: "center" }}>
                                        {needsSelectionDetails && isAdmin && (
                                            <button
                                                onClick={() => setSelectionDrawer({ appId: r.application_id, candidateName: r.candidate_name })}
                                                title="Selection details not filled — click to add offer details"
                                                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
                                            >
                                                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: "#fef3c7", border: "2px solid #d97706", color: "#d97706", fontSize: 12, fontWeight: 800 }}>!</span>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </>
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
    useDocumentTitle("Analytics");
    const { isAdmin } = useAuth();
    const { tab: tabParam } = useParams<{ tab: string }>();
    const navigate = useNavigate();

    // Client managers (any role) get editing access in the tabs, scoped to their companies.
    // The backend enforces per-company authorization; this just unlocks the UI.
    const { data: myCompaniesData } = useQuery<{ companies: string[]; all_access: boolean }>({
        queryKey: ["my-companies"],
        queryFn: () => api.get("/clients/my-companies").then((r: any) => r || { companies: [], all_access: false }),
        staleTime: 5 * 60 * 1000,
        retry: false,
    });
    const isEffectiveAdmin = isAdmin ||
        Boolean(myCompaniesData?.all_access || (myCompaniesData?.companies?.length ?? 0) > 0);
    const [searchParams] = useSearchParams();

    const VALID_TABS = ["overview", "tracker", "submissions", "interviews", "selections", "recruiters", "insights"];
    // Local state gives an instant visual switch when a tab is clicked.
    // The useEffect below keeps it in sync with the URL so back/forward and
    // hard-refresh both land on the correct tab.
    const [activeTab, setActiveTab] = useState<string>(
        () => VALID_TABS.includes(tabParam || "") ? tabParam! : "overview"
    );

    useEffect(() => {
        const t = VALID_TABS.includes(tabParam || "") ? tabParam! : "overview";
        if (t !== activeTab) setActiveTab(t);
    }, [tabParam]); // eslint-disable-line react-hooks/exhaustive-deps

    const emptyFilters: AppliedFilters = { client: "", search: "", status: "", recruiterId: "" };

    // Filters live in URL query params so they survive refresh and share via URL.
    // useMemo prevents a new object reference on every render (which would cause
    // child useEffects that depend on `applied` to fire even when values haven't changed).
    const applied = useMemo((): AppliedFilters => ({
        client: searchParams.get("client") || "",
        search: searchParams.get("search") || "",
        status: searchParams.get("status") || "",
        recruiterId: searchParams.get("recruiterId") || "",
    }), [searchParams.get("client"), searchParams.get("search"), searchParams.get("status"), searchParams.get("recruiterId")]); // eslint-disable-line react-hooks/exhaustive-deps

    // Draft = local state of filter bar before Apply is clicked.
    const [draft, setDraft] = useState<AppliedFilters>(applied);

    // Sync draft when URL params change (back/forward navigation).
    useEffect(() => {
        setDraft({
            client: searchParams.get("client") || "",
            search: searchParams.get("search") || "",
            status: searchParams.get("status") || "",
            recruiterId: searchParams.get("recruiterId") || "",
        });
    }, [searchParams.toString()]); // eslint-disable-line react-hooks/exhaustive-deps

    const [clientOptions, setClientOptions] = useState<string[]>([]);
    const [recruiterOptions, setRecruiterOptions] = useState<{ id: string; name: string }[]>([]);
    const [counts, setCounts] = useState<React.ReactNode>(null);

    useEffect(() => {
        analyticsApi.getRequirementsTracker()
            .then((rows: any[]) => {
                const names = [...new Set((rows || []).map((r: any) => r.company_name).filter(Boolean))].sort() as string[];
                setClientOptions(names);
            })
            .catch(() => { });
    }, []);

    const buildQs = (filters: AppliedFilters) => {
        const p = new URLSearchParams();
        if (filters.client) p.set("client", filters.client);
        if (filters.search) p.set("search", filters.search);
        if (filters.status) p.set("status", filters.status);
        if (filters.recruiterId) p.set("recruiterId", filters.recruiterId);
        return p.toString();
    };

    const handleTabChange = (key: string) => {
        setActiveTab(key); // instant visual switch — don't wait for router re-render
        const qs = buildQs(applied);
        navigate(`/analytics/${key}${qs ? `?${qs}` : ""}`, { replace: false });
    };

    const handleApply = () => {
        const qs = buildQs(draft);
        navigate(`/analytics/${activeTab}${qs ? `?${qs}` : ""}`, { replace: true });
    };

    const handleClear = () => {
        setDraft(emptyFilters);
        navigate(`/analytics/${activeTab}`, { replace: true });
    };

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
        <FilterCtx.Provider value={{ applied, recruiterOptions, setRecruiterOptions, setCounts }}>
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

            <PillNav tabs={tabs} active={activeTab} onSelect={handleTabChange} />

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
                    <div style={{ marginLeft: "auto", display: "flex", gap: "1rem", alignItems: "center" }}>
                        {counts}
                    </div>
                </div>
            )}

            {activeTab === "overview" && <OverviewTab />}
            {activeTab === "tracker" && <TrackerTab />}
            {activeTab === "submissions" && <SubmissionsTab isAdmin={isEffectiveAdmin} />}
            {activeTab === "interviews" && <InterviewsTab isAdmin={isEffectiveAdmin} />}
            {activeTab === "selections" && <SelectionsTab />}
            {activeTab === "recruiters" && isAdmin && <RecruitersTab />}
            {activeTab === "insights" && isAdmin && <InsightsTab />}
        </FilterCtx.Provider>
    );
}
