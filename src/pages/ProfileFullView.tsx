import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, API_BASE, getToken } from "../services/api";

type Profile = any;

function colorForLevel(level?: string): string {
    if (level === "green") return "#16a34a";
    if (level === "orange") return "#ca8a04";
    if (level === "red") return "#dc2626";
    if (level === "warning") return "#ca8a04";
    if (level === "info") return "#2563eb";
    return "#6b7280";
}

function fmtDate(value?: string | Date | null): string {
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

function ResumePreview({ candidateId, candidateName }: { candidateId: string; candidateName?: string }) {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [mime, setMime] = useState<string>("application/pdf");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let created: string | null = null;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/candidates/${candidateId}/resume`, {
                    headers: { Authorization: `Bearer ${await getToken()}` },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                if (cancelled) return;
                setMime(res.headers.get("Content-Type") || "application/pdf");
                created = URL.createObjectURL(blob);
                setBlobUrl(created);
            } catch (e: any) {
                if (!cancelled) setError(e?.message || "Failed to load resume");
            }
        })();
        return () => {
            cancelled = true;
            if (created) URL.revokeObjectURL(created);
        };
    }, [candidateId]);

    if (error) return <div style={{ padding: "1rem", color: "#dc2626", fontSize: 13 }}>{error}</div>;
    if (!blobUrl) return <div style={{ padding: "1rem", fontSize: 13, color: "var(--text-secondary)" }}>Loading resume…</div>;
    if (!mime.includes("pdf")) {
        return (
            <div style={{ padding: "1rem", fontSize: 13 }}>
                Inline preview is only supported for PDFs.{" "}
                <a href={blobUrl} download={candidateName || "resume"} style={{ color: "var(--accent)" }}>Download</a>
            </div>
        );
    }
    return <iframe src={blobUrl} title="Resume" style={{ width: "100%", height: "100%", border: "none" }} />;
}

export default function ProfileFullView() {
    const { id: jdId, candidateId } = useParams<{ id: string; candidateId: string }>();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<"overview" | "deterministic" | "llm" | "comments">("overview");

    const load = useCallback(async () => {
        if (!jdId || !candidateId) return;
        setLoading(true); setError(null);
        try {
            const result = await api.get(`/requirements/${jdId}/profiles/${candidateId}`);
            setProfile(result);
        } catch (e: any) {
            setError(e?.detail || e?.message || "Failed to load profile");
        } finally {
            setLoading(false);
        }
    }, [jdId, candidateId]);

    useEffect(() => { void load(); }, [load]);

    const name = profile?.candidate?.Name || profile?.deterministic_scoring_analysis?.candidate_name || "Profile";
    const det = profile?.deterministic_scoring_analysis;
    const llm = profile?.llm_analysis;

    const tabs = useMemo(() => ([
        { key: "overview" as const, label: "Overview" },
        { key: "deterministic" as const, label: "Deterministic" },
        { key: "llm" as const, label: llm ? "LLM Analysis" : "LLM Analysis (not run)" },
        { key: "comments" as const, label: `Comments (${(profile?.recruiter_comments || []).length})` },
    ]), [profile, llm]);

    if (loading) return <div style={{ padding: "2rem" }}>Loading…</div>;
    if (error || !profile) {
        return (
            <div style={{ padding: "2rem", color: "#dc2626" }}>
                {error || "Profile not found"}
                <div style={{ marginTop: "1rem" }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/requirements/${jdId}`)}>← Back</button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem 1.25rem", height: "calc(100vh - 80px)" }}>
            {/* Header */}
            <header style={{ display: "flex", alignItems: "center", gap: "0.75rem", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "0.75rem" }}>
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => navigate(`/requirements/${jdId}`)}
                    title="Back to requirement"
                >← Back</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: 18 }}>{name}</h2>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {det?.current_role || "—"}
                        {det?.current_company && <> · {det.current_company}</>}
                        {" · "}Sourced by <strong>{profile.recruiter_name || "—"}</strong> ({profile.sourced_by?.source || "—"})
                    </div>
                </div>
                <div style={{ display: "flex", gap: "1rem", alignItems: "center", fontSize: 13 }}>
                    <div><strong>Composite:</strong> <span className="font-mono">{det?.display_score ?? "—"}%</span></div>
                    {llm?.overall_score != null && (
                        <div><strong>AI:</strong> <span className="font-mono">{llm.overall_score}/100</span> · {llm.rating}</div>
                    )}
                </div>
            </header>

            {/* Two-column body */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "1rem", flex: 1, minHeight: 0 }}>
                {/* Left: tabbed content */}
                <section style={{ display: "flex", flexDirection: "column", border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "hidden" }}>
                    <nav style={{ display: "flex", gap: "0.4rem", padding: "0.6rem 0.85rem", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", overflowX: "auto" }}>
                        {tabs.map(t => (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                style={{
                                    padding: "4px 12px", borderRadius: 999, border: "1px solid var(--border-subtle)",
                                    background: tab === t.key ? "var(--accent)" : "transparent",
                                    color: tab === t.key ? "#fff" : "var(--text-secondary)",
                                    cursor: "pointer", fontSize: 13, fontWeight: tab === t.key ? 600 : 400, whiteSpace: "nowrap",
                                }}
                            >{t.label}</button>
                        ))}
                    </nav>
                    <div style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
                        {tab === "overview" && <OverviewBlock profile={profile} />}
                        {tab === "deterministic" && <DeterministicBlock profile={profile} />}
                        {tab === "llm" && <LlmBlock profile={profile} jdId={jdId!} onUpdated={load} />}
                        {tab === "comments" && <CommentsBlock profile={profile} jdId={jdId!} onUpdated={load} />}
                    </div>
                </section>

                {/* Right: resume preview */}
                <section style={{ display: "flex", flexDirection: "column", border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "hidden" }}>
                    <header style={{ padding: "0.6rem 0.85rem", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", fontSize: 13, fontWeight: 500 }}>
                        Resume
                    </header>
                    <div style={{ flex: 1, minHeight: 0 }}>
                        <ResumePreview candidateId={candidateId!} candidateName={name} />
                    </div>
                </section>
            </div>
        </div>
    );
}

function OverviewBlock({ profile }: { profile: Profile }) {
    const det = profile.deterministic_scoring_analysis || {};
    const llm = profile.llm_analysis;
    const flags = [
        ...(det.flags || []).map((f: any) => ({ source: "det", ...f, level: f.severity })),
        ...(llm?.flags || []).map((f: any) => ({ source: "llm", ...f })),
    ];
    const recent = (profile.recruiter_comments || []).slice(-3).reverse();

    const mustSkillResults: Array<{ skill: string; matched: boolean }> = profile.must_have_skill_results ?? [];
    const missed = mustSkillResults.filter(s => !s.matched);
    const matchedSkills = mustSkillResults.filter(s => s.matched);
    const allMatched = mustSkillResults.length > 0 && missed.length === 0;

    const pastSubs: any[] = profile.past_submissions ?? [];
    const seq: number | null = profile.submission_sequence ?? null;
    const sentAt: string | null = profile.submission_sent_at ?? null;
    const appStatus: string | null = profile.application_status ?? null;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", fontSize: 13 }}>
            {llm?.headline && <div style={{ fontStyle: "italic" }}>"{llm.headline}"</div>}

            {mustSkillResults.length > 0 && (
                <div style={{ borderRadius: 6, border: `1px solid ${allMatched ? "#bbf7d0" : "#fecaca"}`, background: allMatched ? "rgba(22,163,74,0.06)" : "rgba(220,38,38,0.05)", padding: "0.6rem 0.75rem" }}>
                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: "0.5rem", color: allMatched ? "#16a34a" : "#dc2626" }}>
                        {allMatched ? `✓ All ${mustSkillResults.length} must-have skills matched` : `⚠ ${missed.length} of ${mustSkillResults.length} must-have skills missing`}
                    </div>
                    {missed.length > 0 && (
                        <div style={{ marginBottom: "0.35rem" }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#dc2626", marginBottom: "0.2rem" }}>Missing</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                                {missed.map((s, i) => (
                                    <span key={i} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(220,38,38,0.1)", border: "1px solid #fecaca", color: "#dc2626" }}>✗ {s.skill}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {matchedSkills.length > 0 && (
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", marginBottom: "0.2rem" }}>Matched</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                                {matchedSkills.map((s, i) => (
                                    <span key={i} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(22,163,74,0.1)", border: "1px solid #bbf7d0", color: "#16a34a" }}>✓ {s.skill}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {flags.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    {flags.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)" }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: colorForLevel(f.level), flexShrink: 0 }} />
                            <span style={{ color: "var(--text-primary)", fontWeight: 500, minWidth: 80, textTransform: "capitalize" }}>{f.type}</span>
                            <span>{f.message}</span>
                        </div>
                    ))}
                </div>
            )}

            {(sentAt || pastSubs.length > 0) && (
                <div>
                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-secondary)" }}>Submission History</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                        {sentAt && (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 12 }}>
                                {seq != null && (
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: seq === 1 ? "#16a34a" : "var(--bg-secondary)", color: seq === 1 ? "#fff" : "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                                        {seq === 1 ? "First" : `#${seq}`}
                                    </span>
                                )}
                                <span style={{ fontWeight: 500 }}>This requirement</span>
                                <span style={{ color: "var(--text-secondary)" }}>·</span>
                                <span style={{ color: appStatus === "REJECTED" ? "#dc2626" : appStatus === "SENT" ? "#16a34a" : "#2563eb", fontWeight: 500 }}>
                                    {appStatus ? (STATUS_LABEL[appStatus] ?? appStatus) : "Submitted"}
                                </span>
                                <span style={{ color: "var(--text-secondary)" }}>· {fmtDate(sentAt)}</span>
                            </div>
                        )}
                        {pastSubs.map((ps: any, i: number) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 12 }}>
                                <span style={{ color: "var(--text-secondary)", fontSize: 10 }}>↳</span>
                                {ps.client && <span style={{ fontWeight: 500 }}>{ps.client}</span>}
                                {ps.requirement_name && <span style={{ color: "var(--text-secondary)" }}>{ps.requirement_name}</span>}
                                <span style={{ color: "var(--text-secondary)" }}>·</span>
                                <span style={{ color: ps.status === "REJECTED" ? "#dc2626" : "#2563eb", fontWeight: 500 }}>{STATUS_LABEL[ps.status] ?? ps.status}</span>
                                {ps.rejection_reason && <span style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>· "{ps.rejection_reason.slice(0, 40)}{ps.rejection_reason.length > 40 ? "…" : ""}"</span>}
                                {ps.sent_at && <span style={{ color: "var(--text-secondary)", marginLeft: "auto" }}>{fmtDate(ps.sent_at)}</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {recent.length > 0 && (
                <div>
                    <div style={{ fontWeight: 600, marginBottom: "0.3rem" }}>Recent comments</div>
                    {recent.map((c: any, i: number) => (
                        <div key={i} style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: "0.4rem", borderLeft: "3px solid var(--border-subtle)", paddingLeft: "0.6rem" }}>
                            <div style={{ color: "var(--text-primary)" }}>"{c.comment}"</div>
                            <div style={{ fontSize: 11 }}>— {c.author_name || "unknown"} · {fmtDate(c.date)} {c.requirement_name && `· for ${c.requirement_name}`}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function DeterministicBlock({ profile }: { profile: Profile }) {
    const dims = profile.deterministic_scoring_analysis?.dimension_breakdown || [];
    if (!dims.length) return <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>No breakdown.</div>;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem", fontSize: 13 }}>
            {dims.map((d: any) => (
                <div key={d.dimension_id} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {d.must_have && <span style={{ color: "#dc2626", fontSize: 10 }}>●</span>}
                        <span style={{ fontWeight: 500 }}>{d.dimension_name}</span>
                        <span style={{ fontSize: 10, color: "var(--text-secondary)", opacity: 0.7 }}>weight {d.weight}</span>
                        <span className="font-mono" style={{ marginLeft: "auto", fontWeight: 600 }}>{d.score}</span>
                    </div>
                    {d.matched_skills?.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                            {Array.from(new Map(d.matched_skills.map((m: any) => [m.candidate_skill?.toLowerCase(), m])).values()).map((m: any, i: number) => (
                                <span
                                    key={i}
                                    title={`${m.jd_keyword} → similarity ${m.similarity}${m.years_since_last_use != null ? ` · ${m.years_since_last_use}y ago` : ""}`}
                                    className="suggestion-chip"
                                    style={{
                                        fontSize: 11, padding: "1px 7px",
                                        background: m.is_stale ? "rgba(202, 138, 4, 0.15)" : undefined,
                                        borderColor: m.is_stale ? "#ca8a04" : undefined,
                                    }}
                                >{m.is_stale && <span style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></span>} {m.candidate_skill}</span>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function LlmBlock({ profile, jdId, onUpdated }: { profile: Profile; jdId: string; onUpdated: () => void }) {
    const [running, setRunning] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const llm = profile.llm_analysis;
    const run = async () => {
        if (running) return;
        setRunning(true); setErr(null);
        try {
            const result = await api.post(`/requirements/${jdId}/profiles/${profile.candidate_uuid}/llm-analysis`, {});
            if (result?.status !== "success") throw new Error(result?.error || "Failed");
            onUpdated();
        } catch (e: any) { setErr(e?.detail || e?.message || "Failed"); }
        finally { setRunning(false); }
    };
    if (!llm) {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>No LLM analysis yet.</div>
                <button className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }} onClick={run} disabled={running}>
                    {running ? "Analyzing…" : "Analyse with AI"}
                </button>
                {err && <div style={{ fontSize: 12, color: "#dc2626" }}>{err}</div>}
            </div>
        );
    }
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", fontSize: 13 }}>
            {llm.headline && <div style={{ fontStyle: "italic" }}>"{llm.headline}"</div>}
            <div style={{ display: "flex", gap: "1.5rem" }}>
                <span><strong>Overall:</strong> <span className="font-mono">{llm.overall_score}/100</span></span>
                <span><strong>Rating:</strong> {llm.rating}</span>
            </div>
            {(llm.dimensions || []).map((d: any) => (
                <div key={d.id} style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                        <span style={{ fontWeight: 500 }}>{d.name}</span>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>weight {d.weight}</span>
                        <span className="font-mono" style={{ marginLeft: "auto", fontWeight: 600 }}>{d.score}</span>
                    </div>
                    {d.reasoning && <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: "0.2rem" }}>{d.reasoning}</div>}
                </div>
            ))}
            {(llm.strengths?.length || llm.gaps?.length) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    {llm.strengths?.length > 0 && (
                        <div><div style={{ fontWeight: 600, color: "#16a34a", marginBottom: "0.3rem" }}>Strengths</div>
                            <ul style={{ margin: 0, paddingLeft: "1rem", fontSize: 12 }}>{llm.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                        </div>
                    )}
                    {llm.gaps?.length > 0 && (
                        <div><div style={{ fontWeight: 600, color: "#dc2626", marginBottom: "0.3rem" }}>Gaps</div>
                            <ul style={{ margin: 0, paddingLeft: "1rem", fontSize: 12 }}>{llm.gaps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                        </div>
                    )}
                </div>
            )}
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={run} disabled={running}>
                {running ? "Re-analyzing…" : "Re-run AI analysis"}
            </button>
        </div>
    );
}

function CommentsBlock({ profile, jdId, onUpdated }: { profile: Profile; jdId: string; onUpdated: () => void }) {
    const [draft, setDraft] = useState("");
    const [posting, setPosting] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const comments = profile.recruiter_comments || [];
    const submit = async () => {
        const t = draft.trim();
        if (!t || posting) return;
        setPosting(true); setErr(null);
        try {
            await api.post(`/requirements/${jdId}/profiles/${profile.candidate_uuid}/comments`, { comment: t });
            setDraft("");
            onUpdated();
        } catch (e: any) { setErr(e?.detail || e?.message || "Failed"); }
        finally { setPosting(false); }
    };
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Add a comment about this candidate for this requirement…"
                    rows={3}
                    style={{ resize: "vertical", padding: "0.5rem", fontSize: 13, border: "1px solid var(--border-subtle)", borderRadius: 4 }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    {err && <div style={{ fontSize: 12, color: "#dc2626" }}>{err}</div>}
                    <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={submit} disabled={posting || !draft.trim()}>
                        {posting ? "Posting…" : "Post comment"}
                    </button>
                </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {comments.length === 0 && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>No comments yet.</div>}
                {[...comments].reverse().map((c: any, i: number) => (
                    <div key={i} style={{ fontSize: 13, borderLeft: "3px solid var(--border-subtle)", paddingLeft: "0.6rem" }}>
                        <div>{c.comment}</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>— {c.author_name || "unknown"} · {fmtDate(c.date)}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
