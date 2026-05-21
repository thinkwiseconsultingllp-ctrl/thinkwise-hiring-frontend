import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
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
}

export default function RequirementDetail() {
    const { id } = useParams<{ id: string }>();
    const { user, isAdmin, isRecruiter } = useAuth();
    const navigate = useNavigate();
    const { openJd, activeReq: jdActiveReq } = useJdViewer();
    const [req, setReq] = useState<Requirement | null>(null);
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);
    const [_showJd, _setShowJd] = useState(false);

    // Status change modal
    const [selectedApp, setSelectedApp] = useState<Application | null>(null);
    const [newStatus, setNewStatus] = useState("");
    const [rejectionReason, setRejectionReason] = useState("");
    const [statusNotes, setStatusNotes] = useState("");
    const [statusError, setStatusError] = useState("");
    const [commentsApp, setCommentsApp] = useState<Application | null>(null);

    // Req Status Update
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showAssignDrawer, setShowAssignDrawer] = useState(false);
    const [showRequestDialog, setShowRequestDialog] = useState(false);
    const [pendingRequestForThisReq, setPendingRequestForThisReq] = useState<boolean>(false);
    const [newReqStatus, setNewReqStatus] = useState("");

    // Profiles list (replaces old recommended/manual split)
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [generatingSuggestions, setGeneratingSuggestions] = useState(false);
    const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

    // Resume upload state (multi-file)
    const [manualUploading, setManualUploading] = useState(false);
    const [manualUploadStage, setManualUploadStage] = useState<string>("");
    const [manualUploadError, setManualUploadError] = useState<string | null>(null);

    const [mainTab, setMainTab] = useState<"submissions" | "profiles">("submissions");

    const refreshApplications = async () => {
        if (!id) return;
        try {
            const appData = await api.get(`/applications?requirement_id=${id}`);
            setApplications(appData || []);
        } catch (err) {
            console.error("Failed to load applications:", err);
        }
    };

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        Promise.all([
            api.get(`/requirements/${id}`),
            api.get(`/applications?requirement_id=${id}`),
        ])
            .then(([reqData, appData]) => {
                setReq(reqData);
                const apps = appData || [];
                setApplications(apps);
                if (apps.length === 0) setMainTab("profiles");
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [id]);

    // Keep the open JD panel in sync if it's showing this requirement
    useEffect(() => {
        if (req && jdActiveReq && jdActiveReq.id === req.id) {
            openJd(req as any);
        }
    }, [req, jdActiveReq, openJd]);

    // Unified profile fetch — replaces the old recommendations + manual split.
    const fetchProfiles = async () => {
        if (!id) return;
        setLoadingSuggestions(true);
        try {
            const result = await api.get(`/requirements/${id}/profiles`);
            setSuggestions(result?.profiles || []);
        } catch (err: any) {
            console.error("Failed to load profiles:", err);
            setSuggestions([]);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    useEffect(() => { void fetchProfiles(); }, [id]);

    useEffect(() => {
        const handleProfileUpdate = (e: any) => {
            const { profile: updatedProfile, jdId } = e.detail;
            if (jdId !== id) return;
            setSuggestions(prev => {
                const arr = prev || [];
                return arr.map(p => p.candidate_uuid === updatedProfile.candidate_uuid ? updatedProfile : p);
            });
            void refreshApplications();
        };
        window.addEventListener("tw-profile-updated", handleProfileUpdate as EventListener);
        return () => window.removeEventListener("tw-profile-updated", handleProfileUpdate as EventListener);
    }, [id]);

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

    const [rescoring, setRescoring] = useState(false);
    const handleRescoreAll = async () => {
        if (!id || rescoring) return;
        setRescoring(true);
        setSuggestionsError(null);
        try {
            const result = await api.post(`/requirements/${id}/profiles/rescore-all`, {});
            await fetchProfiles();
            const msg = `Rescored ${result.rescored} profiles${result.removed > 0 ? `, removed ${result.removed} poor matches` : ""}`;
            setSuggestionsError(msg);
            setTimeout(() => setSuggestionsError(null), 4000);
        } catch (err: any) {
            setSuggestionsError(err?.detail || err?.message || "Rescore failed");
        } finally {
            setRescoring(false);
        }
    };

    // Unified resume upload — multi-file, non-gated. Each file goes through
    // /profiles/upload which stores in talent pool + scores against this req + upserts a profile row.
    const handleUploadResumes = async (files: FileList | null) => {
        if (!id || !files || files.length === 0) return;
        setManualUploading(true);
        setManualUploadError(null);
        setManualUploadStage(`Uploading ${files.length} file${files.length > 1 ? "s" : ""}…`);
        try {
            const form = new FormData();
            Array.from(files).forEach(f => form.append("resume_files", f));
            const result = await api.post(`/requirements/${id}/profiles/upload`, form);
            setManualUploadStage(`Uploaded ${result.uploaded}, failed ${result.failed}`);
            await fetchProfiles();
        } catch (err: any) {
            setManualUploadError(err?.detail || err?.message || "Upload failed");
        } finally {
            setTimeout(() => {
                setManualUploading(false);
                setManualUploadStage("");
            }, 1500);
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
            setSuggestions((prev) =>
                prev.map((p) =>
                    p.candidate_uuid === updated.candidate_id
                        ? { ...p, application_status: updated.status }
                        : p
                )
            );
            setSelectedApp(null);
            setNewStatus("");
            setRejectionReason("");
            setStatusNotes("");
        } catch (err: any) {
            setStatusError(err.detail || "Failed to update status");
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
            <div className="detail-header">
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                        <span className="font-mono text-accent" style={{ fontSize: "var(--font-size-sm)" }}>
                            {req.req_id}
                        </span>
                        <StatusBadge status={req.status} />
                    </div>
                    <h1 className="detail-title" style={{ marginTop: "0.25rem" }}>
                        {req.requirement_name}
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
                    {isRecruiter && !isAdmin && (
                        <button
                            className="btn btn-primary"
                            onClick={() => navigate(`/requirements/${id}/submit`)}
                        >
                            + Submit Profile
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
                            className="btn btn-ghost"
                            onClick={() => navigate(`/tracker/${id}`)}
                        >
                            <Icon name="chart" size={14} style={{ marginRight: 6, verticalAlign: "-2px" }} />
                            Tracker
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



            {/* ── Recruiter: Submissions | Profiles pill ── */}
            {!isAdmin && isRecruiter && (
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
                        return applications.length === 0 ? (
                            <div className="data-table-wrap">
                                <div className="table-empty">
                                    <div className="table-empty-icon"><Icon name="user" size={48} /></div>
                                    No submissions yet.{" "}
                                    <a onClick={() => navigate(`/requirements/${id}/submit`)} style={{ cursor: "pointer" }}>Submit a profile</a>
                                </div>
                            </div>
                        ) : (
                            <div className="data-table-wrap">
                                <table className="data-table" style={{ tableLayout: "fixed", width: "100%" }}>
                                    <colgroup>
                                        <col style={{ width: "26%" }} />
                                        <col style={{ width: "13%" }} />
                                        <col style={{ width: "10%" }} />
                                        <col style={{ width: "24%" }} />
                                        <col style={{ width: "14%" }} />
                                        <col style={{ width: "13%" }} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th>Candidate</th>
                                            <th>Status</th>
                                            <th>AI Score</th>
                                            <th>Comments</th>
                                            <th>Submitted</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {applications.map((app) => {
                                            const prof = profileByCandidate[String(app.candidate_id)];
                                            const isManual = app.source !== "talent_pool";
                                            const uploadedBy = prof?.uploaded_by_name || prof?.recruiter_name;
                                            const updatedBy = prof?.uploaded_by_name && prof?.recruiter_name !== prof?.uploaded_by_name
                                                ? prof.recruiter_name : null;
                                            return (
                                                <tr
                                                    key={app.id}
                                                    onClick={() => setCommentsApp(app)}
                                                    style={{ cursor: "pointer", transition: "background 0.2s" }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-secondary)"}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = ""}
                                                >
                                                    <td style={{ wordBreak: "break-word" }}>
                                                        <strong>{app.candidate_name || "—"}</strong>
                                                        {isManual && uploadedBy && (
                                                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                                                                Uploaded by {uploadedBy}
                                                                {updatedBy && <span> · Updated by {updatedBy}</span>}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td><StatusBadge status={app.status} /></td>
                                                    <td>{app.ai_score != null ? <span className="font-mono">{app.ai_score}/100</span> : <span className="text-muted">—</span>}</td>
                                                    <td className="text-sm">
                                                        {(app.recruiter_comments || app.rejection_reason)
                                                            ? <span style={{ fontSize: "12px", color: "var(--accent)", textDecoration: "underline" }}>View</span>
                                                            : <span className="text-muted">—</span>}
                                                    </td>
                                                    <td className="text-muted text-sm">{new Date(app.sent_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</td>
                                                    <td>
                                                        {app.status === "SENT" && (
                                                            <button
                                                                className="btn btn-ghost btn-sm"
                                                                style={{ color: "var(--error, #e53e3e)", padding: "2px 8px" }}
                                                                onClick={(e) => { e.stopPropagation(); handleRemoveApplication(app); }}
                                                            >Remove</button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })()}

                    {/* ── Profiles tab ── */}
                    {mainTab === "profiles" && (
                        <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", gap: "0.75rem", flexWrap: "wrap" }}>
                                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                                    {loadingSuggestions ? "Loading…" : `${suggestions.length} profile${suggestions.length === 1 ? "" : "s"}`}
                                    {manualUploading && manualUploadStage && <span style={{ marginLeft: "0.75rem" }}>{manualUploadStage}</span>}
                                    {manualUploadError && <span style={{ marginLeft: "0.75rem", color: "#dc2626" }}>{manualUploadError}</span>}
                                    {suggestionsError && <span style={{ marginLeft: "0.75rem", color: "#dc2626" }}>{suggestionsError}</span>}
                                </div>
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={handleRescoreAll}
                                        disabled={rescoring || suggestions.length === 0}
                                        title="Rescore all existing profiles with the current scoring logic"
                                    >{rescoring ? "Rescoring…" : "Rescore All"}</button>
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
                            <ProfilesGrid
                                profiles={suggestions}
                                jdId={id!}
                                jobRole={req.job_role ?? req.requirement_name}
                                onSubmit={handleSubmitProfile}
                            />
                        </>
                    )}
                </div>
            )}

            {/* ── Admin: unified submissions ── */}
            {isAdmin && (() => {
                const profileByCandidate = Object.fromEntries(
                    suggestions.map(p => [String(p.candidate_uuid), p])
                );
                return (
                    <div className="detail-section">
                        <div className="detail-section-title">Submissions</div>
                        {applications.length === 0 ? (
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
                                        <col style={{ width: "24%" }} />
                                        <col style={{ width: "13%" }} />
                                        <col style={{ width: "10%" }} />
                                        <col style={{ width: "25%" }} />
                                        <col style={{ width: "14%" }} />
                                        <col style={{ width: "14%" }} />
                                    </colgroup>
                                    <thead>
                                        <tr>
                                            <th>Candidate</th>
                                            <th>Status</th>
                                            <th>AI Score</th>
                                            <th>Comments</th>
                                            <th>Submitted</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {applications.map((app) => {
                                            const prof = profileByCandidate[String(app.candidate_id)];
                                            const isManual = app.source !== "talent_pool";
                                            const uploadedBy = prof?.uploaded_by_name || prof?.recruiter_name;
                                            const updatedBy = prof?.uploaded_by_name && prof?.recruiter_name !== prof?.uploaded_by_name
                                                ? prof.recruiter_name : null;
                                            return (
                                                <tr
                                                    key={app.id}
                                                    onClick={() => setCommentsApp(app)}
                                                    style={{ cursor: "pointer", transition: "background 0.2s" }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-secondary)"}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = ""}
                                                >
                                                    <td style={{ wordBreak: "break-word" }}>
                                                        <strong>{app.candidate_name || "—"}</strong>
                                                        {isManual && uploadedBy && (
                                                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                                                                Uploaded by {uploadedBy}
                                                                {updatedBy && <span> · Updated by {updatedBy}</span>}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td><StatusBadge status={app.status} /></td>
                                                    <td>{app.ai_score != null ? <span className="font-mono">{app.ai_score}/100</span> : <span className="text-muted">—</span>}</td>
                                                    <td className="text-sm">
                                                        {(app.recruiter_comments || app.rejection_reason)
                                                            ? <span style={{ fontSize: "12px", color: "var(--accent)", textDecoration: "underline" }}>View</span>
                                                            : <span className="text-muted">—</span>}
                                                    </td>
                                                    <td className="text-muted text-sm">{new Date(app.sent_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</td>
                                                    <td>
                                                        {getNextStatuses(app.status).length > 0 && (
                                                            <button
                                                                className="btn btn-ghost btn-sm"
                                                                onClick={(e) => { e.stopPropagation(); setSelectedApp(app); setNewStatus(""); setRejectionReason(""); setStatusNotes(""); setStatusError(""); }}
                                                            >Update</button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Comments popup */}
            {commentsApp && (
                <div className="modal-overlay" onClick={() => setCommentsApp(null)}>
                    <div className="modal-box" style={{ maxWidth: "460px" }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-title">Comments — {commentsApp.candidate_name || "Candidate"}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0.5rem 0 1rem" }}>
                            <StatusBadge status={commentsApp.status} />
                        </div>
                        {commentsApp.recruiter_comments && (
                            <div style={{ marginBottom: "1rem" }}>
                                <div className="text-sm" style={{ fontWeight: 600, marginBottom: "0.3rem", color: "var(--text-secondary)" }}>Recruiter Comments</div>
                                <p className="text-sm" style={{ whiteSpace: "pre-wrap", color: "var(--text-primary)", margin: 0 }}>{commentsApp.recruiter_comments}</p>
                            </div>
                        )}
                        {commentsApp.rejection_reason && (
                            <div>
                                <div className="text-sm" style={{ fontWeight: 600, marginBottom: "0.3rem", color: "var(--text-secondary)" }}>Rejection Reason</div>
                                <p className="text-sm" style={{ whiteSpace: "pre-wrap", color: "var(--text-primary)", margin: 0 }}>- {commentsApp.rejection_reason}</p>
                            </div>
                        )}
                        {(!commentsApp.recruiter_comments && !commentsApp.rejection_reason) && (
                            <div className="text-sm text-muted" style={{ textAlign: "center", margin: "1rem 0" }}>
                                No review details submitted for this candidate yet.
                            </div>
                        )}
                        <div className="modal-actions" style={{ marginTop: "1.25rem" }}>
                            <button className="btn btn-primary" onClick={() => setCommentsApp(null)}>Close</button>
                        </div>
                    </div>
                </div>
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
