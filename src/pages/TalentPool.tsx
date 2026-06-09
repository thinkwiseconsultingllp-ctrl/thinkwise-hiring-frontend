import { useEffect, useMemo, useRef, useState } from "react";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import Icon from "../components/Icon";
import { parseBooleanQuery, matchesQuery } from "../utils/booleanSearch";
import "../styles/pages.css";
import { toUtcDate, fmtDate, fmtTs } from "../utils/dateUtils";

type Requirement = { id: string; req_id: string; requirement_name: string; assigned_recruiters?: string[] };

function parseExpYears(label?: string | null): number | null {
  if (!label) return null;
  let years = 0;
  const yMatch = label.match(/(\d+)\s*yr/i);
  if (yMatch) years += parseInt(yMatch[1]);
  const mMatch = label.match(/(\d+)\s*mo/i);
  if (mMatch) years += parseInt(mMatch[1]) / 12;
  return years > 0 ? years : null;
}

type Candidate = {
  id: string;
  Name?: string | null;
  Email?: string | null;
  PhoneNumber?: string | null;
  Skills?: string[] | null;
  Experience?: Array<{ Position?: string; Company?: string; Years?: string }> | null;
  experience_label?: string | null;
  resume_filename?: string | null;
  resume_updated_at?: string | null;
  created_at: string;
  structured_with_ai?: boolean | null;
  uploaded_by_name?: string;
};

function getDisplayRole(c: Candidate): string | null {
  if (Array.isArray(c.Experience) && c.Experience.length > 0) {
    return c.Experience[0].Position || null;
  }
  return null;
}

export default function TalentPool() {
  useDocumentTitle("Talent Pool");
  const { isAdmin, isRecruiter, user } = useAuth();
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [skillsInput, setSkillsInput] = useState(() => searchParams.get("skills") || "");
  const [roleInput, setRoleInput] = useState(() => searchParams.get("role") || "");
  const [expMin, setExpMin] = useState(() => searchParams.get("expMin") || "");
  const [expMax, setExpMax] = useState(() => searchParams.get("expMax") || "");

  // Keep URL in sync whenever filters change (replace so back-button isn't spammed).
  useEffect(() => {
    const p = new URLSearchParams();
    if (skillsInput) p.set("skills", skillsInput);
    if (roleInput) p.set("role", roleInput);
    if (expMin) p.set("expMin", expMin);
    if (expMax) p.set("expMax", expMax);
    setSearchParams(p, { replace: true });
  }, [skillsInput, roleInput, expMin, expMax]); // eslint-disable-line react-hooks/exhaustive-deps
  type DuplicateDetail = { filename: string; message: string; candidate_id?: string };
  const [skippedFiles, setSkippedFiles] = useState<DuplicateDetail[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Send to requirement
  const [sendModal, setSendModal] = useState(false);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [sendReqId, setSendReqId] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  // Comments modal
  type CommentEntry = { comment: string; date: string; author_name?: string; requirement_name?: string; requirement_uuid?: string };
  type ProfileRef = { requirement_uuid: string; requirement_name: string; req_id?: string };
  const [commentsCandidate, setCommentsCandidate] = useState<Candidate | null>(null);
  const [commentsList, setCommentsList] = useState<CommentEntry[]>([]);
  const [commentProfiles, setCommentProfiles] = useState<ProfileRef[]>([]);
  const [commentReqId, setCommentReqId] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [commentErr, setCommentErr] = useState<string | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);

  const loadCandidates = async () => {
    try {
      const data = await api.get("/candidates");
      setCandidates(data || []);
    } catch {
      // silent refresh during upload
    }
  };

  const refreshAll = async () => {
    setError("");
    setNotice("");
    setLoading(true);
    const timeout = setTimeout(() => setLoading(false), 8000);
    try {
      const data = await api.get("/candidates");
      setCandidates(data || []);
    } catch (err: any) {
      setError(err.detail || "Failed to load talent pool");
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  useEffect(() => { void refreshAll(); }, []);

  useEffect(() => {
    setSelectedCandidateIds((prev) => prev.filter((id) => candidates.some((c) => c.id === id)));
  }, [candidates]);

  const handleBulkUpload = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const files = selectedFiles;
    if (!files || files.length === 0) { setError("Please select at least one file to upload."); return; }

    setUploading(true);
    setError("");
    setNotice("");
    setSkippedFiles([]);

    let createdCount = 0, duplicateCount = 0, failedCount = 0, aiFailedCount = 0;
    const skipped: DuplicateDetail[] = [];
    const failedDetails: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress({ current: i + 1, total: files.length, fileName: file.name });
      try {
        const formData = new FormData();
        formData.append("resume_files", file);
        const res = await api.post("/candidates/bulk-upload", formData);
        createdCount += res.created_count || 0;
        duplicateCount += res.duplicate_count || 0;
        failedCount += res.failed_count || 0;
        aiFailedCount += res.ai_failed_count || 0;
        if (res.items) {
          for (const item of res.items) {
            if (item.status === "duplicate") skipped.push({ filename: item.filename, message: item.message || "", candidate_id: item.candidate_id ? String(item.candidate_id) : undefined });
            if (item.status === "failed") failedDetails.push(`${item.filename}: ${item.message || "unknown error"}`);
          }
        }
        if (res.created_count > 0) await loadCandidates();
      } catch (err: any) {
        failedCount += 1;
        failedDetails.push(`${file.name}: ${err?.detail || err?.message || "upload failed"}`);
      }
    }
    setSkippedFiles(skipped);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSelectedFiles(null);
    setUploadProgress(null);
    setUploading(false);

    const parts = [];
    if (createdCount) parts.push(`${createdCount} uploaded`);
    if (aiFailedCount) parts.push(`${aiFailedCount} saved as raw text only (AI structuring failed)`);
    if (duplicateCount) parts.push(`${duplicateCount} duplicate${duplicateCount > 1 ? "s" : ""} skipped`);
    if (failedCount) parts.push(`${failedCount} failed`);
    setNotice(parts.join(", ") || "Upload complete.");
    if (failedDetails.length) setError(failedDetails.slice(0, 5).join(" • "));
  };

  const toggleCandidateSelection = (id: string) => {
    setSelectedCandidateIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleSelectAllCandidates = () => {
    if (filteredCandidates.every((c) => selectedIdSet.has(c.id))) {
      setSelectedCandidateIds((prev) => prev.filter((id) => !filteredCandidates.some((c) => c.id === id)));
      return;
    }
    setSelectedCandidateIds((prev) => Array.from(new Set([...prev, ...filteredCandidates.map((c) => c.id)])));
  };

  const handleDeleteCandidate = async (candidate: Candidate) => {
    if (!isAdmin) return;
    setConfirmDialog({
      message: `Delete resume for "${candidate.Name || "this candidate"}"? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        setDeleting(true);
        setError("");
        setNotice("");
        try {
          const result = await api.delete(`/candidates/${candidate.id}`);
          setSelectedCandidateIds((prev) => prev.filter((id) => id !== candidate.id));
          setNotice(result?.message || "Candidate deleted successfully");
          await loadCandidates();
        } catch (err: any) {
          setError(err.detail || "Failed to delete candidate");
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  const handleDeleteSelectedCandidates = async () => {
    if (!isAdmin || !selectedCandidateIds.length) return;
    setConfirmDialog({
      message: `Delete ${selectedCandidateIds.length} selected resume${selectedCandidateIds.length > 1 ? "s" : ""}? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        setDeleting(true);
        setError("");
        setNotice("");
        try {
          const result = await api.post("/candidates/bulk-delete", { candidate_ids: selectedCandidateIds });
          const notFoundCount = (result?.not_found_ids || []).length;
          setNotice(`${result?.message || "Bulk delete completed"}${notFoundCount ? ` (${notFoundCount} already removed)` : ""}`);
          setSelectedCandidateIds([]);
          await loadCandidates();
        } catch (err: any) {
          setError(err.detail || "Failed to delete selected candidates");
        } finally {
          setDeleting(false);
        }
      },
    });
  };


  const openCommentsModal = async (candidate: Candidate) => {
    setCommentsCandidate(candidate);
    setCommentDraft("");
    setCommentErr(null);
    setCommentReqId("talent_pool");
    setCommentsList([]);
    setCommentProfiles([]);
    setLoadingComments(true);
    try {
      const data = await api.get(`/candidates/${candidate.id}/profile-comments`);
      setCommentsList(data.comments || []);
      setCommentProfiles(data.profiles || []);
      if ((data.profiles || []).length === 1) setCommentReqId(data.profiles[0].requirement_uuid);
    } catch {
      setCommentsList([]);
      setCommentProfiles([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentsCandidate || !commentDraft.trim()) return;
    setPostingComment(true);
    setCommentErr(null);
    try {
      if (commentReqId && commentReqId !== "talent_pool") {
        await api.post(`/requirements/${commentReqId}/profiles/${commentsCandidate.id}/comments`, {
          comment: commentDraft.trim(),
        });
      } else {
        await api.post(`/candidates/${commentsCandidate.id}/profile-comments`, {
          comment: commentDraft.trim(),
        });
      }
      setCommentDraft("");
      const data = await api.get(`/candidates/${commentsCandidate.id}/profile-comments`);
      setCommentsList(data.comments || []);
      setCommentProfiles(data.profiles || []);
    } catch (e: any) {
      setCommentErr(e?.detail || e?.message || "Failed to post comment");
    } finally {
      setPostingComment(false);
    }
  };

  const openSendModal = async () => {
    setSendResult(null);
    setSendReqId("");
    try {
      const reqs: Requirement[] = await api.get("/requirements");
      const mine = isAdmin
        ? reqs.filter(r => !["DELETED", "CLOSED"].includes((r as any).status))
        : reqs.filter(r =>
          !["DELETED", "CLOSED"].includes((r as any).status) &&
          (r.assigned_recruiters || []).includes(user?.id || "")
        );
      setRequirements(mine);
    } catch {
      setRequirements([]);
    }
    setSendModal(true);
  };

  const handleSendToRequirement = async () => {
    if (!sendReqId || !selectedCandidateIds.length) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await api.post(`/requirements/${sendReqId}/profiles/add-from-pool`, {
        candidate_ids: selectedCandidateIds,
      });
      setSendResult(`${res.added} of ${res.total} profile${res.total !== 1 ? "s" : ""} added to the Profiles tab successfully.`);
      setSelectedCandidateIds([]);
      setTimeout(() => setSendModal(false), 1800);
    } catch (err: any) {
      setSendResult(`Error: ${err?.detail || err?.message || "Send failed"}`);
    } finally {
      setSending(false);
    }
  };

  const skillsNode = useMemo(() => {
    if (!skillsInput.trim()) return null;
    const parts = skillsInput.split(",").map(p => p.trim()).filter(Boolean);
    if (!parts.length) return null;
    return parseBooleanQuery(parts.join(" OR "));
  }, [skillsInput]);

  const filteredCandidates = useMemo(() => {
    let list = candidates;
    if (skillsNode) {
      list = list.filter((c) => {
        const text = (c.Skills ?? []).join(" ").toLowerCase();
        return matchesQuery(skillsNode, text);
      });
    }
    if (roleInput.trim()) {
      const roleLower = roleInput.trim().toLowerCase();
      list = list.filter((c) => {
        const role = getDisplayRole(c);
        return role ? role.toLowerCase().includes(roleLower) : false;
      });
    }
    if (expMin || expMax) {
      const min = expMin ? parseFloat(expMin) : null;
      const max = expMax ? parseFloat(expMax) : null;
      list = list.filter((c) => {
        const exp = parseExpYears(c.experience_label);
        if (exp === null) return false;
        if (min !== null && exp < min) return false;
        if (max !== null && exp > max) return false;
        return true;
      });
    }
    return list;
  }, [candidates, skillsNode, roleInput, expMin, expMax]);

  const selectedIdSet = useMemo(() => new Set(selectedCandidateIds), [selectedCandidateIds]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Talent Pool</h1>
          <p className="page-header-sub">
            {candidates.length} profile{candidates.length !== 1 ? "s" : ""}
            {(skillsInput || roleInput || expMin || expMax) && ` · ${filteredCandidates.length} shown`}
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => void refreshAll()}>Refresh</button>
      </div>

      {/* Structured search bar */}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", flexWrap: "wrap", marginBottom: "1.25rem", padding: "0.75rem 1rem", background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "10px" }}>
        {/* Skills */}
        <div style={{ flex: "2 1 220px", minWidth: 180 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Skills / Keywords</label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", height: 34, border: "1px solid var(--border-subtle)", borderRadius: "6px", background: "var(--bg-input)", padding: "0 0.6rem" }}>
            <Icon name="search" size={13} />
            <input
              type="text"
              value={skillsInput}
              onChange={e => setSkillsInput(e.target.value)}
              placeholder="Java, React, AWS"
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, color: "var(--text-primary)", width: "100%", height: "100%" }}
            />
            {skillsInput && <button onClick={() => setSkillsInput("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: 0, lineHeight: 1, fontSize: 16, flexShrink: 0 }}>×</button>}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: "0.25rem", lineHeight: 1.4 }}>Comma = OR &nbsp;·&nbsp; Space = AND</div>
        </div>

        {/* Role */}
        <div style={{ flex: "2 1 180px", minWidth: 150 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Role / Designation</label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", height: 34, border: "1px solid var(--border-subtle)", borderRadius: "6px", background: "var(--bg-input)", padding: "0 0.6rem" }}>
            <input
              type="text"
              value={roleInput}
              onChange={e => setRoleInput(e.target.value)}
              placeholder="e.g. Full Stack Developer"
              style={{ border: "none", outline: "none", background: "transparent", fontSize: 13, color: "var(--text-primary)", width: "100%", height: "100%" }}
            />
            {roleInput && <button onClick={() => setRoleInput("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: 0, lineHeight: 1, fontSize: 16, flexShrink: 0 }}>×</button>}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: "0.25rem", lineHeight: 1.4 }}>Partial match on job title</div>
        </div>

        {/* Experience */}
        <div style={{ flex: "1 1 160px", minWidth: 140 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Experience (yrs)</label>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", height: 34 }}>
            <input
              type="number"
              value={expMin}
              onChange={e => setExpMin(e.target.value)}
              placeholder="Min"
              min={0}
              style={{ width: "62px", height: "100%", padding: "0 0.5rem", border: "1px solid var(--border-subtle)", borderRadius: "6px", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
            <span style={{ color: "var(--text-secondary)", fontSize: 12, flexShrink: 0 }}>to</span>
            <input
              type="number"
              value={expMax}
              onChange={e => setExpMax(e.target.value)}
              placeholder="Max"
              min={0}
              style={{ width: "62px", height: "100%", padding: "0 0.5rem", border: "1px solid var(--border-subtle)", borderRadius: "6px", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: "0.25rem", lineHeight: 1.4 }}>Total years of experience</div>
        </div>

        {/* Clear button — vertically aligned with inputs */}
        <div style={{ flex: "0 0 auto", paddingTop: "1.4rem" }}>
          {(skillsInput || roleInput || expMin || expMax) ? (
            <button
              className="btn btn-ghost btn-sm"
              style={{ height: 34, whiteSpace: "nowrap" }}
              onClick={() => { setSkillsInput(""); setRoleInput(""); setExpMin(""); setExpMax(""); setSearchParams({}, { replace: true }); }}
            >Clear filters</button>
          ) : (
            <div style={{ height: 34 }} />
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div className="card-title" style={{ marginBottom: "0.75rem" }}>Bulk Resume Upload</div>
          <form onSubmit={handleBulkUpload}>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt" style={{ display: "none" }} onChange={(e) => setSelectedFiles(e.target.files)} />
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              style={{ border: "2px dashed var(--border-subtle)", borderRadius: "10px", padding: "1.5rem", textAlign: "center", cursor: uploading ? "default" : "pointer", background: "var(--bg-secondary)", transition: "border-color 0.2s" }}
              onMouseEnter={(e) => { if (!uploading) (e.currentTarget as HTMLDivElement).style.borderColor = "var(--primary)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-subtle)"; }}
            >
              {selectedFiles && selectedFiles.length > 0 ? (
                <div>
                  <div style={{ marginBottom: "0.3rem", color: "var(--text-secondary)" }}><Icon name="document" size={32} /></div>
                  <div style={{ fontWeight: 600 }}>{selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""} selected</div>
                  <div className="text-muted text-sm" style={{ marginTop: "0.2rem" }}>
                    {Array.from(selectedFiles).map(f => f.name).join(", ").slice(0, 80)}{Array.from(selectedFiles).map(f => f.name).join(", ").length > 80 ? "…" : ""}
                  </div>
                  {!uploading && <div className="text-sm" style={{ marginTop: "0.4rem", color: "var(--primary)" }}>Click to change</div>}
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: "0.3rem", color: "var(--text-secondary)" }}><Icon name="document" size={32} /></div>
                  <div style={{ fontWeight: 600 }}>Click to choose files</div>
                  <div className="text-muted text-sm" style={{ marginTop: "0.2rem" }}>PDF, Word, or TXT — multiple files supported</div>
                </div>
              )}
            </div>

            {uploadProgress && (
              <div style={{ marginTop: "0.75rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.3rem" }}>
                  <span>Processing: <em>{uploadProgress.fileName}</em></span>
                  <span>{uploadProgress.current} / {uploadProgress.total}</span>
                </div>
                <div style={{ height: "6px", background: "var(--border-subtle)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(uploadProgress.current / uploadProgress.total) * 100}%`, background: "var(--primary)", borderRadius: "4px", transition: "width 0.3s ease" }} />
                </div>
              </div>
            )}

            {selectedFiles && selectedFiles.length > 0 && !uploading && (
              <button type="submit" className="btn btn-primary" style={{ marginTop: "0.75rem", width: "100%" }}>
                Upload {selectedFiles.length} Resume{selectedFiles.length > 1 ? "s" : ""}
              </button>
            )}
            {uploading && <button type="button" className="btn btn-primary" disabled style={{ marginTop: "0.75rem", width: "100%" }}>Uploading...</button>}
          </form>
        </div>
      )}

      {error && <div className="form-error" style={{ marginBottom: "1rem" }}>{error}</div>}
      {notice && <div className="form-success" style={{ marginBottom: skippedFiles.length > 0 ? "0.5rem" : "1rem" }}>{notice}</div>}
      {skippedFiles.length > 0 && (
        <div style={{ marginBottom: "1rem", padding: "12px 16px", background: "color-mix(in srgb, var(--warning, #f59e0b) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--warning, #f59e0b) 30%, transparent)", borderRadius: "10px", fontSize: "13px" }}>
          <div style={{ fontWeight: 600, marginBottom: "6px" }}>{skippedFiles.length} duplicate{skippedFiles.length > 1 ? "s" : ""} skipped — already in talent pool:</div>
          <ul style={{ margin: 0, paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "5px" }}>
            {skippedFiles.map((f, i) => (
              <li key={i} style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{f.filename}</span>
                {f.message && <span style={{ color: "var(--text-tertiary, #9ca3af)" }}>— {f.message}</span>}
                {f.candidate_id && (
                  <button
                    onClick={() => navigate(`/talent-pool/${f.candidate_id}`)}
                    style={{ background: "none", border: "1px solid var(--border-subtle)", borderRadius: 4, padding: "1px 8px", fontSize: 11, cursor: "pointer", color: "var(--primary, #2563eb)", fontWeight: 600, flexShrink: 0 }}
                  >View →</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {filteredCandidates.length > 0 && isRecruiter && (
        <div className="card talent-selection-bar">
          <div className="talent-selection-meta"><strong>{selectedCandidateIds.length}</strong> selected</div>
          <div className="talent-selection-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={toggleSelectAllCandidates} disabled={deleting}>
              {filteredCandidates.every((c) => selectedIdSet.has(c.id)) ? "Clear Selection" : "Select All"}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!selectedCandidateIds.length || sending}
              onClick={() => void openSendModal()}
            >
              Send to Requirement ({selectedCandidateIds.length})
            </button>
            {isAdmin && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void handleDeleteSelectedCandidates()} disabled={deleting || !selectedCandidateIds.length} style={{ color: "var(--danger)" }}>
                {deleting ? "Deleting..." : `Delete Selected (${selectedCandidateIds.length})`}
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-spinner">Loading talent pool...</div>
      ) : !candidates.length ? (
        <div className="data-table-wrap"><div className="table-empty"><div className="table-empty-icon">No data</div>No candidates uploaded yet.</div></div>
      ) : !filteredCandidates.length ? (
        <div className="data-table-wrap"><div className="table-empty"><div className="table-empty-icon">No data</div>No candidates match the selected role.</div></div>
      ) : (
        <div className="talent-grid">
          {filteredCandidates.map((candidate) => {
            const displayRole = getDisplayRole(candidate);
            return (
              <a href={`/talent-pool/${candidate.id}`}>
                <div
                  key={candidate.id}
                  className={`talent-card ${selectedIdSet.has(candidate.id) ? "talent-card--selected" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { if (e.ctrlKey || e.metaKey) { window.open(`/talent-pool/${candidate.id}`, '_blank'); } else { navigate(`/talent-pool/${candidate.id}`); } }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (e.ctrlKey || e.metaKey) { window.open(`/talent-pool/${candidate.id}`, '_blank'); } else { navigate(`/talent-pool/${candidate.id}`); } } }}
                >
                  <div className="talent-card-actions">
                    <label className="talent-select-toggle" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIdSet.has(candidate.id)} onChange={() => toggleCandidateSelection(candidate.id)} aria-label={`Select ${candidate.Name}`} />
                      <span>Select</span>
                    </label>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={(e) => { e.stopPropagation(); void openCommentsModal(candidate); }}
                    >Comments</button>
                    {isAdmin && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); void handleDeleteCandidate(candidate); }} disabled={deleting} style={{ color: "var(--danger)" }}>Delete</button>
                    )}
                  </div>
                  <div className="talent-card-top">
                    <strong className="talent-name">{candidate.Name || "Unknown Candidate"}</strong>
                  </div>
                  {displayRole && <div className="talent-role">{displayRole}</div>}
                  <div className="talent-meta-row">
                    <span>{candidate.experience_label || "-"}</span>
                    {(() => {
                      const ch = (candidate as any).source_channel as string | undefined;
                      const label = ch === "email" ? "Email" : ch === "bulk" ? "Bulk" : ch === "manual" ? "Manual" : null;
                      const color = ch === "email" ? { bg: "#dbeafe", text: "#1d4ed8", border: "#bfdbfe" }
                        : ch === "bulk" ? { bg: "#fef3c7", text: "#92400e", border: "#fde68a" }
                          : ch === "manual" ? { bg: "#dcfce7", text: "#166534", border: "#bbf7d0" }
                            : null;
                      return label && color ? (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 3,
                          background: color.bg, color: color.text, border: `1px solid ${color.border}`,
                          marginLeft: 4,
                        }}>{label}</span>
                      ) : null;
                    })()}
                  </div>
                  {candidate.uploaded_by_name && (
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: "0.15rem" }}>
                      Owned by <strong>{candidate.uploaded_by_name}</strong>
                    </div>
                  )}
                  {candidate.resume_filename && (
                    <div>
                      <div className="talent-file" title={candidate.resume_filename}>{candidate.resume_filename}</div>
                      {(() => {
                        const dateStr = candidate.resume_updated_at || candidate.created_at;
                        if (!dateStr) return null;
                        const uploaded = toUtcDate(dateStr);
                        const diffDays = Math.floor((Date.now() - uploaded.getTime()) / 86400000);
                        const diffMonths = diffDays / 30;
                        const isOld = diffMonths >= 2;
                        const label = diffDays < 1 ? "Today"
                          : diffDays < 30 ? `${diffDays}d ago`
                            : `${Math.floor(diffMonths)}mo ago`;
                        return (
                          <div style={{ fontSize: 10, marginTop: 2, color: isOld ? "#b45309" : "var(--text-muted)", display: "flex", alignItems: "center", gap: 3 }}
                            title={fmtDate(dateStr)}>
                            {isOld && <span>⚠</span>}
                            <span>{label}</span>
                            {isOld && <span style={{ opacity: 0.8 }}>· may be outdated</span>}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}

      {confirmDialog && (
        <div className="modal-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="modal-box" style={{ maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Confirm Delete</div>
            <p className="text-sm" style={{ margin: "0.75rem 0 1.25rem", color: "var(--text-secondary)" }}>{confirmDialog.message}</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmDialog(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: "var(--danger, #e53e3e)" }} onClick={() => void confirmDialog.onConfirm()}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {commentsCandidate && (
        <div className="modal-overlay" onClick={() => setCommentsCandidate(null)}>
          <div className="modal-box" style={{ maxWidth: "540px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Comments — {commentsCandidate.Name || "Candidate"}</div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: "0.4rem" }}>Post a comment</label>
              <select
                value={commentReqId}
                onChange={(e) => setCommentReqId(e.target.value)}
                style={{ width: "100%", marginBottom: "0.5rem", padding: "0.5rem 0.75rem", background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "var(--font-size-sm)" }}
              >
                <option value="talent_pool">Talent Pool (general note)</option>
                {commentProfiles.map(p => (
                  <option key={p.requirement_uuid} value={p.requirement_uuid}>{p.requirement_name}</option>
                ))}
              </select>
              <textarea
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Write a comment…"
                rows={3}
                style={{ width: "100%", resize: "vertical", padding: "0.5rem 0.75rem", background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "var(--font-size-sm)", boxSizing: "border-box" }}
              />
              {commentErr && <div className="form-error" style={{ marginTop: "0.3rem" }}>{commentErr}</div>}
              <button
                className="btn btn-primary btn-sm"
                style={{ marginTop: "0.4rem" }}
                disabled={!commentDraft.trim() || postingComment}
                onClick={() => void handlePostComment()}
              >{postingComment ? "Posting…" : "Post Comment"}</button>
            </div>

            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: "0.5rem" }}>
                {loadingComments ? "Loading…" : `${commentsList.length} comment${commentsList.length !== 1 ? "s" : ""}`}
              </div>
              {commentsList.length === 0 && !loadingComments && (
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>No comments yet.</div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", maxHeight: "280px", overflowY: "auto" }}>
                {commentsList.map((c, i) => (
                  <div key={i} style={{ background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)", padding: "0.6rem 0.75rem" }}>
                    <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{c.comment}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: "0.25rem", display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{c.author_name || "Unknown"}</span>
                      <span>·</span>
                      <span>{fmtTs(c.date)}</span>
                      {c.requirement_name && (
                        <>
                          <span>·</span>
                          <span style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: 4, padding: "0px 6px", fontSize: 10 }}>
                            {c.requirement_name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: "1rem" }}>
              <button className="btn btn-ghost" onClick={() => setCommentsCandidate(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {sendModal && (
        <div className="modal-overlay" onClick={() => { if (!sending) setSendModal(false); }}>
          <div className="modal-box" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Send to Requirement</div>
            <p className="text-sm" style={{ margin: "0.5rem 0 1rem", color: "var(--text-secondary)" }}>
              {selectedCandidateIds.length} candidate{selectedCandidateIds.length !== 1 ? "s" : ""} will be scored and added to the Profiles tab for review before submission.
            </p>
            {requirements.length === 0 ? (
              <div className="text-sm" style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
                No open requirements assigned to you.
              </div>
            ) : (
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label>Select Requirement</label>
                <select
                  value={sendReqId}
                  onChange={(e) => setSendReqId(e.target.value)}
                  style={{ padding: "0.65rem 0.85rem", background: "var(--bg-input)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "var(--font-size-base)", width: "100%" }}
                >
                  <option value="">Choose…</option>
                  {requirements.map(r => (
                    <option key={r.id} value={r.id}>{r.req_id} — {r.requirement_name}</option>
                  ))}
                </select>
              </div>
            )}
            {sendResult && (
              <div style={{ fontSize: 13, marginBottom: "0.75rem", color: sendResult.startsWith("Error") ? "#dc2626" : "#16a34a" }}>
                {sendResult}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setSendModal(false)} disabled={sending}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => void handleSendToRequirement()}
                disabled={!sendReqId || sending || requirements.length === 0}
              >
                {sending ? "Sending…" : "Send Profiles"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
