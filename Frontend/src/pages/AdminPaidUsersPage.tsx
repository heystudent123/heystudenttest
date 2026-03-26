import React, { useState, useEffect } from 'react';
import SharedNavbar from '../components/SharedNavbar';
import { authApi } from '../services/api';
import * as XLSX from 'xlsx';

interface Payment {
  _id: string;
  razorpayPaymentId?: string;
  amountInRupees?: number;
  purpose?: string;
  paidAt?: string;
  notes?: Record<string, string>;
}

interface PaidUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  whatsapp?: string;
  college?: string;
  referralCode?: string;
  referrerCodeUsed?: string;
  profileCompleted?: boolean;
  createdAt: string;
  payments: Payment[];
  totalPaid: number;
  lastPaymentDate?: string;
}

const AdminPaidUsersPage: React.FC = () => {
  const [users, setUsers] = useState<PaidUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchPaidUsers();
  }, []);

  const fetchPaidUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await authApi.getPaidUsers();
      setUsers(res.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load paid users.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.city?.toLowerCase().includes(q) ||
      u.whatsapp?.toLowerCase().includes(q) ||
      u.college?.toLowerCase().includes(q)
    );
  });

  const exportExcel = () => {
    // Prepare data for export - excluding sensitive PII (phone, whatsapp)
    const rows = filtered.map(u => ({
      Name: u.name,
      Email: u.email,
      City: u.city || '',
      College: u.college || '',
      'Total Paid (₹)': u.totalPaid,
      'Payments Count': u.payments.length,
      'Last Payment': u.lastPaymentDate ? new Date(u.lastPaymentDate).toLocaleDateString('en-IN') : '',
      'Referral Code': u.referralCode || '',
      'Referred Via': u.referrerCodeUsed || '',
      'Joined': new Date(u.createdAt).toLocaleDateString('en-IN'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Paid Users');
    XLSX.writeFile(wb, `paid-users-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <>
      <SharedNavbar />
      <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Paid Users</h1>
              <p className="text-sm text-gray-500 mt-1">
                {loading ? 'Loading…' : `${filtered.length} user${filtered.length !== 1 ? 's' : ''} who have completed payment`}
              </p>
            </div>
            <div className="flex gap-3 items-center flex-wrap">
              <input
                type="text"
                placeholder="Search by name, email, city…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={exportExcel}
                disabled={filtered.length === 0}
                className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                Export Excel
              </button>
              <button
                onClick={fetchPaidUsers}
                className="bg-amber-400 hover:bg-amber-300 text-black text-sm font-medium px-4 py-2 rounded-lg transition"
              >
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">{error}</div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-10 text-center text-gray-400">
              {search ? 'No users match your search.' : 'No paid users yet.'}
            </div>
          ) : (
            <div className="bg-white shadow rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Name', 'Email', 'Phone / WhatsApp', 'City', 'College', 'Total Paid', 'Payments', 'Last Payment', 'Referral', 'Joined'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(u => (
                      <tr key={u._id} className="hover:bg-amber-50 transition-colors">
                        {/* Name */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-semibold text-gray-900">{u.name}</div>
                          {!u.profileCompleted && (
                            <span className="text-xs text-orange-500">Profile incomplete</span>
                          )}
                        </td>

                        {/* Email */}
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{u.email}</td>

                        {/* Phone / WhatsApp */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {u.phone && <div className="text-gray-600">{u.phone}</div>}
                          {u.whatsapp && (
                            <a
                              href={`https://wa.me/${u.whatsapp.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-600 hover:underline text-xs flex items-center gap-1 mt-0.5"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                                <path d="M5.077 18.957L2 22l3.126-1.004A10.95 10.95 0 0012 23c6.075 0 11-4.925 11-11S18.075 1 12 1 1 5.925 1 12a10.972 10.972 0 001.077 4.687z" fillRule="evenodd" clipRule="evenodd" />
                              </svg>
                              {u.whatsapp}
                            </a>
                          )}
                          {!u.phone && !u.whatsapp && <span className="text-gray-400">—</span>}
                        </td>

                        {/* City */}
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{u.city || '—'}</td>

                        {/* College */}
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{u.college || '—'}</td>

                        {/* Total Paid */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-semibold text-green-700">₹{u.totalPaid.toLocaleString('en-IN')}</span>
                        </td>

                        {/* Payments count */}
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                            {u.payments.length}
                          </span>
                        </td>

                        {/* Last Payment */}
                        <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                          {u.lastPaymentDate ? new Date(u.lastPaymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>

                        {/* Referral info */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {u.referralCode && (
                            <span className="bg-blue-100 text-blue-700 text-xs font-mono px-2 py-0.5 rounded-full mr-1">{u.referralCode}</span>
                          )}
                          {u.referrerCodeUsed && (
                            <span className="bg-amber-100 text-amber-700 text-xs font-mono px-2 py-0.5 rounded-full">via {u.referrerCodeUsed}</span>
                          )}
                          {!u.referralCode && !u.referrerCodeUsed && <span className="text-gray-400">—</span>}
                        </td>

                        {/* Joined */}
                        <td className="px-4 py-3 whitespace-nowrap text-gray-500 text-xs">
                          {new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AdminPaidUsersPage;
