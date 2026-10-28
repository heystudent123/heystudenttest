import React, { useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import { AuthProvider } from './context/AuthContext';
import { DashboardProvider } from './context/DashboardContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/dashboard/DashboardLayout';
import DashboardGate from './components/dashboard/DashboardGate';
import AdminLayout from './components/admin/AdminLayout';
import WhatsAppButton from './components/WhatsAppButton';
import LeadCaptureModal from './components/LeadCaptureModal';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';

// ── Critical routes — eagerly bundled (appear in initial viewport) ──────────
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import CoursesPage from './pages/CoursesPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Footer from './components/Footer';

// ── Non-critical routes — code-split into separate lazy chunks ───────────────
const ProfilePage              = lazy(() => import('./pages/CompleteProfile'));
const UserProfile              = lazy(() => import('./pages/UserProfile'));
const AdminOverviewPage        = lazy(() => import('./pages/admin/AdminOverviewPage'));
const AdminUsersPage           = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminInstitutesPage      = lazy(() => import('./pages/admin/AdminInstitutesPage'));
const AdminReferralsPage       = lazy(() => import('./pages/admin/AdminReferralsPage'));
const AdminCoursesPage         = lazy(() => import('./pages/admin/AdminCoursesPage'));
const AdminPostsPage           = lazy(() => import('./pages/admin/AdminPostsPage'));
const AdminPaymentsPage        = lazy(() => import('./pages/admin/AdminPaymentsPage'));
const AdminContactPage         = lazy(() => import('./pages/admin/AdminContactPage'));
const AdminQuestionBankPage    = lazy(() => import('./pages/admin/AdminQuestionBankPage'));
const AdminMockTestsPage       = lazy(() => import('./pages/admin/AdminMockTestsPage'));
const AdminPlansPage            = lazy(() => import('./pages/admin/AdminPlansPage'));
const MockTestsPage             = lazy(() => import('./pages/MockTestsPage'));
const MockTestRoomPage          = lazy(() => import('./pages/MockTestRoomPage'));
const MockTestResultPage       = lazy(() => import('./pages/MockTestResultPage'));
const DashboardOverviewPage    = lazy(() => import('./pages/dashboard/DashboardOverviewPage'));
const DashboardCoursesPage     = lazy(() => import('./pages/dashboard/DashboardCoursesPage'));
const DashboardCourseContentPage = lazy(() => import('./pages/dashboard/DashboardCourseContentPage'));
const DashboardMockTestsPage   = lazy(() => import('./pages/dashboard/DashboardMockTestsPage'));
const DashboardProfilePage     = lazy(() => import('./pages/dashboard/DashboardProfilePage'));
const PostDetailPage           = lazy(() => import('./pages/PostDetailPage'));
const InstituteDashboardPage   = lazy(() => import('./pages/InstituteDashboardPage'));
const ContactPage              = lazy(() => import('./pages/ContactPage'));

// Minimal fallback — uses CSS animation so no extra JS, no layout shift
const PageLoader = () => (
  <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff9ed' }}>
    <div style={{ width: 40, height: 40, border: '3px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

// Separate component to use hooks inside Router context
function AppContent() {
  const location = useLocation();
  const prevPathRef = useRef<string>('');
  const pageEnterTimeRef = useRef<number>(Date.now());

  // Track page views and time spent on each page
  useEffect(() => {
    const currentPath = location.pathname;
    const currentTime = Date.now();
    let pageName = 'Unknown';
    if (currentPath === '/') pageName = 'Home';
    else if (currentPath === '/about') pageName = 'About';
    else if (currentPath === '/login') pageName = 'Login';
    else if (currentPath === '/profile') pageName = 'Profile';
    else if (currentPath === '/user-profile') pageName = 'User Profile';
    else if (currentPath.startsWith('/admin'))
      pageName = 'Admin - ' + (currentPath.split('/').pop() || 'Dashboard');
    if (prevPathRef.current && prevPathRef.current !== currentPath) {
      const timeSpent = currentTime - pageEnterTimeRef.current;
      const prevPageName = prevPathRef.current === '/' ? 'Home' :
        prevPathRef.current.charAt(1).toUpperCase() + prevPathRef.current.slice(2).replace('/', ' ');
      void timeSpent;
      void prevPageName;
    }
    void pageName;
    prevPathRef.current = currentPath;
    pageEnterTimeRef.current = currentTime;
  }, [location]);

  return (
    <div className="App overflow-x-hidden w-full">
          <ToastContainer position="bottom-center" />
          <WhatsAppButton />
          <LeadCaptureModal />
          <div className="flex flex-col min-h-screen overflow-x-hidden w-full">
            {/* Navbar removed from here and added to individual page components */}
            <main className="flex-grow">
              <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/user-profile" element={<UserProfile />} />
                <Route path="/admin" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<AdminOverviewPage />} />
                  <Route path="users" element={<AdminUsersPage />} />
                  <Route path="institutes" element={<AdminInstitutesPage />} />
                  <Route path="referrals" element={<AdminReferralsPage />} />
                  <Route path="courses" element={<AdminCoursesPage />} />
                  <Route path="posts" element={<AdminPostsPage />} />
                  <Route path="payments" element={<AdminPaymentsPage />} />
                  <Route path="contact" element={<AdminContactPage />} />
                  <Route path="questions" element={<AdminQuestionBankPage />} />
                  <Route path="mock-tests" element={<AdminMockTestsPage />} />
                  <Route path="plans" element={<AdminPlansPage />} />
                </Route>
                {/* Legacy paths redirected to their new home under the admin shell */}
                <Route path="/admin/paid-users" element={<Navigate to="/admin/payments" replace />} />
                <Route path="/admin/pre-payment-leads" element={<Navigate to="/admin/payments" replace />} />
                <Route path="/admin/cuet-predictor" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/videos" element={<Navigate to="/admin" replace />} />
                <Route path="/videos" element={<Navigate to="/" replace />} />
                <Route path="/college-predictor" element={<Navigate to="/" replace />} />
                <Route path="/mock-tests" element={<MockTestsPage />} />
                <Route path="/mock-tests/attempt/:attemptId" element={
                  <ProtectedRoute>
                    <MockTestRoomPage />
                  </ProtectedRoute>
                } />
                <Route path="/mock-tests/result/:attemptId" element={
                  <ProtectedRoute>
                    <MockTestResultPage />
                  </ProtectedRoute>
                } />
                <Route path="/student/dashboard" element={
                  <ProtectedRoute>
                    <DashboardProvider>
                      <DashboardLayout />
                    </DashboardProvider>
                  </ProtectedRoute>
                }>
                  <Route element={<DashboardGate />}>
                    <Route index element={<DashboardOverviewPage />} />
                    <Route path="courses" element={<DashboardCoursesPage />} />
                    <Route path="courses/:courseId" element={<DashboardCourseContentPage />} />
                    <Route path="mock-tests" element={<DashboardMockTestsPage />} />
                    <Route path="profile" element={<DashboardProfilePage />} />
                  </Route>
                </Route>
                <Route path="/student/post/:id" element={
                  <ProtectedRoute>
                    <PostDetailPage />
                  </ProtectedRoute>
                } />
                <Route path="/institute/dashboard" element={
                  <ProtectedRoute>
                    <InstituteDashboardPage />
                  </ProtectedRoute>
                } />
              </Routes>
              </Suspense>
            </main>
            <Footer />
          </div>
        </div>
  );
}

export default App;