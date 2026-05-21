import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";
import ThemeToggle from "../components/ThemeToggle";
import WaveBackground from "../components/WaveBackground";
import logo from "../assets/thinkwise_logo_transparent.png";
import "../App.css";

export default function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: { preventDefault(): void }) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const res = await api.post("/auth/login", { email: email.trim().toLowerCase(), password });
            await login(res.access_token);
            navigate("/dashboard");
        } catch (err: any) {
            setError(err.detail || "Invalid email or password.");
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
                <div className="auth-header">
                    <h2>Welcome back</h2>
                    <p>Sign in to your hiring workspace</p>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form className="auth-form" onSubmit={handleLogin}>
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

                    <PasswordInput
                        id="password"
                        label="Password"
                        value={password}
                        onChange={setPassword}
                        required
                        autoComplete="current-password"
                    />

                    <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                        {loading ? "Signing in…" : "Sign In"}
                    </button>
                </form>

                <div className="auth-footer">
                    <Link to="/forgot-password" style={{ fontSize: 13 }}>Forgot password?</Link>
                    <span style={{ margin: "0 0.5rem", color: "var(--text-secondary)" }}>·</span>
                    Don't have an account? <Link to="/signup">Create one</Link>
                </div>
            </div>
        </div>
    );
}
