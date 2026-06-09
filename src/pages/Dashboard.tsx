import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import "./App.css";

// Public pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

// Layout
import DashboardLayout from "./components/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";

// Dashboard pages
import Dashboard from "./pages/Dashboard";
import RequirementDetail from "./pages/RequirementDetail";
import ProfileFullView from "./pages/ProfileFullView";
import AssignmentRequests from "./pages/AssignmentRequests";
import RequirementCreate from "./pages/RequirementCreate";
import SubmitCandidate from "./pages/SubmitCandidate";
import TrackerView from "./pages/TrackerView";
import TalentPool from "./pages/TalentPool";
import CandidateDetail from "./pages/CandidateDetail";
import MyRequirements from "./pages/MyRequirements";
import MySubmissions from "./pages/MySubmissions";
import Analytics from "./pages/Analytics";
import TeamManagement from "./pages/TeamManagement";
import Clients from "./pages/Clients";
import EmailResumes from "./components/EmailResume";
import LinkedInSearchPage from "./pages/LinkedInSearchPage";
import TestTools from "./pages/TestTools";

function RequirementDetailRoute() {
    const { id } = useParams<{ id: string }>();
    return <RequirementDetail key={id} />;
}

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Protected routes with sidebar layout */}
                <Route
                    element={
                        <ProtectedRoute>
                            <DashboardLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/dashboard/:clientSlug" element={<Dashboard />} />
                    <Route path="/dashboard/:clientSlug/:reqSlug" element={<Dashboard />} />

                    {/* Requirements */}
                    <Route path="/requirements" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/requirements/new" element={<RequirementCreate />} />
                    <Route path="/requirements/:id" element={<RequirementDetailRoute />} />
                    <Route path="/requirements/:id/profiles/:candidateId" element={<ProfileFullView />} />
                    <Route path="/assignment-requests" element={<AssignmentRequests />} />
                    <Route path="/requirements/:reqId/submit" element={<SubmitCandidate />} />

                    {/* Tracker */}
                    <Route path="/tracker/:reqId" element={<TrackerView />} />

                    {/* Talent Pool */}
                    <Route path="/talent-pool" element={<TalentPool />} />
                    <Route path="/talent-pool/:candidateId" element={<CandidateDetail />} />

                    {/* My Requirements (recruiter) */}
                    <Route path="/my-requirements" element={<MyRequirements />} />
                    <Route path="/my-submissions" element={<MySubmissions />} />

                    {/* Analytics */}
                    <Route path="/analytics" element={<Navigate to="/analytics/overview" replace />} />
                    <Route path="/analytics/:tab" element={<Analytics />} />

                    {/* Team Management (Super Admin only) */}
                    <Route path="/team" element={
                        <ProtectedRoute>
                            <TeamManagement />
                        </ProtectedRoute>
                    } />
                    <Route path="/clients" element={
                        <ProtectedRoute adminOnly>
                            <Clients />
                        </ProtectedRoute>
                    } />

                    {/* New Email Resumes Page */}
                    <Route path="/email-resumes" element={<EmailResumes />} />
                    <Route path="/linkedin-search" element={<LinkedInSearchPage />} />
                    <Route path="/test-tools" element={
                        <ProtectedRoute adminOnly>
                            <TestTools />
                        </ProtectedRoute>
                    } />

                </Route>

                {/* Catch all */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;