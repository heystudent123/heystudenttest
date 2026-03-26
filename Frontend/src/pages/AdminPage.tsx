import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import SharedNavbar from '../components/SharedNavbar';
import { useAuth } from '../context/AuthContext';

const AdminPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect unauthenticated users; role access is enforced by ProtectedRoute and backend.
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [navigate, user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <SharedNavbar />
      <div className="min-h-screen bg-gray-50 px-4 sm:px-6 lg:px-8" style={{ paddingTop: '88px', paddingBottom: '48px' }}>
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>
        
        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg leading-6 font-medium text-gray-900">Admin Information</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Personal details and management options.</p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
            <dl className="sm:divide-y sm:divide-gray-200">
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Full name</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{user.name}</dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Email address</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{user.email}</dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Role</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    {user.role}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Link to="/admin/users" className="bg-white overflow-hidden shadow rounded-lg hover:ring-2 hover:ring-primary transition">
            <div className="px-4 py-5 sm:p-6 h-full flex flex-col">
              <h3 className="text-lg font-medium text-gray-900">User Management</h3>
              <p className="mt-4 text-sm text-gray-500 flex-grow">View and manage all registered users.</p>
              <span className="mt-5 inline-block px-4 py-2 text-sm font-medium text-white bg-primary rounded-md self-start">Go</span>
            </div>
          </Link>

          <Link to="/admin/institutes" className="bg-white overflow-hidden shadow rounded-lg hover:ring-2 hover:ring-primary transition">
            <div className="px-4 py-5 sm:p-6 h-full flex flex-col">
              <h3 className="text-lg font-medium text-gray-900">Institute Management</h3>
              <p className="mt-4 text-sm text-gray-500 flex-grow">View institutes and their referral statistics.</p>
              <span className="mt-5 inline-block px-4 py-2 text-sm font-medium text-white bg-primary rounded-md self-start">Go</span>
            </div>
          </Link>

          <Link to="/admin/accommodations" className="bg-white overflow-hidden shadow rounded-lg hover:ring-2 hover:ring-primary transition">
            <div className="px-4 py-5 sm:p-6 h-full flex flex-col">
              <h3 className="text-lg font-medium text-gray-900">Accommodation Management</h3>
              <p className="mt-4 text-sm text-gray-500 flex-grow">Add, edit, or remove accommodation listings.</p>
              <span className="mt-5 inline-block px-4 py-2 text-sm font-medium text-white bg-primary rounded-md self-start">Go</span>
            </div>
          </Link>

          <Link to="/admin/courses" className="bg-white overflow-hidden shadow rounded-lg hover:ring-2 hover:ring-primary transition">
            <div className="px-4 py-5 sm:p-6 h-full flex flex-col">
              <h3 className="text-lg font-medium text-gray-900">Course Management</h3>
              <p className="mt-4 text-sm text-gray-500 flex-grow">Add, edit, or remove course listings.</p>
              <span className="mt-5 inline-block px-4 py-2 text-sm font-medium text-white bg-primary rounded-md self-start">Go</span>
            </div>
          </Link>

          <Link to="/admin/posts" className="bg-white overflow-hidden shadow rounded-lg hover:ring-2 hover:ring-primary transition">
            <div className="px-4 py-5 sm:p-6 h-full flex flex-col">
              <h3 className="text-lg font-medium text-gray-900">Posts Management</h3>
              <p className="mt-4 text-sm text-gray-500 flex-grow">Create and manage posts with videos, images, and documents for the student dashboard.</p>
              <span className="mt-5 inline-block px-4 py-2 text-sm font-medium text-white bg-primary rounded-md self-start">Go</span>
            </div>
          </Link>

          <Link to="/admin/paid-users" className="bg-white overflow-hidden shadow rounded-lg hover:ring-2 hover:ring-green-500 transition">
            <div className="px-4 py-5 sm:p-6 h-full flex flex-col">
              <h3 className="text-lg font-medium text-gray-900">Paid Users</h3>
              <p className="mt-4 text-sm text-gray-500 flex-grow">View all users who have completed a payment, with totals, city, WhatsApp, and referral info.</p>
              <span className="mt-5 inline-block px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md self-start">Go</span>
            </div>
          </Link>

          <Link to="/admin/pre-payment-leads" className="bg-white overflow-hidden shadow rounded-lg hover:ring-2 hover:ring-amber-400 transition">
            <div className="px-4 py-5 sm:p-6 h-full flex flex-col">
              <h3 className="text-lg font-medium text-gray-900">Leads</h3>
              <p className="mt-4 text-sm text-gray-500 flex-grow">Phone numbers and details captured from the 30-second popup and pre-payment forms — track interested students before they pay.</p>
              <span className="mt-5 inline-block px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-md self-start">Go</span>
            </div>
          </Link>

        </div>
      </div>
    </div>
  </>
  );
};

export default AdminPage;