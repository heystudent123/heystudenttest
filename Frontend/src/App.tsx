import React, { useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
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
const AdminPage                = lazy(() => import('./pages/AdminPage'));
const AdminUsersPage           = lazy(() => import('./pages/AdminUsersPage'));
const AdminInstitutesPage      = lazy(() => import('./pages/AdminInstitutesPage'));
const AdminAccommodationsPage  = lazy(() => import('./pages/AdminAccommodationsPage'));
const AdminAccommodationEditPage = lazy(() => import('./pages/AdminAccommodationEditPage'));
const AdminCoursesPage         = lazy(() => import('./pages/AdminCoursesPage'));
const AdminVideosPage          = lazy(() => import('./pages/AdminVideosPage'));
const VideosPage               = lazy(() => import('./pages/VideosPage'));
const AdminPostsPage           = lazy(() => import('./pages/AdminPostsPage'));
const AdminPaidUsersPage       = lazy(() => import('./pages/AdminPaidUsersPage'));
const AdminPrePaymentLeadsPage = lazy(() => import('./pages/AdminPrePaymentLeadsPage'));
const CuetPredictorPage        = lazy(() => import('./pages/CuetPredictorPage'));
const AdminCuetPredictorPage   = lazy(() => import('./pages/AdminCuetPredictorPage'));
const StudentDashboardPage     = lazy(() => import('./pages/StudentDashboardPage'));
const PostDetailPage           = lazy(() => import('./pages/PostDetailPage'));
const InstituteDashboardPage   = lazy(() => import('./pages/InstituteDashboardPage'));

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
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/user-profile" element={<UserProfile />} />
                <Route path="/admin" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/users" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminUsersPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/institutes" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminInstitutesPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/accommodations" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminAccommodationsPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/accommodations/new" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminAccommodationEditPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/accommodations/edit/:id" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminAccommodationEditPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/courses" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminCoursesPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/videos" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminVideosPage />
                  </ProtectedRoute>
                } />
                <Route path="/videos" element={<VideosPage />} />
                <Route path="/admin/posts" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminPostsPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/paid-users" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminPaidUsersPage />
                  </ProtectedRoute>
                } />
                <Route path="/admin/pre-payment-leads" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminPrePaymentLeadsPage />
                  </ProtectedRoute>
                } />
                <Route path="/college-predictor" element={<CuetPredictorPage />} />
                <Route path="/admin/cuet-predictor" element={
                  <ProtectedRoute requiredRole="admin">
                    <AdminCuetPredictorPage />
                  </ProtectedRoute>
                } />
                <Route path="/student/dashboard" element={
                  <ProtectedRoute>
                    <StudentDashboardPage />
                  </ProtectedRoute>
                } />
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