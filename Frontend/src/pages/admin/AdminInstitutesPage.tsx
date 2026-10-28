import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, Building2, Users, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { authApi } from '../../services/api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTable from '../../components/admin/AdminTable';

interface Institute {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  college?: string;
  referralCode: string;
  referralCount: number;
  createdAt: string;
}

interface ReferredStudent {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  college?: string;
  collegeYear?: string;
  createdAt: string;
}

const AdminInstitutesPage: React.FC = () => {
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const [activeInstitute, setActiveInstitute] = useState<Institute | null>(null);
  const [students, setStudents] = useState<ReferredStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  useEffect(() => {
    authApi.getInstitutes()
      .then((res) => setInstitutes(res.data || []))
      .catch(() => setInstitutes([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return institutes;
    return institutes.filter((i) =>
      i.name?.toLowerCase().includes(q) ||
      i.email?.toLowerCase().includes(q) ||
      i.college?.toLowerCase().includes(q) ||
      i.referralCode?.toLowerCase().includes(q)
    );
  }, [institutes, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openInstitute = (inst: Institute) => {
    setActiveInstitute(inst);
    setStudentsLoading(true);
    authApi.getUsersByReferralCode(inst.referralCode)
      .then((res) => setStudents(res.data || []))
      .catch(() => setStudents([]))
      .finally(() => setStudentsLoading(false));
  };

  const handleExport = () => {
    const rows = filtered.map((i) => ({
      Name: i.name, Email: i.email || '', Phone: i.phone || '', College: i.college || '',
      'Referral Code': i.referralCode, 'Referred Students': i.referralCount,
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Institutes');
    XLSX.writeFile(workbook, `institutes-${Date.now()}.xlsx`);
  };

  return (
    <div>
      <AdminPageHeader
        title="Institutes"
        description="Partner institutes and how many students they've referred."
        actions={
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-4 py-2 text-[13px] font-semibold text-[#344054] transition-colors hover:bg-[#F7F9FC]"
          >
            <ArrowDownToLine size={14} /> Export
          </button>
        }
      />

      <div className="px-6 py-6 lg:px-10">
        <div className="mb-4 rounded-xl border border-[#E8EDF4] bg-[#F7F9FC] px-4 py-3 text-[13px] text-[#64748B]">
          To add an institute, promote an existing user from the <a href="/admin/users" className="font-semibold text-[#3267f5] hover:text-[#1d4ed8]">Users page</a>.
        </div>

        <AdminTable
          loading={loading}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          searchPlaceholder="Search by name, email, college, code…"
          emptyMessage="No institutes yet."
          page={page}
          pages={pages}
          onPageChange={setPage}
          rows={pageRows}
          rowKey={(i) => i._id}
          columns={[
            {
              key: 'name', label: 'Name',
              render: (i) => (
                <button onClick={() => openInstitute(i)} className="text-left font-semibold text-[#101828] hover:text-[#3267f5]">
                  <p>{i.name}</p>
                  <p className="text-[12px] font-normal text-[#94A3B8]">{i.email}</p>
                </button>
              ),
            },
            { key: 'phone', label: 'Phone', render: (i) => i.phone || '—' },
            { key: 'college', label: 'College', render: (i) => i.college || '—' },
            {
              key: 'code', label: 'Referral Code',
              render: (i) => <span className="rounded-full bg-[#EEF0FF] px-2.5 py-0.5 font-mono text-[12px] font-bold text-[#6B7CFF]">{i.referralCode}</span>,
            },
            {
              key: 'count', label: 'Referred',
              render: (i) => (
                <button onClick={() => openInstitute(i)} className="inline-flex items-center gap-1 rounded-full bg-[#E7F8EF] px-2.5 py-0.5 text-[12px] font-bold text-[#1F9D55] hover:bg-[#D7F3E3]">
                  <Users size={11} /> {i.referralCount}
                </button>
              ),
            },
          ]}
        />
      </div>

      {activeInstitute && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setActiveInstitute(null); }}
        >
          <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <button onClick={() => setActiveInstitute(null)} aria-label="Close" className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#101828]">
              <X size={16} />
            </button>
            <div className="flex items-center gap-3 pr-6">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#6B7CFF]"><Building2 size={18} /></span>
              <div>
                <h2 className="text-[17px] font-extrabold text-[#101828]">{activeInstitute.name}</h2>
                <p className="text-[12.5px] text-[#64748B]">Code: <span className="font-mono font-semibold">{activeInstitute.referralCode}</span></p>
              </div>
            </div>

            <div className="mt-5">
              {studentsLoading ? (
                <div className="flex justify-center py-10">
                  <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#111827] border-t-transparent" />
                </div>
              ) : students.length === 0 ? (
                <p className="py-8 text-center text-[13.5px] text-[#64748B]">No students have signed up using this institute's referral code yet.</p>
              ) : (
                <>
                  {/* Stacked cards on narrow screens — avoids horizontal scroll being
                      unreachable under the app shell's overflow-x-hidden wrapper. */}
                  <div className="space-y-3 sm:hidden">
                    {students.map((s) => (
                      <div key={s._id} className="rounded-xl border border-[#E8EDF4] p-4">
                        <p className="font-semibold text-[#101828]">{s.name || '—'}</p>
                        <p className="text-[11.5px] text-[#94A3B8]">{s.email}</p>
                        <div className="mt-2 space-y-1 text-[12.5px] text-[#475569]">
                          <div className="flex items-center justify-between gap-3"><span className="font-semibold text-[#94A3B8]">Phone</span><span>{s.phone || '—'}</span></div>
                          <div className="flex items-center justify-between gap-3"><span className="font-semibold text-[#94A3B8]">College</span><span>{s.college || '—'}</span></div>
                          <div className="flex items-center justify-between gap-3"><span className="font-semibold text-[#94A3B8]">Year</span><span>{s.collegeYear || '—'}</span></div>
                          <div className="flex items-center justify-between gap-3"><span className="font-semibold text-[#94A3B8]">Joined</span><span>{new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden overflow-hidden rounded-xl border border-[#E8EDF4] sm:block">
                    <table className="w-full text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-[#E8EDF4] text-[11px] font-bold uppercase tracking-[1px] text-[#94A3B8]">
                          <th className="px-4 py-2.5">Name</th>
                          <th className="px-4 py-2.5">Phone</th>
                          <th className="px-4 py-2.5">College</th>
                          <th className="px-4 py-2.5">Year</th>
                          <th className="px-4 py-2.5">Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((s) => (
                          <tr key={s._id} className="border-b border-[#F1F5F9] last:border-0">
                            <td className="px-4 py-2.5">
                              <p className="font-semibold text-[#101828]">{s.name || '—'}</p>
                              <p className="text-[11.5px] text-[#94A3B8]">{s.email}</p>
                            </td>
                            <td className="px-4 py-2.5 text-[#475569]">{s.phone || '—'}</td>
                            <td className="px-4 py-2.5 text-[#475569]">{s.college || '—'}</td>
                            <td className="px-4 py-2.5 text-[#475569]">{s.collegeYear || '—'}</td>
                            <td className="px-4 py-2.5 text-[#475569]">{new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInstitutesPage;
