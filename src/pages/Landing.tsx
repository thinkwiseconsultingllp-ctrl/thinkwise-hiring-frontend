import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import WaveBackground from "../components/WaveBackground";
import logo from "../assets/thinkwise_logo_transparent.png";
import "../App.css";

const features = [
    {
        icon: "",
        title: "Requirement-Centric Hiring",
        desc: "Anchor every submission around clear, structured job requirements with full traceability.",
    },
    {
        icon: "",
        title: "Recruiter Ownership",
        desc: "Track every submission with clear recruiter ownership — no more confusion over who sent whom.",
    },
    {
        icon: "",
        title: "AI-Powered Screening",
        desc: "Integrate intelligent scoring to surface top candidates and reduce manual review time.",
    },
    {
        icon: "",
        title: "Client-Ready Trackers",
        desc: "Generate professional HTML and Excel trackers ready to send to clients in seconds.",
    },
    {
        icon: "",
        title: "Internal Talent Pool",
        desc: "Build a searchable talent pool to reduce sourcing costs and enable faster re-submissions.",
    },
    {
        icon: "",
        title: "Leadership Visibility",
        desc: "Give leadership clear, non-intrusive dashboards with real-time hiring pipeline insights.",
    },
];

const stats = [
    { number: "10x", label: "Faster Submissions" },
    { number: "85%", label: "Reduced Manual Work" },
    { number: "500+", label: "Candidates Tracked" },
    { number: "99%", label: "Client Satisfaction" },
];

export default function Landing() {
    return (
        <div className="landing-page">
            <WaveBackground />
            {/* Navbar */}
            <nav className="landing-nav">
                <Link to="/" className="landing-logo">
                    <img src={logo} alt="Thinkwise" className="logo-image" />
                    
                </Link>
                <div className="landing-nav-actions">
                    <ThemeToggle />
                    <Link to="/login" className="btn btn-ghost">
                        Sign In
                    </Link>
                    <Link to="/signup" className="btn btn-primary">
                        Get Started
                    </Link>
                </div>
            </nav>

            {/* Hero */}
            <section className="landing-hero">
                <div className="landing-badge">
                    <span className="badge-dot"></span>
                    Built for Hiring Teams
                </div>
                <h1>
                    The Smarter Way to<br />
                    Manage Hiring
                </h1>
                <p>
                    A submission-centric hiring workspace that anchors recruiting around
                    requirements, tracks ownership, integrates AI screening, and delivers
                    client-ready trackers — all in one platform.
                </p>
                {/* <div className="landing-hero-actions">
                    <Link to="/signup" className="btn btn-primary btn-lg">
                        🚀 Start Hiring
                    </Link>
                    <Link to="/login" className="btn btn-ghost btn-lg">
                        Sign In →
                    </Link>
                </div> */}
            </section>

            {/* Features */}
            <section className="landing-features">
                <div className="landing-features-heading">
                    <h2>Everything Your Team Needs</h2>
                    <p>Powerful features designed for modern staffing workflows</p>
                </div>
                <div className="features-grid">
                    {features.map((f, i) => (
                        <div className="feature-card" key={i}>
                            <div className="feature-icon">{f.icon}</div>
                            <h3>{f.title}</h3>
                            <p>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Stats */}
            <section className="landing-stats">
                <div className="stats-grid">
                    {stats.map((s, i) => (
                        <div className="stat-card" key={i}>
                            <div className="stat-number">{s.number}</div>
                            <div className="stat-label">{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                © 2026 Thinkwise Hiring Desk. Built for teams that hire with purpose.
            </footer>
        </div>
    );
}
