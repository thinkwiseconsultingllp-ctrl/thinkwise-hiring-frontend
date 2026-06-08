import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import ThemeToggle from "./ThemeToggle";

import JdSidePanel from "./JdSidePanel";
import ProfileDrawer from "./ProfileDrawer";
import ResumeDrawer from "./ResumeDrawer";
import Icon from "./Icon";
import { JdViewerProvider, useJdViewer } from "../context/JdViewerContext";
import { useSideDrawer } from "../context/SideDrawerContext";
import logo from "../assets/thinkwise_logo_transparent.png";
import "./DashboardLayout.css";

const STATUS_LABELS: Record<string, string> = {
    L1_SELECTED: "L1 Selected",
    L2_SELECTED: "L2 Selected",
    HR_ROUND: "HR Round",
    SELECTED: "Selected",
    REJECTED: "Rejected",
};

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

export default function DashboardLayout() {
    return (
        <JdViewerProvider>
            <DashboardLayoutInner />
        </JdViewerProvider>
    );
}

function DashboardLayoutInner() {
    const { user, logout, isAdmin, isSuperAdmin } = useAuth();
    const { isOpen: jdOpen } = useJdViewer();
    const sideDrawer = useSideDrawer();
    const navigate = useNavigate();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [bellOpen, setBellOpen] = useState(false);


    const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
        try { return new Set(JSON.parse(localStorage.getItem("tw_dismissed_notifs") || "[]")); }
        catch { return new Set(); }
    });
    const bellRef = useRef<HTMLDivElement>(null);

    const getReadIds = (): Set<string> => {
        try { return new Set(JSON.parse(localStorage.getItem("tw_read_notifs") || "[]")); }
        catch { return new Set(); }
    };

    const saveDismissed = (ids: Set<string>) => {
        localStorage.setItem("tw_dismissed_notifs", JSON.stringify([...ids]));
        setDismissedIds(new Set(ids));
    };

    const dismissOne = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const next = new Set(dismissedIds);
        next.add(id);
        saveDismissed(next);
    };

    const dismissAll = () => {
        const next = new Set(dismissedIds);
        notifications.filter(n => !dismissedIds.has(n.id)).forEach(n => next.add(n.id));
        saveDismissed(next);
    };

    const fetchNotifications = async () => {
        try {
            const data = await api.get("/notifications");
            setNotifications(data || []);
        } catch { /* silent */ }
    };

    useEffect(() => {
        if (!user) return;
        void fetchNotifications();
        const interval = setInterval(() => void fetchNotifications(), 60000);
        return () => clearInterval(interval);
    }, [user?.id]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
                setBellOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const readIds = getReadIds();
    const visibleNotifications = notifications.filter(n => !dismissedIds.has(n.id));
    const unreadCount = visibleNotifications.filter(n => !readIds.has(n.id)).length;

    const handleBellClick = () => {
        setBellOpen(prev => !prev);
        if (!bellOpen) {
            localStorage.setItem("tw_read_notifs", JSON.stringify(notifications.map(n => n.id)));
        }
    };

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    const closeMobile = () => setMobileOpen(false);

    return (
        <div className={`layout ${collapsed ? "layout--collapsed" : ""} ${jdOpen ? "layout--jd-open" : ""}`}>
            {mobileOpen && <div className="sidebar-overlay" onClick={closeMobile} />}

            <aside className={`sidebar ${mobileOpen ? "sidebar--open" : ""}`}>
                <div className="sidebar-top">
                    <div className="sidebar-brand" onClick={() => navigate("/dashboard")}>
                        <img src={logo} alt="TW" className="sidebar-logo" />
                        {!collapsed && <span className="sidebar-brand-text"></span>}
                    </div>
                    <button
                        className="sidebar-collapse-btn desktop-only"
                        onClick={() => setCollapsed(!collapsed)}
                        title={collapsed ? "Expand" : "Collapse"}
                    >
                        {collapsed ? "\u25B6" : "\u25C0"}
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {!isSuperAdmin && (
                        <div className="nav-section">
                            {!collapsed && <span className="nav-label">Main</span>}
                            <NavLink to="/dashboard" end className="nav-item" onClick={closeMobile}>
                                <span className="nav-icon"><Icon name="dashboard" size={16} /></span>
                                {!collapsed && <span>Dashboard</span>}
                            </NavLink>
                            {!isAdmin && (
                                <NavLink to="/my-requirements" className="nav-item" onClick={closeMobile}>
                                    <span className="nav-icon"><Icon name="briefcase" size={16} /></span>
                                    {!collapsed && <span>My Requirements</span>}
                                </NavLink>
                            )}
                            {!isAdmin && (
                                <NavLink to="/my-submissions" className="nav-item" onClick={closeMobile}>
                                    <span className="nav-icon"><Icon name="send" size={16} /></span>
                                    {!collapsed && <span>My Submissions</span>}
                                </NavLink>
                            )}
                        </div>
                    )}

                    {!isSuperAdmin && (
                        <div className="nav-section">
                            {!collapsed && <span className="nav-label">Recruitment</span>}

                            {/* THIS IS NOW A NORMAL LINK TO THE NEW PAGE */}
                            <NavLink to="/email-resumes" className="nav-item" onClick={closeMobile}>
                                <span className="nav-icon"><Icon name="mail" size={16} /></span>
                                {!collapsed && <span>Resumes from Email</span>}
                            </NavLink>

                            <NavLink to="/linkedin-search" className="nav-item" onClick={closeMobile}>
                                <span className="nav-icon"><Icon name="linkedin" size={16} /></span>
                                {!collapsed && <span>LinkedIn Search</span>}
                            </NavLink>

                            <NavLink to="/talent-pool" className="nav-item" onClick={closeMobile}>
                                <span className="nav-icon"><Icon name="talent-pool" size={16} /></span>
                                {!collapsed && <span>Talent Pool</span>}
                            </NavLink>
                            <NavLink to="/assignment-requests" className="nav-item" onClick={closeMobile}>
                                <span className="nav-icon"><Icon name="send" size={16} /></span>
                                {!collapsed && <span>{isAdmin ? "Assignment Requests" : "My Requests"}</span>}
                            </NavLink>
                            <NavLink to="/analytics" className="nav-item" onClick={closeMobile}>
                                <span className="nav-icon"><Icon name="chart" size={16} /></span>
                                {!collapsed && <span>Analytics</span>}
                            </NavLink>
                        </div>
                    )}

                    {isAdmin && isSuperAdmin && (
                        <div className="nav-section">
                            {!collapsed && <span className="nav-label">Overview</span>}
                            <NavLink to="/dashboard" className="nav-item" onClick={closeMobile}>
                                <span className="nav-icon"><Icon name="dashboard" size={16} /></span>
                                {!collapsed && <span>Dashboard</span>}
                            </NavLink>
                            <NavLink to="/analytics" className="nav-item" onClick={closeMobile}>
                                <span className="nav-icon"><Icon name="chart" size={16} /></span>
                                {!collapsed && <span>Analytics</span>}
                            </NavLink>
                        </div>
                    )}
                    {isAdmin && isSuperAdmin && (
                        <div className="nav-section">
                            {!collapsed && <span className="nav-label">Admin</span>}
                            <NavLink to="/team" className="nav-item" onClick={closeMobile}>
                                <span className="nav-icon"><Icon name="team" size={16} /></span>
                                {!collapsed && <span>Team</span>}
                            </NavLink>
                            <NavLink to="/clients" className="nav-item" onClick={closeMobile}>
                                <span className="nav-icon"><Icon name="briefcase" size={16} /></span>
                                {!collapsed && <span>Clients</span>}
                            </NavLink>
                        </div>
                    )}
                </nav>

                <div className="sidebar-bottom">
                    <div className="sidebar-user">
                        <div className="user-avatar">
                            {user?.name?.charAt(0).toUpperCase()}
                        </div>
                        {!collapsed && (
                            <div className="user-info">
                                <span className="user-name">{user?.name}</span>
                                <span className="user-role">{user?.role}</span>
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            <div className="main-area">
                <header className="topbar">
                    <button className="mobile-menu-btn mobile-only" onClick={() => setMobileOpen(!mobileOpen)}>
                        {"\u2630"}
                    </button>
                    <div className="topbar-spacer" />
                    <div className="topbar-actions">
                        <ThemeToggle />
                        <div ref={bellRef} style={{ position: "relative" }}>
                            <button
                                onClick={handleBellClick}
                                className="btn btn-ghost btn-sm"
                                style={{ position: "relative", padding: "6px 10px" }}
                                title="Notifications"
                                aria-label="Notifications"
                            >
                                <Icon name="bell" size={16} />
                                {unreadCount > 0 && (
                                    <span style={{
                                        position: "absolute", top: "2px", right: "2px",
                                        background: "var(--accent)", color: "#fff",
                                        borderRadius: "999px", fontSize: "10px", fontWeight: 700,
                                        minWidth: "16px", height: "16px",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        padding: "0 3px", lineHeight: 1,
                                    }}>
                                        {unreadCount > 9 ? "9+" : unreadCount}
                                    </span>
                                )}
                            </button>
                            {bellOpen && (
                                <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: "340px", background: "var(--bg-primary)", border: "1px solid var(--border-subtle)", borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 1000, overflow: "hidden" }}>
                                    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)" }}>Notifications</span>
                                        {visibleNotifications.length > 0 && (
                                            <button onClick={dismissAll} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: "var(--text-muted)", padding: "2px 4px", borderRadius: "4px" }}>Clear all</button>
                                        )}
                                    </div>
                                    {visibleNotifications.length === 0 ? (
                                        <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "var(--font-size-sm)" }}>No updates yet</div>
                                    ) : (
                                        <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                                            {visibleNotifications.map(n => {
                                                const isAssignment = n.kind === "assignment_request" || n.kind === "assignment_decision";
                                                const target = isAssignment
                                                    ? (n.kind === "assignment_request" ? "/assignment-requests" : `/requirements/${n.requirement_id || ""}`)
                                                    : (n.requirement_id ? `/requirements/${n.requirement_id}` : "/dashboard");
                                                const accentColor = n.status === "rejected" || n.status === "REJECTED" ? "var(--accent)"
                                                    : n.status === "pending" ? "#ca8a04"
                                                        : "var(--success, #16a34a)";
                                                return (
                                                    <div
                                                        key={n.id}
                                                        onClick={() => { navigate(target); setBellOpen(false); }}
                                                        style={{
                                                            padding: "10px 16px", cursor: "pointer",
                                                            borderBottom: "1px solid var(--border-subtle)",
                                                            background: readIds.has(n.id) ? "transparent" : "var(--bg-secondary)",
                                                            transition: "background 0.15s", position: "relative",
                                                        }}
                                                    >
                                                        <button
                                                            onClick={(e) => dismissOne(e, n.id)}
                                                            style={{ position: "absolute", top: "8px", right: "10px", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px 4px", borderRadius: "4px" }}
                                                            aria-label="Dismiss"
                                                        ><Icon name="x" size={12} /></button>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--font-size-sm)", fontWeight: 500, color: "var(--text-primary)", marginBottom: "2px", paddingRight: "20px" }}>
                                                            <Icon
                                                                name={n.kind === "assignment_request" ? "users" : n.kind === "assignment_decision" ? "send" : "user"}
                                                                size={14}
                                                                style={{ color: "var(--text-secondary)", flexShrink: 0 }}
                                                            />
                                                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</span>
                                                            <span style={{ fontWeight: 400, color: "var(--text-secondary)" }}>·</span>
                                                            <span style={{ color: accentColor, fontWeight: 600 }}>
                                                                {n.kind === "application" ? (STATUS_LABELS[n.status] || n.subtitle) : n.subtitle}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", justifyContent: "space-between", gap: "8px" }}>
                                                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.context || ""}</span>
                                                            <span style={{ flexShrink: 0 }}>{n.occurred_at ? timeAgo(n.occurred_at) : ""}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <button onClick={handleLogout} className="btn btn-ghost btn-sm">Sign Out</button>
                    </div>
                </header>

                <main className="page-content">
                    <Outlet />
                </main>
            </div>



            <JdSidePanel />
            {sideDrawer.state.mode === "profile" && (
                <ProfileDrawer
                    jdId={sideDrawer.state.jdId}
                    profile={sideDrawer.state.profile}
                    action={sideDrawer.state.action}
                    initialTab={sideDrawer.state.initialTab}
                />
            )}
            {sideDrawer.state.mode === "resume" && (
                <ResumeDrawer
                    candidateId={sideDrawer.state.candidateId}
                    candidateName={sideDrawer.state.candidateName}
                />
            )}
        </div>
    );
}