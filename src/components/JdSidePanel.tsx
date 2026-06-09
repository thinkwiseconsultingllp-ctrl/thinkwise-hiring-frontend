import { useJdViewer } from "../context/JdViewerContext";
import StatusBadge from "./StatusBadge";
import "./JdSidePanel.css";
import { fmtTs } from "../utils/dateUtils";

const REQ_TYPE_LABELS: Record<string, string> = {
    FULL_TIME: "Full Time",
    CONTRACT: "Contract",
    CONTRACT_TO_HIRE: "Contract to Hire",
    INTERNSHIP: "Internship",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    if (value === null || value === undefined || value === "") return null;
    return (
        <div className="jd-panel-field">
            <div className="jd-panel-field-label">{label}</div>
            <div className="jd-panel-field-value">{value}</div>
        </div>
    );
}

function Chips({ items }: { items?: string[] | null }) {
    if (!items || items.length === 0) return null;
    return (
        <div className="jd-panel-chips">
            {items.map((s, i) => (
                <span key={`${s}-${i}`} className="suggestion-chip">{s}</span>
            ))}
        </div>
    );
}

export default function JdSidePanel() {
    const { activeReq, isOpen, closeJd } = useJdViewer();

    if (!activeReq) return null;

    const r = activeReq;
    const typeLabel = r.requirement_type ? (REQ_TYPE_LABELS[r.requirement_type] ?? r.requirement_type) : null;
    const sla = r.sla_hours_to_first_submission != null ? `${r.sla_hours_to_first_submission}h` : null;
    const deadline = r.sla_deadline_ist ? fmtTs(r.sla_deadline_ist) : null;
    const created = r.created_at ? fmtTs(r.created_at) : null;

    return (
        <aside className={`jd-panel ${isOpen ? "jd-panel--open" : ""}`} role="complementary" aria-label="Job description viewer">
            <header className="jd-panel-header">
                <div className="jd-panel-header-main">
                    <div className="jd-panel-header-row">
                        {r.req_id && (
                            <span className="font-mono text-accent" style={{ fontSize: "var(--font-size-sm)" }}>
                                {r.req_id}
                            </span>
                        )}
                        {r.status && <StatusBadge status={r.status} />}
                    </div>
                    <h2 className="jd-panel-title">{r.requirement_name || "Job Description"}</h2>
                </div>
                <button
                    className="jd-panel-close"
                    onClick={closeJd}
                    aria-label="Close job description panel"
                    title="Close"
                >
                    ×
                </button>
            </header>

            <div className="jd-panel-body">
                <section className="jd-panel-section">
                    <div className="jd-panel-section-title">Overview</div>
                    <div className="jd-panel-grid">
                        <Field label="Company" value={r.company_name} />
                        <Field label="Type" value={typeLabel} />
                        <Field label="Role" value={r.role_type} />
                        <Field label="Mode of Work" value={r.mode_of_work} />
                        <Field label="Location" value={r.location} />
                        <Field label="Experience" value={r.years_of_experience} />
                        <Field label="Notice Period" value={r.notice_period} />
                        <Field label="No. of Positions" value={r.no_of_positions} />
                        <Field label="Budget Range" value={r.budget_range} />
                        <Field label="Client SPOC" value={r.client_spoc_name} />
                        <Field label="SLA" value={sla} />
                        <Field label="Deadline" value={deadline} />
                        <Field label="Created" value={created} />
                    </div>
                </section>

                {(r.all_skills?.length || r.must_have_skills?.length || r.good_to_have_skills?.length) ? (
                    <section className="jd-panel-section">
                        <div className="jd-panel-section-title">Skills</div>
                        {r.must_have_skills && r.must_have_skills.length > 0 && (
                            <div className="jd-panel-subgroup">
                                <div className="jd-panel-subtitle">Must-have</div>
                                <Chips items={r.must_have_skills} />
                            </div>
                        )}
                        {r.good_to_have_skills && r.good_to_have_skills.length > 0 && (
                            <div className="jd-panel-subgroup">
                                <div className="jd-panel-subtitle">Good to have</div>
                                <Chips items={r.good_to_have_skills} />
                            </div>
                        )}
                        {(!r.must_have_skills || r.must_have_skills.length === 0) &&
                            (!r.good_to_have_skills || r.good_to_have_skills.length === 0) &&
                            r.all_skills && r.all_skills.length > 0 && (
                                <div className="jd-panel-subgroup">
                                    <div className="jd-panel-subtitle">All Skills</div>
                                    <Chips items={r.all_skills} />
                                </div>
                            )}
                    </section>
                ) : null}

                {r.special_instructions && (
                    <section className="jd-panel-section">
                        <div className="jd-panel-section-title">Special Instructions</div>
                        <p className="jd-panel-text">{r.special_instructions}</p>
                    </section>
                )}

                <section className="jd-panel-section">
                    <div className="jd-panel-section-title">Job Description</div>
                    {r.jd ? (
                        <pre className="jd-panel-jd">{r.jd}</pre>
                    ) : (
                        <p className="jd-panel-text jd-panel-muted">No job description text available.</p>
                    )}
                </section>
            </div>
        </aside>
    );
}
