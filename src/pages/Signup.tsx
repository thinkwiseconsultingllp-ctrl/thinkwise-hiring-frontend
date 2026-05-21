import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";
import ThemeToggle from "../components/ThemeToggle";
import WaveBackground from "../components/WaveBackground";
import logo from "../assets/thinkwise_logo_transparent.png";
import "../App.css";

export default function Signup() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSignup = async (e: { preventDefault(): void }) => {
        e.preventDefault();
        setError("");
        if (password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }
        if (password !== confirm) {
            setError("Passwords do not match");
            return;
        }
        setLoading(true);
        try {
            const res = await api.post("/auth/signup", {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                password,
            });
            await login(res.access_token);
            navigate("/dashboard");
        } catch (err: any) {
            setError(err.detail || "Something went wrong. Please try again.");
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
                    <h2>Create your account</h2>
                    <p>Your email must be approved by an admin first.</p>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form className="auth-form" onSubmit={handleSignup}>
                    <div className="form-group">
                        <label htmlFor="name">Full Name</label>
                        <input
                            id="name"
                            type="text"
                            placeholder="Jane Smith"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

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
                        placeholder="Min. 8 characters"
                        showStrength
                        required
                        autoComplete="new-password"
                    />

                    <PasswordInput
                        id="confirm"
                        label="Confirm Password"
                        value={confirm}
                        onChange={setConfirm}
                        placeholder="Repeat password"
                        required
                        autoComplete="new-password"
                    />

                    <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                        {loading ? "Creating account…" : "Create Account"}
                    </button>
                </form>

                <div className="auth-footer">
                    Already have an account? <Link to="/login">Sign in</Link>
                </div>
            </div>
        </div>
    );
}
