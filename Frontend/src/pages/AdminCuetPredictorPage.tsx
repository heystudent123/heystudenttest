import React, { useState, useEffect } from 'react';
import SharedNavbar from '../components/SharedNavbar';
import { cuetPredictorApi } from '../services/api';
import * as XLSX from 'xlsx';

interface Submission {
  _id: string;
  name: string;
  mobile: string;
  score: number;
  category: string;
  gender?: string;
  createdAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  UR:   'bg-blue-100 text-blue-700',
  OBC:  'bg-purple-100 text-purple-700',
  SC:   'bg-orange-100 text-orange-700',
  ST:   'bg-rose-100 text-rose-700',
  EWS:  'bg-teal-100 text-teal-700',
  PwBD: 'bg-gray-100 text-gray-700',
};

const PAGE_SIZE = 20;

const AdminCuetPredictorPage: React.FC = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => { fetchPage(page); }, [page]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, categoryFilter]);

  const fetchPage = async (p: number) => {
    try {
      setLoading(true);
      setError('');
      const res = await cuetPredictorApi.getAllSubmissions(p, PAGE_SIZE);
      setSubmissions(res.data || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.pages || 1);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  };

  // Client-side filter on the current page's data
  const filtered = submissions.filter(s => {
    const matchCat = categoryFilter === 'all' || s.category === categoryFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || s.name.toLowerCase().includes(q) || s.mobile.includes(q);
    return matchCat && matchSearch;
  });

  const stats = {
    total: totalCount,
    avgScore: submissions.length
      ? (submissions.reduce((sum, s) => sum + s.score, 0) / submissions.length).toFixed(1)
      : '—',
  };

  const exportExcel = async () => {
    // Fetch all data for export (no pagination)
    try {
      const res = await cuetPredictorApi.getAllSubmissions(1, 10000);
      const all: Submission[] = res.data || [];
      const rows = all.map(s => ({
        Name: s.name,
        Mobile: s.mobile,
        Gender: s.gender === 'M' ? 'Male' : s.gender === 'F' ? 'Female' : '—',
        'CUET Score': s.score,
        Category: s.category,
        Date: s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN') : '',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'CUET Submissions');
      XLSX.writeFile(wb, `cuet-predictor-${Date.now()}.xlsx`);
    } catch {
      alert('Export failed. Please try again.');
    }
  };

  const goTo = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Build visible page numbers (window of 5)
  const pageNumbers = () => {
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  return (
    <>
      <SharedNavbar />
      <div className="min-h-screen bg-gray-50 px-4 sm:px-6 lg:px-8" style={{ paddingTop: '88px', paddingBottom: '48px' }}>
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">CUET Predictor Submissions</h1>
              <p className="text-gray-500 mt-1 text-sm">Students who used the CUET college predictor tool</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => fetchPage(page)} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                Refresh
              </button>
              <button
                onClick={exportExcel}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Sheet
              </button>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Submissions</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Avg Score (this page)</p>
              <p className="text-3xl font-bold text-amber-600 mt-1">{stats.avgScore}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Current Page</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{page} <span className="text-base font-normal text-gray-400">/ {totalPages}</span></p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Per Page</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{PAGE_SIZE}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <input
              type="text"
              placeholder="Search by name or mobile…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full sm:w-72 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm"
            />
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
            >
              <option value="all">All Categories</option>
              {['UR', 'OBC', 'SC', 'ST', 'EWS', 'PwBD'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-sm">{error}</div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              {search || categoryFilter !== 'all' ? 'No submissions match your filters on this page.' : 'No submissions yet.'}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['#', 'Name', 'Mobile', 'Score', 'Category', 'Gender', 'Date'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((s, idx) => (
                      <tr key={s._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{s.name}</td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          <a href={`https://wa.me/${s.mobile}`} target="_blank" rel="noopener noreferrer" className="hover:underline text-green-700">
                            {s.mobile}
                          </a>
                        </td>
                        <td className="px-4 py-3 font-semibold text-amber-700 whitespace-nowrap">{s.score}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${CATEGORY_COLORS[s.category] || 'bg-gray-100 text-gray-600'}`}>
                            {s.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                          {s.gender === 'M' ? 'Male' : s.gender === 'F' ? 'Female' : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                          {s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer: count + pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} submissions
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => goTo(1)}
                    disabled={page === 1}
                    className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    «
                  </button>
                  <button
                    onClick={() => goTo(page - 1)}
                    disabled={page === 1}
                    className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ‹
                  </button>
                  {pageNumbers().map(n => (
                    <button
                      key={n}
                      onClick={() => goTo(n)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        n === page
                          ? 'border-black bg-black text-white'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => goTo(page + 1)}
                    disabled={page === totalPages}
                    className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ›
                  </button>
                  <button
                    onClick={() => goTo(totalPages)}
                    disabled={page === totalPages}
                    className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    »
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default AdminCuetPredictorPage;
