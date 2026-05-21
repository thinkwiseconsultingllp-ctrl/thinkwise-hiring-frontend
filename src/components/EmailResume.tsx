import { useState, useEffect } from 'react';
import { candidateApi } from '../services/api';

export default function EmailResumes() {
    const [isSyncingEmail, setIsSyncingEmail] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Settings State
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [imapServer, setImapServer] = useState("outlook.office365.com");

    // Load saved settings when page opens
    useEffect(() => {
        const savedEmail = localStorage.getItem("tw_email") || "";
        const savedPass = localStorage.getItem("tw_email_pass") || "";
        const savedServer = localStorage.getItem("tw_imap_server") || "outlook.office365.com";
        setEmail(savedEmail);
        setPassword(savedPass);
        setImapServer(savedServer);
    }, []);

    const saveSettings = () => {
        if (!email || !password || !imapServer) {
            alert("Please fill in all fields!");
            return;
        }
        localStorage.setItem("tw_email", email);
        localStorage.setItem("tw_email_pass", password);
        localStorage.setItem("tw_imap_server", imapServer);
        alert("Settings saved successfully!");
        setShowSettings(false);
    };

    const handleEmailSync = async () => {
        if (!email || !password) {
            alert("Please configure your email settings first!");
            setShowSettings(true);
            return;
        }

        setIsSyncingEmail(true);
        try {
            // Send the saved credentials to your Python backend!
            const res = await candidateApi.fetchFromEmail({
                email: email,
                password: password,
                imap_server: imapServer
            });
            const lines = [`Sync complete! Added ${res.processed} new resumes.`];
            if (res.ai_failed) {
                lines.push(`${res.ai_failed} saved as raw text only — AI structuring failed for those.`);
            }
            if (res.failed) {
                lines.push(`${res.failed} attachment${res.failed > 1 ? "s" : ""} failed to process.`);
            }
            if (Array.isArray(res.errors) && res.errors.length) {
                lines.push("\nErrors:\n• " + res.errors.slice(0, 5).join("\n• "));
            }
            alert(lines.join("\n"));
        } catch (error: any) {
            alert(error.detail || error.message || "Failed to connect to email. Check your app password and settings.");
        } finally {
            setIsSyncingEmail(false);
        }
    };

    return (
        <div style={{ padding: "32px", maxWidth: "800px", margin: "0 auto" }}>
            <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "8px" }}>Email Integrations</h1>
            <p style={{ color: "var(--text-muted)", marginBottom: "32px" }}>
                Connect your inbox to automatically pull resumes into your talent pool.
            </p>

            {showSettings ? (
                <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "24px", background: "var(--bg-card)", marginBottom: "24px", animation: "fadeIn 0.2s" }}>
                    <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "16px", display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                        Configuration Settings
                    </h3>

                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <div>
                            <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "4px" }}>Email Provider (IMAP Server)</label>
                            <select
                                value={imapServer}
                                onChange={(e) => setImapServer(e.target.value)}
                                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", color: "var(--text-primary)", outline: "none" }}
                            >
                                <option value="outlook.office365.com">Outlook / Hotmail (outlook.office365.com)</option>
                                <option value="imap.gmail.com">Gmail (imap.gmail.com)</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "4px" }}>Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your.email@outlook.com"
                                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", color: "var(--text-primary)", outline: "none" }}
                            />
                        </div>

                        <div>
                            <label style={{ display: "block", fontSize: "14px", fontWeight: "500", marginBottom: "4px" }}>App Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Paste your 16-character App Password here"
                                style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", color: "var(--text-primary)", outline: "none" }}
                            />
                        </div>

                        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                            <button
                                onClick={saveSettings}
                                style={{ background: "var(--accent)", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}
                            >
                                Save Settings
                            </button>
                            <button
                                onClick={() => setShowSettings(false)}
                                style={{ background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", padding: "10px 16px", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                    {/* BUTTON 1: Configure Email */}
                    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "24px", background: "var(--bg-card)", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                        <div style={{ marginBottom: "16px", color: "var(--text-secondary)" }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                        </div>
                        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "8px" }}>Configure Email</h3>
                        <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "24px", flexGrow: 1 }}>
                            Set up your IMAP connection, app passwords, and select which inbox to monitor.
                        </p>
                        <button
                            onClick={() => setShowSettings(true)}
                            style={{ background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", padding: "10px 16px", borderRadius: "6px", fontWeight: "600", cursor: "pointer", width: "100%" }}
                        >
                            Open Settings
                        </button>
                    </div>

                    {/* BUTTON 2: Fetch New */}
                    <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "24px", background: "var(--bg-card)", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                        <div style={{ marginBottom: "16px", color: "var(--text-secondary)" }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/></svg>
                        </div>
                        <h3 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "8px" }}>Fetch New Resumes</h3>
                        <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "24px", flexGrow: 1 }}>
                            Manually trigger a scan of your configured inbox to download any new unread resumes.
                        </p>
                        <button
                            onClick={handleEmailSync}
                            disabled={isSyncingEmail}
                            style={{ background: "var(--accent)", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "6px", fontWeight: "600", cursor: isSyncingEmail ? "not-allowed" : "pointer", width: "100%", opacity: isSyncingEmail ? 0.7 : 1 }}
                        >
                            {isSyncingEmail ? "Syncing Inbox..." : "Fetch Now"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}