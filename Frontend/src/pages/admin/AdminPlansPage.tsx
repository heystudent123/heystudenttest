import React, { useEffect, useState } from 'react';
import { Layers, Pencil, Plus, Trash2, X } from 'lucide-react';
import { coursesApi, mockTestsApi, plansApi } from '../../services/api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';

interface Choice {
  _id: string;
  title: string;
}

interface PlanRecord {
  _id: string;
  title: string;
  description: string;
  price: number;
  status: 'draft' | 'published' | 'unpublished';
  mockTestIds: string[];
  courseIds: string[];
}

const empty = {
  title: '',
  description: '',
  price: '',
  mockTestIds: [] as string[],
  courseIds: [] as string[],
};

function errorMessage(err: any, fallback: string) {
  return err?.response?.data?.error || err?.response?.data?.message || fallback;
}

const StatusPill: React.FC<{ status: PlanRecord['status'] }> = ({ status }) => {
  const styles = {
    draft: 'bg-[#F1F5F9] text-[#64748B]',
    published: 'bg-[#E7F8EF] text-[#1F9D55]',
    unpublished: 'bg-[#FFF6D8] text-[#B7860B]',
  } as const;
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${styles[status]}`}>{status}</span>;
};

const AdminPlansPage: React.FC = () => {
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [tests, setTests] = useState<Choice[]>([]);
  const [courses, setCourses] = useState<Choice[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PlanRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const [planRes, testRes, courseRes] = await Promise.all([
      plansApi.list(),
      mockTestsApi.list({ limit: 50 }),
      coursesApi.getAll({ limit: 100 }),
    ]);
    setPlans(planRes.data || []);
    setTests((testRes.data || []).map((item: Choice) => ({ _id: item._id, title: item.title })));
    setCourses((courseRes.data || []).map((item: Choice) => ({ _id: item._id, title: item.title })));
  };

  useEffect(() => {
    load().catch((err) => setError(errorMessage(err, 'Could not load plans.')));
  }, []);

  const toggle = (key: 'mockTestIds' | 'courseIds', id: string) => {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(id) ? current[key].filter((item) => item !== id) : [...current[key], id],
    }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(empty);
    setError('');
    setFormOpen(true);
  };

  const openEdit = (plan: PlanRecord) => {
    setEditingId(plan._id);
    setForm({
      title: plan.title,
      description: plan.description || '',
      price: String(plan.price),
      mockTestIds: (plan.mockTestIds || []).map(String),
      courseIds: (plan.courseIds || []).map(String),
    });
    setError('');
    setFormOpen(true);
  };

  const save = async (publish: boolean) => {
    setSaving(true);
    setError('');
    const payload = {
      title: form.title,
      description: form.description,
      price: Number(form.price),
      mockTestIds: form.mockTestIds,
      courseIds: form.courseIds,
    };
    try {
      const response = editingId ? await plansApi.update(editingId, payload) : await plansApi.create(payload);
      const id = response.data._id as string;
      if (publish) await plansApi.publish(id);
      setNotice(publish ? 'Plan published.' : 'Draft saved.');
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'The plan could not be saved.'));
    } finally {
      setSaving(false);
    }
  };

  const onUnpublish = async (plan: PlanRecord) => {
    setError('');
    try {
      await plansApi.unpublish(plan._id);
      setNotice('Plan unpublished.');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not unpublish.'));
    }
  };

  const onDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    try {
      await plansApi.remove(confirmDelete._id);
      setNotice('Plan deleted.');
      setConfirmDelete(null);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not delete.'));
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Plans"
        description="Bundle mock tests and courses together. Shown to students on both the Courses and Mock Tests pages."
        actions={
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-lg bg-[#111827] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1F2937]">
            <Plus size={14} /> New Plan
          </button>
        }
      />

      <div className="px-6 py-6 lg:px-10">
        {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-800">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3.5 py-2.5 text-[13px] text-green-800">{notice}</p>}

        {plans.length === 0 ? (
          <div className="rounded-2xl border border-[#E8EDF4] bg-white py-16 text-center text-[13.5px] text-[#64748B]">
            No plans yet. Create one to bundle mock tests and courses.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <div key={plan._id} className="rounded-2xl border border-[#E8EDF4] bg-white p-5">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F3EEFF] text-[#9B8AF5]"><Layers size={17} /></span>
                  <StatusPill status={plan.status} />
                </div>
                <h3 className="mt-3 text-[15px] font-bold text-[#101828]">{plan.title}</h3>
                {plan.description && <p className="mt-1 line-clamp-2 text-[12.5px] text-[#64748B]">{plan.description}</p>}
                <p className="mt-2 text-[17px] font-extrabold text-[#101828]">₹{plan.price.toLocaleString('en-IN')}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px] text-[#64748B]">
                  <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5">{(plan.mockTestIds || []).length} mock test{(plan.mockTestIds || []).length === 1 ? '' : 's'}</span>
                  <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5">{(plan.courseIds || []).length} course{(plan.courseIds || []).length === 1 ? '' : 's'}</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => openEdit(plan)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#D0D5DD] py-2 text-[12.5px] font-semibold text-[#344054] transition-colors hover:bg-[#F7F9FC]">
                    <Pencil size={13} /> Edit
                  </button>
                  {plan.status === 'published' ? (
                    <button onClick={() => onUnpublish(plan)} className="flex-1 rounded-lg border border-amber-300 bg-amber-50 py-2 text-[12.5px] font-semibold text-amber-800 transition-colors hover:bg-amber-100">
                      Unpublish
                    </button>
                  ) : (
                    <button onClick={() => setConfirmDelete(plan)} className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#D0D5DD] px-3 py-2 text-[12.5px] font-semibold text-[#DC2626] transition-colors hover:bg-[#FEF2F2]">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / edit plan */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
          onClick={(e) => { if (e.target === e.currentTarget) setFormOpen(false); }}
        >
          <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <button onClick={() => setFormOpen(false)} aria-label="Close" className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#101828]">
              <X size={16} />
            </button>
            <div className="flex items-center gap-2 pr-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F3EEFF] text-[#9B8AF5]"><Layers size={17} /></span>
              <h2 className="text-[17px] font-extrabold text-[#101828]">{editingId ? 'Edit Plan' : 'New Plan'}</h2>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Description</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
              </div>
              <div className="max-w-[160px]">
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Price (₹) *</label>
                <input type="number" min="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Mock tests in this bundle</label>
                <div className="max-h-40 space-y-1 overflow-auto rounded-lg border border-[#E8EDF4] p-3">
                  {tests.length === 0 && <p className="text-[13px] text-[#94A3B8]">No mock tests yet.</p>}
                  {tests.map((test) => (
                    <label key={test._id} className="flex items-center gap-2 text-[13.5px] text-[#344054]">
                      <input type="checkbox" checked={form.mockTestIds.includes(test._id)} onChange={() => toggle('mockTestIds', test._id)} className="h-4 w-4 rounded border-[#D0D5DD]" />
                      {test.title}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Courses in this bundle</label>
                <div className="max-h-40 space-y-1 overflow-auto rounded-lg border border-[#E8EDF4] p-3">
                  {courses.length === 0 && <p className="text-[13px] text-[#94A3B8]">No courses yet.</p>}
                  {courses.map((course) => (
                    <label key={course._id} className="flex items-center gap-2 text-[13.5px] text-[#344054]">
                      <input type="checkbox" checked={form.courseIds.includes(course._id)} onChange={() => toggle('courseIds', course._id)} className="h-4 w-4 rounded border-[#D0D5DD]" />
                      {course.title}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button onClick={() => save(false)} disabled={saving} className="rounded-lg border border-[#D0D5DD] px-4 py-2.5 text-[13.5px] font-semibold text-[#344054] transition-colors hover:bg-[#F7F9FC] disabled:opacity-50">
                Save draft
              </button>
              <button onClick={() => save(true)} disabled={saving} className="rounded-lg bg-[#111827] px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#1F2937] disabled:opacity-50">
                Save and publish
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
            <h2 className="text-[17px] font-extrabold text-[#101828]">Delete this plan?</h2>
            <p className="mt-1.5 text-[13px] text-[#64748B]"><span className="font-semibold text-[#101828]">{confirmDelete.title}</span> will be permanently removed.</p>
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

export default AdminPlansPage;
