import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import SharedNavbar from '../components/SharedNavbar';
import Footer from '../components/Footer';

const InstituteDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    if (user?.role !== 'institute') {
      setError('You do not have permission to access this page.');
      setLoading(false);
      return;
    }
    authApi.getReferredUsers()
      .then((response) => {
        setTotalUsers(response.count || 0);
        setError(null);
      })
      .catch(() => setError('Failed to fetch referrals. Please try again.'))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col bg-[#fff9ed]">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <SharedNavbar />
      <div className="container mx-auto px-4 py-8 flex-grow mt-16">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold mb-4">Institute Management</h1>
          
          {user?.role === 'institute' && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h2 className="text-xl font-semibold mb-2">Your Institute Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600">Name:</p>
                  <p className="font-medium">{user.name || user.email || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-600">Email:</p>
                  <p className="font-medium">{user.email || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-600">Phone:</p>
                  <p className="font-medium">{user.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-600">Referral Code:</p>
                  <p className="font-medium bg-yellow-100 px-2 py-1 rounded inline-block">
                    {user.referralCode}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Paid referrals:</p>
                  <p className="font-medium">{loading ? '…' : totalUsers}</p>
                </div>
              </div>
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default InstituteDashboardPage;
