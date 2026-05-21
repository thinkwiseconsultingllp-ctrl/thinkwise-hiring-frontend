import { useState } from "react";
import "../styles/pages.css";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from "recharts";

export default function Analytics() {
    const [loading] = useState(false);
    const stats = {
        totalSubmissions: 248,
        avgScore: 78,
        selectionRate: "24%",
        activeRecruiters: 6
    };

    const statusFunnelData = [
        { name: "Screening", value: 140 },
        { name: "Interviewing", value: 65 },
        { name: "Offered", value: 25 },
        { name: "Rejected", value: 18 },
    ];

    const scoreDistributionData = [
        { range: "0-40", count: 12 },
        { range: "41-60", count: 45 },
        { range: "61-80", count: 110 },
        { range: "81-100", count: 81 },
    ];

    const recruiterPerformanceData = [
        { name: "Sarah", processed: 85, hired: 12 },
        { name: "John", processed: 65, hired: 8 },
        { name: "Mike", processed: 50, hired: 4 },
        { name: "Emma", processed: 48, hired: 6 },
    ];

    const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

    if (loading) {
        return <div style={{ padding: "40px", textAlign: "center" }}>Loading Analytics...</div>;
    }

    return (
        <div>
            {/* Header section (kept from your original code) */}
            <div className="page-header">
                <div>
                    <h1>Analytics</h1>
                    <p className="page-header-sub">
                        Hiring pipeline insights and recruiter performance
                    </p>
                </div>
            </div>

            {/* High-level stats row (kept your classes, injected live data) */}
            <div className="stats-row">
                <div className="stat-box">
                    <div className="stat-box-value accent">{stats.totalSubmissions}</div>
                    <div className="stat-box-label">Total Submissions</div>
                </div>
                <div className="stat-box">
                    <div className="stat-box-value" style={{ color: "#0088FE" }}>{stats.avgScore}/100</div>
                    <div className="stat-box-label">Avg AI Score</div>
                </div>
                <div className="stat-box">
                    <div className="stat-box-value" style={{ color: "#00C49F" }}>{stats.selectionRate}</div>
                    <div className="stat-box-label">Selection Rate</div>
                </div>
                <div className="stat-box">
                    <div className="stat-box-value">{stats.activeRecruiters}</div>
                    <div className="stat-box-label">Active Recruiters</div>
                </div>
            </div>

            {/* Dashboard Charts Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px", marginTop: "24px" }}>

                {/* Status Funnel */}
                <div className="data-table-wrap" style={{ padding: "24px", margin: 0 }}>
                    <h3 style={{ marginBottom: "16px", fontSize: "16px", fontWeight: "600" }}>Pipeline Status Funnel</h3>
                    <div style={{ width: "100%", height: "300px" }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie
                                    data={statusFunnelData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, percent }: { name?: string | number; percent?: number }) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                                >
                                    {statusFunnelData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Score Distribution */}
                <div className="data-table-wrap" style={{ padding: "24px", margin: 0 }}>
                    <h3 style={{ marginBottom: "16px", fontSize: "16px", fontWeight: "600" }}>AI Score Distribution</h3>
                    <div style={{ width: "100%", height: "300px" }}>
                        <ResponsiveContainer>
                            <BarChart data={scoreDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Candidates" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recruiter Performance */}
                <div className="data-table-wrap" style={{ padding: "24px", margin: 0, gridColumn: "1 / -1" }}>
                    <h3 style={{ marginBottom: "16px", fontSize: "16px", fontWeight: "600" }}>Recruiter Performance</h3>
                    <div style={{ width: "100%", height: "350px" }}>
                        <ResponsiveContainer>
                            <AreaChart data={recruiterPerformanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorProcessed" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorHired" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" />
                                <YAxis />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <Tooltip />
                                <Legend />
                                <Area type="monotone" dataKey="processed" stroke="#8884d8" fillOpacity={1} fill="url(#colorProcessed)" name="Candidates Processed" />
                                <Area type="monotone" dataKey="hired" stroke="#82ca9d" fillOpacity={1} fill="url(#colorHired)" name="Candidates Hired" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
        </div>
    );
}