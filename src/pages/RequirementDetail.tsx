import { useEffect, useState } from "react";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import StatusBadge from "../components/StatusBadge";

import { useJdViewer } from "../context/JdViewerContext";
import ProfilesGrid from "../components/ProfilesGrid";
import Icon from "../components/Icon";
import AssignRecruitersDrawer from "../components/AssignRecruitersDrawer";
import RequestAssignmentDialog from "../components/RequestAssignmentDialog";
import "../styles/pages.css";

function PillNav({ tabs, active, onSelect }: {
    tabs: { key: string; label: string }[];
    active: string;
    onSelect: (key: string) => void;
}) {
    const idx = Math.max(0, tabs.findIndex(t => t.key === active));
    const pct = 100 / tabs.length;
    return (
        <div style={{
            position: "relative", display: "grid",
            gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
            background: "var(--bg-secondary)", borderRadius: "999px",
            padding: "4px", border: "1px solid var(--border-subtle)",
        }}>
            <div style={{
                position: "absolute", top: "4px", bottom: "4px",
                width: `calc(${pct}% - 4px)`, borderRadius: "999px",
                background: "var(--accent)",
                transform: `translateX(calc(${idx * 100}% + ${idx * 4}px))`,
                transition: "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
                pointerEvents: "none",
            }} />
            {tabs.map(t => {
                const isActive = t.key === active;
                return (
                    <button key={t.key} onClick={() => onSelect(t.key)} style={{
                        position: "relative", zIndex: 1,
                        padding: "5px 18px", borderRadius: "999px",
                        border: "none", cursor: "pointer",
                        fontSize: "var(--font-size-sm)",
                        fontWeight: isActive ? 600 : 400,
                        background: "transparent",
                        color: isActive ? "#fff" : "var(--text-secondary)",
                        transition: "color 0.22s ease",
                        whiteSpace: "nowrap", textAlign: "center",
                    }}>{t.label}</button>
                );
            })}
        </div>
    );
}

interface Requirement {
    id: string;
    req_id: string;
    requirement_name: string;
    job_role?: string | null;
    jd: string | null;
    evaluation_dimensions?: Array<Record<string, any>>;
    important_information?: Array<{ label: string; any_of: string[] }>;
    additional_fields?: Record<string, any> | null;
    must_have_skills?: string[] | null;
    good_to_have_skills?: string[] | null;
    all_skills?: string[] | null;
    special_instructions: string | null;
    requirement_type: string | null;
    role_type: string | null;
    client_spoc_name: string | null;
    location: string | null;
    notice_period: string | null;
    years_of_experience: string | null;
    max_years_experience: string | null;
    mode_of_work: string | null;
    no_of_positions?: number | null;
    budget_range?: string | null;
    sla_hours_to_first_submission?: number | null;
    sla_timezone?: string | null;
    sla_status?: string | null;
    sla_breached?: boolean | null;
    sla_deadline_ist?: string | null;
    first_submission_at_ist?: string | null;
    time_to_first_submission_hours?: number | null;
    sla_remaining_hours?: number | null;
    status: string;
    created_at: string;
    updated_at?: string | null;
    assigned_recruiters?: string[];
}

interface Application {
    id: string;
    candidate_id: string;
    requirement_id: string;
    recruiter_id: string;
    status: string;
    recruiter_comments: string | null;
    ai_score: number | null;
    sent_at: string;
    rejection_reason: string | null;
    source: string | null;
    candidate_name: string | null;
    recruiter_name: string | null;
}

const SUB_PAGE_SIZE = 10;

function npColor(notice?: string | null): string {
    if (!notice) return "var(--text-secondary)";
    const l = notice.toLowerCase();
    if (l.includes("immediate") || l.includes("serving") || l === "0") return "#16a34a";
    const n = parseInt(l);
    if (!isNaN(n)) { if (n <= 15) return "#16a34a"; if (n <= 60) return "#d97706"; return "#dc2626"; }
    return "var(--text-secondary)";
}

function SubmissionDetailModal({ app, prof, isAdmin, onClose }: { app: Application; prof: any; isAdmin: boolean; onClose: () => void }) {
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [onClose]);

    const det = prof?.deterministic_scoring_analysis || {};
    const cand = prof?.candidate || {};
    const personal = cand.PersonalDetails || {};
    const mostRecent = (cand.Experience || [])[0] || {};
    const llm = prof?.llm_analysis;

    const currentRole = det.current_role || mostRecent.Position || cand.current_role;
    const currentCompany = det.current_company || mostRecent.Company || cand.current_company;
    const currentCtc = cand.current_ctc ?? cand.present_ctc;
    const expectedCtc = cand.expected_ctc;
    const noticePeriod = cand.notice_period || personal.NoticePeriod;
    const relevantExp = cand.relevant_experience;
    const reasonForChange = cand.reason_for_change;
    const totalExp = cand.experience_label
        || (det.total_experience_years != null ? `${det.total_experience_years} yrs` : undefined);

    const detFlags = (det.flags || []).map((f: any) => ({ ...f, level: f.severity }));
    const llmFlags = llm?.flags || [];
    const flags = [...detFlags, ...llmFlags];

    const Field = ({ label, value }: { label: string; value?: any }) => (
        <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.6px", marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.45 }}>
                {value ?? <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>—</span>}
            </div>
        </div>
    );

    return (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.52)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }} onClick={onClose}>
            <div style={{ background: "var(--bg-primary)", borderRadius: 14, boxShadow: "0 24px 80px rgba(0,0,0,0.35)", width: "100%", maxWidth: 560, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--border-subtle)" }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: "1.1rem 1.4rem", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", flexShrink: 0 }}>
                    <div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>{app.candidate_name || "—"}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3, display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                            <StatusBadge status={app.status} />
                            <span style={{ color: "var(--text-muted)" }}>·</span>
                            <span>{new Date(app.sent_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                            {isAdmin && app.recruiter_name && (<><span style={{ color: "var(--text-muted)" }}>· by</span><span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{app.recruiter_name}</span></>)}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 8, cursor: "pointer", fontSize: 18, color: "var(--text-secondary)", lineHeight: 1, padding: "4px 9px", flexShrink: 0, marginTop: 2 }} title="Close (Esc)">×</button>
                </div>
                <div style={{ padding: "1.1rem 1.4rem", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {llm?.overall_score != null && (
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.65rem 0.9rem", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                            <div style={{ flexShrink: 0 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.6px" }}>AI Score</div>
                                <div style={{ fontSize: 22, fontWeight: 800, color: "#2563eb", fontFamily: "monospace", lineHeight: 1.1 }}>{llm.overall_score}<span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-secondary)" }}>/100</span></div>
                            </div>
                            {llm.rating && <span style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-primary)", padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border-subtle)", flexShrink: 0 }}>{llm.rating}</span>}
                            {llm.headline && <div style={{ fontStyle: "italic", color: "var(--text-secondary)", fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{llm.headline}"</div>}
                        </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem 1.5rem" }}>
                        <Field label="Current Role" value={currentRole} />
                        <Field label="Current Company" value={currentCompany} />
                        <Field label="Current CTC" value={currentCtc != null ? `${currentCtc} LPA` : undefined} />
                        <Field label="Expected CTC" value={expectedCtc != null ? `${expectedCtc} LPA` : undefined} />
                        <Field label="Notice Period" value={noticePeriod ? <span style={{ color: npColor(noticePeriod), fontWeight: 600 }}>{noticePeriod}</span> : undefined} />
                        <Field label="Total Experience" value={totalExp} />
                    </div>
                    {relevantExp && (
                        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.6px", marginBottom: 4 }}>Relevant Experience</div>
                            <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.55 }}>{relevantExp}</div>
                        </div>
                    )}
                    {reasonForChange && (
                        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.6px", marginBottom: 4 }}>Reason for Change</div>
                            <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.55 }}>{reasonForChange}</div>
                        </div>
                    )}
                    {app.recruiter_comments && (
                        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.6px", marginBottom: 4 }}>Recruiter Comments</div>
                            <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.55 }}>{app.recruiter_comments}</div>
                        </div>
                    )}
                    {app.rejection_reason && (
                        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.6px", marginBottom: 4 }}>Rejection Reason</div>
                            <div style={{ fontSize: 13, color: "#dc2626", lineHeight: 1.55 }}>{app.rejection_reason}</div>
                        </div>
                    )}
                    {flags.length > 0 && (
                        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.85rem" }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.6px", marginBottom: 6 }}>Flags</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                                {
                                    (flags && flags.length > 0) ? (
                                        <table border={0} style={{ borderCollapse: "collapse", width: "100%" }}>
                                            <tbody>
                                                {flags.map((f: any, i: number) => {
                                                    const col = f.level === "green" ? "#16a34a" : f.level === "orange" ? "#ca8a04" : (f.level === "red" || f.level === "warning") ? "#dc2626" : "#6b7280";
                                                    return (
                                                        <tr key={i}>
                                                            <td style={{ width: "20px", verticalAlign: "middle", padding: "6px 8px 6px 0" }}>
                                                                <span style={{ display: "block", width: 8, height: 8, borderRadius: "50%", background: col }} />
                                                            </td>
                                                            <td style={{ color: "var(--text-primary)", fontWeight: 500, minWidth: 80, textTransform: "capitalize" as const, padding: "6px 16px 6px 0", verticalAlign: "middle" }}>{f.type}</td>
                                                            <td style={{ color: "var(--text-secondary)", padding: "6px 0", verticalAlign: "middle" }}>{f.message}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    ) : <></>
                                }
                                {/* {flags.map((f: any, i: number) => {
                                    const col = f.level === "green" ? "#16a34a" : f.level === "orange" ? "#ca8a04" : (f.level === "red" || f.level === "warning") ? "#dc2626" : "#6b7280";
                                    return (
                                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: col, flexShrink: 0 }} />
                                            <span style={{ color: "var(--text-primary)", fontWeight: 500, minWidth: 80, textTransform: "capitalize" as const }}>{f.type}</span>
                                            <span style={{ color: "var(--text-secondary)" }}>{f.message}</span>
                                        </div>
                                    );
                                })} */}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function RequirementDetail() {
    const { id } = useParams<{ id: string }>();
    const { user, isAdmin, isRecruiter } = useAuth();
    const navigate = useNavigate();
    const { openJd, activeReq: jdActiveReq } = useJdViewer();
    const [req, setReq] = useState<Requirement | null>(null);
    useDocumentTitle(req?.requirement_name || "Requirement");
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [_showJd, _setShowJd] = useState(false);

    // Submission detail modal
    const [selectedSub, setSelectedSub] = useState<{ app: Application; prof: any } | null>(null);
    const [subPage, setSubPage] = useState(1);

    // Status change modal
    const [selectedApp, setSelectedApp] = useState<Application | null>(null);
    const [newStatus, setNewStatus] = useState("");
    const [rejectionReason, setRejectionReason] = useState("");
    const [statusNotes, setStatusNotes] = useState("");
    const [statusError, setStatusError] = useState("");
    // Req Status Update
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showAssignDrawer, setShowAssignDrawer] = useState(false);
    const [showRequestDialog, setShowRequestDialog] = useState(false);
    const [pendingRequestForThisReq, setPendingRequestForThisReq] = useState<boolean>(false);
    const [newReqStatus, setNewReqStatus] = useState("");

    // Profiles list (replaces old recommended/manual split)
    const queryClient = useQueryClient();
    const [generatingSuggestions, setGeneratingSuggestions] = useState(false);
    const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

    const {
        data: _profilesResult,
        isLoading: loadingSuggestions,
        refetch: _refetchProfiles,
    } = useQuery({
        queryKey: ["profiles", id],
        queryFn: () => api.get(`/requirements/${id}/profiles`),
        enabled: !!id,
        staleTime: 30 * 1000,
        // While any profile is still being structured by the AI worker, poll so the grid
        // updates (name / role / score fill in) once structuring completes. Stops at 0 pending.
        refetchInterval: (query: any) => {
            const profs: any[] = query?.state?.data?.profiles ?? [];
            const anyPending = profs.some(
                (p) => p?.candidate?.ai_status === "pending" || p?.candidate?.ai_status === "processing"
            );
            return anyPending ? 5000 : false;
        },
    });
    const suggestions: any[] = _profilesResult?.profiles ?? [];
    const fetchProfiles = () => _refetchProfiles();

    // Resume upload state (multi-file)
    const [manualUploading, setManualUploading] = useState(false);
    const [manualUploadStage, setManualUploadStage] = useState<string>("");
    const [manualUploadError, setManualUploadError] = useState<string | null>(null);
    type UploadDuplicate = { filename: string; message: string; candidate_id?: string };
    const [uploadDuplicates, setUploadDuplicates] = useState<UploadDuplicate[]>([]);

    const [mainTab, setMainTab] = useState<"submissions" | "profiles">("submissions");

    // Inline edit state (admin only)
    const [showEditPanel, setShowEditPanel] = useState(false);
    const [editFields, setEditFields] = useState<{
        requirement_name: string;
        requirement_type: string;
        role_type: string;
        client_spoc_name: string;
        location: string;
        notice_period: string;
        years_of_experience: string;
        max_years_experience: string;
        mode_of_work: string;
        no_of_positions: string;
        budget_range: string;
        special_instructions: string;
    } | null>(null);
    const [editSaving, setEditSaving] = useState(false);
    const [editErr, setEditErr] = useState<string | null>(null);

    const refreshApplications = async () => {
        if (!id) return;
        try {
            const appData = await api.get(`/applications?requirement_id=${id}`);
            setApplications(appData || []);
        } catch (err) {
            console.error("Failed to load applications:", err);
        }
    };

    const openEditPanel = () => {
        if (!req) return;
        setEditFields({
            requirement_name: req.requirement_name || "",
            requirement_type: req.requirement_type || "",
            role_type: req.role_type || "",
            client_spoc_name: req.client_spoc_name || "",
            location: req.location || "",
            notice_period: req.notice_period || "",
            years_of_experience: req.years_of_experience || "",
            max_years_experience: req.max_years_experience || "",
            mode_of_work: req.mode_of_work || "",
            no_of_positions: req.no_of_positions != null ? String(req.no_of_positions) : "",
            budget_range: req.budget_range || "",
            special_instructions: req.special_instructions || "",
        });
        setEditErr(null);
        setShowEditPanel(true);
    };

    const handleSaveEdit = async () => {
        if (!editFields || !id) return;
        setEditSaving(true); setEditErr(null);
        try {
            const updated = await api.patch(`/requirements/${id}`, {
                requirement_name: editFields.requirement_name.trim() || undefined,
                requirement_type: editFields.requirement_type.trim() || null,
                role_type: editFields.role_type.trim() || null,
                client_spoc_name: editFields.client_spoc_name.trim() || null,
                location: editFields.location.trim() || null,
                notice_period: editFields.notice_period.trim() || null,
                years_of_experience: editFields.years_of_experience.trim() || null,
                max_years_experience: editFields.max_years_experience.trim() || null,
                mode_of_work: editFields.mode_of_work.trim() || null,
                no_of_positions: editFields.no_of_positions ? parseInt(editFields.no_of_positions, 10) : null,
                budget_range: editFields.budget_range.trim() || null,
                special_instructions: editFields.special_instructions.trim() || null,
            });
            setReq(updated);
            setShowEditPanel(false);
        } catch (e: any) {
            setEditErr(e?.detail || e?.message || "Failed to save");
        } finally {
            setEditSaving(false);
        }
    };

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        api.get(`/requirements/${id}`)
            .then((reqData) => setReq(reqData))
            .catch(() => { })
            .finally(() => setLoading(false));
        api.get(`/applications?requirement_id=${id}`)
            .then((appData) => {
                const apps = appData || [];
                setApplications(apps);
                if (apps.length === 0) setMainTab("profiles");
            })
            .catch(() => { });
    }, [id]);

    // Keep the open JD panel in sync if it's showing this requirement
    useEffect(() => {
        if (req && jdActiveReq && jdActiveReq.id === req.id) {
            openJd(req as any);
        }
    }, [req, jdActiveReq, openJd]);

    useEffect(() => {
        const handleProfileUpdate = (e: any) => {
            const { profile: updatedProfile, jdId } = e.detail;
            if (jdId !== id) return;
            // Patch the cached profile in place — avoids a full refetch for single-row updates
            queryClient.setQueryData(["profiles", id], (old: any) => ({
                ...(old || {}),
                profiles: (old?.profiles ?? []).map((p: any) =>
                    p.candidate_uuid === updatedProfile.candidate_uuid ? updatedProfile : p
                ),
            }));
            void refreshApplications();
        };
        window.addEventListener("tw-profile-updated", handleProfileUpdate as EventListener);
        return () => window.removeEventListener("tw-profile-updated", handleProfileUpdate as EventListener);
    }, [id, queryClient]);

    const refreshPendingRequest = async () => {
        if (!id || !user) return;
        try {
            const rows = await api.get(`/assignment-requests?status=pending&requirement_id=${id}`);
            setPendingRequestForThisReq(Array.isArray(rows) && rows.some((r: any) => r.recruiter_id === user.id));
        } catch {
            setPendingRequestForThisReq(false);
        }
    };
    useEffect(() => { void refreshPendingRequest(); }, [id, user?.id]);

    const handleScanTalentPool = async () => {
        if (!id || generatingSuggestions) return;
        setGeneratingSuggestions(true);
        setSuggestionsError(null);
        try {
            const { job_id } = await api.post(`/requirements/${id}/profiles/scan-talent-pool`, {});
            // Poll for job completion every 3 seconds
            await new Promise<void>((resolve, reject) => {
                const interval = setInterval(async () => {
                    try {
                        const job = await api.get(`/requirements/${id}/scan-jobs/${job_id}`);
                        if (job.status === "done") {
                            clearInterval(interval);
                            resolve();
                        } else if (job.status === "failed") {
                            clearInterval(interval);
                            reject(new Error(job.error || "Scan failed"));
                        }
                    } catch (e) {
                        clearInterval(interval);
                        reject(e);
                    }
                }, 3000);
            });
            await fetchProfiles();
        } catch (err: any) {
            console.error("Talent-pool scan failed:", err);
            setSuggestionsError(err?.detail || err?.message || "Scan failed");
        } finally {
            setGeneratingSuggestions(false);
        }
    };


    // Unified resume upload — multi-file, non-gated. Each file goes through
    // /profiles/upload which stores in talent pool + scores against this req + upserts a profile row.
    const handleUploadResumes = async (files: FileList | null) => {
        if (!id || !files || files.length === 0) return;
        setManualUploading(true);
        setManualUploadError(null);
        setManualUploadStage(`Uploading ${files.length} file${files.length > 1 ? "s" : ""}…`);
        setUploadDuplicates([]);
        try {
            const form = new FormData();
            Array.from(files).forEach(f => form.append("resume_files", f));
            const result = await api.post(`/requirements/${id}/profiles/upload`, form);
            const dupes: UploadDuplicate[] = (result.items ?? [])
                .filter((item: any) => item.status === "duplicate")
                .map((item: any) => ({ filename: item.filename, message: item.message || "", candidate_id: item.candidate_id }));
            setUploadDuplicates(dupes);
            const parts = [];
            if (result.uploaded) parts.push(`${result.uploaded} uploaded`);
            if (dupes.length) parts.push(`${dupes.length} duplicate${dupes.length > 1 ? "s" : ""} skipped`);
            if (result.failed) parts.push(`${result.failed} failed`);
            setManualUploadStage(parts.join(", ") || "Upload complete");
            await fetchProfiles();
        } catch (err: any) {
            setManualUploadError(err?.detail || err?.message || "Upload failed");
        } finally {
            setTimeout(() => {
                setManualUploading(false);
                setManualUploadStage("");
            }, 3000);
        }
    };

    // Submit a profile → creates an application + flips status="submitted".
    const handleSubmitProfile = async (profile: any) => {
        if (!id) return;
        const confirm = window.confirm(
            `Submit ${profile.candidate?.Name || "candidate"} to ${req?.requirement_name || "this requirement"}?\n\n` +
            `Sourced by: ${profile.recruiter_name || "—"} (${profile.sourced_by?.source || "—"})\n` +
            `Match score: ${profile.deterministic_scoring_analysis?.display_score ?? "—"}%`
        );
        if (!confirm) return;
        try {
            await api.post(`/requirements/${id}/profiles/${profile.candidate_uuid}/submit`, {});
            await fetchProfiles();
        } catch (err: any) {
            alert(err?.detail || err?.message || "Submit failed");
        }
    };

    const handleStatusChange = async () => {
        if (!selectedApp) return;
        setStatusError("");

        try {
            const body: any = { status: newStatus };
            if (newStatus === "REJECTED") body.rejection_reason = rejectionReason;
            if (statusNotes && newStatus !== "REJECTED") body.notes = statusNotes;

            const updated = await api.patch(
                `/applications/${selectedApp.id}/status`,
                body
            );
            setApplications((prev) =>
                prev.map((a) => (a.id === updated.id ? updated : a))
            );
            queryClient.setQueryData(["profiles", id], (old: any) => ({
                ...(old || {}),
                profiles: (old?.profiles ?? []).map((p: any) =>
                    p.candidate_uuid === updated.candidate_id
                        ? { ...p, application_status: updated.status }
                        : p
                ),
            }));
            setSelectedApp(null);
            setNewStatus("");
            setRejectionReason("");
            setStatusNotes("");
        } catch (err: any) {
            setStatusError(err.detail || "Failed to update status");
        }
    };

    // Remove a candidate's profile from this requirement (deletes the profile row +
    // the application if it hasn't progressed in the client pipeline).
    const handleRemoveProfile = async (profile: any) => {
        if (!id) return;
        const name = profile.candidate?.Name || profile.deterministic_scoring_analysis?.candidate_name || "this candidate";
        if (!window.confirm(`Remove ${name} from ${req?.requirement_name || "this requirement"}?\n\nThe candidate stays in the talent pool — only the link to this requirement is removed.`)) return;
        try {
            await api.delete(`/requirements/${id}/profiles/${profile.candidate_uuid}`);
            await fetchProfiles();
        } catch (err: any) {
            alert(err?.detail || err?.message || "Failed to remove profile");
        }
    };

    const handleRemoveApplication = async (app: Application) => {
        try {
            await api.delete(`/applications/${app.id}`);
            setApplications(prev => prev.filter(a => a.id !== app.id));
            // Profile grid refreshes through fetchProfiles to reflect the changed state.
            await fetchProfiles();
        } catch (err: any) {
            alert(err.detail || "Failed to remove submission");
        }
    };

    const STATUS_LABELS: Record<string, string> = {
        SENT: "Sent",
        L1_SELECTED: "L1 Selected",
        L2_SELECTED: "L2 Selected",
        HR_ROUND: "HR Round",
        SELECTED: "Selected",
        REJECTED: "Rejected",
    };

    const getNextStatuses = (current: string) => {
        const map: Record<string, string[]> = {
            SENT: ["L1_SELECTED", "L2_SELECTED", "HR_ROUND", "SELECTED", "REJECTED"],
            L1_SELECTED: ["L2_SELECTED", "HR_ROUND", "SELECTED", "REJECTED"],
            L2_SELECTED: ["HR_ROUND", "SELECTED", "REJECTED"],
            HR_ROUND: ["SELECTED", "REJECTED"],
            SELECTED: ["REJECTED"],
            REJECTED: ["SENT", "L1_SELECTED", "L2_SELECTED", "HR_ROUND", "SELECTED"],
        };
        return map[current] || [];
    };

    if (loading) return <div className="loading-spinner">Loading...</div>;
    if (!req) return <div className="loading-spinner">Requirement not found</div>;

    const statusCounts = {
        SENT: applications.filter((a) => a.status === "SENT").length,
        L1: applications.filter((a) => a.status === "L1_SELECTED").length,
        L2: applications.filter((a) => a.status === "L2_SELECTED").length,
        SELECTED: applications.filter((a) => a.status === "SELECTED").length,
        REJECTED: applications.filter((a) => a.status === "REJECTED").length,
    };

    const renderSla = () => {
        const status = req.sla_status || "ON_TRACK";
        const breached = Boolean(req.sla_breached);
        if (status === "MET") {
            return <span className="sla-badge sla-badge--met">Met</span>;
        }
        if (breached || status === "BREACHED") {
            return <span className="sla-badge sla-badge--breached">Breached</span>;
        }
        const remainingText =
            req.sla_remaining_hours != null
                ? `${Math.ceil(req.sla_remaining_hours)}h left`
                : "On Track";
        return <span className="sla-badge sla-badge--ontrack">{remainingText}</span>;
    };

    return (
        <div>
            <button
                className="btn btn-ghost"
                onClick={() => navigate(-1)}
                style={{ marginBottom: "0.75rem", fontSize: 13, display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
            >
                ← Back
            </button>
            <div className="detail-header">
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                        <span className="font-mono text-accent" style={{ fontSize: "var(--font-size-sm)" }}>
                            {req.req_id}
                        </span>
                        <StatusBadge status={req.status} />
                    </div>
                    <h1 className="detail-title" style={{ marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        {req.requirement_name}
                        {req.updated_at && (
                            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 4, padding: "2px 8px", verticalAlign: "middle" }}>
                                edited
                            </span>
                        )}
                    </h1>
                    <div className="detail-meta">
                        {req.requirement_type && (
                            <span className="detail-meta-item">
                                Type: <strong>{req.requirement_type}</strong>
                            </span>
                        )}
                        {req.role_type && (
                            <span className="detail-meta-item">
                                Role: <strong>{req.role_type}</strong>
                            </span>
                        )}
                        {req.client_spoc_name && (
                            <span className="detail-meta-item">
                                SPOC: <strong>{req.client_spoc_name}</strong>
                            </span>
                        )}
                        <span className="detail-meta-item">
                            SLA: {renderSla()}
                        </span>
                        {req.sla_deadline_ist && (
                            <span className="detail-meta-item">
                                Deadline:{" "}
                                <strong>
                                    {new Date(req.sla_deadline_ist).toLocaleString()}
                                </strong>
                            </span>
                        )}
                        {req.first_submission_at_ist && (
                            <span className="detail-meta-item">
                                First Submission:{" "}
                                <strong>
                                    {new Date(req.first_submission_at_ist).toLocaleString()}
                                </strong>
                            </span>
                        )}
                        <span className="detail-meta-item" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                            Created: {new Date(req.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}
                        </span>
                        {req.updated_at && (
                            <span className="detail-meta-item" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                                Edited: {new Date(req.updated_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}
                            </span>
                        )}
                    </div>
                </div>
                <div className="page-actions">
                    <button
                        className="btn btn-outline"
                        onClick={() => openJd(req as any)}
                        title="View full job description in side panel"
                    >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Icon name="document" size={16} /> View JD</span>
                    </button>
                    {isAdmin && req?.status !== "DELETED" && (
                        <button
                            className="btn btn-outline"
                            onClick={openEditPanel}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Icon name="edit" size={16} /> Edit</span>
                        </button>
                    )}
                    <button
                        className="btn btn-outline"
                        style={{ color: '#0077b5', borderColor: '#0077b5' }}
                        onClick={() => {
                            const params = new URLSearchParams();
                            if (req.requirement_name) params.set("title", req.requirement_name);
                            if (req.all_skills?.length) params.set("keywords", req.all_skills.join(", "));
                            navigate(`/linkedin-search?${params.toString()}`);
                        }}
                    >
                        LinkedIn Search
                    </button>
                    {isAdmin && req?.status !== "DELETED" && (
                        <button
                            className="btn btn-outline"
                            onClick={() => {
                                setNewReqStatus(req?.status || "");
                                setShowStatusModal(true);
                            }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Icon name="edit" size={16} /> Status</span>
                        </button>
                    )}
                    {isAdmin && req?.status === "DELETED" && (
                        <button
                            className="btn btn-outline"
                            onClick={() => {
                                setNewReqStatus("OPEN"); // Default to OPEN on restore
                                setShowStatusModal(true);
                            }}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Icon name="refresh" size={16} /> Restore</span>
                        </button>
                    )}
                    {isAdmin && req?.status !== "DELETED" && (
                        <button
                            className="btn btn-ghost text-error"
                            style={{ color: "var(--error)" }}
                            onClick={() => setShowDeleteConfirm(true)}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Icon name="trash" size={16} /> Delete</span>
                        </button>
                    )}
                    {isAdmin && req?.status !== "DELETED" && (
                        <button
                            className="btn btn-outline"
                            onClick={() => setShowAssignDrawer(true)}
                            title="Assign recruiters to this requirement"
                        >
                            <Icon name="users" size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
                            Assign Recruiters
                            {(req?.assigned_recruiters?.length || 0) > 0 && (
                                <span style={{
                                    marginLeft: 6, fontSize: 11, fontWeight: 700,
                                    background: "var(--bg-secondary)", color: "var(--text-primary)",
                                    borderRadius: 999, padding: "1px 7px",
                                }}>{req.assigned_recruiters?.length}</span>
                            )}
                        </button>
                    )}
                    {!isAdmin && isRecruiter && req?.status !== "DELETED" && user && !(req?.assigned_recruiters || []).includes(user.id) && (
                        <button
                            className="btn btn-outline"
                            onClick={() => setShowRequestDialog(true)}
                            disabled={pendingRequestForThisReq}
                            title={pendingRequestForThisReq ? "Your request is pending admin approval" : "Request to be assigned to this requirement"}
                        >
                            <Icon name="send" size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
                            {pendingRequestForThisReq ? "Request Pending" : "Request Assignment"}
                        </button>
                    )}
                </div>
            </div>
            <AssignRecruitersDrawer
                open={showAssignDrawer}
                onClose={() => setShowAssignDrawer(false)}
                jdId={id || ""}
                requirementName={req?.requirement_name}
                initialAssigned={(req?.assigned_recruiters || []).map((u: any) => String(u))}
                onSaved={(newIds) => {
                    setReq((prev: any) => prev ? { ...prev, assigned_recruiters: newIds } : prev);
                    void refreshPendingRequest();
                }}
            />
            <RequestAssignmentDialog
                open={showRequestDialog}
                onClose={() => setShowRequestDialog(false)}
                jdId={id || ""}
                requirementName={req?.requirement_name}
                onSubmitted={() => {
                    setPendingRequestForThisReq(true);
                }}
            />

            {/* JD Section
            {(hasSkillData || req.special_instructions) && (
                <div className="card" style={{ marginBottom: "1.5rem" }}>
                    <div
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                        onClick={() => setShowJd(!showJd)}
                    >
                        <span className="card-title" style={{ marginBottom: 0 }}>
                            JD Skills & Instructions
                        </span>
                        <span className="text-muted">{showJd ? "Hide" : "Show"}</span>
                    </div>
                    {showJd && (
                        <div style={{ marginTop: "1rem" }}>
                            {hasSkillData && (
                                <div className="jd-skill-preview" style={{ marginBottom: "1rem" }}>
                                    <div className="jd-skill-group">
                                        <div className="jd-skill-title">Skills from JD</div>
                                        <div className="jd-skill-chips">
                                            {allSkills.length ? (
                                                allSkills.map((skill, idx) => (
                                                    <span key={`all-${idx}-${skill}`} className="suggestion-chip">{skill}</span>
                                                ))
                                            ) : (
                                                <span className="jd-skill-empty">Not Mentioned</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {req.special_instructions && (
                                <div>
                                    <strong className="text-sm">Special Instructions</strong>
                                    <p className="text-sm" style={{ marginTop: "0.35rem", color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                                        {req.special_instructions}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )} */}

            {/* ── Inline edit panel (admin only) ── */}
            {showEditPanel && editFields && (
                <div className="detail-section" style={{ marginBottom: "1.5rem", border: "1px solid var(--accent)", borderRadius: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>Edit Requirement</div>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowEditPanel(false)}>✕ Cancel</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
                        {([
                            { key: "requirement_name", label: "Requirement Name" },
                            { key: "requirement_type", label: "Type" },
                            { key: "role_type", label: "Role Type" },
                            { key: "client_spoc_name", label: "Client SPOC" },
                            { key: "location", label: "Location" },
                            { key: "mode_of_work", label: "Mode of Work" },
                            { key: "years_of_experience", label: "Min Experience" },
                            { key: "max_years_experience", label: "Max Experience" },
                            { key: "notice_period", label: "Notice Period" },
                            { key: "no_of_positions", label: "No. of Positions" },
                            { key: "budget_range", label: "Budget Range" },
                        ] as { key: keyof typeof editFields; label: string }[]).map(({ key, label }) => (
                            <div key={key}>
                                <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>{label}</label>
                                <input
                                    type="text"
                                    value={editFields[key]}
                                    onChange={e => setEditFields(p => p ? { ...p, [key]: e.target.value } : p)}
                                    style={{ width: "100%", padding: "0.45rem 0.65rem", fontSize: 13, border: "1px solid var(--border-subtle)", borderRadius: 4, background: "var(--bg-input)", color: "var(--text-primary)" }}
                                />
                            </div>
                        ))}
                        <div style={{ gridColumn: "1 / -1" }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>Special Instructions</label>
                            <textarea
                                value={editFields.special_instructions}
                                onChange={e => setEditFields(p => p ? { ...p, special_instructions: e.target.value } : p)}
                                rows={4}
                                style={{ width: "100%", padding: "0.45rem 0.65rem", fontSize: 13, border: "1px solid var(--border-subtle)", borderRadius: 4, background: "var(--bg-input)", color: "var(--text-primary)", resize: "vertical", fontFamily: "inherit" }}
                            />
                        </div>
                    </div>
                    {editErr && <div style={{ fontSize: 12, color: "#dc2626", marginTop: "0.5rem" }}>{editErr}</div>}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
                        <button className="btn btn-primary" onClick={handleSaveEdit} disabled={editSaving}>
                            {editSaving ? "Saving…" : "Save Changes"}
                        </button>
                    </div>
                </div>
            )}

            {/* Status funnel — always visible */}
            <div className="stats-row">
                <div className="stat-box">
                    <div className="stat-box-value">{applications.length}</div>
                    <div className="stat-box-label">Total Submissions</div>
                </div>
                <div className="stat-box">
                    <div className="stat-box-value">{statusCounts.SENT}</div>
                    <div className="stat-box-label">Sent</div>
                </div>
                <div className="stat-box">
                    <div className="stat-box-value">{statusCounts.L1 + statusCounts.L2}</div>
                    <div className="stat-box-label">In Progress</div>
                </div>
                <div className="stat-box">
                    <div className="stat-box-value accent">{statusCounts.SELECTED}</div>
                    <div className="stat-box-label">Selected</div>
                </div>
                <div className="stat-box">
                    <div className="stat-box-value">{statusCounts.REJECTED}</div>
                    <div className="stat-box-label">Rejected</div>
                </div>
            </div>



            {/* ── Submissions | Profiles pill (all roles) ── */}
            {(isAdmin || isRecruiter) && (
                <div className="detail-section">
                    <div style={{ marginBottom: "1.25rem" }}>
                        <PillNav
                            tabs={[
                                { key: "submissions", label: "Submissions" },
                                { key: "profiles", label: "Profiles" },
                            ]}
                            active={mainTab}
                            onSelect={(k) => setMainTab(k as "submissions" | "profiles")}
                        />
                    </div>

                    {mainTab === "submissions" && (() => {
                        const profileByCandidate = Object.fromEntries(
                            suggestions.map(p => [String(p.candidate_uuid), p])
                        );
                        const totalSubPages = Math.max(1, Math.ceil(applications.length / SUB_PAGE_SIZE));
                        const clampedSubPage = Math.min(subPage, totalSubPages);
                        const visibleApps = applications.slice((clampedSubPage - 1) * SUB_PAGE_SIZE, clampedSubPage * SUB_PAGE_SIZE);
                        return applications.length === 0 ? (
                            <div className="data-table-wrap">
                                <div className="table-empty">
                                    <div className="table-empty-icon"><Icon name="user" size={48} /></div>
                                    No submissions yet.
                                </div>
                            </div>
                        ) : (
                            <div className="data-table-wrap">
                                <table className="data-table" style={{ tableLayout: "fixed", width: "100%" }}>
                                    <colgroup>
                                        <col style={{ width: isAdmin ? "30%" : "36%" }} />
                                        <col style={{ width: "15%" }} />
                                        <col style={{ width: isAdmin ? "10%" : "11%" }} />
                                        <col style={{ width: "24%" }} />
                                        <col style={{ width: isAdmin ? "21%" : "14%" }} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th style={{ fontSize: 12 }}>Candidate</th>
                                            <th style={{ fontSize: 12 }}>Status</th>
                                            <th style={{ fontSize: 12 }}>AI Score</th>
                                            <th style={{ fontSize: 12 }}>Submitted</th>
                                            <th style={{ fontSize: 12 }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleApps.map((app) => {
                                            const prof = profileByCandidate[String(app.candidate_id)];
                                            const isManual = app.source !== "talent_pool";
                                            return (
                                                <tr
                                                    key={app.id}
                                                    onClick={() => setSelectedSub({ app, prof: prof ?? null })}
                                                    style={{ cursor: "pointer" }}
                                                >
                                                    <td style={{ overflow: "hidden", maxWidth: 0 }}>
                                                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, fontSize: 13 }}>{app.candidate_name || "—"}</div>
                                                        <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                                                            {isManual ? "Manual" : "Pool"}
                                                            {app.recruiter_name && <> · {app.recruiter_name}</>}
                                                        </div>
                                                    </td>
                                                    <td><StatusBadge status={app.status} /></td>
                                                    <td style={{ fontSize: 13 }}>{app.ai_score != null ? <span className="font-mono">{app.ai_score}/100</span> : <span className="text-muted">—</span>}</td>
                                                    <td style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{new Date(app.sent_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</td>
                                                    <td onClick={(e) => e.stopPropagation()}>
                                                        {isAdmin && getNextStatuses(app.status).length > 0 && (
                                                            <button
                                                                className="btn btn-ghost btn-sm"
                                                                onClick={() => { setSelectedApp(app); setNewStatus(""); setRejectionReason(""); setStatusNotes(""); setStatusError(""); }}
                                                            >Update</button>
                                                        )}
                                                        {app.status === "SENT" && String(app.recruiter_id) === String(user?.id) && (
                                                            <button
                                                                className="btn btn-ghost btn-sm"
                                                                style={{ color: "var(--error, #e53e3e)", padding: "2px 8px" }}
                                                                onClick={() => handleRemoveApplication(app)}
                                                            >Remove</button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {totalSubPages > 1 && (
                                    <div style={{ padding: "0.5rem 1rem", borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{applications.length} submissions</span>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                            <button className="btn btn-primary btn-sm" onClick={() => setSubPage(p => Math.max(1, p - 1))} disabled={clampedSubPage <= 1}>‹</button>
                                            <span style={{ fontSize: 13, color: "var(--text-secondary)", minWidth: 60, textAlign: "center" }}>{clampedSubPage} / {totalSubPages}</span>
                                            <button className="btn btn-primary btn-sm" onClick={() => setSubPage(p => Math.min(totalSubPages, p + 1))} disabled={clampedSubPage >= totalSubPages}>›</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* ── Profiles tab ── */}
                    {mainTab === "profiles" && (
                        <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", gap: "0.75rem", flexWrap: "wrap" }}>
                                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                                    {loadingSuggestions ? "Loading…" : `${suggestions.length} profile${suggestions.length === 1 ? "" : "s"}`}
                                    {manualUploadStage && <span style={{ marginLeft: "0.75rem" }}>{manualUploadStage}</span>}
                                    {manualUploadError && <span style={{ marginLeft: "0.75rem", color: "#dc2626" }}>{manualUploadError}</span>}
                                    {suggestionsError && <span style={{ marginLeft: "0.75rem", color: "#dc2626" }}>{suggestionsError}</span>}
                                </div>
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={handleScanTalentPool}
                                        disabled={generatingSuggestions}
                                        title="Run deterministic scoring against the talent pool"
                                    >{generatingSuggestions ? "Scanning…" : "Scan Talent Pool"}</button>
                                    <label className="btn btn-primary btn-sm" style={{ cursor: manualUploading ? "not-allowed" : "pointer", opacity: manualUploading ? 0.6 : 1 }}>
                                        {manualUploading ? "Uploading…" : "Upload Resumes"}
                                        <input
                                            type="file"
                                            multiple
                                            accept=".pdf,.doc,.docx,.txt"
                                            style={{ display: "none" }}
                                            disabled={manualUploading}
                                            onChange={(e) => {
                                                handleUploadResumes(e.target.files);
                                                e.target.value = "";
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>
                            {uploadDuplicates.length > 0 && (
                                <div style={{ marginBottom: "0.75rem", padding: "10px 14px", background: "color-mix(in srgb, #f59e0b 8%, transparent)", border: "1px solid color-mix(in srgb, #f59e0b 30%, transparent)", borderRadius: "8px", fontSize: "13px" }}>
                                    <div style={{ fontWeight: 600, marginBottom: "5px" }}>{uploadDuplicates.length} duplicate{uploadDuplicates.length > 1 ? "s" : ""} skipped — already in this requirement's pool:</div>
                                    <ul style={{ margin: 0, paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "4px" }}>
                                        {uploadDuplicates.map((d, i) => (
                                            <li key={i} style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                                <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{d.filename}</span>
                                                {d.message && <span style={{ color: "var(--text-secondary)" }}>— {d.message}</span>}
                                                {d.candidate_id && (
                                                    <button
                                                        onClick={() => navigate(`/talent-pool/${d.candidate_id}`)}
                                                        style={{ background: "none", border: "1px solid var(--border-subtle)", borderRadius: 4, padding: "1px 8px", fontSize: 11, cursor: "pointer", color: "var(--primary, #2563eb)", fontWeight: 600 }}
                                                    >View in pool →</button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <ProfilesGrid
                                profiles={suggestions}
                                jdId={id!}
                                jobRole={req.job_role ?? req.requirement_name}
                                onSubmit={handleSubmitProfile}
                                onRemove={handleRemoveProfile}
                                currentUserId={user?.id}
                                isAdmin={isAdmin}
                            />
                        </>
                    )}
                </div>
            )}

            {/* Submission detail modal */}
            {selectedSub && (
                <SubmissionDetailModal
                    app={selectedSub.app}
                    prof={selectedSub.prof}
                    isAdmin={isAdmin}
                    onClose={() => setSelectedSub(null)}
                />
            )}

            {/* Status change modal */}
            {selectedApp && (
                <div className="modal-overlay" onClick={() => setSelectedApp(null)}>
                    <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-title">Update Application Status</div>
                        <p className="text-sm text-muted mb-1">
                            Current status: <StatusBadge status={selectedApp.status} />
                        </p>

                        {statusError && <div className="form-error">{statusError}</div>}

                        <div className="form-group" style={{ marginTop: "1rem" }}>
                            <label>New Status</label>
                            <select
                                value={newStatus}
                                onChange={(e) => setNewStatus(e.target.value)}
                                style={{
                                    padding: "0.65rem 0.85rem",
                                    background: "var(--bg-input)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "var(--radius-sm)",
                                    color: "var(--text-primary)",
                                    fontSize: "var(--font-size-base)",
                                }}
                            >
                                <option value="">Select...</option>
                                {getNextStatuses(selectedApp.status).map((s) => (
                                    <option key={s} value={s}>
                                        {STATUS_LABELS[s] ?? s}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {newStatus === "REJECTED" && (
                            <div className="form-group" style={{ marginTop: "0.75rem" }}>
                                <label>Rejection Reason (required)</label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Why is this candidate being rejected?"
                                    style={{
                                        padding: "0.65rem 0.85rem",
                                        background: "var(--bg-input)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: "var(--radius-sm)",
                                        color: "var(--text-primary)",
                                        fontSize: "var(--font-size-base)",
                                        resize: "vertical",
                                        minHeight: "80px",
                                        width: "100%",
                                        fontFamily: "var(--font-family)",
                                    }}
                                />
                            </div>
                        )}

                        {newStatus && newStatus !== "REJECTED" && newStatus !== "SELECTED" && (
                            <div className="form-group" style={{ marginTop: "0.75rem" }}>
                                <label>Notes <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span></label>
                                <textarea
                                    value={statusNotes}
                                    onChange={(e) => setStatusNotes(e.target.value)}
                                    placeholder={`Any notes for this ${STATUS_LABELS[newStatus] ?? newStatus} update...`}
                                    style={{
                                        padding: "0.65rem 0.85rem",
                                        background: "var(--bg-input)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: "var(--radius-sm)",
                                        color: "var(--text-primary)",
                                        fontSize: "var(--font-size-base)",
                                        resize: "vertical",
                                        minHeight: "80px",
                                        width: "100%",
                                        fontFamily: "var(--font-family)",
                                    }}
                                />
                            </div>
                        )}

                        <div className="modal-actions">
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setSelectedApp(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleStatusChange}
                                disabled={!newStatus}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Req Status Modal */}
            {showStatusModal && (
                <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
                    <div className="modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-title">
                            {req?.status === "DELETED" ? "Restore Requirement" : "Update Requirement Status"}
                        </div>

                        <div className="form-group" style={{ marginTop: "1rem" }}>
                            <label>
                                {req?.status === "DELETED" ? "Select New Status (Required)" : "Status"}
                            </label>
                            <select
                                value={newReqStatus}
                                onChange={(e) => setNewReqStatus(e.target.value)}
                                style={{
                                    padding: "0.65rem 0.85rem",
                                    background: "var(--bg-input)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "var(--radius-sm)",
                                    color: "var(--text-primary)",
                                    fontSize: "var(--font-size-base)",
                                }}
                            >
                                <option value="OPEN">OPEN</option>
                                <option value="ON_HOLD">ON HOLD</option>
                                <option value="CLOSED">CLOSED</option>
                                <option value="POSITION_CLOSED">POSITION CLOSED</option>
                                <option value="ARCHIVED">ARCHIVE</option>
                            </select>
                        </div>

                        <div className="modal-actions">
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setShowStatusModal(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={async () => {
                                    try {
                                        const updated = await api.patch(`/requirements/${id}`, { status: newReqStatus });
                                        setReq(updated);
                                        setShowStatusModal(false);
                                        // If restored, maybe show a toast?
                                    } catch (err: any) {
                                        alert(err.message || "Failed to update");
                                    }
                                }}
                            >
                                {req?.status === "DELETED" ? "Confirm Restore" : "Confirm"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {showDeleteConfirm && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="modal-box" style={{ maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-title">Delete Requirement</div>
                        <p className="text-sm" style={{ margin: "0.75rem 0 1.25rem", color: "var(--text-secondary)" }}>
                            Are you sure you want to delete this requirement? It will be moved to the Deleted tab.
                        </p>
                        <div className="modal-actions">
                            <button className="btn btn-ghost" onClick={() => setShowDeleteConfirm(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                style={{ background: "var(--danger, #e53e3e)" }}
                                onClick={() => {
                                    setShowDeleteConfirm(false);
                                    api.patch(`/requirements/${id}`, { status: "DELETED" })
                                        .then(() => navigate("/dashboard"))
                                        .catch((err: any) => alert(err.message || "Failed to delete"));
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
