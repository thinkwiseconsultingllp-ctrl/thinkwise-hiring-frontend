import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE, api, getToken } from "../services/api";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";
import "../styles/pages.css";

type CommentEntry = {
  id: string;
  author_id: string;
  author_name?: string | null;
  text: string;
  created_at: string;
};

type ExperienceEntry = {
  Position?: string;
  Company?: string;
  Years?: string;
  Skills?: string[];
  duration?: string | null;
};

type EducationEntry = {
  Degree?: string;
  University?: string;
  Year?: string;
};

type Candidate = {
  id: string;
  Name?: string | null;
  Email?: string | null;
  PhoneNumber?: string | null;
  LinkedIn?: string | null;
  Skills?: string[] | null;
  Experience?: ExperienceEntry[] | null;
  Education?: EducationEntry[] | null;
  Certifications?: any[] | null;
  PersonalDetails?: Record<string, any> | null;
  resume_filename?: string | null;
  resume_content_type?: string | null;
  resume_updated_at?: string | null;
  created_at: string;
  structured_with_ai?: boolean | null;
  experience_label?: string | null;
  current_ctc?: number | null;
  expected_ctc?: number | null;
  notice_period?: string | null;
  comments?: CommentEntry[] | null;
};

export default function CandidateDetail() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const [resumeBlobUrl, setResumeBlobUrl] = useState<string | null>(null);
  const [resumeContentType, setResumeContentType] = useState<string>("");
  const [deleting, setDeleting] = useState(false);

  // Requirement history
  const [reqHistory, setReqHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Editable fields
  const [currentCtc, setCurrentCtc] = useState<string>("");
  const [expectedCtc, setExpectedCtc] = useState<string>("");
  const [noticePeriod, setNoticePeriod] = useState<string>("");
  const [savingFields, setSavingFields] = useState(false);
  const [fieldsEditing, setFieldsEditing] = useState(false);

  // Comments
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  // Replace resume
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const [replacingResume, setReplacingResume] = useState(false);
  const [replaceMessage, setReplaceMessage] = useState("");

  const fetchResume = async (id: string) => {
    setResumeLoading(true);
    setResumeError("");
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/candidates/${id}/resume`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load resume");
      const blob = await res.blob();
      setResumeContentType(blob.type || "");
      setResumeBlobUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setResumeError(err.message || "Could not load resume");
    } finally {
      setResumeLoading(false);
    }
  };

  useEffect(() => {
    if (!candidateId) return;
    void (async () => {
      try {
        const data = await api.get(`/candidates/${candidateId}`);
        setCandidate(data);
        void fetchResume(candidateId);
      } catch (err: any) {
        setError(err.detail || "Failed to load candidate");
      } finally {
        setLoading(false);
      }
    })();
    setHistoryLoading(true);
    api.get(`/candidates/${candidateId}/requirement-history`)
      .then((data: any[]) => setReqHistory(data || []))
      .catch(() => setReqHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [candidateId]);

  useEffect(() => {
    return () => { if (resumeBlobUrl) URL.revokeObjectURL(resumeBlobUrl); };
  }, [resumeBlobUrl]);

  // Sync editable fields when candidate data loads/updates
  useEffect(() => {
    if (!candidate) return;
    setCurrentCtc(candidate.current_ctc != null ? String(candidate.current_ctc) : "");
    setExpectedCtc(candidate.expected_ctc != null ? String(candidate.expected_ctc) : "");
    setNoticePeriod(candidate.notice_period || "");
    // If data already has values, start in view mode
    const hasData = candidate.current_ctc != null || candidate.expected_ctc != null || !!candidate.notice_period;
    setFieldsEditing(!hasData);
  }, [candidate]);

  const handleSaveFields = async () => {
    if (!candidate) return;
    setSavingFields(true);
    try {
      const payload: any = {
        current_ctc: currentCtc ? parseFloat(currentCtc) : null,
        expected_ctc: expectedCtc ? parseFloat(expectedCtc) : null,
        notice_period: noticePeriod || null,
      };
      const updated = await api.patch(`/candidates/${candidate.id}`, payload);
      setCandidate(updated);
      setFieldsEditing(false);
    } catch (err: any) {
      setError(err.detail || "Failed to update fields");
    } finally {
      setSavingFields(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!candidate) return;
    const text = editingCommentText.trim();
    if (!text) return;
    setSavingComment(true);
    try {
      const updated = await api.patch(`/candidates/${candidate.id}/comments/${commentId}`, { text });
      setCandidate(updated);
      setEditingCommentId(null);
      setEditingCommentText("");
    } catch (err: any) {
      setError(err.detail || "Failed to edit comment");
    } finally {
      setSavingComment(false);
    }
  };

  const handlePostComment = async () => {
    if (!candidate) return;
    const text = newComment.trim();
    if (!text) return;
    setPostingComment(true);
    try {
      const updated = await api.post(`/candidates/${candidate.id}/comments`, { text });
      setCandidate(updated);
      setNewComment("");
    } catch (err: any) {
      setError(err.detail || "Failed to post comment");
    } finally {
      setPostingComment(false);
    }
  };

  const handleReplaceResume = async (file: File) => {
    if (!candidate) return;
    setReplacingResume(true);
    setReplaceMessage("");
    try {
      const formData = new FormData();
      formData.append("resume_file", file);
      const updated = await api.post(`/candidates/${candidate.id}/replace-resume`, formData);
      setCandidate(updated);
      // Re-fetch the resume blob to refresh the iframe
      if (resumeBlobUrl) { URL.revokeObjectURL(resumeBlobUrl); setResumeBlobUrl(null); }
      void fetchResume(candidate.id);
      setReplaceMessage(updated.structured_with_ai === false
        ? "Resume replaced — but AI structuring failed; only raw text was saved."
        : "Resume replaced and re-parsed successfully.");
      setTimeout(() => setReplaceMessage(""), 4000);
    } catch (err: any) {
      setError(err.detail || "Failed to replace resume");
    } finally {
      setReplacingResume(false);
      if (replaceFileRef.current) replaceFileRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!candidate || !isAdmin) return;
    if (!window.confirm(`Delete resume for "${candidate.Name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/candidates/${candidate.id}`);
      navigate("/talent-pool");
    } catch (err: any) {
      setError(err.detail || "Failed to delete candidate");
      setDeleting(false);
    }
  };

  if (loading) return <div className="loading-spinner" style={{ padding: "3rem" }}>Loading candidate...</div>;
  if (error) return <div className="form-error" style={{ margin: "2rem" }}>{error}</div>;
  if (!candidate) return null;

  const experience: ExperienceEntry[] = Array.isArray(candidate.Experience) ? candidate.Experience : [];

  const totalExp = candidate.experience_label;

  const firstRole = experience.length > 0 ? experience[0].Position : null;

  const isPdf = resumeContentType.includes("pdf")
    || (candidate.resume_filename || "").toLowerCase().endsWith(".pdf");

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700 }}>{candidate.Name || "Unknown Candidate"}</h1>
          {firstRole && <div style={{ color: "var(--text-muted)", marginTop: "0.2rem", fontSize: "0.95rem" }}>{firstRole}</div>}
          <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            {candidate.Email && <span className="text-sm text-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Icon name="mail" size={14} /> {candidate.Email}</span>}
            {candidate.PhoneNumber && <span className="text-sm text-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Icon name="user" size={14} /> {candidate.PhoneNumber}</span>}
            {totalExp && (
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 10%, transparent)", padding: "2px 10px", borderRadius: "20px", border: "1px solid color-mix(in srgb, var(--primary) 25%, transparent)" }}>
                {totalExp} exp
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button className="btn btn-ghost" onClick={() => navigate("/talent-pool")}>← Back</button>
          <input
            ref={replaceFileRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleReplaceResume(f); }}
          />
          <button
            className="btn btn-primary"
            onClick={() => replaceFileRef.current?.click()}
            disabled={replacingResume}
          >
            {replacingResume ? "Updating..." : <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Icon name="document" size={16} /> Update Resume</span>}
          </button>
          {resumeBlobUrl && (
            <a className="btn btn-ghost" href={resumeBlobUrl} download={candidate.resume_filename || "resume"}>Download</a>
          )}
          {isAdmin && (
            <button className="btn btn-ghost" onClick={() => void handleDelete()} disabled={deleting} style={{ color: "var(--danger)" }}>
              {deleting ? "Deleting..." : "Delete"}
            </button>
          )}
        </div>
      </div>

      {replaceMessage && (
        <div style={{ marginBottom: "1rem", padding: "0.65rem 0.85rem", background: "rgba(16, 185, 129, 0.10)", border: "1px solid rgba(16, 185, 129, 0.35)", color: "#047857", borderRadius: "6px", fontSize: "var(--font-size-sm)" }}>
          ✓ {replaceMessage}
        </div>
      )}

      {/* Recruiter fields */}
      <section style={{ marginBottom: "2rem", padding: "1rem 1.25rem", background: "var(--bg-card)", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h2 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", margin: 0 }}>Recruiter Notes</h2>
          {!fieldsEditing && (
            <button className="btn btn-ghost btn-sm" style={{ fontSize: "12px", padding: "3px 10px" }} onClick={() => setFieldsEditing(true)}><Icon name="edit" size={14} /> Edit</button>
          )}
        </div>
        {fieldsEditing ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 500, marginBottom: "4px", color: "var(--text-muted)" }}>Current CTC (LPA)</label>
                <input
                  type="number" step="any" min="0" placeholder="e.g. 12.0"
                  value={currentCtc} onChange={(e) => setCurrentCtc(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 500, marginBottom: "4px", color: "var(--text-muted)" }}>Expected CTC (LPA)</label>
                <input
                  type="number" step="any" min="0" placeholder="e.g. 18.0"
                  value={expectedCtc} onChange={(e) => setExpectedCtc(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 500, marginBottom: "4px", color: "var(--text-muted)" }}>Notice Period</label>
                <input
                  type="text" placeholder="e.g. 30 days, Immediate, 2 months"
                  value={noticePeriod} onChange={(e) => setNoticePeriod(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.75rem" }}>
              <button className="btn btn-primary btn-sm" onClick={() => void handleSaveFields()} disabled={savingFields}>
                {savingFields ? "Saving..." : "Save"}
              </button>
              {(candidate.current_ctc != null || candidate.expected_ctc != null || candidate.notice_period) && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setFieldsEditing(false); setCurrentCtc(candidate.current_ctc != null ? String(candidate.current_ctc) : ""); setExpectedCtc(candidate.expected_ctc != null ? String(candidate.expected_ctc) : ""); setNoticePeriod(candidate.notice_period || ""); }}>Cancel</button>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-muted)", marginBottom: "2px" }}>Current CTC</div>
              <div style={{ fontSize: "0.875rem", color: "var(--text-primary)", fontWeight: 600 }}>{candidate.current_ctc != null ? `₹${candidate.current_ctc} LPA` : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-muted)", marginBottom: "2px" }}>Expected CTC</div>
              <div style={{ fontSize: "0.875rem", color: "var(--text-primary)", fontWeight: 600 }}>{candidate.expected_ctc != null ? `₹${candidate.expected_ctc} LPA` : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-muted)", marginBottom: "2px" }}>Notice Period</div>
              <div style={{ fontSize: "0.875rem", color: "var(--text-primary)", fontWeight: 600 }}>{candidate.notice_period || "—"}</div>
            </div>
          </div>
        )}
      </section>

      {/* Requirement history */}
      {(historyLoading || reqHistory.length > 0) && (
        <section style={{ marginBottom: "2rem", padding: "1rem 1.25rem", background: "var(--bg-card)", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
          <h2 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", margin: "0 0 0.75rem" }}>
            Requirement History
            {reqHistory.length > 0 && <span style={{ fontWeight: 500, marginLeft: 6 }}>· {reqHistory.length}</span>}
          </h2>
          {historyLoading ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading…</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {reqHistory.map((h, i) => {
                const statusColor = h.status === "SELECTED" ? "#16a34a"
                  : h.status === "REJECTED" ? "#dc2626"
                  : h.status === "SENT" ? "#2563eb"
                  : h.status ? "#ca8a04"
                  : "var(--text-muted)";
                const STATUS_LABEL: Record<string, string> = {
                  SENT: "Submitted", L1_SELECTED: "L1 Selected", L2_SELECTED: "L2 Selected",
                  L3_SELECTED: "L3 Selected", HR_ROUND: "HR Round", HR_SELECTED: "HR Selected",
                  SELECTED: "Selected", OFFER_RELEASED: "Offer Released", OFFER_ACCEPTED: "Offer Accepted",
                  JOINED: "Joined", REJECTED: "Rejected",
                };
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.55rem 0.75rem", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-subtle)", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                        {h.req_id && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", fontFamily: "monospace" }}>{h.req_id}</span>}
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.requirement_name || "—"}</span>
                        {h.req_status && h.req_status !== "OPEN" && (
                          <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 3, background: "var(--bg-primary)", border: "1px solid var(--border-subtle)", color: "var(--text-muted)" }}>{h.req_status}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {h.in_pool && !h.submitted && <span>In pool</span>}
                        {h.recruiter_name && <span>· {h.recruiter_name}</span>}
                        {h.sent_at && <span>· {new Date(h.sent_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                      {h.det_score != null && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", fontFamily: "monospace" }}>{h.det_score}%</span>
                      )}
                      {h.ai_score != null && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", fontFamily: "monospace" }}>AI {h.ai_score}</span>
                      )}
                      {h.status ? (
                        <span style={{ fontSize: 12, fontWeight: 700, color: statusColor }}>{STATUS_LABEL[h.status] || h.status}</span>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-primary)", border: "1px solid var(--border-subtle)", borderRadius: 4, padding: "1px 7px" }}>Pool</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Candidate details */}
      <div>

        {/* Experience */}
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "0.75rem" }}>Experience</h2>
          {experience.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {experience.map((exp, i) => {
                const yearsStr = exp.Years || "";
                const skills: string[] = Array.isArray(exp.Skills) ? exp.Skills : [];
                return (
                  <div key={i} style={{ padding: "0.9rem 1rem", background: "var(--bg-card)", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          {exp.Position || "Unknown Role"}
                        </div>
                        <div className="text-sm text-muted" style={{ marginTop: "0.15rem" }}>{exp.Company || ""}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        {yearsStr && <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{yearsStr}</div>}
                        {exp.duration && (
                          <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--primary)", marginTop: "2px" }}>{exp.duration}</div>
                        )}
                      </div>
                    </div>
                    {skills.length > 0 && (
                      <div style={{ marginTop: "0.6rem", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {skills.map((s: string, j: number) => (
                          <span key={j} style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "4px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }}>{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted">No experience details available.</p>
          )}
        </section>

        {/* All Skills */}
        {(candidate.Skills || []).length > 0 && (
          <section style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "0.75rem" }}>All Skills</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {(candidate.Skills || []).map((skill: string, i: number) => (
                <span key={i} className="suggestion-chip">{skill}</span>
              ))}
            </div>
          </section>
        )}

        {/* Education */}
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "0.75rem" }}>Education</h2>
          {Array.isArray(candidate.Education) && candidate.Education.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {candidate.Education.map((e, i) => (
                <div key={i} style={{ padding: "0.65rem 1rem", background: "var(--bg-card)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.875rem" }}>{e.Degree || "Degree"}</div>
                  <div className="text-sm text-muted" style={{ marginTop: "0.1rem" }}>
                    {e.University || ""}
                    {e.Year ? ` · ${e.Year}` : ""}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No education details available.</p>
          )}
        </section>

        {/* Certifications */}
        {(candidate.Certifications || []).length > 0 && (
          <section style={{ marginBottom: "2rem" }}>
            <h2 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "0.75rem" }}>Certifications</h2>
            <ul style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              {(candidate.Certifications || []).map((c: any, i: number) => (
                <li key={i} className="text-sm" style={{ listStyleType: "disc" }}>
                  {typeof c === "string" ? c : JSON.stringify(c)}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Comments */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
          Comments {(candidate.comments || []).length > 0 && <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>· {(candidate.comments || []).length}</span>}
        </h2>

        {/* Existing comments */}
        {(candidate.comments || []).length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginBottom: "1rem" }}>
            {(candidate.comments || []).map((c) => (
              <div key={c.id} style={{ padding: "0.75rem 1rem", background: "var(--bg-card)", borderRadius: "8px", border: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.3rem", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>{c.author_name || "Unknown"}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{new Date(c.created_at).toLocaleString()}</span>
                    {editingCommentId !== c.id && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: "11px", padding: "1px 6px", lineHeight: 1.2 }}
                        onClick={() => { setEditingCommentId(c.id); setEditingCommentText(c.text); }}
                      ><Icon name="edit" size={12} /></button>
                    )}
                  </div>
                </div>
                {editingCommentId === c.id ? (
                  <div style={{ marginTop: "0.3rem" }}>
                    <textarea
                      value={editingCommentText}
                      onChange={(e) => setEditingCommentText(e.target.value)}
                      rows={3}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-subtle)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none", resize: "vertical", fontFamily: "inherit" }}
                    />
                    <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem" }}>
                      <button className="btn btn-primary btn-sm" onClick={() => void handleEditComment(c.id)} disabled={savingComment || !editingCommentText.trim()}>
                        {savingComment ? "Saving..." : "Save"}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditingCommentId(null); setEditingCommentText(""); }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm" style={{ whiteSpace: "pre-wrap", color: "var(--text-secondary)" }}>{c.text}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* New comment input */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <textarea
            placeholder="Add a comment about this candidate (e.g. interview feedback, screening notes)..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
            style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-subtle)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: "0.875rem", outline: "none", resize: "vertical", fontFamily: "inherit" }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-primary btn-sm" onClick={() => void handlePostComment()} disabled={postingComment || !newComment.trim()}>
              {postingComment ? "Posting..." : "Post Comment"}
            </button>
          </div>
        </div>
      </section>

      {/* ── Resume viewer (below) ── */}
      <div style={{ marginTop: "1rem" }}>
        <h2 style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
          Resume{candidate.resume_filename ? ` · ${candidate.resume_filename}` : ""}
        </h2>
        <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "10px", overflow: "hidden", background: "var(--bg-card)", minHeight: "200px" }}>
          {resumeLoading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading resume...</div>
          ) : resumeError ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--danger)", fontSize: "0.875rem" }}>{resumeError}</div>
          ) : resumeBlobUrl ? (
            isPdf ? (
              <iframe
                title="Resume"
                src={resumeBlobUrl}
                style={{ width: "100%", height: "80vh", minHeight: "600px", border: "none", display: "block" }}
              />
            ) : (
              <div style={{ padding: "2rem", textAlign: "center" }}>
                <div style={{ marginBottom: "0.75rem", color: "var(--text-muted)" }}><Icon name="document" size={48} /></div>
                <p className="text-sm text-muted" style={{ marginBottom: "1rem" }}>Inline preview only supports PDF files.</p>
                <a className="btn btn-ghost" href={resumeBlobUrl} download={candidate.resume_filename || "resume"}>Download to View</a>
              </div>
            )
          ) : (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>No resume file available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
