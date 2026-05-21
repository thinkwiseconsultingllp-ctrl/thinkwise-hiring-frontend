import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import ThemeToggle from "../components/ThemeToggle";
import WaveBackground from "../components/WaveBackground";
import logo from "../assets/thinkwise_logo_transparent.png";
import "../App.css";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: { preventDefault(): void }) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await api.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
            setSent(true);
        } catch (err: any) {
            setError(err.detail || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <WaveBackground />
            <div className="auth-top-bar">
                <Link to="/" className="landing-logo">
                    <img src={logo} alt="Thinkwise" className="logo-image" />
                </Link>
                <ThemeToggle />
            </div>

            <div className="auth-card">
                {!sent ? (
                    <>
                        <div className="auth-header">
                            <h2>Forgot password?</h2>
                            <p>Enter your email and your admin will share a reset link with you.</p>
                        </div>

                        {error && <div className="auth-error">{error}</div>}

                        <form className="auth-form" onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label htmlFor="email">Email</label>
                                <input
                                    id="email"
                                    type="email"
                                    placeholder="you@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                                {loading ? "Submitting…" : "Request Reset"}
                            </button>
                        </form>

                        <div className="auth-footer">
                            <Link to="/login">Back to sign in</Link>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="auth-header">
                            <h2>Request received</h2>
                            <p>
                                Your admin has been notified. They will generate a reset link and share it with you directly.
                            </p>
                        </div>
                        <div className="auth-footer" style={{ marginTop: "1rem" }}>
                            <Link to="/login">Back to sign in</Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
