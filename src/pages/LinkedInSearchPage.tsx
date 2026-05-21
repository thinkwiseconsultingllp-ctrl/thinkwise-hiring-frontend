import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import "../styles/pages.css";

interface SearchResponse {
    query: string;
    google_url: string;
}

export default function LinkedInSearchPage() {
    const [searchParams] = useSearchParams();

    const [jobTitle, setJobTitle] = useState("");
    const [skills, setSkills] = useState("");
    const [experience, setExperience] = useState("");
    const [location, setLocation] = useState("");

    const [result, setResult] = useState<SearchResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Pre-fill from query params (when navigating from RequirementDetail)
    useEffect(() => {
        const title = searchParams.get("title");
        const kw = searchParams.get("keywords");
        if (title) setJobTitle(title);
        if (kw) setSkills(kw);
    }, [searchParams]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const data = await api.post("/api/linkedin/search", {
                job_title: jobTitle,
                keywords: skills
                    ? skills
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                    : [],
                location: location || null,
                experience_years: experience ? parseInt(experience) : null,
            });

            setResult(data);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "An error occurred"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1>LinkedIn Search</h1>
                    <p className="page-header-sub">
                        Find candidates on LinkedIn with boolean search
                    </p>
                </div>
            </div>

            {/* Search Form Card */}
            <div
                className="card"
                style={{ marginBottom: "1.5rem", padding: "1.5rem" }}
            >
                <form onSubmit={handleSearch}>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "1rem",
                        }}
                    >
                        <div className="form-group">
                            <label
                                style={{
                                    fontSize: "var(--font-size-sm)",
                                    fontWeight: 500,
                                    color: "var(--text-secondary)",
                                    marginBottom: "0.35rem",
                                }}
                            >
                                Job Title
                            </label>
                            <input
                                type="text"
                                value={jobTitle}
                                onChange={(e) => setJobTitle(e.target.value)}
                                placeholder="e.g. Backend Engineer"
                                style={{
                                    width: "100%",
                                    padding: "0.65rem 0.85rem",
                                    background: "var(--bg-input)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "var(--radius-sm)",
                                    color: "var(--text-primary)",
                                    fontFamily: "var(--font-family)",
                                    fontSize: "var(--font-size-base)",
                                    outline: "none",
                                }}
                            />
                        </div>

                        <div className="form-group">
                            <label
                                style={{
                                    fontSize: "var(--font-size-sm)",
                                    fontWeight: 500,
                                    color: "var(--text-secondary)",
                                    marginBottom: "0.35rem",
                                }}
                            >
                                Keywords{" "}
                                <span
                                    style={{
                                        fontWeight: 400,
                                        color: "var(--text-muted)",
                                    }}
                                >
                                    (comma separated)
                                </span>
                            </label>
                            <input
                                type="text"
                                value={skills}
                                onChange={(e) => setSkills(e.target.value)}
                                placeholder="python, fastapi, aws"
                                style={{
                                    width: "100%",
                                    padding: "0.65rem 0.85rem",
                                    background: "var(--bg-input)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "var(--radius-sm)",
                                    color: "var(--text-primary)",
                                    fontFamily: "var(--font-family)",
                                    fontSize: "var(--font-size-base)",
                                    outline: "none",
                                }}
                            />
                        </div>

                        <div className="form-group">
                            <label
                                style={{
                                    fontSize: "var(--font-size-sm)",
                                    fontWeight: 500,
                                    color: "var(--text-secondary)",
                                    marginBottom: "0.35rem",
                                }}
                            >
                                Experience{" "}
                                <span
                                    style={{
                                        fontWeight: 400,
                                        color: "var(--text-muted)",
                                    }}
                                >
                                    (years)
                                </span>
                            </label>
                            <input
                                type="number"
                                value={experience}
                                onChange={(e) => setExperience(e.target.value)}
                                placeholder="e.g. 3"
                                style={{
                                    width: "100%",
                                    padding: "0.65rem 0.85rem",
                                    background: "var(--bg-input)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "var(--radius-sm)",
                                    color: "var(--text-primary)",
                                    fontFamily: "var(--font-family)",
                                    fontSize: "var(--font-size-base)",
                                    outline: "none",
                                }}
                            />
                        </div>

                        <div className="form-group">
                            <label
                                style={{
                                    fontSize: "var(--font-size-sm)",
                                    fontWeight: 500,
                                    color: "var(--text-secondary)",
                                    marginBottom: "0.35rem",
                                }}
                            >
                                Location
                            </label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="e.g. Remote, Bangalore"
                                style={{
                                    width: "100%",
                                    padding: "0.65rem 0.85rem",
                                    background: "var(--bg-input)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "var(--radius-sm)",
                                    color: "var(--text-primary)",
                                    fontFamily: "var(--font-family)",
                                    fontSize: "var(--font-size-base)",
                                    outline: "none",
                                }}
                            />
                        </div>
                    </div>

                    {error && (
                        <div
                            className="form-error"
                            style={{ marginTop: "1rem" }}
                        >
                            {error}
                        </div>
                    )}

                    <div
                        style={{
                            marginTop: "1.25rem",
                            display: "flex",
                            gap: "0.75rem",
                        }}
                    >
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading || !jobTitle.trim()}
                            style={{ minWidth: "180px" }}
                        >
                            {loading ? "Searching…" : " Search LinkedIn"}
                        </button>
                    </div>
                </form>
            </div>

            {/* Generated Query Display */}
            {result && (
                <div
                    className="card"
                    style={{
                        marginBottom: "1rem",
                        padding: "1rem 1.25rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        flexWrap: "wrap",
                    }}
                >
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                            style={{
                                fontSize: "var(--font-size-sm)",
                                fontWeight: 600,
                                color: "var(--text-secondary)",
                                marginBottom: "0.35rem",
                            }}
                        >
                            Generated Query
                        </div>
                        <code
                            style={{
                                display: "block",
                                padding: "0.5rem 0.75rem",
                                background: "var(--bg-secondary)",
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid var(--border-subtle)",
                                fontSize: "12px",
                                wordBreak: "break-all",
                                color: "var(--text-primary)",
                                fontFamily:
                                    "'SF Mono', 'Fira Code', monospace",
                            }}
                        >
                            {result.query}
                        </code>
                    </div>
                    <a
                        href={result.google_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost"
                        style={{
                            fontSize: "var(--font-size-sm)",
                            padding: "0.5rem 1rem",
                            flexShrink: 0,
                        }}
                    >
                        Open in New Tab ↗
                    </a>
                </div>
            )}

            {/* Results iframe */}
            {result && result.google_url && (
                <div
                    style={{
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-md)",
                        overflow: "hidden",
                        background: "#fff",
                    }}
                >
                    <iframe
                        src={result.google_url}
                        title="LinkedIn Search Results"
                        style={{
                            width: "100%",
                            height: "calc(100vh - 120px)",
                            border: "none",
                            display: "block",
                        }}
                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                        referrerPolicy="no-referrer"
                    />
                </div>
            )}

            {/* Empty state when no search yet */}
            {!result && !loading && (
                <div
                    className="card"
                    style={{
                        padding: "3rem 2rem",
                        textAlign: "center",
                        color: "var(--text-muted)",
                    }}
                >
                    <div style={{ fontSize: "var(--font-size-sm)" }}>
                        Enter a job title and keywords above, then click{" "}
                        <strong>Search LinkedIn</strong> to find candidates.
                    </div>
                    <div
                        style={{
                            fontSize: "12px",
                            marginTop: "0.5rem",
                            color: "var(--text-muted)",
                        }}
                    >
                        Results will appear here in an embedded view.
                    </div>
                </div>
            )}
        </div>
    );
}