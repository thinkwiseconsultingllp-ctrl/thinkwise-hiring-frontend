import { useState, useMemo } from "react";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import StatusBadge from "../components/StatusBadge";
import ModernDropdown from "../components/ModernDropdown";
import Icon from "../components/Icon";
import { useQuery } from "@tanstack/react-query";
import RequirementDetail from "./RequirementDetail";
import "../styles/pages.css";

interface Notification {
    id: string;
    kind: string;
    title: string;
    subtitle: string;
    context: string;
    context_id?: string;
    requirement_id?: string | null;
    candidate_id?: string | null;
    status?: string | null;
    occurred_at?: string | null;
}

const NOTIF_KIND_ICON: Record<string, string> = {
    requirement_created: "📋",
    requirement_assigned: "✅",
    application: "👤",
    assignment_request: "🔔",
    assignment_decision: "📩",
};

const APP_STATUS_COLOR: Record<string, string> = {
    SELECTED: "#16a34a",
    REJECTED: "#dc2626",
    L1_SELECTED: "#2563eb",
    L2_SELECTED: "#7c3aed",
    HR_ROUND: "#d97706",
    SENT: "var(--text-muted)",
};

function NotificationsFeed({ navigate }: { navigate: (path: string) => void }) {
    const { data: notifs = [], isLoading } = useQuery<Notification[]>({
        queryKey: ["notifications"],
        queryFn: () => api.get("/notifications").then((r: any) => r || []),
        staleTime: 5 * 60 * 1000,
        retry: false,
    });

    if (isLoading) return null;
    if (notifs.length === 0) return null;

    return (
        <div style={{ marginTop: "2rem" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "0.75rem" }}>
                Activity Feed
            </div>
            <div style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px",
                overflow: "hidden",
            }}>
                {notifs.slice(0, 15).map((n, idx) => {
                    const isLast = idx === Math.min(notifs.length, 15) - 1;
                    const dot = NOTIF_KIND_ICON[n.kind] || "🔔";
                    const timeStr = n.occurred_at ? new Date(n.occurred_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
                    const statusColor = n.kind === "application" && n.status ? (APP_STATUS_COLOR[n.status] || "var(--text-secondary)") : undefined;

                    const handleClick = () => {
                        if (n.requirement_id) navigate(`/requirements/${n.requirement_id}`);
                    };

                    return (
                        <div
                            key={n.id}
                            onClick={n.requirement_id ? handleClick : undefined}
                            style={{
                                display: "flex", alignItems: "flex-start", gap: "12px",
                                padding: "12px 16px",
                                borderBottom: isLast ? "none" : "1px solid var(--border-subtle)",
                                cursor: n.requirement_id ? "pointer" : "default",
                                transition: "background 0.15s",
                            }}
                            onMouseEnter={e => { if (n.requirement_id) (e.currentTarget as HTMLDivElement).style.background = "var(--bg-secondary)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ""; }}
                        >
                            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{dot}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap" }}>
                                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{n.title}</span>
                                    <span style={{ fontSize: 12, color: statusColor || "var(--text-secondary)" }}>{n.subtitle}</span>
                                </div>
                                {n.context && (
                                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {n.context}
                                    </div>
                                )}
                            </div>
                            {timeStr && (
                                <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, whiteSpace: "nowrap", marginTop: 2 }}>{timeStr}</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
interface Requirement {
    id: string;
    req_id: string;
    company_name: string;
    requirement_name: string;
    status: string;
    sla_status?: string | null;
    sla_breached?: boolean | null;
    sla_remaining_hours?: number | null;
    requirement_type: string | null;
    role_type: string | null;
    client_spoc_name: string | null;
    location: string | null;
    mode_of_work: string | null;
    years_of_experience: string | null;
    must_have_skills: string[];
    good_to_have_skills: string[];
    special_instructions: string | null;
    notice_period: string | null;
    assigned_recruiters: string[];
    created_at: string;
}

function SlaChip({ req }: { req: Requirement }) {
    const status = req.sla_status || "ON_TRACK";
    const breached = Boolean(req.sla_breached);
    if (status === "MET") return <span className="sla-badge sla-badge--met">SLA Met</span>;
    if (breached || status === "BREACHED") return <span className="sla-badge sla-badge--breached">SLA Breached</span>;
    const label = req.sla_remaining_hours != null ? `${Math.ceil(req.sla_remaining_hours)}h left` : "On Track";
    return <span className="sla-badge sla-badge--ontrack">{label}</span>;
}

function SkillPill({ label, variant }: { label: string; variant: "must" | "good" }) {
    return (
        <span style={{
            fontSize: "11px", padding: "3px 9px", borderRadius: "20px", fontWeight: 500,
            background: variant === "must"
                ? "color-mix(in srgb, var(--primary) 10%, transparent)"
                : "var(--bg-secondary)",
            color: variant === "must" ? "var(--primary)" : "var(--text-secondary)",
            border: `1px solid ${variant === "must" ? "color-mix(in srgb, var(--primary) 25%, transparent)" : "var(--border-subtle)"}`,
        }}>
            {label}
        </span>
    );
}

function JDDetailModal({ req, onClose }: { req: Requirement; onClose: () => void }) {
    const must = req.must_have_skills || [];
    const good = req.good_to_have_skills || [];

    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed", inset: 0, zIndex: 2000,
                background: "rgba(0,0,0,0.45)", display: "flex",
                alignItems: "center", justifyContent: "center", padding: "16px",
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "16px",
                    width: "100%", maxWidth: "560px", maxHeight: "85vh",
                    display: "flex", flexDirection: "column",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                    overflow: "hidden",
                }}
            >
                {/* Header */}
                <div style={{
                    padding: "20px 24px 16px",
                    borderBottom: "1px solid var(--border-subtle)",
                    display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px",
                }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span style={{
                                fontSize: "11px", fontWeight: 700, color: "var(--primary)",
                                background: "color-mix(in srgb, var(--primary) 10%, transparent)",
                                borderRadius: "6px", padding: "2px 8px",
                            }}>
                                {req.req_id}
                            </span>
                        </div>
                        <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>
                            {req.requirement_name}
                        </h2>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "3px" }}>{req.company_name}</div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: "18px", color: "var(--text-muted)", padding: "2px 6px",
                            lineHeight: 1, borderRadius: "6px", flexShrink: 0,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
                        onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>

                    {/* Must-have skills */}
                    {must.length > 0 && (
                        <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "10px" }}>
                                Must-Have Skills
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                {must.map((sk, i) => <SkillPill key={i} label={sk} variant="must" />)}
                            </div>
                        </div>
                    )}

                    {/* Good-to-have skills */}
                    {good.length > 0 && (
                        <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "10px" }}>
                                Good-to-Have Skills
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                {good.map((sk, i) => <SkillPill key={i} label={sk} variant="good" />)}
                            </div>
                        </div>
                    )}

                    {must.length === 0 && good.length === 0 && (
                        <div style={{ color: "var(--text-muted)", fontSize: "13px", textAlign: "center", padding: "12px 0" }}>
                            No skills extracted for this requirement
                        </div>
                    )}

                    {/* Special instructions */}
                    {req.special_instructions && (
                        <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "10px" }}>
                                Special Instructions
                            </div>
                            <div style={{
                                fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.65,
                                background: "var(--bg-secondary)", borderRadius: "10px", padding: "12px 14px",
                                border: "1px solid var(--border-subtle)", whiteSpace: "pre-wrap",
                            }}>
                                {req.special_instructions}
                            </div>
                        </div>
                    )}

                    {/* Notice period */}
                    {req.notice_period && (
                        <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "6px" }}>
                                Notice Period
                            </div>
                            <div style={{ fontSize: "13px", color: "var(--text-primary)" }}>{req.notice_period}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function toSlug(s: string) {
    return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function RequirementCard({
    req,
    onAssign,
    onViewDetails,
    onNavigate,
    assigning,
    userId,
    isRequested,
}: {
    req: Requirement;
    onAssign: (id: string) => void;
    onViewDetails: (req: Requirement) => void;
    onNavigate: (req: Requirement) => void;
    assigning: string | null;
    userId: string;
    isRequested?: boolean;
}) {
    const isAssigned = req.assigned_recruiters?.includes(userId);

    return (
        <div style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "14px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            transition: "box-shadow 0.18s, transform 0.18s",
            cursor: "pointer",
        }}
            onClick={() => onNavigate(req)}
            onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = "0 6px 24px rgba(0,0,0,0.10)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                (e.currentTarget as HTMLDivElement).style.transform = "none";
            }}
        >
            {/* Top row */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: 0 }}>
                    <span style={{
                        display: "inline-block", fontSize: "11px", fontWeight: 700,
                        color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 10%, transparent)",
                        borderRadius: "6px", padding: "2px 8px", width: "fit-content",
                        letterSpacing: "0.5px",
                    }}>
                        {req.req_id}
                    </span>
                    {/* <span style={{ fontSize: "11px", color: "var(--primary)", fontWeight: 700 }}>{req.company_name}</span> */}
                </div>
                <div style={{ display: "flex", gap: "6px", flexShrink: 0, alignItems: "center" }}>
                    <SlaChip req={req} />
                    <StatusBadge status={req.status} />
                </div>
            </div>

            {/* Title */}
            <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.3 }}>
                    {req.requirement_name} - {req.company_name}
                </h3>
            </div>

            {/* Meta */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", fontSize: "12px", color: "var(--text-secondary)" }}>
                {req.role_type && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.8 }}><Icon name="briefcase" size={13} /> {req.role_type}</span>}
                {req.requirement_type && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.8 }}><Icon name="document" size={13} /> {req.requirement_type.replace("_", " ")}</span>}
                {req.mode_of_work && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.8 }}><Icon name="users" size={13} /> {req.mode_of_work}</span>}
                {req.location && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.8 }}><Icon name="pin" size={13} /> {req.location}</span>}
                {req.years_of_experience && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.8 }}><Icon name="clock" size={13} /> {req.years_of_experience} yrs</span>}
                {req.client_spoc_name && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.8 }}><Icon name="user" size={13} /> {req.client_spoc_name}</span>}
            </div>

            {/* Footer actions */}
            <div style={{ display: "flex", gap: "8px", marginTop: "auto", paddingTop: "4px" }}>
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={(e) => { e.stopPropagation(); onViewDetails(req); }}
                    style={{ flex: 1, justifyContent: "center" }}
                >
                    View Details
                </button>
                <a
                    href={`/requirements/${req.id}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    title="Open in new tab"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "0 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)", color: "var(--text-muted)", textDecoration: "none", fontSize: 14 }}
                >↗</a>
                <button
                    className={isAssigned || isRequested ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"}
                    onClick={(e) => { e.stopPropagation(); onAssign(req.id); }}
                    disabled={assigning === req.id || isAssigned || isRequested}
                    style={{
                        flex: 1, justifyContent: "center",
                        ...(isAssigned ? {
                            color: "var(--success, #16a34a)",
                            borderColor: "var(--success, #16a34a)",
                        } : isRequested ? {
                            color: "#ca8a04",
                            borderColor: "#ca8a04",
                        } : {}),
                    }}
                >
                    {assigning === req.id ? "..." : isAssigned ? "✓ Assigned" : isRequested ? "Request Pending" : "Request Assignment"}
                </button>
            </div>
        </div>
    );
}

function RecruiterAssignmentsTable({ requirements }: { requirements: Requirement[] }) {
    const { data: users = [] } = useQuery<any[]>({
        queryKey: ["users"],
        queryFn: () => api.get("/users").then((r: any) => r || []),
    });

    const recruiterMap = useMemo(() => {
        const map = new Map<string, { name: string; reqs: Requirement[] }>();
        for (const u of users) {
            if (u.role === "RECRUITER" || u.role === "ADMIN") {
                map.set(String(u.id), { name: u.name || u.email, reqs: [] });
            }
        }
        for (const req of requirements) {
            for (const uid of req.assigned_recruiters || []) {
                const key = String(uid);
                if (map.has(key)) map.get(key)!.reqs.push(req);
            }
        }
        const entries = [...map.entries()].filter(([, v]) => v.reqs.length > 0);
        entries.sort((a, b) => b[1].reqs.length - a[1].reqs.length);
        return entries;
    }, [users, requirements]);

    if (recruiterMap.length === 0) return null;

    return (
        <div className="detail-section" style={{ marginBottom: "1.5rem" }}>
            <div className="detail-section-title" style={{ marginBottom: "0.75rem" }}>Recruiter Assignments</div>
            <div className="data-table-wrap">
                <table className="data-table" style={{ tableLayout: "fixed", width: "100%" }}>
                    <colgroup>
                        <col style={{ width: "22%" }} />
                        <col style={{ width: "58%" }} />
                        <col style={{ width: "20%" }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th style={{ fontSize: 12 }}>Recruiter</th>
                            <th style={{ fontSize: 12 }}>Assigned Requirements</th>
                            <th style={{ fontSize: 12 }}>Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        {recruiterMap.map(([uid, { name, reqs }]) => (
                            <tr key={uid}>
                                <td style={{ fontWeight: 600, fontSize: 13 }}>{name}</td>
                                <td>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                                        {reqs.slice(0, 5).map(r => (
                                            <span key={r.id} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                                                {r.req_id} · {r.requirement_name}
                                            </span>
                                        ))}
                                        {reqs.length > 5 && (
                                            <span style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center" }}>+{reqs.length - 5} more</span>
                                        )}
                                    </div>
                                </td>
                                <td style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>{reqs.length}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function Dashboard() {
    useDocumentTitle("Dashboard");
    const { user, isAdmin } = useAuth();
    const navigate = useNavigate();
    const { clientSlug, reqSlug } = useParams<{ clientSlug?: string; reqSlug?: string }>();
    const location = useLocation();
    const reqIdFromState = (location.state as any)?.reqId as string | undefined;
    const [assigning, setAssigning] = useState<string | null>(null);
    const [optimisticRequested, setOptimisticRequested] = useState<Set<string>>(new Set());
    const [detailReq, setDetailReq] = useState<Requirement | null>(null);
    const notice = "";

    const { data: requirements = [], isLoading: loading } = useQuery<Requirement[]>({
        queryKey: ["requirements"],
        queryFn: () => api.get("/requirements").then((r: any) => r || []),
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
    });

    const { data: pendingRequestIds = [] } = useQuery<string[]>({
        queryKey: ["assignment-requests-pending", user?.id],
        queryFn: () =>
            api.get("/assignment-requests?status=pending").then((reqs: any[]) =>
                (reqs || [])
                    .filter((r: any) => r.recruiter_id === user?.id)
                    .map((r: any) => r.requirement_id)
            ),
        enabled: !isAdmin && !!user?.id,
    });

    // Merge server-known pending with optimistic additions from this session
    const requestedReqs = useMemo(
        () => new Set([...pendingRequestIds, ...optimisticRequested]),
        [pendingRequestIds, optimisticRequested],
    );

    // Fetch official client list (companies user can manage)
    const { data: myCompaniesData } = useQuery<{ companies: string[]; all_access: boolean }>({
        queryKey: ["my-companies"],
        queryFn: () => api.get("/clients/my-companies").then((r: any) => r || { companies: [], all_access: false }),
        staleTime: 5 * 60 * 1000,
        retry: false,
    });

    const clientsMap = useMemo(() => {
        const map = new Map<string, Requirement[]>();
        for (const req of requirements) {
            const c = req.company_name || "Unknown Client";
            if (!map.has(c)) map.set(c, []);
            map.get(c)!.push(req);
        }
        return map;
    }, [requirements]);

    // Merge official client names with requirement-derived names.
    // Deduplicate by slug so "CtrlS" and "ctrls" become one card.
    // Requirements-derived names (canonical casing) win over API names.
    const clientNames = useMemo(() => {
        const fromReqs = Array.from(clientsMap.keys());
        const fromApi = myCompaniesData?.companies || [];
        const slugToName = new Map<string, string>();
        // API names first (lower priority)
        for (const n of fromApi) slugToName.set(toSlug(n), n);
        // Requirements names overwrite (higher priority — canonical casing)
        for (const n of fromReqs) slugToName.set(toSlug(n), n);
        return [...slugToName.values()].sort();
    }, [clientsMap, myCompaniesData]);

    // Resolve URL slug → client name
    const selectedClient = useMemo(() => {
        if (!clientSlug) return null;
        return clientNames.find(n => toSlug(n) === clientSlug) || null;
    }, [clientSlug, clientNames]);

    const clientRequirements = selectedClient ? (clientsMap.get(selectedClient) || []) : [];

    // True if the current user is an assigned client manager for the selected client.
    // Use slug comparison so "ctrls" matches "CtrlS" (same slug "ctrls").
    const isClientManager = Boolean(
        myCompaniesData?.all_access ||
        (myCompaniesData?.companies || []).some(c => toSlug(c) === (clientSlug || ""))
    );

    // Treat client managers like admins for their assigned client
    const effectiveAdmin = isAdmin || isClientManager;

    // Admin filter state
    const [searchParam, setSearchParam] = useState("");
    const [searchValue, setSearchValue] = useState("");
    const [appliedFilter, setAppliedFilter] = useState<{ param: string; value: string } | null>(null);

    // Recruiter card filter state
    const [cardSearch, setCardSearch] = useState("");
    const [cardStatus, setCardStatus] = useState("ALL");

    const handleAssign = async (id: string) => {
        setAssigning(id);
        try {
            await api.post(`/requirements/${id}/assignment-requests`, { message: "Requested from Dashboard" });
            setOptimisticRequested(prev => new Set([...prev, id]));
        } catch (e: any) {
            alert(e?.detail || e?.message || "Failed to send request");
        } finally {
            setAssigning(null);
        }
    };

    // Admin helpers
    const openReqs = clientRequirements.filter(r => r.status === "OPEN");
    const holdReqs = clientRequirements.filter(r => r.status === "ON_HOLD");
    const closedReqs = clientRequirements.filter(r => r.status === "CLOSED");
    const positionClosedReqs = clientRequirements.filter(r => r.status === "POSITION_CLOSED");
    const archivedReqs = clientRequirements.filter(r => r.status === "ARCHIVED");
    const deletedReqs = clientRequirements.filter(r => r.status === "DELETED");
    const [activeTab, setActiveTab] = useState("OPEN");

    const REQ_TABS = [
        { key: "OPEN", label: "Open", reqs: openReqs },
        { key: "ON_HOLD", label: "On Hold", reqs: holdReqs },
        { key: "CLOSED", label: "Closed", reqs: closedReqs },
        { key: "POSITION_CLOSED", label: "Position Closed", reqs: positionClosedReqs },
        { key: "ARCHIVED", label: "Archived", reqs: archivedReqs },
        { key: "DELETED", label: "Deleted", reqs: deletedReqs },
    ];

    const getFilteredReqs = (reqs: Requirement[]) => {
        if (!appliedFilter) return reqs;
        return reqs.filter(r => {
            const { param, value } = appliedFilter;
            if (param === "role") return r.role_type === value;
            if (param === "contract") return r.requirement_type === value;
            if (param === "requirement") return r.requirement_name === value;
            return true;
        });
    };

    const getAdminDisplayedReqs = () => {
        if (appliedFilter) return getFilteredReqs(clientRequirements);
        return REQ_TABS.find(t => t.key === activeTab)?.reqs ?? openReqs;
    };

    const uniqueValues = {
        role: [...new Set(clientRequirements.map(r => r.role_type).filter(Boolean))],
        contract: [...new Set(clientRequirements.map(r => r.requirement_type).filter(Boolean))],
        requirement: [...new Set(clientRequirements.map(r => r.requirement_name).filter(Boolean))],
    };

    const handleSearch = () => {
        if (searchParam && searchValue) setAppliedFilter({ param: searchParam, value: searchValue });
    };

    const handleClear = () => {
        setSearchParam(""); setSearchValue(""); setAppliedFilter(null);
    };

    const renderSla = (req: Requirement) => {
        const status = req.sla_status || "ON_TRACK";
        const breached = Boolean(req.sla_breached);
        if (status === "MET") return <span className="sla-badge sla-badge--met">Met</span>;
        if (breached || status === "BREACHED") return <span className="sla-badge sla-badge--breached">Breached</span>;
        const label = req.sla_remaining_hours != null ? `${Math.ceil(req.sla_remaining_hours)}h left` : "On Track";
        return <span className="sla-badge sla-badge--ontrack">{label}</span>;
    };

    const renderStatsRow = (reqs: Requirement[]) => {
        const total = reqs.length;
        const open = reqs.filter(r => r.status === "OPEN").length;
        const hold = reqs.filter(r => r.status === "ON_HOLD").length;
        const closed = reqs.filter(r => r.status === "CLOSED").length;
        return (
            <div className="stats-row" style={{ marginBottom: "1.5rem" }}>
                <div className="stat-box">
                    <div className="stat-box-value accent">{total}</div>
                    <div className="stat-box-label">Total Requirements</div>
                </div>
                <div className="stat-box">
                    <div className="stat-box-value">{open}</div>
                    <div className="stat-box-label">Open</div>
                </div>
                <div className="stat-box">
                    <div className="stat-box-value">{hold}</div>
                    <div className="stat-box-label">On Hold</div>
                </div>
                <div className="stat-box">
                    <div className="stat-box-value">{closed}</div>
                    <div className="stat-box-label">Closed</div>
                </div>
            </div>
        );
    };

    const renderClientCards = () => {
        return (
            <div style={{ padding: "10px 0" }}>
                <div className="page-header">
                    <div>
                        <h1>Clients Overview</h1>
                        <p className="page-header-sub">Select a client to view their requirements</p>
                    </div>
                    {isAdmin && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn btn-primary" onClick={() => navigate("/requirements/new")}>
                                + Create Requirement
                            </button>
                        </div>
                    )}
                </div>

                {renderStatsRow(requirements)}

                {notice && <div className="form-success" style={{ marginBottom: "1.5rem" }}>{notice}</div>}

                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: "16px",
                }}>
                    {clientNames.map(c => {
                        const reqs = clientsMap.get(c) || [];
                        const openCount = reqs.filter(r => r.status === "OPEN").length;
                        const isActive = openCount > 0;
                        return (
                            <div key={c}
                                style={{
                                    background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                                    borderRadius: "12px", padding: "20px", cursor: "pointer",
                                    transition: "all 0.2s"
                                }}
                                onClick={() => navigate(`/dashboard/${toSlug(c)}`)}
                                onMouseEnter={e => e.currentTarget.style.borderColor = "var(--primary)"}
                                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border-subtle)"}
                            >
                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                                    <h3 style={{ margin: 0, fontSize: "18px" }}>{c}</h3>
                                    <span style={{
                                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                                        background: isActive ? "color-mix(in srgb, var(--success, #16a34a) 12%, transparent)" : "var(--bg-secondary)",
                                        color: isActive ? "var(--success, #16a34a)" : "var(--text-muted)",
                                        border: `1px solid ${isActive ? "color-mix(in srgb, var(--success, #16a34a) 30%, transparent)" : "var(--border-subtle)"}`,
                                        flexShrink: 0,
                                    }}>
                                        {isActive ? "Active" : "Inactive"}
                                    </span>
                                </div>
                                <div style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                                    {openCount} Open Requirement{openCount !== 1 ? "s" : ""}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {!isAdmin && <NotificationsFeed navigate={navigate} />}
            </div>
        );
    };

    // ── Requirement detail view (/dashboard/:clientSlug/:reqSlug) ─────────────
    // Fast path: caller passed reqId in navigation state (from Analytics row click)
    if (reqIdFromState) {
        return <RequirementDetail reqId={reqIdFromState} />;
    }
    // Slug-resolution fallback (for direct URL access or Dashboard table row click)
    if (reqSlug) {
        if (loading) return <div className="page-loading">Loading…</div>;
        const matchedReq = requirements.find(
            r => toSlug(r.company_name || "") === clientSlug && toSlug(r.requirement_name || "") === reqSlug
        );
        if (matchedReq) return <RequirementDetail reqId={matchedReq.id} />;
        // No match — fall through to client view (slug may be stale)
    }

    if (!selectedClient) {
        return renderClientCards();
    }

    // Recruiter card view
    if (!effectiveAdmin) {

        const filtered = clientRequirements.filter(r => {
            const matchesStatus = cardStatus === "ALL" || r.status === cardStatus;
            const q = cardSearch.toLowerCase();
            const matchesSearch = !q ||
                r.requirement_name.toLowerCase().includes(q) ||
                r.req_id.toLowerCase().includes(q) ||
                (r.role_type || "").toLowerCase().includes(q);
            return matchesStatus && matchesSearch;
        });

        return (
            <>
                <div>
                    <div className="page-header" style={{ alignItems: "flex-start" }}>
                        <div>
                            <button className="btn btn-ghost btn-sm" style={{ marginBottom: "8px", padding: "4px 0", color: "var(--text-muted)" }} onClick={() => navigate("/dashboard")}>
                                ← Back to Clients
                            </button>
                            <h1 style={{ marginTop: 0 }}>{selectedClient} Requirements</h1>
                            <p className="page-header-sub">Browse open requirements and assign yourself</p>
                        </div>
                    </div>

                    {renderStatsRow(clientRequirements)}

                    {notice && <div className="form-success" style={{ marginBottom: "1.5rem" }}>{notice}</div>}

                    {/* Filters */}
                    <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
                        <input
                            type="text"
                            placeholder="Search by name, Req ID, company, role..."
                            value={cardSearch}
                            onChange={e => setCardSearch(e.target.value)}
                            style={{
                                flex: 1, minWidth: "220px", padding: "0.6rem 0.85rem",
                                background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
                                borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "var(--font-size-sm)",
                            }}
                        />
                        <select
                            value={cardStatus}
                            onChange={e => setCardStatus(e.target.value)}
                            style={{
                                padding: "0.6rem 0.85rem", background: "var(--bg-input)",
                                border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)",
                                color: "var(--text-primary)", fontSize: "var(--font-size-sm)",
                            }}
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="OPEN">Open</option>
                            <option value="ON_HOLD">On Hold</option>
                            <option value="CLOSED">Closed</option>
                        </select>
                        <span style={{ fontSize: "13px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                            {filtered.length} requirement{filtered.length !== 1 ? "s" : ""}
                        </span>
                    </div>

                    {loading ? (
                        <div className="loading-spinner">Loading...</div>
                    ) : filtered.length === 0 ? (
                        <div className="table-empty">
                            <div className="table-empty-icon"><Icon name="document" size={48} /></div>
                            No requirements found
                        </div>
                    ) : (
                        <div style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                            gap: "16px",
                        }}>
                            {filtered.map(req => (
                                <RequirementCard
                                    key={req.id}
                                    req={req}
                                    onAssign={handleAssign}
                                    onViewDetails={setDetailReq}
                                    onNavigate={(req) => navigate(`/dashboard/${toSlug(req.company_name || "")}/${toSlug(req.requirement_name || "")}`)}
                                    assigning={assigning}
                                    userId={user?.id || ""}
                                    isRequested={requestedReqs.has(req.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {detailReq && <JDDetailModal req={detailReq} onClose={() => setDetailReq(null)} />}
            </>
        );
    }

    // Admin table view
    const displayedReqs = getAdminDisplayedReqs();

    return (
        <div>
            <div className="page-header" style={{ alignItems: "flex-start" }}>
                <div>
                    <button className="btn btn-ghost btn-sm" style={{ marginBottom: "8px", padding: "4px 0", color: "var(--text-muted)" }} onClick={() => navigate("/dashboard")}>
                        ← Back to Clients
                    </button>
                    <h1 style={{ marginTop: 0 }}>{selectedClient}</h1>
                    <p className="page-header-sub">Admin Dashboard — Here's your hiring overview</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-primary" onClick={() => navigate(`/requirements/new?client=${encodeURIComponent(selectedClient || "")}`)}>
                        + Create Requirement
                    </button>
                </div>
            </div>

            {notice && <div className="form-success" style={{ marginBottom: "1.5rem" }}>{notice}</div>}

            {/* Search Toolbar */}
            <div className="toolbar-row" style={{ marginBottom: "1.5rem", display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
                <ModernDropdown
                    value={searchParam}
                    onChange={val => { setSearchParam(val); setSearchValue(""); }}
                    options={[
                        { value: "role", label: "Role" },
                        { value: "contract", label: "Contract/Type" },
                        { value: "requirement", label: "Requirement Name" },
                    ]}
                    placeholder="Filter by..."
                    style={{ minWidth: "200px" }}
                />
                {searchParam && (
                    <ModernDropdown
                        value={searchValue}
                        onChange={val => setSearchValue(val)}
                        options={uniqueValues[searchParam as keyof typeof uniqueValues]?.map(val => ({ value: val as string, label: val as string })) || []}
                        placeholder={`Select ${searchParam}...`}
                        style={{ minWidth: "200px" }}
                    />
                )}
                {searchParam && searchValue && (
                    <button className="btn btn-primary btn-sm" onClick={handleSearch}>Search</button>
                )}
                {(searchParam || searchValue || appliedFilter) && (
                    <button className="btn btn-ghost btn-sm" onClick={handleClear}>Clear</button>
                )}
            </div>

            {renderStatsRow(clientRequirements)}

            <RecruiterAssignmentsTable requirements={clientRequirements} />

            <div className="detail-section">
                <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1rem", borderBottom: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>
                    {REQ_TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                                padding: "0.5rem 0.85rem", background: "none", border: "none",
                                borderBottomWidth: "2px", borderBottomStyle: "solid",
                                borderBottomColor: activeTab === tab.key ? "var(--primary)" : "transparent",
                                color: activeTab === tab.key ? "var(--primary)" : "var(--text-secondary)",
                                cursor: "pointer", fontWeight: activeTab === tab.key ? 600 : 400,
                                fontSize: 13, whiteSpace: "nowrap",
                            }}
                        >
                            {tab.label} ({tab.reqs.length})
                        </button>
                    ))}
                </div>

                <div className="detail-section-title">
                    {appliedFilter ? "Search Results" : `${REQ_TABS.find(t => t.key === activeTab)?.label ?? activeTab} Requirements`}
                </div>

                {loading ? (
                    <div className="loading-spinner">Loading...</div>
                ) : displayedReqs.length === 0 ? (
                    <div className="table-empty">
                        <div className="table-empty-icon"><Icon name="document" size={48} /></div>
                        No {activeTab.toLowerCase().replace("_", " ")} requirements found
                    </div>
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Req ID</th>
                                    <th>Requirement Name</th>
                                    <th>Type</th>
                                    <th>Role</th>
                                    <th>Client SPOC</th>
                                    <th>SLA</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedReqs.map(req => (
                                    <tr key={req.id} onClick={(e) => { if (e.ctrlKey || e.metaKey) { window.open(`/requirements/${req.id}`, '_blank'); } else { navigate(`/dashboard/${toSlug(req.company_name || "")}/${toSlug(req.requirement_name || "")}`); } }} style={{ cursor: "pointer" }}>
                                        <td className="font-mono text-accent">{req.req_id}</td>
                                        <td><strong>{req.requirement_name}</strong></td>
                                        <td>{req.requirement_type || "-"}</td>
                                        <td>{req.role_type || "-"}</td>
                                        <td>{req.client_spoc_name || "-"}</td>
                                        <td>{renderSla(req)}</td>
                                        <td><StatusBadge status={req.status} /></td>
                                        <td className="text-muted text-sm">{new Date(req.created_at).toLocaleDateString()}</td>
                                        <td onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/dashboard/${toSlug(req.company_name || "")}/${toSlug(req.requirement_name || "")}`)}>View</button>
                                            <a href={`/requirements/${req.id}`} target="_blank" rel="noreferrer" title="Open in new tab"
                                                style={{ fontSize: 14, color: "var(--text-muted)", textDecoration: "none", padding: "2px 4px" }}>↗</a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
