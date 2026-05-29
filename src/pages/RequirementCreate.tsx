import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import Icon from "../components/Icon";
import "../styles/pages.css";

function ClientCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [clients, setClients] = useState<string[]>([]);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        api.get("/requirements")
            .then((reqs: any[]) => {
                const names = [...new Set((reqs || []).map((r: any) => r.company_name).filter(Boolean))].sort() as string[];
                setClients(names);
            })
            .catch(() => { });
    }, []);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const filtered = value
        ? clients.filter(c => c.toLowerCase().includes(value.toLowerCase()))
        : clients;

    return (
        <div ref={ref} style={{ position: "relative" }}>
            <input
                type="text"
                placeholder="e.g. Google"
                value={value}
                required
                autoComplete="off"
                onFocus={() => setOpen(true)}
                onChange={e => { onChange(e.target.value); setOpen(true); }}
                style={{ width: "100%" }}
            />
            {open && filtered.length > 0 && (
                <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
                    background: "var(--bg-card)", border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-sm)", boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                    maxHeight: 220, overflowY: "auto", marginTop: 2,
                }}>
                    {filtered.map(c => (
                        <div
                            key={c}
                            onMouseDown={e => { e.preventDefault(); onChange(c); setOpen(false); }}
                            style={{
                                padding: "0.5rem 0.85rem", fontSize: 13, cursor: "pointer",
                                color: c === value ? "var(--primary)" : "var(--text-primary)",
                                fontWeight: c === value ? 600 : 400,
                                background: "transparent",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-secondary)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                            {c}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const REQUIREMENT_TYPE_SUGGESTIONS = [
    { label: "Full Time", value: "FULL_TIME" },
    { label: "Contract", value: "CONTRACT" },
    { label: "Contract to Hire", value: "CONTRACT_TO_HIRE" },
    { label: "Internship", value: "INTERNSHIP" },
];

const MODE_OF_WORK_OPTIONS = [
    "Remote",
    "On-site",
    "Hybrid",
];

const REQUIREMENT_NAME_SUGGESTIONS = [
    "Senior Java Developer",
    "Frontend React Developer",
    "DevOps Engineer",
    "QA Automation Engineer",
    "Data Engineer",
    "Full Stack Developer",
];

const INITIAL_FORM = {
    company_name: "",
    requirement_name: "",
    jd: "",
    special_instructions: "",
    requirement_type: "",
    role_type: "",
    location: "",
    notice_period: "",
    years_of_experience: "",
    max_years_experience: "",
    mode_of_work: "",
    client_spoc_name: "",
    sla_hours_to_first_submission: "48",
};

const REQUIREMENT_TEMPLATES: Record<string, Partial<typeof INITIAL_FORM>> = {
    "Senior Java Developer": {
        role_type: "Backend",
        requirement_type: "FULL_TIME",
        jd: "Responsibilities:\n- Design and develop high-volume, low-latency applications for mission-critical systems.\n- Support continuous improvement by investigating alternatives and technologies.\n- Technical stack: Java 17+, Spring Boot, Microservices, SQL, Docker.",
        years_of_experience: "5+ years",
        mode_of_work: "Hybrid",
    },
    "Frontend React Developer": {
        role_type: "Frontend",
        requirement_type: "FULL_TIME",
        jd: "Responsibilities:\n- Developing new user-facing features using React.js.\n- Building reusable components and front-end libraries for future use.\n- Translating designs and wireframes into high quality code.\n- Technical stack: React, TypeScript, Redux/Context API, CSS-in-JS.",
        years_of_experience: "3+ years",
        mode_of_work: "Remote",
    },
    "DevOps Engineer": {
        role_type: "DevOps",
        requirement_type: "FULL_TIME",
        jd: "Responsibilities:\n- Implementing automation for CI/CD pipelines.\n- Managing cloud infrastructure (AWS/Azure/GCP).\n- Monitoring system performance and reliability.\n- Technical stack: Kubernetes, Docker, Terraform, Jenkins/GitHub Actions, Ansible.",
        years_of_experience: "4+ years",
        mode_of_work: "On-site",
    },
    "QA Automation Engineer": {
        role_type: "QA Automation",
        requirement_type: "FULL_TIME",
        jd: "Responsibilities:\n- Design and execute automated test scripts.\n- Collaborate with developers to ensure code quality.\n- Analyze test results and report bugs.\n- Technical stack: Selenium, Playwright, Java/Python, Jest/Mocha.",
        years_of_experience: "3+ years",
        mode_of_work: "Hybrid",
    },
    "Data Engineer": {
        role_type: "Data Engineer",
        requirement_type: "FULL_TIME",
        jd: "Responsibilities:\n- Designing and maintaining data pipelines (ETL).\n- Managing data warehouses and big data platforms.\n- Optimizing database performance for analytics.\n- Technical stack: Python, SQL, Spark, Hadoop, Snowflake/Redshift.",
        years_of_experience: "4+ years",
        mode_of_work: "Remote",
    },
    "Full Stack Developer": {
        role_type: "Full Stack",
        requirement_type: "FULL_TIME",
        jd: "Responsibilities:\n- Developing responsive front-end applications and robust back-end APIs.\n- Ensuring the entire stack is scalable and maintainable.\n- Managing databases and server-side logic.\n- Technical stack: Node.js/Python, React, SQL/NoSQL, AWS.",
        years_of_experience: "5+ years",
        mode_of_work: "Hybrid",
    },
};

const ROLE_TYPE_SUGGESTIONS = [
    "Backend",
    "Frontend",
    "Full Stack",
    "DevOps",
    "Data Engineer",
    "QA Automation",
    "UI/UX",
];

type ParsedJdPreview = {
    jd_text: string;
    all_skills?: string[];
    must_have_skills?: string[];
    good_to_have_skills?: string[];
    important_information?: Array<{ label: string; any_of: string[] }>;
    company_name?: string;
    requirement_name?: string;
    requirement_type?: string;
    role_type?: string;
    location?: string;
    notice_period?: string;
    years_of_experience?: string;
    mode_of_work?: string;
};

const SKILL_PREFERENCE_OPTIONS = [
    "Strongly required",
    "Good working knowledge",
    "Basics enough",
];

const SKILL_PREFERENCE_HEADER = "Skill Preferences:";

export default function RequirementCreate() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [parsingJd, setParsingJd] = useState(false);
    const [jdFile, setJdFile] = useState<File | null>(null);
    const [parsedJd, setParsedJd] = useState<ParsedJdPreview | null>(null);
    const [activeSkill, setActiveSkill] = useState<string | null>(null);
    const [skillPreferences, setSkillPreferences] = useState<Record<string, string>>({});
    const [form, setForm] = useState(() => ({
        ...INITIAL_FORM,
        company_name: searchParams.get("client") || "",
    }));
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [editingSpecialInstructions, setEditingSpecialInstructions] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    const handleAutofill = (name: string) => {
        const template = REQUIREMENT_TEMPLATES[name];
        if (template) {
            setForm((prev) => ({
                ...prev,
                requirement_name: name,
                role_type: template.role_type || prev.role_type,
                requirement_type: template.requirement_type || prev.requirement_type,
                jd: template.jd || prev.jd,
                years_of_experience: template.years_of_experience || prev.years_of_experience,
                mode_of_work: template.mode_of_work || prev.mode_of_work,
            }));
        } else {
            update("requirement_name", name);
        }
    };

    const update = (field: string, value: string) =>
        setForm((prev) => ({ ...prev, [field]: value }));

    const buildSpecialInstructions = (manualText: string, preferences: Record<string, string>) => {
        const lines = Object.entries(preferences).map(([skill, preference]) => `- ${skill}: ${preference}`);
        if (!lines.length) return manualText;
        const prefsBlock = `${SKILL_PREFERENCE_HEADER}\n${lines.join("\n")}`;
        const manual = manualText.trim();
        return manual ? `${manual}\n\n${prefsBlock}` : prefsBlock;
    };

    const extractManualInstructions = (value: string) => {
        const marker = `\n\n${SKILL_PREFERENCE_HEADER}\n`;
        const markerIndex = value.indexOf(marker);
        if (markerIndex >= 0) return value.slice(0, markerIndex);
        if (value.startsWith(`${SKILL_PREFERENCE_HEADER}\n`)) return "";
        const inlineMarkerIndex = value.indexOf(`${SKILL_PREFERENCE_HEADER}\n`);
        if (inlineMarkerIndex >= 0) return value.slice(0, inlineMarkerIndex).trimEnd();
        return value;
    };

    const specialInstructionsValue = buildSpecialInstructions(
        form.special_instructions,
        skillPreferences
    );

    const selectedRequirementTypeLabel =
        REQUIREMENT_TYPE_SUGGESTIONS.find(
            (option) => option.value === form.requirement_type
        )?.label || form.requirement_type;

    const handleJdFileChange = async (file: File | null) => {
        setError("");
        setParsedJd(null);
        setActiveSkill(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);

        if (!file) {
            setJdFile(null);
            setSkillPreferences({});
            return;
        }

        setJdFile(file);
        if (file.type === "application/pdf") {
            setPreviewUrl(URL.createObjectURL(file));
        }

        setParsingJd(true);
        try {
            const payload = new FormData();
            payload.append("jd_file", file);
            const parsed = await api.post("/requirements/parse-jd-file", payload);
            setParsedJd(parsed);

            setForm((prev) => ({
                ...prev,
                company_name: parsed.company_name || prev.company_name,
                requirement_name: parsed.requirement_name || prev.requirement_name,
                requirement_type: parsed.requirement_type || prev.requirement_type,
                role_type: parsed.role_type || prev.role_type,
                location: parsed.location || prev.location,
                notice_period: parsed.notice_period || prev.notice_period,
                years_of_experience: parsed.years_of_experience || prev.years_of_experience,
                mode_of_work: parsed.mode_of_work || prev.mode_of_work,
                jd: parsed.jd_text || prev.jd,
            }));

            const parsedSkills = new Set(parsed?.all_skills || []);
            setSkillPreferences((prev) =>
                Object.fromEntries(
                    Object.entries(prev).filter(([skill]) => parsedSkills.has(skill))
                )
            );
        } catch (err: any) {
            setError(err.detail || "Failed to parse JD file");
        } finally {
            setParsingJd(false);
        }
    };

    const applySkillPreference = (skill: string, preference: string) => {
        setSkillPreferences((prev) => ({ ...prev, [skill]: preference }));
        setActiveSkill(null);
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            if (jdFile) {
                const payload = new FormData();
                payload.append("company_name", form.company_name);
                payload.append("requirement_name", form.requirement_name);
                payload.append("special_instructions", specialInstructionsValue || "");
                payload.append("requirement_type", form.requirement_type || "");
                payload.append("role_type", form.role_type || "");
                payload.append("client_spoc_name", form.client_spoc_name || "");
                payload.append("sla_hours_to_first_submission", form.sla_hours_to_first_submission || "48");
                payload.append("location", form.location || "");
                payload.append("notice_period", form.notice_period || "");
                payload.append("years_of_experience", form.years_of_experience || "");
                payload.append("max_years_experience", form.max_years_experience || "");
                payload.append("mode_of_work", form.mode_of_work || "");
                payload.append("jd_file", jdFile);
                if (parsedJd?.all_skills?.length) {
                    payload.append("all_skills_json", JSON.stringify(parsedJd.all_skills));
                }
                const created = await api.post("/requirements/from-file", payload);
                navigate(`/requirements/${created.id}`);
            } else {
                const payload = {
                    ...form,
                    jd: form.jd || null,
                    special_instructions: specialInstructionsValue || null,
                    requirement_type: form.requirement_type || null,
                    role_type: form.role_type || null,
                    client_spoc_name: form.client_spoc_name || null,
                    sla_hours_to_first_submission: Number.parseInt(form.sla_hours_to_first_submission || "48", 10) || 48,
                    location: form.location || null,
                    notice_period: form.notice_period || null,
                    years_of_experience: form.years_of_experience || null,
                    max_years_experience: form.max_years_experience || null,
                    mode_of_work: form.mode_of_work || null,
                };
                const created = await api.post("/requirements", payload);
                navigate(`/requirements/${created.id}`);
            }
        } catch (err: any) {
            setError(err.detail || "Failed to create requirement");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="requirement-create-page">
            <button
                className="btn btn-ghost"
                onClick={() => navigate(-1)}
                style={{ marginBottom: "0.75rem", fontSize: 13, display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
            >
                ← Back
            </button>
            <div className="page-header">
                <div>
                    <h1>Create Requirement</h1>
                    <p className="page-header-sub">Add a new hiring requirement</p>
                </div>
            </div>

            {error && <div className="form-error" style={{ marginBottom: "1rem" }}>{error}</div>}

            <div className="requirement-create-layout">
                <form className="dash-form requirement-create-form" onSubmit={handleSubmit}>

                    {/* JD Upload — top of form */}
                    <div className="form-group">
                        <label>JD / Description</label>
                        <div className="jd-upload-wrap">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.doc,.docx,.txt,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/rtf"
                                style={{ display: "none" }}
                                onChange={(e) => void handleJdFileChange(e.target.files?.[0] || null)}
                            />
                            <div
                                onClick={() => !parsingJd && fileInputRef.current?.click()}
                                style={{
                                    border: "2px dashed var(--border-subtle)",
                                    borderRadius: "10px",
                                    padding: "1.25rem",
                                    textAlign: "center",
                                    cursor: parsingJd ? "default" : "pointer",
                                    background: "var(--bg-secondary)",
                                    transition: "border-color 0.2s",
                                }}
                                onMouseEnter={(e) => { if (!parsingJd) (e.currentTarget as HTMLDivElement).style.borderColor = "var(--primary)"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-subtle)"; }}
                            >
                                {jdFile ? (
                                    <div>
                                        <div style={{ marginBottom: "0.25rem", color: "var(--text-secondary)" }}><Icon name="document" size={32} /></div>
                                        <div style={{ fontWeight: 600, color: "var(--fg-primary)" }}>{jdFile.name}</div>
                                        <div style={{ fontSize: "0.8rem", color: "var(--primary)", marginTop: "0.25rem" }}>
                                            {previewUrl && <span style={{ marginRight: "0.5rem", cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setShowPreview(true); }}>Preview</span>}
                                            Click to change
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div style={{ marginBottom: "0.25rem", color: "var(--text-secondary)" }}><Icon name="document" size={32} /></div>
                                        <div style={{ fontWeight: 600, color: "var(--fg-primary)" }}>Click to upload JD</div>
                                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>PDF, Word, or TXT</div>
                                    </div>
                                )}
                            </div>
                            {parsingJd && (
                                <div className="jd-parse-status">Analyzing JD and extracting tech stack...</div>
                            )}
                            {parsedJd && (
                                <div className="jd-skill-preview">
                                    <div className="jd-skill-group">
                                        <div className="jd-skill-title">Skills from JD</div>
                                        <div className="jd-skill-chips">
                                            {(parsedJd.all_skills || []).length ? (
                                                (parsedJd.all_skills || []).map((skill) => (
                                                    <button
                                                        key={`all-${skill}`}
                                                        type="button"
                                                        className={`suggestion-chip ${skillPreferences[skill] ? "is-active" : ""} skill-chip-btn`}
                                                        onClick={() => setActiveSkill(skill)}
                                                        title="Set importance for this skill"
                                                    >
                                                        {skillPreferences[skill]
                                                            ? `${skill} (${skillPreferences[skill]})`
                                                            : skill}
                                                    </button>
                                                ))
                                            ) : (
                                                <span className="jd-skill-empty">Not Mentioned</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="form-group" style={{ marginTop: "1rem", marginBottom: "1rem" }}>
                        <label>Original JD Text / Paste JD manually</label>
                        <textarea
                            placeholder="Paste the Job Description here if you don't have a file, or review the extracted text..."
                            value={form.jd}
                            onChange={(e) => update("jd", e.target.value)}
                            rows={8}
                            style={{ 
                                width: "100%", 
                                padding: "0.75rem", 
                                borderRadius: "8px", 
                                border: "1px solid var(--border-subtle)", 
                                background: "var(--bg-primary)", 
                                color: "var(--fg-primary)", 
                                fontFamily: "inherit",
                                resize: "vertical"
                            }}
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Company Name *</label>
                            <ClientCombobox
                                value={form.company_name}
                                onChange={(v) => update("company_name", v)}
                            />
                        </div>
                        <div className="form-group">
                            <label>Requirement Name *</label>
                            <input
                                type="text"
                                placeholder="e.g. Senior Java Developer"
                                value={form.requirement_name}
                                onChange={(e) => update("requirement_name", e.target.value)}
                                required
                            />
                            <div className="quick-suggestions quick-suggestions--name">
                                {REQUIREMENT_NAME_SUGGESTIONS.map((name) => (
                                    <button
                                        key={name}
                                        type="button"
                                        className={`suggestion-chip ${form.requirement_name === name ? "is-active" : ""}`}
                                        onClick={() => handleAutofill(name)}
                                    >
                                        {name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Requirement Type</label>
                            <input
                                type="text"
                                placeholder="Select from recommendations below"
                                value={selectedRequirementTypeLabel}
                                readOnly
                            />
                            <div className="quick-suggestions">
                                {REQUIREMENT_TYPE_SUGGESTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={`suggestion-chip ${form.requirement_type === option.value ? "is-active" : ""}`}
                                        onClick={() => update("requirement_type", option.value)}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Role Type</label>
                            <input
                                type="text"
                                placeholder="e.g. Backend, Frontend, DevOps"
                                value={form.role_type}
                                onChange={(e) => update("role_type", e.target.value)}
                            />
                            <div className="quick-suggestions quick-suggestions--role">
                                {ROLE_TYPE_SUGGESTIONS.map((role) => (
                                    <button
                                        key={role}
                                        type="button"
                                        className={`suggestion-chip ${form.role_type === role ? "is-active" : ""}`}
                                        onClick={() => update("role_type", role)}
                                    >
                                        {role}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Location</label>
                            <input
                                type="text"
                                placeholder="e.g. Bangalore, Remote"
                                value={form.location}
                                onChange={(e) => update("location", e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label>Notice Period</label>
                            <input
                                type="text"
                                placeholder="e.g. 30 days, Immediate"
                                value={form.notice_period}
                                onChange={(e) => update("notice_period", e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Min Years of Experience</label>
                            <input
                                type="text"
                                placeholder="e.g. 5"
                                value={form.years_of_experience}
                                onChange={(e) => update("years_of_experience", e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label>Max Years of Experience</label>
                            <input
                                type="text"
                                placeholder="e.g. 10"
                                value={form.max_years_experience}
                                onChange={(e) => update("max_years_experience", e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group" style={{ flex: 1 }}>
                            <label>Mode of Work</label>
                            <select
                                value={form.mode_of_work}
                                onChange={(e) => update("mode_of_work", e.target.value)}
                            >
                                <option value="">Select Mode</option>
                                {MODE_OF_WORK_OPTIONS.map((mode) => (
                                    <option key={mode} value={mode}>{mode}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Client SPOC Name</label>
                        <input
                            type="text"
                            placeholder="Client point of contact"
                            value={form.client_spoc_name}
                            onChange={(e) => update("client_spoc_name", e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label>SLA to First Submission (Hours)</label>
                        <input
                            type="number"
                            min={1}
                            step={1}
                            value={form.sla_hours_to_first_submission}
                            onChange={(e) => update("sla_hours_to_first_submission", e.target.value)}
                        />
                        <span className="requirement-side-note">
                            Default 48 hours. SLA runs on 24x5 (weekends excluded), timezone Asia/Kolkata.
                        </span>
                    </div>

                    <div className="form-group">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                            <label style={{ margin: 0 }}>Special Instructions</label>
                            {!editingSpecialInstructions ? (
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    style={{ fontSize: 12, padding: "2px 10px" }}
                                    onClick={() => setEditingSpecialInstructions(true)}
                                >
                                    <Icon name="edit" size={13} /> Edit
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    style={{ fontSize: 12, padding: "2px 10px", color: "var(--accent)" }}
                                    onClick={() => setEditingSpecialInstructions(false)}
                                >
                                    Done
                                </button>
                            )}
                        </div>
                        {editingSpecialInstructions ? (
                            <textarea
                                placeholder="Any special notes for recruiters..."
                                value={specialInstructionsValue}
                                onChange={(e) =>
                                    update("special_instructions", extractManualInstructions(e.target.value))
                                }
                                rows={5}
                                autoFocus
                            />
                        ) : specialInstructionsValue ? (
                            <div
                                style={{
                                    padding: "0.6rem 0.85rem", fontSize: 13,
                                    border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)",
                                    background: "var(--bg-secondary)", whiteSpace: "pre-wrap",
                                    color: "var(--text-primary)", cursor: "pointer", minHeight: 60,
                                }}
                                onClick={() => setEditingSpecialInstructions(true)}
                                title="Click to edit"
                            >
                                {specialInstructionsValue}
                            </div>
                        ) : (
                            <div
                                style={{
                                    padding: "0.6rem 0.85rem", fontSize: 13,
                                    border: "1px dashed var(--border-subtle)", borderRadius: "var(--radius-sm)",
                                    color: "var(--text-muted)", cursor: "pointer", minHeight: 60,
                                    display: "flex", alignItems: "center",
                                }}
                                onClick={() => setEditingSpecialInstructions(true)}
                            >
                                Click to add special instructions for recruiters…
                            </div>
                        )}
                    </div>

                    <div className="form-actions">
                        <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => navigate("/dashboard")}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? "Creating..." : "Create Requirement"}
                        </button>
                    </div>
                </form>
            </div>

            {/* PDF Preview Modal */}
            {showPreview && previewUrl && (
                <div className="modal-overlay" onClick={() => setShowPreview(false)}>
                    <div
                        className="modal-box"
                        style={{ width: "80vw", maxWidth: "900px", height: "85vh", display: "flex", flexDirection: "column" }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>{jdFile?.name}</span>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPreview(false)}>Close</button>
                        </div>
                        <object
                            data={previewUrl}
                            type="application/pdf"
                            style={{ flex: 1, border: "none", borderRadius: "8px", width: "100%", minHeight: 0 }}
                        >
                            <div style={{ padding: "2rem", textAlign: "center" }}>
                                <p>PDF preview not available in this browser.</p>
                                <a href={previewUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                                    Open in new tab
                                </a>
                            </div>
                        </object>
                    </div>
                </div>
            )}

            {/* Skill Preference Modal */}
            {activeSkill && (
                <div className="modal-overlay" onClick={() => setActiveSkill(null)}>
                    <div className="modal-box skill-pref-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-title">Set Requirement Level</div>
                        <p className="text-sm text-muted" style={{ marginBottom: "0.75rem" }}>
                            {activeSkill}
                        </p>
                        <div className="skill-pref-options">
                            {SKILL_PREFERENCE_OPTIONS.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    className={`btn ${skillPreferences[activeSkill] === option ? "btn-primary" : "btn-ghost"}`}
                                    onClick={() => applySkillPreference(activeSkill, option)}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
