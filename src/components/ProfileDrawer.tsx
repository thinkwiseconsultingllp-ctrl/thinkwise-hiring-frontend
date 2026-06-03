import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useSideDrawer, type ProfileAction, type ProfileViewTab } from "../context/SideDrawerContext";
import { useAuth } from "../context/AuthContext";

type Profile = any;

interface ProfileDrawerProps {
    jdId: string;
    profile: Profile;
    action: ProfileAction;
    initialTab?: ProfileViewTab;
    onUpdated?: (next: Profile) => void;
}

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
    } catch {
        return String(value);
    }
}

function npColor(notice?: string | null): string {
    if (!notice) return "var(--text-secondary)";
    const l = notice.toLowerCase();
    if (l.includes("immediate") || l.includes("serving") || l === "0") return "#16a34a";
    const n = parseInt(l);
    if (!isNaN(n)) { if (n <= 15) return "#16a34a"; if (n <= 60) return "#d97706"; return "#dc2626"; }
    return "var(--text-secondary)";
}

function OverviewSection({ profile }: { profile: Profile }) {
    const det = profile.deterministic_scoring_analysis || {};
    const llm = profile.llm_analysis;
    const cand = profile.candidate || {};
    const personal = cand.PersonalDetails || {};
    const mostRecent = (cand.Experience || [])[0] || {};

    const currentRole = det.current_role || mostRecent.Position || cand.current_role || "—";
    const currentCompany = det.current_company || mostRecent.Company || cand.current_company || "—";
    const currentCtc = cand.current_ctc ?? cand.present_ctc;
    const expectedCtc = cand.expected_ctc;
    const noticePeriod = cand.notice_period || personal.NoticePeriod;
    const reasonForChange = cand.reason_for_change;
    const relevantExp = cand.relevant_experience;

    const flags = [
        ...(det.flags || []).map((f: any) => ({ source: "det", ...f, level: f.severity })),
        ...(llm?.flags || []).map((f: any) => ({ source: "llm", ...f })),
    ];

    const mustSkillResults: Array<{ skill: string; matched: boolean }> = profile.must_have_skill_results ?? [];
    const missed = mustSkillResults.filter(s => !s.matched);
    const matched = mustSkillResults.filter(s => s.matched);
    const allMatched = mustSkillResults.length > 0 && missed.length === 0;

    const pastSubs: any[] = profile.past_submissions ?? [];
    const seq: number | null = profile.submission_sequence ?? null;
    const sentAt: string | null = profile.submission_sent_at ?? null;
    const appStatus: string | null = profile.application_status ?? null;

    const STATUS_LABEL: Record<string, string> = {
        SENT: "Submitted", L1_SELECTED: "L1 Selected", L2_SELECTED: "L2 Selected",
        L3_SELECTED: "L3 Selected", HR_SELECTED: "HR Selected", HR_ROUND: "HR Round",
        SELECTED: "Selected", OFFER_RELEASED: "Offer Released", OFFER_ACCEPTED: "Offer Accepted",
        JOINED: "Joined", REJECTED: "Rejected",
    };

    const Field = ({ label, value }: { label: string; value?: any }) => (
        <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.6px", marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.45 }}>
                {value ?? <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>—</span>}
            </div>
        </div>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: 13 }}>
            {/* AI Score block */}
            {llm?.overall_score != null && (
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.65rem 0.9rem", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                    <div style={{ flexShrink: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.6px" }}>AI Score</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#2563eb", fontFamily: "monospace", lineHeight: 1.1 }}>
                            {llm.overall_score}<span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-secondary)" }}>/100</span>
                        </div>
                    </div>
                    {llm.rating && <span style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-primary)", padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border-subtle)", flexShrink: 0 }}>{llm.rating}</span>}
                    {llm.headline && <div style={{ fontStyle: "italic", color: "var(--text-secondary)", fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{llm.headline}"</div>}
                </div>
            )}

            {/* Key submission details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem 1.5rem" }}>
                <Field label="Current Role" value={currentRole} />
                <Field label="Current Company" value={currentCompany} />
                <Field label="Current CTC" value={currentCtc != null ? `${currentCtc} LPA` : undefined} />
                <Field label="Expected CTC" value={expectedCtc != null ? `${expectedCtc} LPA` : undefined} />
                <Field label="Notice Period" value={
                    noticePeriod
                        ? <span style={{ color: npColor(noticePeriod) }}>{noticePeriod}</span>
                        : undefined
                } />
                <Field label="Match Score" value={det.display_score != null ? `${det.display_score}%` : undefined} />
            </div>

            {/* Relevant Experience */}
            {relevantExp && (
                <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.6px", marginBottom: 4 }}>Relevant Experience</div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.55 }}>{relevantExp}</div>
                </div>
            )}

            {/* Reason for Change */}
            {reasonForChange && (
                <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.6px", marginBottom: 4 }}>Reason for Change</div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.55 }}>{reasonForChange}</div>
                </div>
            )}

            {/* Must-have skills */}
            {mustSkillResults.length > 0 && (
                <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem", borderRadius: 6, border: `1px solid ${allMatched ? "#bbf7d0" : "#fecaca"}`, background: allMatched ? "rgba(22,163,74,0.06)" : "rgba(220,38,38,0.05)", padding: "0.6rem 0.75rem" }}>
                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: "0.5rem", color: allMatched ? "#16a34a" : "#dc2626" }}>
                        {allMatched
                            ? `✓ All ${mustSkillResults.length} must-have skills matched`
                            : `⚠ ${missed.length} of ${mustSkillResults.length} must-have skills missing`}
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
                    {matched.length > 0 && (
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", marginBottom: "0.2rem" }}>Matched</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                                {matched.map((s, i) => (
                                    <span key={i} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "rgba(22,163,74,0.1)", border: "1px solid #bbf7d0", color: "#16a34a" }}>✓ {s.skill}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Flags */}
            {flags.length > 0 && (
                <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.6px", marginBottom: 6 }}>Flags</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                        {flags.map((f: any, i: number) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span style={{ width: 8, height: 8, borderRadius: "50%", background: colorForLevel(f.level), flexShrink: 0 }} />
                                <span style={{ color: "var(--text-primary)", fontWeight: 500, minWidth: 80, textTransform: "capitalize" as const }}>{f.type}</span>
                                <span style={{ color: "var(--text-secondary)" }}>{f.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Submission history */}
            {(sentAt || pastSubs.length > 0) && (
                <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.6px", marginBottom: 6 }}>Submission History</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                        {sentAt && (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 12 }}>
                                {seq != null && (
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: seq === 1 ? "#16a34a" : "var(--bg-secondary)", color: seq === 1 ? "#fff" : "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                                        {seq === 1 ? "First" : `#${seq}`}
                                    </span>
                                )}
                                <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>This requirement</span>
                                <span style={{ color: "var(--text-secondary)" }}>·</span>
                                <span style={{ color: appStatus === "REJECTED" ? "#dc2626" : appStatus === "SENT" ? "#16a34a" : "#2563eb", fontWeight: 500 }}>
                                    {appStatus ? (STATUS_LABEL[appStatus] ?? appStatus) : "Submitted"}
                                </span>
                                <span style={{ color: "var(--text-secondary)" }}>·</span>
                                <span style={{ color: "var(--text-secondary)" }}>{fmtDate(sentAt)}</span>
                            </div>
                        )}
                        {pastSubs.map((ps: any, i: number) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: 12 }}>
                                <span style={{ color: "var(--text-secondary)", fontSize: 10 }}>↳</span>
                                {ps.client && <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{ps.client}</span>}
                                {ps.requirement_name && <span style={{ color: "var(--text-secondary)" }}>{ps.requirement_name}</span>}
                                <span style={{ color: "var(--text-secondary)" }}>·</span>
                                <span style={{ color: ps.status === "REJECTED" ? "#dc2626" : "#2563eb", fontWeight: 500 }}>{STATUS_LABEL[ps.status] ?? ps.status}</span>
                                {ps.rejection_reason && (
                                    <span style={{ color: "var(--text-secondary)", fontStyle: "italic" }} title={ps.rejection_reason}>
                                        · "{ps.rejection_reason.slice(0, 40)}{ps.rejection_reason.length > 40 ? "…" : ""}"
                                    </span>
                                )}
                                {ps.sent_at && <span style={{ color: "var(--text-secondary)", marginLeft: "auto" }}>{fmtDate(ps.sent_at)}</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function DeterministicSection({ profile }: { profile: Profile }) {
    const det = profile.deterministic_scoring_analysis || {};
    const dims = det.dimension_breakdown || [];
    if (!dims.length) {
        return <div className="text-sm text-muted">No deterministic breakdown available.</div>;
    }
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem", fontSize: 13 }}>
            {dims.map((d: any) => (
                <div key={d.dimension_id} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {d.must_have && <span title="Must-have" style={{ color: "#dc2626", fontSize: 10 }}>●</span>}
                        <span style={{ fontWeight: 500 }}>{d.dimension_name}</span>
                        <span style={{ fontSize: 10, color: "var(--text-secondary)", opacity: 0.7 }}>weight {d.weight}</span>
                        <span className="font-mono" style={{ marginLeft: "auto", fontWeight: 600 }}>{d.score}</span>
                    </div>
                    {d.matched_skills?.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                            {Array.from(new Map(d.matched_skills.map((m: any) => [m.candidate_skill?.toLowerCase(), m])).values()).map((m: any, i: number) => (
                                <span
                                    key={i}
                                    title={`JD: "${m.jd_keyword}" → similarity ${m.similarity}${m.years_since_last_use != null ? ` · last used ${m.years_since_last_use}y ago` : ""}`}
                                    className="suggestion-chip"
                                    style={{
                                        fontSize: 11, padding: "1px 7px",
                                        background: m.is_stale ? "rgba(202, 138, 4, 0.15)" : undefined,
                                        borderColor: m.is_stale ? "#ca8a04" : undefined,
                                    }}
                                >
                                    {m.is_stale && <span style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg></span>} {m.candidate_skill}
                                </span>
                            ))}
                        </div>
                    )}
                    {d.closest_misses?.length > 0 && (
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", opacity: 0.75 }}>
                            Near-misses: {d.closest_misses.slice(0, 3).map((m: any) => m.candidate_skill).join(", ")}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function LlmSection({ profile, jdId, onUpdated }: { profile: Profile; jdId: string; onUpdated: (next: Profile) => void }) {
    const [running, setRunning] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const llm = profile.llm_analysis;

    const run = async () => {
        if (running) return;
        setRunning(true); setErr(null);
        try {
            const result = await api.post(`/requirements/${jdId}/profiles/${profile.candidate_uuid}/llm-analysis`, {});
            if (result?.status !== "success") throw new Error(result?.error || "Analysis failed");
            onUpdated({ ...profile, llm_analysis: result.analysis });
        } catch (e: any) {
            setErr(e?.detail || e?.message || "Analysis failed");
        } finally {
            setRunning(false);
        }
    };

    if (!llm) {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "0.5rem 0" }}>
                <div className="text-sm text-muted">No LLM analysis yet for this candidate × requirement.</div>
                <button className="btn btn-primary btn-sm" style={{ alignSelf: "flex-start" }} onClick={run} disabled={running}>
                    {running ? "Analyzing…" : "Analyse with AI"}
                </button>
                {err && <div style={{ fontSize: 12, color: "#dc2626" }}>{err}</div>}
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", fontSize: 13 }}>
            {llm.headline && (
                <div style={{ fontStyle: "italic", color: "var(--text-primary)" }}>"{llm.headline}"</div>
            )}
            <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
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
                    {d.matched_skills?.length > 0 && (
                        <div style={{ marginTop: "0.3rem", fontSize: 11, color: "var(--text-secondary)" }}>
                            Matched: {d.matched_skills.map((m: any) => `${m.skill} (${m.strength})`).join(", ")}
                        </div>
                    )}
                </div>
            ))}
            {(llm.strengths?.length > 0 || llm.gaps?.length > 0) && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    {llm.strengths?.length > 0 && (
                        <div>
                            <div style={{ fontWeight: 600, color: "#16a34a", marginBottom: "0.3rem" }}>Strengths</div>
                            <ul style={{ margin: 0, paddingLeft: "1rem", fontSize: 12, color: "var(--text-secondary)" }}>
                                {llm.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                            </ul>
                        </div>
                    )}
                    {llm.gaps?.length > 0 && (
                        <div>
                            <div style={{ fontWeight: 600, color: "#dc2626", marginBottom: "0.3rem" }}>Gaps</div>
                            <ul style={{ margin: 0, paddingLeft: "1rem", fontSize: 12, color: "var(--text-secondary)" }}>
                                {llm.gaps.map((s: string, i: number) => <li key={i}>{s}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            )}
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={run} disabled={running}>
                {running ? "Re-analyzing…" : "Re-run AI analysis"}
            </button>
            {err && <div style={{ fontSize: 12, color: "#dc2626" }}>{err}</div>}
        </div>
    );
}

function CommentsSection({ profile, jdId, onUpdated }: { profile: Profile; jdId: string; onUpdated: (next: Profile) => void }) {
    const { user } = useAuth();
    const [draft, setDraft] = useState("");
    const [posting, setPosting] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState("");
    const [editSaving, setEditSaving] = useState(false);
    const comments = profile.recruiter_comments || [];

    const [reqHistory, setReqHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    useEffect(() => {
        if (!profile.candidate_uuid) return;
        setHistoryLoading(true);
        api.get(`/candidates/${profile.candidate_uuid}/requirement-history`)
            .then((data: any[]) => setReqHistory((data || []).filter(h => String(h.requirement_id) !== String(jdId))))
            .catch(() => setReqHistory([]))
            .finally(() => setHistoryLoading(false));
    }, [profile.candidate_uuid, jdId]);

    const submit = async () => {
        const trimmed = draft.trim();
        if (!trimmed || posting) return;
        setPosting(true); setErr(null);
        try {
            const updated = await api.post(
                `/requirements/${jdId}/profiles/${profile.candidate_uuid}/comments`,
                { comment: trimmed }
            );
            onUpdated(updated);
            setDraft("");
        } catch (e: any) {
            setErr(e?.detail || e?.message || "Could not post comment");
        } finally {
            setPosting(false);
        }
    };

    const saveEdit = async (commentId: string) => {
        const trimmed = editText.trim();
        if (!trimmed || editSaving) return;
        setEditSaving(true);
        try {
            const updated = await api.patch(
                `/requirements/${jdId}/profiles/${profile.candidate_uuid}/comments/${commentId}`,
                { comment: trimmed }
            );
            onUpdated(updated);
            setEditingId(null);
        } catch (e: any) {
            setErr(e?.detail || e?.message || "Could not save edit");
        } finally {
            setEditSaving(false);
        }
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
                    <button
                        className="btn btn-primary btn-sm"
                        style={{ marginLeft: "auto" }}
                        onClick={submit}
                        disabled={posting || !draft.trim()}
                    >{posting ? "Posting…" : "Post comment"}</button>
                </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {comments.length === 0 && <div className="text-sm text-muted">No comments yet.</div>}
                {[...comments].reverse().map((c: any, i: number) => {
                    const isOwn = user?.id && c.author_id && String(c.author_id) === String(user.id);
                    const isEditing = editingId === String(c.id);
                    return (
                        <div key={i} style={{ fontSize: 13, borderLeft: "3px solid var(--border-subtle)", paddingLeft: "0.6rem" }}>
                            {isEditing ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                                    <textarea
                                        value={editText}
                                        onChange={e => setEditText(e.target.value)}
                                        rows={2}
                                        autoFocus
                                        style={{ resize: "vertical", padding: "0.4rem", fontSize: 13, border: "1px solid var(--accent)", borderRadius: 4, width: "100%" }}
                                    />
                                    <div style={{ display: "flex", gap: "0.4rem" }}>
                                        <button className="btn btn-primary btn-sm" onClick={() => saveEdit(String(c.id))} disabled={editSaving || !editText.trim()}>
                                            {editSaving ? "Saving…" : "Save"}
                                        </button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)} disabled={editSaving}>Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ color: "var(--text-primary)" }}>{c.comment}</div>
                            )}
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: "0.2rem", display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                                <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{c.author_name || "Unknown"}</span>
                                <span>·</span>
                                <span>{fmtDate(c.date)}</span>
                                {c.requirement_name && (
                                    <>
                                        <span>·</span>
                                        <span style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 4, padding: "0px 6px", fontSize: 10 }}>
                                            {c.requirement_name}
                                        </span>
                                    </>
                                )}
                                {isOwn && !isEditing && c.id && (
                                    <button
                                        style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}
                                        onClick={() => { setEditingId(String(c.id)); setEditText(c.comment); }}
                                    >Edit</button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Requirement history */}
            {(historyLoading || reqHistory.length > 0) && (
                <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.6px", marginBottom: 8 }}>
                        Other Requirements
                    </div>
                    {historyLoading ? (
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Loading…</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                            {reqHistory.map((h, i) => {
                                const STATUS_LABEL: Record<string, string> = {
                                    SENT: "Submitted", L1_SELECTED: "L1", L2_SELECTED: "L2",
                                    L3_SELECTED: "L3", HR_ROUND: "HR Round", HR_SELECTED: "HR",
                                    SELECTED: "Selected", OFFER_RELEASED: "Offered", OFFER_ACCEPTED: "Accepted",
                                    JOINED: "Joined", REJECTED: "Rejected",
                                };
                                const statusColor = h.status === "SELECTED" || h.status === "JOINED" ? "#16a34a"
                                    : h.status === "REJECTED" ? "#dc2626"
                                        : h.status === "SENT" ? "#2563eb"
                                            : h.status ? "#ca8a04"
                                                : "var(--text-muted)";
                                return (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.6rem", background: "var(--bg-secondary)", borderRadius: 6, border: "1px solid var(--border-subtle)" }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {h.req_id && <span style={{ color: "var(--text-muted)", fontWeight: 400, marginRight: 4, fontFamily: "monospace", fontSize: 11 }}>{h.req_id}</span>}
                                                {h.requirement_name || "—"}
                                            </div>
                                            {h.sent_at && (
                                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                                    {new Date(h.sent_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                                    {h.recruiter_name && <> · {h.recruiter_name}</>}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
                                            {h.det_score != null && <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-muted)" }}>{h.det_score}%</span>}
                                            {h.ai_score != null && <span style={{ fontSize: 11, fontFamily: "monospace", color: "#2563eb" }}>AI {h.ai_score}</span>}
                                            <span style={{ fontSize: 11, fontWeight: 700, color: statusColor }}>
                                                {h.status ? (STATUS_LABEL[h.status] || h.status) : "Pool"}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function UpdateForm({ profile, jdId, refreshProfile }: {
    profile: Profile;
    jdId: string;
    refreshProfile: () => Promise<Profile | null>;
}) {
    const cand = profile.candidate || {};
    const [fields, setFields] = useState({
        current_ctc: cand.current_ctc != null ? String(cand.current_ctc) : "",
        expected_ctc: cand.expected_ctc != null ? String(cand.expected_ctc) : "",
        notice_period: cand.notice_period || "",
        relevant_experience: cand.relevant_experience || "",
        reason_for_change: cand.reason_for_change || "",
    });
    const { user } = useAuth();
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const [posting, setPosting] = useState(false);
    const [commentErr, setCommentErr] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState("");
    const [editSaving, setEditSaving] = useState(false);
    const comments = profile.recruiter_comments || [];

    useEffect(() => {
        const c = profile.candidate || {};
        setFields({
            current_ctc: c.current_ctc != null ? String(c.current_ctc) : "",
            expected_ctc: c.expected_ctc != null ? String(c.expected_ctc) : "",
            notice_period: c.notice_period || "",
            relevant_experience: c.relevant_experience || "",
            reason_for_change: c.reason_for_change || "",
        });
    }, [profile.candidate_uuid]);

    const handleSaveFields = async () => {
        if (!fields.reason_for_change.trim()) {
            setSaveMsg("Reason for change is required");
            return;
        }
        setSaving(true); setSaveMsg(null);
        try {
            const body: any = {
                current_ctc: fields.current_ctc.trim() ? parseFloat(fields.current_ctc) : null,
                expected_ctc: fields.expected_ctc.trim() ? parseFloat(fields.expected_ctc) : null,
                notice_period: fields.notice_period.trim() || null,
                relevant_experience: fields.relevant_experience.trim() || null,
                reason_for_change: fields.reason_for_change.trim() || null,
            };
            await api.patch(`/candidates/${profile.candidate_uuid}`, body);
            await refreshProfile();
            setSaveMsg("Saved");
        } catch (e: any) { setSaveMsg(e?.detail || e?.message || "Save failed"); }
        finally { setSaving(false); setTimeout(() => setSaveMsg(null), 2500); }
    };

    const handlePostComment = async () => {
        const trimmed = draft.trim();
        if (!trimmed || posting) return;
        setPosting(true); setCommentErr(null);
        try {
            await api.post(
                `/requirements/${jdId}/profiles/${profile.candidate_uuid}/comments`,
                { comment: trimmed },
            );
            await refreshProfile();
            setDraft("");
        } catch (e: any) { setCommentErr(e?.detail || e?.message || "Could not post comment"); }
        finally { setPosting(false); }
    };

    const handleSaveEdit = async (commentId: string) => {
        const trimmed = editText.trim();
        if (!trimmed || editSaving) return;
        setEditSaving(true);
        try {
            await api.patch(
                `/requirements/${jdId}/profiles/${profile.candidate_uuid}/comments/${commentId}`,
                { comment: trimmed },
            );
            await refreshProfile();
            setEditingId(null);
        } catch (e: any) { setCommentErr(e?.detail || e?.message || "Could not save edit"); }
        finally { setEditSaving(false); }
    };

    const inputStyle: React.CSSProperties = {
        padding: "0.45rem 0.65rem", fontSize: 13,
        border: "1px solid var(--border-subtle)", borderRadius: 4,
        background: "var(--bg-input, var(--bg-secondary))",
        color: "var(--text-primary)", width: "100%", fontFamily: "inherit",
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: "0.5rem" }}>Candidate Details</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 2, display: "block" }}>Current CTC (LPA)</label>
                        <input type="number" value={fields.current_ctc} placeholder="e.g. 12" style={inputStyle}
                            onChange={e => setFields(p => ({ ...p, current_ctc: e.target.value }))} />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 2, display: "block" }}>Expected CTC (LPA)</label>
                        <input type="number" value={fields.expected_ctc} placeholder="e.g. 18" style={inputStyle}
                            onChange={e => setFields(p => ({ ...p, expected_ctc: e.target.value }))} />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 2, display: "block" }}>Notice Period</label>
                        <input type="text" value={fields.notice_period} placeholder="e.g. 30 days" style={inputStyle}
                            onChange={e => setFields(p => ({ ...p, notice_period: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 2, display: "block" }}>Relevant Experience</label>
                        <textarea rows={3} value={fields.relevant_experience} placeholder="Experience directly relevant to this requirement..."
                            style={{ ...inputStyle, resize: "vertical" }}
                            onChange={e => setFields(p => ({ ...p, relevant_experience: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 2, display: "block" }}>
                            Reason for Change <span style={{ color: "#dc2626" }}>*</span>
                        </label>
                        <textarea rows={2} value={fields.reason_for_change} placeholder="Why is the candidate looking for a change?"
                            style={{ ...inputStyle, resize: "vertical", borderColor: fields.reason_for_change.trim() ? undefined : "#dc2626" }}
                            onChange={e => setFields(p => ({ ...p, reason_for_change: e.target.value }))} />
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.65rem" }}>
                    <button className="btn btn-primary btn-sm" onClick={handleSaveFields} disabled={saving}>
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                    {saveMsg && <span style={{ fontSize: 12, color: saveMsg === "Saved" ? "#16a34a" : "#dc2626" }}>{saveMsg}</span>}
                </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem" }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: "0.5rem" }}>Add Comment</div>
                <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    placeholder="Add a comment about this candidate..."
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.35rem" }}>
                    {commentErr && <div style={{ fontSize: 12, color: "#dc2626" }}>{commentErr}</div>}
                    <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }}
                        onClick={handlePostComment} disabled={posting || !draft.trim()}>
                        {posting ? "Posting..." : "Post comment"}
                    </button>
                </div>
            </div>

            {comments.length > 0 && (
                <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem" }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: "0.5rem" }}>Comments ({comments.length})</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                        {[...comments].reverse().map((c: any, i: number) => {
                            const isOwn = user?.id && c.author_id && String(c.author_id) === String(user.id);
                            const isEditing = editingId === String(c.id);
                            return (
                                <div key={i} style={{ fontSize: 13, borderLeft: "3px solid var(--border-subtle)", paddingLeft: "0.6rem" }}>
                                    {isEditing ? (
                                        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                                            <textarea
                                                value={editText}
                                                onChange={e => setEditText(e.target.value)}
                                                rows={2}
                                                autoFocus
                                                style={{ resize: "vertical", padding: "0.4rem", fontSize: 13, border: "1px solid var(--accent)", borderRadius: 4, width: "100%" }}
                                            />
                                            <div style={{ display: "flex", gap: "0.4rem" }}>
                                                <button className="btn btn-primary btn-sm" onClick={() => handleSaveEdit(String(c.id))} disabled={editSaving || !editText.trim()}>
                                                    {editSaving ? "Saving…" : "Save"}
                                                </button>
                                                <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)} disabled={editSaving}>Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ color: "var(--text-primary)" }}>{c.comment}</div>
                                    )}
                                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: "0.15rem", display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                                        <span>— {c.author_name || "unknown"} · {fmtDate(c.date)}</span>
                                        {isOwn && !isEditing && c.id && (
                                            <button
                                                style={{ fontSize: 10, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0 2px" }}
                                                onClick={() => { setEditingId(String(c.id)); setEditText(c.comment); }}
                                            >Edit</button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}


function ReviewPanel({ profile, jdId }: { profile: Profile; jdId: string }) {
    const drawer = useSideDrawer();
    const cand = profile.candidate || {};
    const det = profile.deterministic_scoring_analysis || {};
    const llm = profile.llm_analysis;
    const mostRecent = (cand.Experience || [])[0] || {};
    const currentRole = det.current_role || mostRecent.Position || "—";
    const currentCompany = det.current_company || mostRecent.Company || "—";
    const name = cand.Name || det.candidate_name || "—";
    const totalExp = det.total_experience_years != null ? `${det.total_experience_years} yr` : "—";
    const src = profile.sourced_by?.source;
    const sourceLabel = src === "manual" ? "Manual upload" : src === "email" ? "Email sync" : "Talent pool";

    const [fields, setFields] = useState({
        current_ctc: cand.current_ctc != null ? String(cand.current_ctc) : "",
        expected_ctc: cand.expected_ctc != null ? String(cand.expected_ctc) : "",
        notice_period: cand.notice_period || "",
        relevant_experience: cand.relevant_experience || "",
        reason_for_change: cand.reason_for_change || "",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const requiredFilled =
        fields.current_ctc.trim() !== "" &&
        fields.expected_ctc.trim() !== "" &&
        fields.notice_period.trim() !== "" &&
        fields.reason_for_change.trim() !== "";

    const inputStyle: React.CSSProperties = {
        padding: "0.45rem 0.65rem", fontSize: 13,
        border: "1px solid var(--border-subtle)", borderRadius: 4,
        background: "var(--bg-input, var(--bg-secondary))",
        color: "var(--text-primary)", width: "100%", fontFamily: "inherit",
    };
    const requiredInputStyle = (val: string): React.CSSProperties => ({
        ...inputStyle,
        borderColor: val.trim() === "" ? "#dc2626" : undefined,
    });

    const handleSaveAndSubmit = async () => {
        if (!requiredFilled) return;
        setSaving(true);
        setError(null);
        try {
            const body: any = {
                current_ctc: fields.current_ctc.trim() ? parseFloat(fields.current_ctc) : null,
                expected_ctc: fields.expected_ctc.trim() ? parseFloat(fields.expected_ctc) : null,
                notice_period: fields.notice_period.trim() || null,
                relevant_experience: fields.relevant_experience.trim() || null,
                reason_for_change: fields.reason_for_change.trim() || null,
            };
            await api.patch(`/candidates/${profile.candidate_uuid}`, body);
            await api.post(`/requirements/${jdId}/profiles/${profile.candidate_uuid}/submit`, {});
            const next = { ...profile, status: "submitted", candidate: { ...cand, ...body } };
            window.dispatchEvent(new CustomEvent("tw-profile-updated", { detail: { profile: next, jdId } }));
            drawer.close();
        } catch (e: any) {
            setError(e?.detail || e?.message || "Failed to submit");
        } finally {
            setSaving(false);
        }
    };

    const Row = ({ label, value }: { label: string; value: any }) => (
        <div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: 13 }}>{value || <span style={{ color: "var(--text-muted)" }}>—</span>}</div>
        </div>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Read-only candidate summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
                <Row label="Candidate" value={<span style={{ fontWeight: 600 }}>{name}</span>} />
                <Row label="Total Experience" value={totalExp} />
                <Row label="Current Role" value={currentRole} />
                <Row label="Current Company" value={currentCompany} />
                <Row label="Match Score" value={det.display_score != null ? <span className="font-mono">{det.display_score}%</span> : "—"} />
                <Row label="AI Score" value={llm?.overall_score != null ? <span className="font-mono">{llm.overall_score}/100</span> : "—"} />
            </div>

            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
                <Row label="Owned by" value={profile.uploaded_by_name || "—"} />
                <Row label="Sourced from" value={sourceLabel} />
            </div>

            {/* Required fields before submit */}
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem" }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: "0.5rem" }}>
                    Candidate Details <span style={{ color: "#dc2626", fontWeight: 400 }}>— required before submitting</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 2 }}>
                            Current CTC (LPA) <span style={{ color: "#dc2626" }}>*</span>
                        </label>
                        <input type="number" placeholder="e.g. 12" style={requiredInputStyle(fields.current_ctc)}
                            value={fields.current_ctc} onChange={e => setFields(p => ({ ...p, current_ctc: e.target.value }))} />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 2 }}>
                            Expected CTC (LPA) <span style={{ color: "#dc2626" }}>*</span>
                        </label>
                        <input type="number" placeholder="e.g. 18" style={requiredInputStyle(fields.expected_ctc)}
                            value={fields.expected_ctc} onChange={e => setFields(p => ({ ...p, expected_ctc: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 2 }}>
                            Notice Period <span style={{ color: "#dc2626" }}>*</span>
                        </label>
                        <input type="text" placeholder="e.g. 30 days / immediate" style={requiredInputStyle(fields.notice_period)}
                            value={fields.notice_period} onChange={e => setFields(p => ({ ...p, notice_period: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ fontSize: 11, fontWeight: 500, color: "var(--text-secondary)", display: "block", marginBottom: 2 }}>Relevant Experience</label>
                        <textarea rows={3} placeholder="Experience relevant to this requirement…" style={{ ...inputStyle, resize: "vertical" }}
                            value={fields.relevant_experience} onChange={e => setFields(p => ({ ...p, relevant_experience: e.target.value }))} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 2 }}>
                            Reason for Change <span style={{ color: "#dc2626" }}>*</span>
                        </label>
                        <textarea rows={2} placeholder="Why is the candidate looking for a change?" style={{ ...inputStyle, resize: "vertical", borderColor: fields.reason_for_change.trim() ? undefined : "#dc2626" }}
                            value={fields.reason_for_change} onChange={e => setFields(p => ({ ...p, reason_for_change: e.target.value }))} />
                    </div>
                </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {!requiredFilled && (
                    <div style={{ fontSize: 12, color: "#dc2626" }}>Fill in all required fields (CTC, Notice Period, Reason for Change) to enable submission.</div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                    <button className="btn btn-ghost" onClick={drawer.close} disabled={saving}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSaveAndSubmit} disabled={saving || !requiredFilled}>
                        {saving ? "Submitting…" : "Save & Submit"}
                    </button>
                </div>
                {error && <div style={{ color: "#dc2626", fontSize: 13, textAlign: "right" }}>{error}</div>}
            </div>
        </div>
    );
}


export default function ProfileDrawer({ jdId, profile, action, initialTab, onUpdated }: ProfileDrawerProps) {
    const drawer = useSideDrawer();
    const navigate = useNavigate();
    const [tab, setTab] = useState<ProfileViewTab>(initialTab || "overview");

    useEffect(() => {
        if (initialTab) setTab(initialTab);
    }, [initialTab, profile.candidate_uuid]);

    const refreshProfile = async () => {
        try {
            const fresh = await api.get(`/requirements/${jdId}/profiles/${profile.candidate_uuid}`);
            drawer.patchProfile(fresh);
            drawer.notifyProfileChanged();
            window.dispatchEvent(new CustomEvent("tw-profile-updated", { detail: { profile: fresh, jdId } }));
            onUpdated?.(fresh);
            return fresh;
        } catch {
            drawer.notifyProfileChanged();
            return null;
        }
    };

    const name = profile.candidate?.Name || profile.deterministic_scoring_analysis?.candidate_name || "Profile";
    const score = profile.deterministic_scoring_analysis?.display_score;
    const aiScore = profile.llm_analysis?.overall_score;
    const comments = profile.recruiter_comments || [];

    const viewTabs = useMemo(() => {
        const arr: Array<{ key: ProfileViewTab; label: string }> = [
            { key: "overview", label: "Overview" },
            { key: "deterministic", label: "Deterministic" },
            { key: "llm", label: "LLM Analysis" },
            { key: "comments", label: comments.length > 0 ? `Comments (${comments.length})` : "Comments" },
        ];
        return arr;
    }, [comments.length]);

    const headerLabel = action === "update" ? "Update Profile" : action === "submit" ? "Review" : "";

    return (
        <>
            <div
                onClick={drawer.close}
                style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.18)" }}
            />
            <aside
                style={{
                    position: "fixed", top: 0, right: 0, bottom: 0,
                    width: "min(45vw, 640px)",
                    background: "var(--bg-primary)",
                    borderLeft: "1px solid var(--border-subtle)",
                    boxShadow: "-4px 0 16px rgba(0,0,0,0.08)",
                    zIndex: 1000,
                    display: "flex", flexDirection: "column",
                }}
            >
                <header style={{ padding: "0.85rem 1.1rem", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {name}
                            {headerLabel && <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-secondary)", marginLeft: "0.5rem" }}>— {headerLabel}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            {score != null && <>Match <strong>{score}%</strong></>}
                            {aiScore != null && <> · AI <strong>{aiScore}/100</strong></>}
                            {(score != null || aiScore != null) && " · "}
                            {(() => {
                                const s = profile.sourced_by?.source;
                                const owner = profile.uploaded_by_name || profile.recruiter_name || "—";
                                return s === "manual"
                                    ? <>Manual upload · Owned by <strong>{owner}</strong></>
                                    : s === "email"
                                        ? <>Email sync · Owned by <strong>{owner}</strong></>
                                        : <>From talent pool · Owned by <strong>{owner}</strong></>;
                            })()}
                        </div>
                    </div>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => navigate(`/requirements/${jdId}/profiles/${profile.candidate_uuid}`)}
                        title="Open in full screen"
                    >Full View</button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => drawer.openResume(profile.candidate_uuid, name)}
                        title="View resume"
                    >Resume</button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={drawer.close}
                        title="Close"
                        style={{ padding: "4px 8px" }}
                    >×</button>
                </header>

                {action === "view" && (
                    <nav style={{ padding: "0.6rem 1.1rem", borderBottom: "1px solid var(--border-subtle)", display: "flex", gap: "0.4rem", overflowX: "auto" }}>
                        {viewTabs.map(t => (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                style={{
                                    padding: "4px 12px", borderRadius: 999, border: "1px solid var(--border-subtle)",
                                    background: tab === t.key ? "var(--accent)" : "transparent",
                                    color: tab === t.key ? "#fff" : "var(--text-secondary)",
                                    cursor: "pointer", fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
                                    whiteSpace: "nowrap",
                                }}
                            >{t.label}</button>
                        ))}
                    </nav>
                )}

                <div style={{ flex: 1, overflow: "auto", padding: "1rem 1.1rem" }}>
                    {action === "view" && (
                        <>
                            {tab === "overview" && <OverviewSection profile={profile} />}
                            {tab === "deterministic" && <DeterministicSection profile={profile} />}
                            {tab === "llm" && (
                                <LlmSection profile={profile} jdId={jdId} onUpdated={(next) => {
                                    drawer.patchProfile(next);
                                    window.dispatchEvent(new CustomEvent("tw-profile-updated", { detail: { profile: next, jdId } }));
                                }} />
                            )}
                            {tab === "comments" && (
                                <CommentsSection profile={profile} jdId={jdId} onUpdated={() => { void refreshProfile(); }} />
                            )}
                        </>
                    )}
                    {action === "update" && (
                        <UpdateForm profile={profile} jdId={jdId} refreshProfile={refreshProfile} />
                    )}
                    {action === "submit" && (
                        <ReviewPanel profile={profile} jdId={jdId} />
                    )}
                </div>
            </aside>
        </>
    );
}
