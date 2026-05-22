import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import StatusBadge from "../components/StatusBadge";
import "../styles/pages.css";

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
    assigned_recruiters: string[];
    created_at: string;
}

export default function MyRequirements() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [requirements, setRequirements] = useState<Requirement[]>([]);
    const [submissionCounts, setSubmissionCounts] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [reqs, counts] = await Promise.all([
                    api.get("/requirements"),
                    api.get("/applications/counts"),
                ]);
                const uid = user?.id || "";
                const assigned = (reqs || []).filter((r: Requirement) =>
                    r.assigned_recruiters?.includes(uid)
                );
                setRequirements(assigned);
                setSubmissionCounts(counts || {});
            } catch { /* silent */ } finally {
                setLoading(false);
            }
        };
        void fetchAll();
    }, [user]);

    const filtered = requirements.filter(r => {
        const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
        const q = search.toLowerCase();
        const matchesSearch = !q ||
            r.requirement_name.toLowerCase().includes(q) ||
            r.req_id.toLowerCase().includes(q) ||
            (r.company_name || "").toLowerCase().includes(q);
        return matchesStatus && matchesSearch;
    });

    const renderSla = (req: Requirement) => {
        const status = req.sla_status || "ON_TRACK";
        const breached = Boolean(req.sla_breached);
        if (status === "MET") return <span className="sla-badge sla-badge--met">Met</span>;
        if (breached || status === "BREACHED") return <span className="sla-badge sla-badge--breached">Breached</span>;
        const label = req.sla_remaining_hours != null ? `${Math.ceil(req.sla_remaining_hours)}h left` : "On Track";
        return <span className="sla-badge sla-badge--ontrack">{label}</span>;
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>My Requirements</h1>
                </div>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
                <input
                    type="text"
                    placeholder="Search by name or Req ID..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                        flex: 1, minWidth: "200px", padding: "0.6rem 0.85rem",
                        background: "var(--bg-input)", border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-sm)", color: "var(--text-primary)", fontSize: "var(--font-size-sm)",
                    }}
                />
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
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
            </div>

            <div className="detail-section">
                <div className="detail-section-title">
                    {filtered.length} assigned requirement{filtered.length !== 1 ? "s" : ""}
                </div>

                {loading ? (
                    <div className="loading-spinner">Loading...</div>
                ) : requirements.length === 0 ? (
                    <div className="table-empty">
                        <div className="table-empty-icon"></div>
                        <div style={{ fontWeight: 600, marginBottom: "4px" }}>No requirements assigned yet</div>
                        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                            Go to the Dashboard and click <strong>Assign to me</strong> on any requirement
                        </div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="table-empty">
                        <div className="table-empty-icon"></div>
                        No requirements match your filters
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
                                    <th>Submissions</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(req => (
                                    <tr key={req.id}>
                                        <td className="font-mono text-accent">{req.req_id}</td>
                                        <td><strong>{req.requirement_name}</strong></td>
                                        <td>{req.requirement_type || "-"}</td>
                                        <td>{req.role_type || "-"}</td>
                                        <td>{req.client_spoc_name || "-"}</td>
                                        <td>{renderSla(req)}</td>
                                        <td>
                                            {submissionCounts[req.id] > 0 ? (
                                                <span
                                                    className="text-accent"
                                                    style={{ cursor: "pointer", fontSize: "12px" }}
                                                    onClick={() => navigate(`/requirements/${req.id}`)}
                                                >
                                                    ⚡View fits
                                                </span>
                                            ) : (
                                                <span style={{
                                                    display: "inline-flex", alignItems: "center", gap: "4px",
                                                    fontSize: "11px", fontWeight: 500, color: "var(--text-muted)",
                                                    background: "var(--bg-secondary)", border: "1px dashed var(--border-subtle)",
                                                    borderRadius: "6px", padding: "3px 8px",
                                                }}>
                                                    No submissions yet
                                                </span>
                                            )}
                                        </td>
                                        <td><StatusBadge status={req.status} /></td>
                                        <td className="text-muted text-sm">{new Date(req.created_at).toLocaleDateString()}</td>
                                        <td>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => navigate(`/requirements/${req.id}`)}
                                            >
                                                View
                                            </button>
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
