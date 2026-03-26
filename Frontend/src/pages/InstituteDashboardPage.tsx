import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi, PaginationParams } from '../services/api';
// Link import removed as it's not used
import SharedNavbar from '../components/SharedNavbar';
import Footer from '../components/Footer';

interface ReferredUser {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  college?: string;
  year?: string;
  createdAt: string;
}

interface Pagination {
  next?: {
    page: number;
    limit: number;
  };
  prev?: {
    page: number;
    limit: number;
  };
}

const InstituteDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [searchPhone, setSearchPhone] = useState<string>('');
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const fetchReferrals = async (params: PaginationParams = {}) => {
    try {
      setLoading(true);
      const response = await authApi.getReferredUsers(params);
      setReferredUsers(response.data);
      setTotalUsers(response.count);
      setPagination(response.pagination);
      setError(null);
    } catch (err) {
      console.error('Error fetching referrals:', err);
      setError('Failed to fetch referrals. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== 'institute') {
      setError('You do not have permission to access this page.');
      setLoading(false);
      return;
    }

    fetchReferrals({ page: currentPage, limit: 10 });
  }, [user, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchPhone(value);
    
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set new timeout for search
    const timeout = setTimeout(() => {
      setCurrentPage(1); // Reset to first page when searching
      fetchReferrals({ page: 1, limit: 10, phone: value });
    }, 500);
    
    setSearchTimeout(timeout);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page when searching
    fetchReferrals({ page: 1, limit: 10, phone: searchPhone });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fff9ed]">
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
                  <p className="text-gray-600">Total Referrals:</p>
                  <p className="font-medium">{totalUsers}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-4">Students Using Your Referral Code</h2>
            
            <form onSubmit={handleSearchSubmit} className="mb-4 flex">
              <input
                type="text"
                placeholder="Search by phone number"
                className="border rounded-l px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchPhone}
                onChange={handleSearchChange}
              />
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded-r hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Search
              </button>
            </form>

            {loading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : error ? (
              <div className="bg-red-100 text-red-700 p-4 rounded-lg">{error}</div>
            ) : referredUsers.length === 0 ? (
              <div className="bg-yellow-100 text-yellow-700 p-4 rounded-lg">
                No students have used your referral code yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">College</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {referredUsers.map((user) => (
                      <tr key={user._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name || user.email || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.phone || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.college || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.year || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!loading && !error && referredUsers.length > 0 && (
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">{referredUsers.length}</span> of{' '}
                  <span className="font-medium">{totalUsers}</span> results
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => pagination?.prev && handlePageChange(pagination.prev.page)}
                    disabled={!pagination?.prev}
                    className={`px-3 py-1 rounded ${
                      pagination?.prev
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 bg-gray-100 rounded">Page {currentPage}</span>
                  <button
                    onClick={() => pagination?.next && handlePageChange(pagination.next.page)}
                    disabled={!pagination?.next}
                    className={`px-3 py-1 rounded ${
                      pagination?.next
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default InstituteDashboardPage;
