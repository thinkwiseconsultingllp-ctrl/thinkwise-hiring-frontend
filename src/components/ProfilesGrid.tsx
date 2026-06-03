import { useState } from "react";
import { useSideDrawer } from "../context/SideDrawerContext";

type Profile = any;

interface ProfilesGridProps {
    profiles: Profile[];
    jdId: string;
    jobRole?: string;
    minExperience?: number | null;
    maxExperience?: number | null;
    onSubmit?: (profile: Profile) => void;
    currentUserId?: string;
    isAdmin?: boolean;
}

function scoreColor(score: number): string {
    if (score >= 80) return "#16a34a";
    if (score >= 60) return "#ca8a04";
    if (score >= 40) return "#ea580c";
    return "#dc2626";
}

function fmtTs(value?: string | Date | null): string {
    if (!value) return "";
    try {
        return new Date(value).toLocaleString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit", hour12: true,
        });
    } catch { return String(value); }
}

const STATUS_LABEL: Record<string, string> = {
    SENT: "Submitted", L1_SELECTED: "L1 Selected", L2_SELECTED: "L2 Selected",
    L3_SELECTED: "L3 Selected", HR_SELECTED: "HR Selected", HR_ROUND: "HR Round",
    SELECTED: "Selected", OFFER_RELEASED: "Offer Released", OFFER_ACCEPTED: "Offer Accepted",
    JOINED: "Joined", REJECTED: "Rejected",
};

function ownershipExpiry(profile: Profile): string | null {
    const exp = profile.ownership_expires_at;
    if (!exp) return null;
    try {
        return new Date(exp).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return null; }
}

// ── Smart sort helpers ─────────────────────────────────────────────────────

function hasExpFlag(p: Profile): boolean {
    const flags: any[] = p.deterministic_scoring_analysis?.flags ?? [];
    return flags.some((f: any) => f?.type?.includes("experience"));
}

function hasTitleMatch(p: Profile, jobRole?: string): boolean {
    if (!jobRole) return false;
    const role = (p.deterministic_scoring_analysis?.current_role || "").toLowerCase();
    if (!role || role === "—") return false;
    // Match if any meaningful word (>2 chars) from the JD title appears in the candidate's role
    const jdWords = jobRole.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    return jdWords.some(w => role.includes(w));
}

/** 0 = title match + exp OK · 1 = exp OK · 2 = title match + exp flagged · 3 = exp flagged */
function smartTier(p: Profile, jobRole?: string): number {
    const expFlagged = hasExpFlag(p);
    const titleMatch = hasTitleMatch(p, jobRole);
    if (titleMatch && !expFlagged) return 0;
    if (!expFlagged) return 1;
    if (titleMatch) return 2;
    return 3;
}

// ── Constants ──────────────────────────────────────────────────────────────

type SortKey = "smart" | "score" | "ai_score" | "exp";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 5;

function firstName(name?: string | null): string {
    if (!name) return "—";
    return name.split(" ")[0];
}

export default function ProfilesGrid({ profiles, jdId, jobRole, currentUserId, isAdmin }: ProfilesGridProps) {
    const drawer = useSideDrawer();
    const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "smart", dir: "desc" });
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");

    const detScore = (p: Profile) => p.deterministic_scoring_analysis?.display_score ?? 0;
    const aiScore = (p: Profile): number => p.llm_analysis?.overall_score ?? 0;
    const expYearsVal = (p: Profile): number => p.deterministic_scoring_analysis?.total_experience_years ?? 0;

    const sorted = [...profiles].sort((a, b) => {
        if (sort.key === "smart") {
            const ta = smartTier(a, jobRole), tb = smartTier(b, jobRole);
            if (ta !== tb) return ta - tb;               // tier ascending (0 = best)
            return detScore(b) - detScore(a);             // within same tier: score desc
        }
        const av = sort.key === "score" ? detScore(a)
            : sort.key === "ai_score" ? aiScore(a)
                : expYearsVal(a);
        const bv = sort.key === "score" ? detScore(b)
            : sort.key === "ai_score" ? aiScore(b)
                : expYearsVal(b);
        return sort.dir === "desc" ? bv - av : av - bv;
    });

    const filtered = search.trim()
        ? sorted.filter(p => {
            const q = search.trim().toLowerCase();
            const name = (p.candidate?.Name || p.deterministic_scoring_analysis?.candidate_name || "").toLowerCase();
            const role = (p.deterministic_scoring_analysis?.current_role || "").toLowerCase();
            return name.includes(q) || role.includes(q);
        })
        : sorted;

    const totalPages = search.trim() ? 1 : Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const clampedPage = Math.min(page, totalPages);
    const visible = search.trim()
        ? filtered
        : filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);
    const rangeStart = search.trim() ? 1 : Math.min((clampedPage - 1) * PAGE_SIZE + 1, filtered.length);
    const rangeEnd = search.trim() ? filtered.length : Math.min(clampedPage * PAGE_SIZE, filtered.length);

    const toggleSort = (key: SortKey) => {
        setSort(curr =>
            curr.key === key
                ? { key, dir: curr.dir === "desc" ? "asc" : "desc" }
                : { key, dir: "desc" }
        );
        setPage(1);
    };

    const sortLabel = (key: SortKey, label: string) => {
        const active = sort.key === key;
        return (
            <span
                onClick={() => toggleSort(key)}
                style={{
                    cursor: "pointer", userSelect: "none",
                    fontWeight: active ? 700 : 500,
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                    whiteSpace: "nowrap",
                    display: "flex", alignItems: "center", gap: "3px",
                    fontSize: 12,
                }}
            >
                {label}
                {active && key !== "smart" && (
                    <span style={{ fontSize: 9 }}>{sort.dir === "desc" ? "▼" : "▲"}</span>
                )}
            </span>
        );
    };

    if (!profiles.length) {
        return (
            <div className="data-table-wrap">
                <div className="table-empty">
                    <div className="table-empty-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    </div>
                    No profiles yet. Upload resumes or scan the talent pool to populate this list.
                </div>
            </div>
        );
    }

    const openReview = (p: Profile) => drawer.openProfile(jdId, p, "submit");
    const openView = (p: Profile) => drawer.openProfile(jdId, p, "view");
    const openUpdate = (p: Profile) => drawer.openProfile(jdId, p, "update");

    const pageBtnStyle = (disabled: boolean): React.CSSProperties => ({
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 30, height: 30, borderRadius: 6, border: disabled ? "1px solid var(--border-subtle)" : "none",
        background: disabled ? "var(--bg-secondary)" : "var(--accent-gradient)", cursor: disabled ? "default" : "pointer",
        color: disabled ? "var(--text-muted)" : "#ffffff",
        fontSize: 16, lineHeight: 1, opacity: disabled ? 0.4 : 1,
        transition: "background 0.15s",
        userSelect: "none",
    });

    return (
        <div className="data-table-wrap">
            {/* ── Search bar + pagination controls ── */}
            <div style={{
                display: "flex", alignItems: "center", gap: "0.6rem",
                padding: "0.75rem 1rem", borderBottom: "1px solid var(--border-subtle)",
            }}>
                <div style={{ position: "relative", flex: 1 }}>
                    <svg
                        width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }}
                    >
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search by name or role…"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        style={{
                            width: "100%", padding: "0.5rem 0.85rem 0.5rem 2rem",
                            fontSize: 14, fontFamily: "inherit",
                            border: "1.5px solid var(--border-subtle)", borderRadius: 8,
                            background: "var(--bg-input)", color: "var(--text-primary)",
                            outline: "none", boxSizing: "border-box",
                            transition: "border-color 0.15s",
                        }}
                        onFocus={e => (e.target.style.borderColor = "var(--accent)")}
                        onBlur={e => (e.target.style.borderColor = "var(--border-subtle)")}
                    />
                </div>
                {!search.trim() && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
                        <button
                            style={pageBtnStyle(clampedPage <= 1)}
                            onClick={() => clampedPage > 1 && setPage(p => p - 1)}
                            title="Previous page"
                        >‹</button>
                        <span style={{
                            fontSize: 13, fontWeight: 500,
                            color: "var(--text-secondary)", whiteSpace: "nowrap",
                            minWidth: 52, textAlign: "center",
                        }}>
                            {filtered.length === 0 ? "0 / 0" : `${clampedPage} / ${totalPages}`}
                        </span>
                        <button
                            style={pageBtnStyle(clampedPage >= totalPages)}
                            onClick={() => clampedPage < totalPages && setPage(p => p + 1)}
                            title="Next page"
                        >›</button>
                    </div>
                )}
                {filtered.length > 0 && (
                    <span style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
                        {search.trim()
                            ? `${filtered.length} found`
                            : `${filtered.length} total`}
                    </span>
                )}
            </div>

            <table className="data-table" style={{ tableLayout: "fixed", width: "100%" }}>
                <colgroup>
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "34%" }} />
                </colgroup>
                <thead>
                    <tr>
                        <th style={{ fontSize: 12, fontWeight: 600 }}>Candidate</th>
                        <th>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                {sortLabel("smart", "Smart")}
                                <span style={{ color: "var(--border-subtle)", fontSize: 10 }}>|</span>
                                {sortLabel("score", "Score")}
                                <span style={{ color: "var(--border-subtle)", fontSize: 10 }}>|</span>
                                {sortLabel("ai_score", "AI")}
                            </div>
                        </th>
                        <th style={{ fontSize: 12, fontWeight: 600 }}>AI Score</th>
                        <th
                            style={{ cursor: "pointer", userSelect: "none", fontSize: 12, fontWeight: 600 }}
                            onClick={() => toggleSort("exp")}
                        >
                            Exp {sort.key === "exp" && (sort.dir === "desc" ? "▼" : "▲")}
                        </th>
                        <th style={{ fontSize: 12, fontWeight: 600 }}>Owned by</th>
                        <th style={{ fontSize: 12, fontWeight: 600 }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {visible.map((p) => {
                        const det = detScore(p);
                        const llm = p.llm_analysis?.overall_score;
                        const hasAi = llm != null;
                        const name = p.candidate?.Name || p.deterministic_scoring_analysis?.candidate_name || "Unknown";
                        const role = p.deterministic_scoring_analysis?.current_role || "—";
                        const expLabel: string | null = p.candidate?.experience_label ?? null;
                        const expYrs = p.deterministic_scoring_analysis?.total_experience_years;
                        const appStatus = p.application_status || (p.status === "submitted" ? "SENT" : null);
                        const titleMatch = hasTitleMatch(p, jobRole);
                        const expFlagged = hasExpFlag(p);

                        const formatAppStatus = (status: string) => {
                            const mapped: Record<string, string> = {
                                "SENT": "Submitted", "L1_SELECTED": "L1 Selected", "L2_SELECTED": "L2 Selected",
                                "L3_SELECTED": "L3 Selected", "HR_SELECTED": "HR Selected",
                                "OFFER_RELEASED": "Offer Released", "OFFER_ACCEPTED": "Offer Accepted",
                                "JOINED": "Joined", "REJECTED": "Rejected",
                            };
                            return mapped[status] || status;
                        };

                        const appStatusColor = (status: string) => {
                            if (status === "REJECTED") return "#dc2626";
                            if (status === "SENT") return "#16a34a";
                            return "#2563eb";
                        };

                        const seq: number | null = p.submission_sequence ?? null;
                        const sentAt: string | null = p.submission_sent_at ?? null;
                        const pastSubs: any[] = p.past_submissions ?? [];

                        return (
                            <tr
                                key={String(p.candidate_uuid)}
                                onClick={() => openView(p)}
                                style={{ cursor: "pointer", opacity: expFlagged ? 0.78 : 1 }}
                            >
                                <td style={{ paddingTop: "0.55rem", paddingBottom: "0.55rem", overflow: "hidden", maxWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", overflow: "hidden" }}>
                                        <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                                        {titleMatch && (
                                            <span style={{
                                                fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 3, flexShrink: 0,
                                                background: "#dbeafe", color: "#1d4ed8", border: "1px solid #bfdbfe",
                                            }} title="Job title matches the requirement">Title</span>
                                        )}
                                        {seq != null && (
                                            <span style={{
                                                fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 3, flexShrink: 0,
                                                background: seq === 1 ? "#16a34a" : "var(--bg-secondary)",
                                                color: seq === 1 ? "#fff" : "var(--text-secondary)",
                                                border: "1px solid var(--border-subtle)",
                                            }} title={`Submission #${seq} for this requirement`}>
                                                {seq === 1 ? "1st" : `#${seq}`}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: "0.1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={role}>{role}</div>
                                    {expFlagged && (
                                        <div style={{ fontSize: 11, color: "#ea580c", marginTop: "0.1rem", whiteSpace: "nowrap" }}>
                                            ⚠ Exp. outside range
                                        </div>
                                    )}
                                    {sentAt && (
                                        <div style={{ fontSize: 11, color: "#16a34a", marginTop: "0.1rem", whiteSpace: "nowrap", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>
                                            Submitted by {firstName(p.recruiter_name)} · {fmtTs(sentAt)}
                                        </div>
                                    )}
                                    {pastSubs.length > 0 && (
                                        <div style={{ marginTop: "0.2rem", display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                                            {pastSubs.slice(0, 2).map((ps, i) => (
                                                <div key={i} style={{ fontSize: 11, color: ps.status === "REJECTED" ? "#dc2626" : "var(--text-secondary)", display: "flex", gap: "0.3rem", alignItems: "center", flexWrap: "wrap" }}>
                                                    <span style={{ opacity: 0.5 }}>↳</span>
                                                    {ps.client && <span style={{ fontWeight: 600 }}>{ps.client}</span>}
                                                    <span>·</span>
                                                    <span>{STATUS_LABEL[ps.status] ?? ps.status}</span>
                                                    {ps.rejection_reason && (
                                                        <span style={{ opacity: 0.75 }} title={ps.rejection_reason}>· "{ps.rejection_reason.slice(0, 30)}{ps.rejection_reason.length > 30 ? "…" : ""}"</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </td>
                                <td style={{ whiteSpace: "nowrap" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                                        <div style={{ width: 46, height: 7, background: "var(--border-subtle)", borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                                            <div style={{ width: `${det}%`, height: "100%", background: scoreColor(det), borderRadius: 4 }} />
                                        </div>
                                        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>{det}%</span>
                                    </div>
                                </td>
                                <td style={{ whiteSpace: "nowrap" }}>
                                    {hasAi ? (
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                                            <div style={{ width: 46, height: 7, background: "var(--border-subtle)", borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
                                                <div style={{ width: `${llm}%`, height: "100%", background: scoreColor(llm), borderRadius: 4 }} />
                                            </div>
                                            <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>{llm}</span>
                                        </div>
                                    ) : <span style={{ color: "var(--text-muted)", fontSize: 13 }}>—</span>}
                                </td>
                                <td style={{ whiteSpace: "nowrap", fontSize: 13, fontWeight: 500 }}>
                                    {expLabel ?? (expYrs != null ? `${expYrs} yr` : "—")}
                                </td>
                                <td style={{ fontSize: 12, overflow: "hidden", maxWidth: 0 }}>
                                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        <span style={{ fontWeight: 500 }}>{p.uploaded_by_name || "—"}</span>
                                        {(() => {
                                            const src = p?.sourced_by?.source;
                                            const label = src === "email" ? "Email" : src === "manual" ? "Manual" : "Pool";
                                            const style: React.CSSProperties = src === "email"
                                                ? { background: "#dbeafe", color: "#1d4ed8", border: "1px solid #bfdbfe" }
                                                : src === "manual"
                                                    ? { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" }
                                                    : { background: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" };
                                            return (
                                                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 3, marginLeft: 5, flexShrink: 0, ...style }}>
                                                    {label}
                                                </span>
                                            );
                                        })()}
                                        {ownershipExpiry(p) && (
                                            <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · until {ownershipExpiry(p)}</span>
                                        )}
                                    </div>
                                </td>
                                <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: "nowrap" }}>
                                    <div style={{ display: "flex", gap: "0.3rem", flexWrap: "nowrap", alignItems: "center" }}>
                                        <button className="btn btn-ghost btn-sm" style={{ width: "80px", justifyContent: "center" }} onClick={() => openView(p)} title="View full analysis">View</button>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            style={{ width: "80px", justifyContent: "center" }}
                                            onClick={() => drawer.openProfile(jdId, p, "view", "comments")}
                                            title="View and post comments"
                                        >
                                            {p.recruiter_comments?.length > 0
                                                ? `Notes (${p.recruiter_comments.length})`
                                                : "Notes"}
                                        </button>
                                        <button className="btn btn-ghost btn-sm" style={{ width: "80px", justifyContent: "center" }} onClick={() => openUpdate(p)} title="Update candidate info">Edit</button>
                                        {appStatus ? (
                                            <span style={{ fontSize: 12, fontWeight: 700, alignSelf: "center", color: appStatusColor(appStatus) }}>
                                                {formatAppStatus(appStatus)}
                                            </span>
                                        ) : (() => {
                                            const isManual = p.sourced_by?.source === "manual";
                                            const ownerExpiry = p.ownership_expires_at ? new Date(p.ownership_expires_at) : null;
                                            const ownershipActive = ownerExpiry && ownerExpiry > new Date();
                                            const canSubmit = isAdmin || !isManual || !ownershipActive || String(p.recruiter_uuid) === String(currentUserId);
                                            return canSubmit
                                                ? <button className="btn btn-primary btn-sm" onClick={() => openReview(p)} title="Submit candidate to this requirement">Submit</button>
                                                : <span style={{ fontSize: 11, color: "var(--text-muted)" }} title="Owned by another recruiter">Owned</span>;
                                        })()}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* ── Footer ── */}
            <div style={{
                padding: "0.5rem 1rem", borderTop: "1px solid var(--border-subtle)",
                fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center",
            }}>
                {filtered.length === 0
                    ? "No profiles match your search."
                    : search.trim()
                        ? `${filtered.length} match${filtered.length !== 1 ? "es" : ""}`
                        : `Showing ${rangeStart}–${rangeEnd} of ${filtered.length} profiles`
                }
            </div>
        </div>
    );
}
