import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import PasswordInput from "../components/PasswordInput";
import ThemeToggle from "../components/ThemeToggle";
import WaveBackground from "../components/WaveBackground";
import logo from "../assets/thinkwise_logo_transparent.png";
import "../App.css";

export default function ResetPassword() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token") ?? "";
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleReset = async (e: { preventDefault(): void }) => {
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
            await api.post("/auth/reset-password", { token, password });
            navigate("/login", { state: { message: "Password updated. Please sign in." } });
        } catch (err: any) {
            setError(err.detail || "Failed to reset password. The link may have expired.");
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="auth-page">
                <div className="auth-card">
                    <div className="auth-header">
                        <h2>Invalid link</h2>
                        <p>This reset link is missing a token. Ask your admin to generate a new one.</p>
                    </div>
                    <div className="auth-footer"><Link to="/login">Back to sign in</Link></div>
                </div>
            </div>
        );
    }

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
                    <h2>Set new password</h2>
                    <p>Choose a strong password for your account.</p>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form className="auth-form" onSubmit={handleReset}>
                    <PasswordInput
                        id="password"
                        label="New Password"
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
                        {loading ? "Updating…" : "Update Password"}
                    </button>
                </form>
            </div>
        </div>
    );
}
