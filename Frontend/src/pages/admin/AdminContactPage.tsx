import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, Phone, Trash2 } from 'lucide-react';
import { contactApi } from '../../services/api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTable from '../../components/admin/AdminTable';

interface ContactMessage {
  _id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: 'new' | 'read' | 'resolved';
  createdAt: string;
}

function errorMessage(err: any, fallback: string) {
  return err?.response?.data?.error || err?.response?.data?.message || fallback;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const statusStyle: Record<ContactMessage['status'], string> = {
  new: 'bg-[#EEF1FF] text-[#3267f5]',
  read: 'bg-[#F1F5F9] text-[#64748B]',
  resolved: 'bg-[#E7F8EF] text-[#1F9D55]',
};

const AdminContactPage: React.FC = () => {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ContactMessage['status']>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [active, setActive] = useState<ContactMessage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ContactMessage | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (nextPage: number, status: typeof statusFilter) => {
    setLoading(true);
    setError('');
    try {
      const response = await contactApi.list({ page: nextPage, limit: 20, status: status === 'all' ? undefined : status });
      setMessages(response.data || []);
      setTotal(response.total || 0);
      setPages(response.pages || 1);
    } catch (err) {
      setError(errorMessage(err, 'Could not load contact messages.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, statusFilter); }, [load, page, statusFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.message.toLowerCase().includes(q));
  }, [messages, search]);

  const openMessage = async (message: ContactMessage) => {
    setActive(message);
    if (message.status === 'new') {
      try {
        await contactApi.setStatus(message._id, 'read');
        setMessages((prev) => prev.map((m) => (m._id === message._id ? { ...m, status: 'read' } : m)));
      } catch {
        // non-blocking
      }
    }
  };

  const markResolved = async (message: ContactMessage) => {
    try {
      await contactApi.setStatus(message._id, 'resolved');
      setMessages((prev) => prev.map((m) => (m._id === message._id ? { ...m, status: 'resolved' } : m)));
      setActive((prev) => (prev && prev._id === message._id ? { ...prev, status: 'resolved' } : prev));
    } catch (err) {
      setError(errorMessage(err, 'Could not update the status.'));
    }
  };

  const onDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await contactApi.remove(confirmDelete._id);
      setConfirmDelete(null);
      setActive(null);
      load(page, statusFilter);
    } catch (err) {
      setError(errorMessage(err, 'Could not delete this message.'));
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const newCount = messages.filter((m) => m.status === 'new').length;

  return (
    <div>
      <AdminPageHeader
        title="Contact Messages"
        description={`${total} message${total === 1 ? '' : 's'} received from the Contact Us form.`}
      />

      <div className="px-6 py-6 lg:px-10">
        {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-800">{error}</p>}

        <div className="mb-4 flex flex-wrap gap-2">
          {(['all', 'new', 'read', 'resolved'] as const).map((key) => (
            <button
              key={key}
              onClick={() => { setStatusFilter(key); setPage(1); }}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold capitalize transition-colors ${
                statusFilter === key ? 'bg-[#111827] text-white' : 'border border-[#D0D5DD] text-[#475569] hover:bg-[#F7F9FC]'
              }`}
            >
              {key}{key === 'new' && newCount > 0 ? ` (${newCount})` : ''}
            </button>
          ))}
        </div>

        <AdminTable
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by name, email, or message…"
          emptyMessage="No contact messages yet."
          rows={filtered}
          rowKey={(m) => m._id}
          page={page}
          pages={pages}
          onPageChange={setPage}
          columns={[
            {
              key: 'name', label: 'From',
              render: (m) => (
                <button onClick={() => openMessage(m)} className="text-left font-semibold text-[#101828] hover:text-[#3267f5]">
                  {m.name}
                  <p className="font-normal text-[12px] text-[#94A3B8]">{m.email}</p>
                </button>
              ),
            },
            {
              key: 'message', label: 'Message',
              render: (m) => <p className="max-w-sm line-clamp-2 text-[#344054]">{m.message}</p>,
            },
            { key: 'date', label: 'Received', render: (m) => <span className="text-[#64748B]">{formatDate(m.createdAt)}</span> },
            {
              key: 'status', label: 'Status',
              render: (m) => <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold capitalize ${statusStyle[m.status]}`}>{m.status}</span>,
            },
            {
              key: 'actions', label: 'Actions', className: 'text-right',
              render: (m) => (
                <div className="flex items-center justify-end gap-1.5">
                  <button onClick={() => openMessage(m)} className="rounded-lg border border-[#D0D5DD] px-2.5 py-1.5 text-[12px] font-semibold text-[#344054] transition-colors hover:bg-[#F7F9FC]">View</button>
                  <button onClick={() => setConfirmDelete(m)} className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] px-2.5 py-1.5 text-[12px] font-semibold text-[#DC2626] transition-colors hover:bg-[#FEF2F2]"><Trash2 size={13} /></button>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Message detail modal */}
      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
          onClick={(e) => { if (e.target === e.currentTarget) setActive(null); }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[16px] font-bold text-[#101828]">{active.name}</p>
                <p className="mt-0.5 text-[12.5px] text-[#64748B]">{formatDate(active.createdAt)}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold capitalize ${statusStyle[active.status]}`}>{active.status}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-[13px] text-[#344054]">
              <a href={`mailto:${active.email}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-3 py-1.5 hover:bg-[#F7F9FC]">
                <Mail size={13} /> {active.email}
              </a>
              {active.phone && (
                <a href={`tel:${active.phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-3 py-1.5 hover:bg-[#F7F9FC]">
                  <Phone size={13} /> {active.phone}
                </a>
              )}
            </div>

            <p className="mt-4 whitespace-pre-wrap rounded-xl bg-[#F7F9FC] p-4 text-[14px] leading-relaxed text-[#101828]">{active.message}</p>

            <div className="mt-5 flex gap-2">
              {active.status !== 'resolved' && (
                <button onClick={() => markResolved(active)} className="flex-1 rounded-lg bg-[#111827] py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#1F2937]">
                  Mark Resolved
                </button>
              )}
              <button onClick={() => setActive(null)} className="flex-1 rounded-lg border border-[#D0D5DD] py-2.5 text-[13.5px] font-semibold text-[#344054] hover:bg-[#F7F9FC]">
                Close
              </button>
            </div>
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
            <h2 className="text-[17px] font-extrabold text-[#101828]">Delete this message?</h2>
            <p className="mt-1.5 text-[13px] text-[#64748B]">From <span className="font-semibold text-[#101828]">{confirmDelete.name}</span>. This cannot be undone.</p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-lg border border-[#D0D5DD] py-2.5 text-[13.5px] font-semibold text-[#344054] hover:bg-[#F7F9FC]">Cancel</button>
              <button onClick={onDelete} disabled={deleting} className="flex-1 rounded-lg bg-[#DC2626] py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#B91C1C] disabled:opacity-60">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminContactPage;
