import React, { useState, useEffect } from 'react';
import SharedNavbar from '../components/SharedNavbar';
import { paymentsApi } from '../services/api';
import * as XLSX from 'xlsx';

interface Lead {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  college?: string;
  courseTitle?: string;
  referralCode?: string;
  converted: boolean;
  source?: 'popup' | 'enrollment_form' | null;
  createdAt: string;
}

// Determine lead type for display + filtering
// Handles both new leads (with source field) and legacy leads (without)
const getLeadType = (l: Lead): 'converted' | 'popup' | 'form' => {
  if (l.converted) return 'converted';
  if (l.source === 'popup') return 'popup';
  if (l.source === 'enrollment_form') return 'form';
  // Legacy fallback: heuristic on name
  if (l.name === 'Website Visitor') return 'popup';
  return 'form';
};

type TabType = 'all' | 'converted' | 'popup' | 'form';

const TAB_CONFIG: { key: TabType; label: string; desc: string; color: string; bg: string }[] = [
  { key: 'all',       label: 'All Leads',    desc: 'Every lead captured',                          color: 'text-gray-700',   bg: 'bg-gray-100' },
  { key: 'converted', label: 'Converted',    desc: 'Paid for a course',                            color: 'text-green-700',  bg: 'bg-green-100' },
  { key: 'form',      label: 'Form Filled',  desc: 'Filled enroll form but didn\'t pay',           color: 'text-amber-700',  bg: 'bg-amber-100' },
  { key: 'popup',     label: 'Popup Only',   desc: 'Dropped number in the 30-sec prompt',          color: 'text-blue-700',   bg: 'bg-blue-100' },
];

const BADGE: Record<'converted' | 'popup' | 'form', { label: string; cls: string }> = {
  converted: { label: 'Converted ✓', cls: 'bg-green-100 text-green-700' },
  form:       { label: 'Form Filled',  cls: 'bg-amber-50 text-amber-700' },
  popup:      { label: 'Popup Only',   cls: 'bg-blue-50 text-blue-600' },
};

const AdminPrePaymentLeadsPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');

  useEffect(() => { fetchLeads(); }, []);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await paymentsApi.getAllLeads(1, 1000);
      setLeads(res.data || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load leads.');
    } finally {
      setLoading(false);
    }
  };

  // Apply tab filter then text search
  const tabFiltered = leads.filter(l => {
    if (activeTab === 'all') return true;
    return getLeadType(l) === activeTab;
  });

  const filtered = tabFiltered.filter(l => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      l.name?.toLowerCase().includes(q) ||
      l.phone?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.city?.toLowerCase().includes(q) ||
      l.college?.toLowerCase().includes(q) ||
      l.courseTitle?.toLowerCase().includes(q)
    );
  });

  const counts = {
    all:       leads.length,
    converted: leads.filter(l => getLeadType(l) === 'converted').length,
    form:      leads.filter(l => getLeadType(l) === 'form').length,
    popup:     leads.filter(l => getLeadType(l) === 'popup').length,
  };

  const exportExcel = () => {
    const rows = filtered.map(l => ({
      Name: l.name,
      Phone: l.phone,
      Email: l.email || '',
      City: l.city || '',
      College: l.college || '',
      Course: l.courseTitle || '',
      'Referral Code': l.referralCode || '',
      Type: getLeadType(l) === 'converted' ? 'Converted' : getLeadType(l) === 'popup' ? 'Popup Only' : 'Form Filled',
      Date: l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-IN') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, `leads-${activeTab}-${Date.now()}.xlsx`);
  };

  return (
    <>
      <SharedNavbar />
      <div className="min-h-screen bg-gray-50 px-4 sm:px-6 lg:px-8" style={{ paddingTop: '88px', paddingBottom: '48px' }}>
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
              <p className="text-gray-500 mt-1 text-sm">
                Phone numbers &amp; details from the 30-sec popup and pre-payment forms
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={fetchLeads} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                Refresh
              </button>
              <button onClick={exportExcel} disabled={filtered.length === 0} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-green-300 transition-colors">
                Export Excel
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {TAB_CONFIG.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  activeTab === tab.key
                    ? `${tab.bg} ${tab.color} border-transparent shadow-sm`
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {tab.label}
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-white/60' : 'bg-gray-100'}`}>
                  {counts[tab.key]}
                </span>
              </button>
            ))}
          </div>

          {/* Tab description */}
          <p className="text-xs text-gray-400 mb-4">
            {TAB_CONFIG.find(t => t.key === activeTab)?.desc}
          </p>

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by name, phone, email, city, college…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full max-w-md px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm"
            />
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
              {search ? 'No leads match your search.' : `No ${activeTab === 'all' ? '' : TAB_CONFIG.find(t => t.key === activeTab)?.label + ' '}leads yet.`}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Type', 'Name', 'Phone', 'Email', 'City', 'College', 'Course', 'Ref Code', 'Date'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(lead => {
                      const type = getLeadType(lead);
                      const badge = BADGE[type];
                      return (
                        <tr key={lead._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{lead.name}</td>
                          <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                            <a href={`https://wa.me/${lead.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" className="hover:underline text-green-700">{lead.phone}</a>
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {lead.email ? <a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{lead.city || <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-gray-600">{lead.college || <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{lead.courseTitle || <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{lead.referralCode || <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                            {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      );
                    })}
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

export default AdminPrePaymentLeadsPage;
