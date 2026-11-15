/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingSkeleton } from './components/StateViews';
import { AccessibilityProvider } from './context/AccessibilityContext';
import { AuthProvider, useAuth, type UserRole } from './context/AuthContext';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const FeaturesPage = lazy(() => import('./pages/FeaturesPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SeniorDashboard = lazy(() => import('./pages/SeniorDashboard'));
const AssistantPage = lazy(() => import('./pages/AssistantPage'));
const ScamShieldPage = lazy(() => import('./pages/ScamShieldPage'));
const AudioReaderPage = lazy(() => import('./pages/AudioReaderPage'));
const WellnessPage = lazy(() => import('./pages/WellnessPage'));
const AcademyPage = lazy(() => import('./pages/AcademyPage'));
const ResearchPage = lazy(() => import('./pages/ResearchPage'));
const RemindersPage = lazy(() => import('./pages/RemindersPage'));
const FamilyHubPage = lazy(() => import('./pages/FamilyHubPage'));
const AutonomyPage = lazy(() => import('./pages/AutonomyPage'));
const EmergencyPage = lazy(() => import('./pages/EmergencyPage'));
const BackupPage = lazy(() => import('./pages/BackupPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const CaregiverDashboard = lazy(() => import('./pages/CaregiverDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

function PageLoader() {
  return (
    <div className="min-h-screen p-8 bg-[#FAF7F0] dark:bg-[#0B1320]">
      <div className="max-w-3xl mx-auto">
        <LoadingSkeleton rows={4} />
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireRole({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    const fallback = user.role === 'admin' ? '/admin' : user.role === 'caregiver' ? '/caregiver' : '/dashboard';
    return <Navigate to={fallback} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AccessibilityProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/features" element={<FeaturesPage />} />
                <Route path="/login" element={<LoginPage initialMode="login" />} />
                <Route path="/register" element={<LoginPage initialMode="register" />} />

                <Route path="/dashboard" element={<RequireAuth><SeniorDashboard /></RequireAuth>} />
                <Route path="/assistant" element={<RequireAuth><AssistantPage /></RequireAuth>} />
                <Route path="/scam-shield" element={<RequireAuth><ScamShieldPage /></RequireAuth>} />
                <Route path="/ocr-reader" element={<RequireAuth><AudioReaderPage /></RequireAuth>} />
                <Route path="/wellness" element={<RequireAuth><WellnessPage /></RequireAuth>} />
                <Route path="/academy" element={<RequireAuth><AcademyPage /></RequireAuth>} />
                <Route path="/research" element={<RequireAuth><ResearchPage /></RequireAuth>} />
                <Route path="/reminders" element={<RequireAuth><RemindersPage /></RequireAuth>} />
                <Route path="/family" element={<RequireAuth><FamilyHubPage /></RequireAuth>} />
                <Route path="/autonomy" element={<RequireAuth><AutonomyPage /></RequireAuth>} />
                <Route path="/emergency" element={<RequireAuth><EmergencyPage /></RequireAuth>} />
                <Route path="/backup" element={<RequireAuth><BackupPage /></RequireAuth>} />
                <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />

                <Route
                  path="/caregiver"
                  element={
                    <RequireRole roles={['caregiver', 'admin']}>
                      <CaregiverDashboard />
                    </RequireRole>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RequireRole roles={['admin']}>
                      <AdminDashboard />
                    </RequireRole>
                  }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </AccessibilityProvider>
    </ErrorBoundary>
  );
}
