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

const PAGE_SIZE = 15;

export default function ProfilesGrid({ profiles, jdId, jobRole }: ProfilesGridProps) {
    const drawer = useSideDrawer();
    const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "smart", dir: "desc" });
    const [showAll, setShowAll] = useState(false);

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

    const visible = showAll ? sorted : sorted.slice(0, PAGE_SIZE);
    const hidden = sorted.length - PAGE_SIZE;

    const toggleSort = (key: SortKey) => {
        setSort(curr =>
            curr.key === key
                ? { key, dir: curr.dir === "desc" ? "asc" : "desc" }
                : { key, dir: key === "exp" ? "desc" : "desc" }
        );
    };

    const sortLabel = (key: SortKey, label: string) => {
        const active = sort.key === key;
        return (
            <span
                onClick={() => toggleSort(key)}
                style={{
                    cursor: "pointer", userSelect: "none",
                    fontWeight: active ? 700 : 400,
                    color: active ? "var(--text-primary)" : "var(--text-secondary)",
                    whiteSpace: "nowrap",
                    display: "flex", alignItems: "center", gap: "3px",
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

    return (
        <div className="data-table-wrap">
            <table className="data-table" style={{ tableLayout: "fixed", width: "100%" }}>
                <colgroup>
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "24%" }} />
                </colgroup>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                {sortLabel("smart", "Smart")}
                                <span style={{ color: "var(--border-subtle)", fontSize: 11 }}>|</span>
                                {sortLabel("score", "Score")}
                                <span style={{ color: "var(--border-subtle)", fontSize: 11 }}>|</span>
                                {sortLabel("ai_score", "AI")}
                            </div>
                        </th>
                        <th>AI Score</th>
                        <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("exp")}>
                            Exp {sort.key === "exp" && (sort.dir === "desc" ? "▼" : "▲")}
                        </th>
                        <th>Sourced by</th>
                        <th>Actions</th>
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
                                style={{
                                    cursor: "pointer",
                                    opacity: expFlagged ? 0.75 : 1,
                                }}
                            >
                                <td>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
                                        <strong>{name}</strong>
                                        {titleMatch && (
                                            <span style={{
                                                fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3,
                                                background: "#dbeafe", color: "#1d4ed8", border: "1px solid #bfdbfe",
                                                letterSpacing: "0.3px",
                                            }} title="Job title matches the requirement">
                                                Title Match
                                            </span>
                                        )}
                                        {seq != null && (
                                            <span style={{
                                                fontSize: 10, fontWeight: 700, padding: "1px 5px",
                                                borderRadius: 3, background: seq === 1 ? "#16a34a" : "var(--bg-secondary)",
                                                color: seq === 1 ? "#fff" : "var(--text-secondary)",
                                                border: "1px solid var(--border-subtle)", letterSpacing: "0.3px",
                                            }} title={`Submission #${seq} for this requirement`}>
                                                {seq === 1 ? "First Submitted" : `#${seq}`}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-muted">{role}</div>
                                    {expFlagged && (
                                        <div style={{ fontSize: 10, color: "#ea580c", marginTop: "0.1rem" }}>
                                            ⚠ Experience outside requirement range
                                        </div>
                                    )}
                                    {sentAt && (
                                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: "0.1rem" }}>
                                            Submitted {fmtTs(sentAt)}
                                        </div>
                                    )}
                                    {pastSubs.length > 0 && (
                                        <div style={{ marginTop: "0.25rem", display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                                            {pastSubs.slice(0, 2).map((ps, i) => (
                                                <div key={i} style={{ fontSize: 11, color: ps.status === "REJECTED" ? "#dc2626" : "var(--text-secondary)", display: "flex", gap: "0.3rem", alignItems: "center", flexWrap: "wrap" }}>
                                                    <span style={{ opacity: 0.5 }}>↳</span>
                                                    {ps.client && <span style={{ fontWeight: 500 }}>{ps.client}</span>}
                                                    <span>·</span>
                                                    <span>{STATUS_LABEL[ps.status] ?? ps.status}</span>
                                                    {ps.rejection_reason && (
                                                        <span style={{ opacity: 0.75 }} title={ps.rejection_reason}>· "{ps.rejection_reason.slice(0, 35)}{ps.rejection_reason.length > 35 ? "…" : ""}"</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </td>
                                {/* Match score = deterministic only */}
                                <td style={{ whiteSpace: "nowrap" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                        <div style={{ width: 40, height: 6, background: "var(--border-subtle)", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
                                            <div style={{ width: `${det}%`, height: "100%", background: scoreColor(det) }} />
                                        </div>
                                        <span className="font-mono">{det}%</span>
                                    </div>
                                </td>
                                <td style={{ whiteSpace: "nowrap" }}>
                                    {hasAi ? (
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <div style={{ width: 40, height: 6, background: "var(--border-subtle)", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
                                                <div style={{ width: `${llm}%`, height: "100%", background: scoreColor(llm) }} />
                                            </div>
                                            <span className="font-mono">{llm}/100</span>
                                        </div>
                                    ) : <span className="text-muted">—</span>}
                                </td>
                                <td className="text-sm" style={{ whiteSpace: "nowrap" }}>
                                    {expLabel ?? (expYrs != null ? `${expYrs} yr` : "—")}
                                </td>
                                <td className="text-sm">
                                    <div>{p.recruiter_name || "—"} · {p?.sourced_by?.source === "manual" ? "Manual" : "Talent pool"}</div>
                                    {ownershipExpiry(p) && (
                                        <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                                            owns until {ownershipExpiry(p)}
                                        </div>
                                    )}
                                </td>
                                <td onClick={(e) => e.stopPropagation()}>
                                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => openView(p)} title="View full analysis">View</button>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => drawer.openProfile(jdId, p, "view", "comments")}
                                            title="View and post comments"
                                        >
                                            {p.recruiter_comments?.length > 0
                                                ? `Comments (${p.recruiter_comments.length})`
                                                : "Comments"}
                                        </button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => openUpdate(p)} title="Update candidate info">Update</button>
                                        {appStatus ? (
                                            <span className="text-sm" style={{ alignSelf: "center", color: appStatusColor(appStatus), fontWeight: 600 }}>
                                                {formatAppStatus(appStatus)}
                                            </span>
                                        ) : (
                                            <button className="btn btn-primary btn-sm" onClick={() => openReview(p)} title="Submit candidate to this requirement">Submit</button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {!showAll && hidden > 0 && (
                <div style={{ padding: "0.65rem 1rem", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "var(--text-secondary)" }}>
                        Showing top {PAGE_SIZE} of {sorted.length} profiles
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowAll(true)}>
                        Show all {sorted.length} profiles
                    </button>
                </div>
            )}
            {showAll && sorted.length > PAGE_SIZE && (
                <div style={{ padding: "0.65rem 1rem", borderTop: "1px solid var(--border-subtle)", textAlign: "center" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowAll(false)}>
                        Collapse to top {PAGE_SIZE}
                    </button>
                </div>
            )}
        </div>
    );
}
