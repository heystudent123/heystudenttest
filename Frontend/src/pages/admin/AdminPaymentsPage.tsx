import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, CheckCircle2, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { authApi, paymentsApi } from '../../services/api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTable from '../../components/admin/AdminTable';

interface PaidUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  city?: string;
  college?: string;
  whatsapp?: string;
  referralCode?: string;
  referrerCodeUsed?: string;
  profileCompleted: boolean;
  totalPaid: number;
  payments: { _id: string; purpose?: string; amountInRupees?: number }[];
  lastPaymentDate: string;
  createdAt: string;
}

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

type Tab = 'paid' | 'leads';
type LeadType = 'all' | 'converted' | 'form' | 'popup';

const leadType = (l: Lead): Exclude<LeadType, 'all'> => {
  if (l.converted) return 'converted';
  if (l.source === 'popup') return 'popup';
  if (l.source === 'enrollment_form') return 'form';
  if (l.name === 'Website Visitor') return 'popup';
  return 'form';
};

const AdminPaymentsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('paid');

  const [paidUsers, setPaidUsers] = useState<PaidUser[]>([]);
  const [paidLoading, setPaidLoading] = useState(true);
  const [paidSearch, setPaidSearch] = useState('');

  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsSearch, setLeadsSearch] = useState('');
  const [leadTypeFilter, setLeadTypeFilter] = useState<LeadType>('all');
  const [leadBusyId, setLeadBusyId] = useState<string | null>(null);

  useEffect(() => {
    authApi.getPaidUsers().then((res) => setPaidUsers(res.data || [])).catch(() => setPaidUsers([])).finally(() => setPaidLoading(false));
  }, []);

  const fetchLeads = () => {
    setLeadsLoading(true);
    paymentsApi.getAllLeads(1, 1000)
      .then((res) => setLeads(res.data || []))
      .catch(() => setLeads([]))
      .finally(() => setLeadsLoading(false));
  };
  useEffect(() => { fetchLeads(); }, []);

  const filteredPaid = useMemo(() => {
    const q = paidSearch.trim().toLowerCase();
    if (!q) return paidUsers;
    return paidUsers.filter((u) =>
      u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) || u.city?.toLowerCase().includes(q) ||
      u.college?.toLowerCase().includes(q)
    );
  }, [paidUsers, paidSearch]);

  const leadCounts = useMemo(() => ({
    all: leads.length,
    converted: leads.filter((l) => leadType(l) === 'converted').length,
    form: leads.filter((l) => leadType(l) === 'form').length,
    popup: leads.filter((l) => leadType(l) === 'popup').length,
  }), [leads]);

  const filteredLeads = useMemo(() => {
    let list = leads;
    if (leadTypeFilter !== 'all') list = list.filter((l) => leadType(l) === leadTypeFilter);
    const q = leadsSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((l) =>
        l.name?.toLowerCase().includes(q) || l.phone?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) || l.city?.toLowerCase().includes(q) ||
        l.college?.toLowerCase().includes(q) || l.courseTitle?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [leads, leadTypeFilter, leadsSearch]);

  const totalRevenue = useMemo(() => paidUsers.reduce((sum, u) => sum + (u.totalPaid || 0), 0), [paidUsers]);

  const handleToggleConverted = async (lead: Lead) => {
    setLeadBusyId(lead._id);
    try {
      await paymentsApi.setLeadConverted(lead._id, !lead.converted);
      fetchLeads();
    } catch { /* non-blocking */ } finally {
      setLeadBusyId(null);
    }
  };

  const handleDeleteLead = async (lead: Lead) => {
    setLeadBusyId(lead._id);
    try {
      await paymentsApi.deleteLead(lead._id);
      fetchLeads();
    } catch { /* non-blocking */ } finally {
      setLeadBusyId(null);
    }
  };

  const exportPaid = () => {
    const rows = filteredPaid.map((u) => ({
      Name: u.name, Email: u.email, City: u.city || '', College: u.college || '',
      'Total Paid': u.totalPaid, Payments: u.payments.length,
      'Last Payment': new Date(u.lastPaymentDate).toLocaleDateString('en-IN'),
      'Referral Code': u.referralCode || '', 'Referred Via': u.referrerCodeUsed || '',
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Paid Users');
    XLSX.writeFile(workbook, `paid-users-${Date.now()}.xlsx`);
  };

  const exportLeads = () => {
    const rows = filteredLeads.map((l) => ({
      Name: l.name, Phone: l.phone, Email: l.email || '', City: l.city || '',
      College: l.college || '', Course: l.courseTitle || '', 'Referral Code': l.referralCode || '',
      Type: leadType(l), Date: new Date(l.createdAt).toLocaleDateString('en-IN'),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Leads');
    XLSX.writeFile(workbook, `leads-${Date.now()}.xlsx`);
  };

  return (
    <div>
      <AdminPageHeader
        title="Paid Users & Leads"
        description="Everyone who's paid, and everyone who hasn't yet."
        actions={
          <button
            onClick={tab === 'paid' ? exportPaid : exportLeads}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-4 py-2 text-[13px] font-semibold text-[#344054] transition-colors hover:bg-[#F7F9FC]"
          >
            <ArrowDownToLine size={14} /> Export
          </button>
        }
      />

      <div className="border-b border-[#E8EDF4] bg-white px-6 lg:px-10">
        <div className="flex gap-6">
          {([
            { key: 'paid', label: 'Paid Users' },
            { key: 'leads', label: 'Leads' },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`border-b-2 px-1 py-3.5 text-[14px] font-semibold transition-colors ${
                tab === t.key ? 'border-[#111827] text-[#101828]' : 'border-transparent text-[#94A3B8] hover:text-[#475569]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6 lg:px-10">
        {tab === 'paid' ? (
          <>
            <div className="mb-4 rounded-xl border border-[#E8EDF4] bg-[#F7F9FC] px-4 py-3">
              <p className="text-[12px] font-semibold text-[#64748B]">Total revenue from {paidUsers.length} paying users</p>
              <p className="mt-0.5 text-[22px] font-extrabold text-[#101828]">₹{totalRevenue.toLocaleString('en-IN')}</p>
            </div>

            <AdminTable
              loading={paidLoading}
              search={paidSearch}
              onSearchChange={setPaidSearch}
              searchPlaceholder="Search by name, email, phone, city, college…"
              emptyMessage="No paid users yet."
              rows={filteredPaid}
              rowKey={(u) => u._id}
              columns={[
                {
                  key: 'name', label: 'Name',
                  render: (u) => (
                    <div>
                      <p className="font-semibold text-[#101828]">{u.name}</p>
                      <p className="text-[12px] text-[#94A3B8]">{u.email}</p>
                      {!u.profileCompleted && <span className="mt-0.5 inline-block rounded-full bg-[#FFF1E8] px-2 py-0.5 text-[10.5px] font-bold text-[#E07A1F]">Profile incomplete</span>}
                    </div>
                  ),
                },
                { key: 'contact', label: 'Phone / WhatsApp', render: (u) => u.whatsapp || u.phone || '—' },
                { key: 'city', label: 'City', render: (u) => u.city || '—' },
                { key: 'total', label: 'Total Paid', render: (u) => <span className="font-semibold text-[#1F9D55]">₹{u.totalPaid.toLocaleString('en-IN')}</span> },
                { key: 'payments', label: 'Payments', render: (u) => <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11.5px] font-bold text-[#475569]">{u.payments.length}</span> },
                { key: 'last', label: 'Last Payment', render: (u) => new Date(u.lastPaymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
                {
                  key: 'referral', label: 'Referral',
                  render: (u) => (
                    <div className="space-y-0.5 text-[12px]">
                      {u.referralCode && <p className="font-mono text-[#101828]">{u.referralCode}</p>}
                      {u.referrerCodeUsed && <p className="text-[#94A3B8]">via {u.referrerCodeUsed}</p>}
                      {!u.referralCode && !u.referrerCodeUsed && '—'}
                    </div>
                  ),
                },
              ]}
            />
          </>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {([
                { key: 'all', label: 'All' },
                { key: 'converted', label: 'Converted' },
                { key: 'form', label: 'Form Filled' },
                { key: 'popup', label: 'Popup Only' },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setLeadTypeFilter(t.key)}
                  className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                    leadTypeFilter === t.key ? 'bg-[#111827] text-white' : 'border border-[#D0D5DD] bg-white text-[#475569] hover:border-[#111827] hover:text-[#101828]'
                  }`}
                >
                  {t.label} <span className="ml-1 opacity-70">({leadCounts[t.key]})</span>
                </button>
              ))}
            </div>

            <AdminTable
              loading={leadsLoading}
              search={leadsSearch}
              onSearchChange={setLeadsSearch}
              searchPlaceholder="Search by name, phone, email, course…"
              emptyMessage="No leads match this filter."
              rows={filteredLeads}
              rowKey={(l) => l._id}
              columns={[
                {
                  key: 'type', label: 'Type',
                  render: (l) => {
                    const t = leadType(l);
                    const chip = t === 'converted' ? 'bg-[#E7F8EF] text-[#1F9D55]' : t === 'form' ? 'bg-[#FFF1E8] text-[#E07A1F]' : 'bg-[#EEF0FF] text-[#6B7CFF]';
                    const label = t === 'converted' ? 'Converted' : t === 'form' ? 'Form Filled' : 'Popup Only';
                    return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${chip}`}>{label}</span>;
                  },
                },
                { key: 'name', label: 'Name', render: (l) => l.name || '—' },
                { key: 'phone', label: 'Phone', render: (l) => l.phone || '—' },
                { key: 'email', label: 'Email', render: (l) => l.email || '—' },
                { key: 'course', label: 'Course', render: (l) => l.courseTitle || '—' },
                { key: 'referral', label: 'Ref Code', render: (l) => l.referralCode || '—' },
                { key: 'date', label: 'Date', render: (l) => new Date(l.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
                {
                  key: 'actions', label: 'Actions', className: 'text-right',
                  render: (l) => (
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        disabled={leadBusyId === l._id}
                        onClick={() => handleToggleConverted(l)}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-50 ${
                          l.converted ? 'border-[#D0D5DD] text-[#344054] hover:bg-[#F7F9FC]' : 'border-[#1F9D55] text-[#1F9D55] hover:bg-[#E7F8EF]'
                        }`}
                      >
                        <CheckCircle2 size={13} /> {l.converted ? 'Unmark' : 'Mark converted'}
                      </button>
                      <button
                        disabled={leadBusyId === l._id}
                        onClick={() => handleDeleteLead(l)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] px-2.5 py-1.5 text-[12px] font-semibold text-[#DC2626] transition-colors hover:bg-[#FEF2F2] disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPaymentsPage;
