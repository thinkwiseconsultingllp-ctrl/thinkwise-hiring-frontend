import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import Icon from "./Icon";

interface Recruiter {
    id: string;
    name: string;
    email: string;
    role: string;
    is_active?: boolean;
}

interface AssignRecruitersDrawerProps {
    open: boolean;
    onClose: () => void;
    jdId: string;
    requirementName?: string | null;
    initialAssigned: string[];
    onSaved: (newAssignedIds: string[]) => void;
}

export default function AssignRecruitersDrawer({
    open, onClose, jdId, requirementName, initialAssigned, onSaved,
}: AssignRecruitersDrawerProps) {
    const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set(initialAssigned));
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        setError(null);
        api.get("/users/recruiters")
            .then((rows: Recruiter[]) => setRecruiters(rows || []))
            .catch((e: any) => setError(e?.detail || e?.message || "Failed to load recruiters"))
            .finally(() => setLoading(false));
    }, [open]);

    useEffect(() => {
        if (open) setSelected(new Set(initialAssigned));
    }, [open, initialAssigned]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return recruiters;
        return recruiters.filter(r =>
            (r.name || "").toLowerCase().includes(q) ||
            (r.email || "").toLowerCase().includes(q)
        );
    }, [recruiters, query]);

    const toggle = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const recruiter_ids = Array.from(selected);
            const result = await api.post(`/requirements/${jdId}/assign`, { recruiter_ids });
            onSaved(result?.assigned_recruiters || recruiter_ids);
            onClose();
        } catch (e: any) {
            setError(e?.detail || e?.message || "Save failed");
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    return (
        <aside
            style={{
                position: "fixed", top: 0, right: 0, bottom: 0,
                width: "min(40vw, 520px)",
                background: "var(--bg-primary)",
                borderLeft: "1px solid var(--border-subtle)",
                boxShadow: "-4px 0 16px rgba(0,0,0,0.08)",
                zIndex: 1100,
                display: "flex", flexDirection: "column",
            }}
        >
            <header style={{ padding: "0.85rem 1.1rem", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>Assign Recruiters</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {requirementName || ""}
                    </div>
                </div>
                <button
                    className="btn btn-ghost btn-sm"
                    onClick={onClose}
                    title="Close"
                    aria-label="Close"
                    style={{ padding: "4px 8px" }}
                ><Icon name="x" size={14} /></button>
            </header>

            <div style={{ padding: "0.75rem 1.1rem", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "0.4rem 0.6rem", background: "var(--bg-secondary)" }}>
                    <Icon name="search" size={14} style={{ color: "var(--text-secondary)" }} />
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search by name or email"
                        style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: 13, color: "var(--text-primary)" }}
                    />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: "0.4rem" }}>
                    {selected.size} selected
                </div>
            </div>

            <div style={{ flex: 1, overflow: "auto" }}>
                {loading && <div style={{ padding: "1rem", fontSize: 13, color: "var(--text-secondary)" }}>Loading recruiters...</div>}
                {error && <div style={{ padding: "1rem", fontSize: 13, color: "#dc2626" }}>{error}</div>}
                {!loading && filtered.length === 0 && !error && (
                    <div style={{ padding: "1rem", fontSize: 13, color: "var(--text-secondary)" }}>No recruiters match.</div>
                )}
                {filtered.map(r => {
                    const isSelected = selected.has(r.id);
                    return (
                        <button
                            key={r.id}
                            onClick={() => toggle(r.id)}
                            style={{
                                width: "100%", display: "flex", alignItems: "center", gap: "0.75rem",
                                padding: "0.7rem 1.1rem", border: "none", background: "transparent",
                                textAlign: "left", cursor: "pointer", borderBottom: "1px solid var(--border-subtle)",
                            }}
                        >
                            <div style={{
                                width: 18, height: 18, borderRadius: 4,
                                border: `1.5px solid ${isSelected ? "var(--accent)" : "var(--border-subtle)"}`,
                                background: isSelected ? "var(--accent)" : "transparent",
                                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            }}>
                                {isSelected && <Icon name="check" size={12} style={{ color: "#fff" }} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{r.name}</div>
                                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{r.email}{r.role === "ADMIN" && " · Admin"}</div>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div style={{ padding: "0.75rem 1.1rem", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                {error && <div style={{ fontSize: 12, color: "#dc2626", marginRight: "auto", alignSelf: "center" }}>{error}</div>}
                <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save Assignments"}
                </button>
            </div>
        </aside>
    );
}
