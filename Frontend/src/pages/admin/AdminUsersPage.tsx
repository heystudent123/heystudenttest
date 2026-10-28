import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine, Building2, CheckCircle2, ShieldCheck, Trash2, User as UserIcon, X,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { authApi } from '../../services/api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTable from '../../components/admin/AdminTable';

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  college?: string;
  course?: string;
  year?: string;
  city?: string;
  whatsapp?: string;
  role: 'student' | 'admin' | 'institute';
  referralCode?: string;
  referrerCodeUsed?: string;
  referralsCount: number;
  profileCompleted: boolean;
  createdAt: string;
}

const ROLE_CHIP: Record<string, string> = {
  admin: 'bg-[#E7F8EF] text-[#1F9D55]',
  institute: 'bg-[#EEF0FF] text-[#6B7CFF]',
  student: 'bg-[#F1F5F9] text-[#64748B]',
};

type RoleFilter = 'all' | 'student' | 'admin' | 'institute';

const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const [actionError, setActionError] = useState('');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const [instituteModalUser, setInstituteModalUser] = useState<AdminUser | null>(null);
  const [instituteSaving, setInstituteSaving] = useState(false);
  const [instituteError, setInstituteError] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    authApi.getUsers('')
      .then((res) => setUsers(res.data || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = useMemo(() => {
    let list = users;
    if (roleFilter !== 'all') list = list.filter((u) => u.role === roleFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q) ||
        u.college?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, roleFilter, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const roleCounts = useMemo(() => ({
    all: users.length,
    student: users.filter((u) => u.role === 'student').length,
    admin: users.filter((u) => u.role === 'admin').length,
    institute: users.filter((u) => u.role === 'institute').length,
  }), [users]);

  const handlePromoteToAdmin = async (user: AdminUser) => {
    setActionError('');
    setBusyUserId(user._id);
    try {
      await authApi.promoteToAdmin(user._id);
      fetchUsers();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Could not promote this user.');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleDemote = async (user: AdminUser) => {
    setActionError('');
    setBusyUserId(user._id);
    try {
      await authApi.setUserRole(user._id, 'student');
      fetchUsers();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Could not demote this user.');
    } finally {
      setBusyUserId(null);
    }
  };

  const openInstituteModal = (user: AdminUser) => {
    setInstituteModalUser(user);
    setInstituteError('');
  };

  const handlePromoteToInstitute = async () => {
    if (!instituteModalUser) return;
    setInstituteSaving(true);
    setInstituteError('');
    try {
      await authApi.promoteToInstitute(instituteModalUser._id);
      setInstituteModalUser(null);
      fetchUsers();
    } catch (err: any) {
      setInstituteError(err?.response?.data?.message || 'Could not promote this user.');
    } finally {
      setInstituteSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await authApi.deleteUser(confirmDelete._id);
      setConfirmDelete(null);
      fetchUsers();
    } catch (err: any) {
      setActionError(err?.response?.data?.message || 'Could not delete this user.');
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = () => {
    const rows = filtered.map((u) => ({
      Name: u.name, Role: u.role, College: u.college || '', Course: u.course || '',
      Year: u.year || '', 'Profile Complete': u.profileCompleted ? 'Yes' : 'No',
      'Own Referral Code': u.referralCode || '', 'Signed Up Via': u.referrerCodeUsed || '',
      'Referrals Count': u.referralsCount, 'Created At': new Date(u.createdAt).toLocaleDateString('en-IN'),
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Users');
    XLSX.writeFile(workbook, `users-${Date.now()}.xlsx`);
  };

  return (
    <div>
      <AdminPageHeader
        title="Users"
        description="Everyone registered on the platform."
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
        {actionError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{actionError}</div>
        )}

        {/* Role filter tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          {([
            { key: 'all', label: 'All' },
            { key: 'student', label: 'Students' },
            { key: 'admin', label: 'Admins' },
            { key: 'institute', label: 'Institutes' },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => { setRoleFilter(t.key); setPage(1); }}
              className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                roleFilter === t.key ? 'bg-[#111827] text-white' : 'border border-[#D0D5DD] bg-white text-[#475569] hover:border-[#111827] hover:text-[#101828]'
              }`}
            >
              {t.label} <span className="ml-1 opacity-70">({roleCounts[t.key]})</span>
            </button>
          ))}
        </div>

        <AdminTable
          loading={loading}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          searchPlaceholder="Search by name, email, phone, college…"
          emptyMessage="No users match this filter."
          page={page}
          pages={pages}
          onPageChange={setPage}
          rows={pageRows}
          rowKey={(u) => u._id}
          columns={[
            {
              key: 'name', label: 'Name',
              render: (u) => (
                <div>
                  <p className="font-semibold text-[#101828]">{u.name || '—'}</p>
                  <p className="text-[12px] text-[#94A3B8]">{u.email}</p>
                  {!u.profileCompleted && (
                    <span className="mt-0.5 inline-block rounded-full bg-[#FFF1E8] px-2 py-0.5 text-[10.5px] font-bold text-[#E07A1F]">Profile incomplete</span>
                  )}
                </div>
              ),
            },
            {
              key: 'role', label: 'Role',
              render: (u) => (
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-bold capitalize ${ROLE_CHIP[u.role]}`}>{u.role}</span>
              ),
            },
            { key: 'phone', label: 'Phone', render: (u) => u.phone || '—' },
            { key: 'college', label: 'College', render: (u) => u.college || '—' },
            {
              key: 'referral', label: 'Referral',
              render: (u) => (
                <div className="space-y-0.5 text-[12px]">
                  {u.referralCode && <p><span className="text-[#94A3B8]">Code:</span> <span className="font-mono font-semibold text-[#101828]">{u.referralCode}</span></p>}
                  {u.referrerCodeUsed && <p><span className="text-[#94A3B8]">Via:</span> <span className="font-mono text-[#101828]">{u.referrerCodeUsed}</span></p>}
                  {!u.referralCode && !u.referrerCodeUsed && '—'}
                </div>
              ),
            },
            {
              key: 'actions', label: 'Actions', className: 'text-right',
              render: (u) => (
                <div className="flex items-center justify-end gap-1.5">
                  {u.role === 'student' && (
                    <>
                      <button
                        disabled={busyUserId === u._id}
                        onClick={() => handlePromoteToAdmin(u)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] px-2.5 py-1.5 text-[12px] font-semibold text-[#344054] transition-colors hover:bg-[#F7F9FC] disabled:opacity-50"
                      >
                        <ShieldCheck size={13} /> Make Admin
                      </button>
                      <button
                        disabled={busyUserId === u._id}
                        onClick={() => openInstituteModal(u)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] px-2.5 py-1.5 text-[12px] font-semibold text-[#344054] transition-colors hover:bg-[#F7F9FC] disabled:opacity-50"
                      >
                        <Building2 size={13} /> Make Institute
                      </button>
                    </>
                  )}
                  {(u.role === 'admin' || u.role === 'institute') && (
                    <button
                      disabled={busyUserId === u._id}
                      onClick={() => handleDemote(u)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] px-2.5 py-1.5 text-[12px] font-semibold text-[#344054] transition-colors hover:bg-[#F7F9FC] disabled:opacity-50"
                    >
                      <UserIcon size={13} /> Make Student
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmDelete(u)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] px-2.5 py-1.5 text-[12px] font-semibold text-[#DC2626] transition-colors hover:bg-[#FEF2F2]"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Promote to institute modal */}
      {instituteModalUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setInstituteModalUser(null); }}
        >
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <button onClick={() => setInstituteModalUser(null)} aria-label="Close" className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#101828]">
              <X size={16} />
            </button>
            <h2 className="pr-6 text-[17px] font-extrabold text-[#101828]">Promote to Institute</h2>
            <p className="mt-1 text-[13px] text-[#64748B]">{instituteModalUser.name} ({instituteModalUser.email})</p>
            <p className="mt-3 text-[13px] text-[#64748B]">Their referral code is set on the Referrals page.</p>
            {instituteError && <p className="mt-1.5 text-[12.5px] text-red-600">{instituteError}</p>}
            <button
              onClick={handlePromoteToInstitute}
              disabled={instituteSaving}
              className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#111827] py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#1F2937] disabled:opacity-60"
            >
              {instituteSaving ? 'Promoting…' : <><CheckCircle2 size={14} /> Confirm</>}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-[17px] font-extrabold text-[#101828]">Delete this user?</h2>
            <p className="mt-1.5 text-[13px] text-[#64748B]">
              This permanently removes <span className="font-semibold text-[#101828]">{confirmDelete.name}</span> ({confirmDelete.email}). This cannot be undone.
            </p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-lg border border-[#D0D5DD] py-2.5 text-[13.5px] font-semibold text-[#344054] hover:bg-[#F7F9FC]">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-[#DC2626] py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#B91C1C] disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;
