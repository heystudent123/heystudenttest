import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen, FileText, Pencil, Plus, Trash2, X,
} from 'lucide-react';
import { coursesApi } from '../../services/api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTable from '../../components/admin/AdminTable';

interface Course {
  _id: string;
  title: string;
  description: string;
  subtitle?: string;
  category: string[];
  duration: string;
  level: string;
  instructor?: string;
  price: number;
  originalPrice?: number;
  referralPrice?: number;
  isPaid: boolean;
  isActive: boolean;
  features: string[];
}

const LEVELS = ['All Levels', 'Beginner', 'Intermediate', 'Advanced'];
const CATEGORIES = ['Commerce', 'Arts', 'Science', 'Foundation'];

const emptyForm = {
  title: '', subtitle: '', description: '', category: [] as string[],
  duration: '', level: 'All Levels', instructor: '',
  price: '', originalPrice: '', referralPrice: '',
  isPaid: true, isActive: true, features: '',
};

const AdminCoursesPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCourses = () => {
    setLoading(true);
    coursesApi.getAll({})
      .then((res) => setCourses(res.data || res.courses || []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCourses(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) =>
      c.title?.toLowerCase().includes(q) ||
      c.instructor?.toLowerCase().includes(q) ||
      (Array.isArray(c.category) ? c.category.join(' ') : '').toLowerCase().includes(q)
    );
  }, [courses, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditingId(course._id);
    setForm({
      title: course.title || '',
      subtitle: course.subtitle || '',
      description: course.description || '',
      category: Array.isArray(course.category) ? course.category : [],
      duration: course.duration || '',
      level: course.level || 'All Levels',
      instructor: course.instructor || '',
      price: String(course.price ?? ''),
      originalPrice: String(course.originalPrice ?? ''),
      referralPrice: String(course.referralPrice ?? ''),
      isPaid: course.isPaid ?? true,
      isActive: course.isActive ?? true,
      features: (course.features || []).join('\n'),
    });
    setFormError('');
    setFormOpen(true);
  };

  const toggleCategory = (cat: string) => {
    setForm((p) => ({
      ...p,
      category: p.category.includes(cat) ? p.category.filter((c) => c !== cat) : [...p.category, cat],
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setFormError('Title is required.'); return; }
    setSaving(true);
    setFormError('');
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      description: form.description.trim(),
      category: form.category,
      duration: form.duration.trim(),
      level: form.level,
      instructor: form.instructor.trim(),
      price: parseFloat(form.price) || 0,
      originalPrice: parseFloat(form.originalPrice) || 0,
      referralPrice: parseFloat(form.referralPrice) || 0,
      isPaid: form.isPaid,
      isActive: form.isActive,
      features: form.features.split('\n').map((f) => f.trim()).filter(Boolean),
    };
    try {
      if (editingId) {
        await coursesApi.update(editingId, payload);
      } else {
        await coursesApi.create(payload);
      }
      setFormOpen(false);
      fetchCourses();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Could not save this course.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await coursesApi.deleteCourse(confirmDelete._id);
      setConfirmDelete(null);
      fetchCourses();
    } catch {
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <AdminPageHeader
        title="Courses"
        description="Sellable course listings — pricing, details, and content."
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#111827] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1F2937]"
          >
            <Plus size={14} /> New Course
          </button>
        }
      />

      <div className="px-6 py-6 lg:px-10">
        <AdminTable
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by title, instructor, category…"
          emptyMessage="No courses yet. Create one to get started."
          rows={filtered}
          rowKey={(c) => c._id}
          columns={[
            {
              key: 'title', label: 'Course',
              render: (c) => (
                <div>
                  <p className="font-semibold text-[#101828]">{c.title}</p>
                  {c.subtitle && <p className="line-clamp-1 text-[12px] text-[#94A3B8]">{c.subtitle}</p>}
                </div>
              ),
            },
            {
              key: 'category', label: 'Category',
              render: (c) => (
                <div className="flex flex-wrap gap-1">
                  {(Array.isArray(c.category) ? c.category : []).map((cat) => (
                    <span key={cat} className="rounded-full bg-[#EEF0FF] px-2 py-0.5 text-[11px] font-semibold text-[#6B7CFF]">{cat}</span>
                  ))}
                </div>
              ),
            },
            { key: 'price', label: 'Price', render: (c) => c.isPaid ? `₹${c.price.toLocaleString('en-IN')}` : 'Free' },
            {
              key: 'status', label: 'Status',
              render: (c) => (
                <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${c.isActive ? 'bg-[#E7F8EF] text-[#1F9D55]' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
                  {c.isActive ? 'Active' : 'Inactive'}
                </span>
              ),
            },
            {
              key: 'actions', label: 'Actions', className: 'text-right',
              render: (c) => (
                <div className="flex items-center justify-end gap-1.5">
                  <Link
                    to={`/admin/posts?courseId=${c._id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] px-2.5 py-1.5 text-[12px] font-semibold text-[#344054] transition-colors hover:bg-[#F7F9FC]"
                  >
                    <FileText size={13} /> Posts
                  </Link>
                  <button onClick={() => openEdit(c)} className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] px-2.5 py-1.5 text-[12px] font-semibold text-[#344054] transition-colors hover:bg-[#F7F9FC]">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setConfirmDelete(c)} className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] px-2.5 py-1.5 text-[12px] font-semibold text-[#DC2626] transition-colors hover:bg-[#FEF2F2]">
                    <Trash2 size={13} />
                  </button>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Create / Edit form */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setFormOpen(false); }}
        >
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <button onClick={() => setFormOpen(false)} aria-label="Close" className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#101828]">
              <X size={16} />
            </button>
            <div className="flex items-center gap-2 pr-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF0FF] text-[#6B7CFF]"><BookOpen size={17} /></span>
              <h2 className="text-[17px] font-extrabold text-[#101828]">{editingId ? 'Edit Course' : 'New Course'}</h2>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Title *</label>
                <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Subtitle</label>
                <input value={form.subtitle} onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))} className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Description</label>
                <textarea rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                        form.category.includes(cat) ? 'bg-[#111827] text-white' : 'border border-[#D0D5DD] text-[#475569] hover:bg-[#F7F9FC]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Duration</label>
                  <input value={form.duration} onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))} placeholder="e.g. 12 months" className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Level</label>
                  <select value={form.level} onChange={(e) => setForm((p) => ({ ...p, level: e.target.value }))} className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]">
                    {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Instructor</label>
                <input value={form.instructor} onChange={(e) => setForm((p) => ({ ...p, instructor: e.target.value }))} className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
              </div>

              <div className="flex items-center gap-2">
                <input id="isPaid" type="checkbox" checked={form.isPaid} onChange={(e) => setForm((p) => ({ ...p, isPaid: e.target.checked }))} className="h-4 w-4 rounded border-[#D0D5DD]" />
                <label htmlFor="isPaid" className="text-[13.5px] font-medium text-[#344054]">This is a paid course</label>
              </div>

              {form.isPaid && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Price (₹)</label>
                    <input type="number" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">MRP (₹)</label>
                    <input type="number" value={form.originalPrice} onChange={(e) => setForm((p) => ({ ...p, originalPrice: e.target.value }))} className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Referral (₹)</label>
                    <input type="number" value={form.referralPrice} onChange={(e) => setForm((p) => ({ ...p, referralPrice: e.target.value }))} className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Features (one per line)</label>
                <textarea rows={4} value={form.features} onChange={(e) => setForm((p) => ({ ...p, features: e.target.value }))} placeholder={'Live classes\nRecorded lectures\n24/7 doubt solving'} className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
              </div>

              <div className="flex items-center gap-2">
                <input id="isActive" type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="h-4 w-4 rounded border-[#D0D5DD]" />
                <label htmlFor="isActive" className="text-[13.5px] font-medium text-[#344054]">Visible to students (Active)</label>
              </div>
            </div>

            {formError && <p className="mt-4 text-[13px] text-red-600">{formError}</p>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-6 w-full rounded-lg bg-[#111827] py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#1F2937] disabled:opacity-60"
            >
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Course'}
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
            <h2 className="text-[17px] font-extrabold text-[#101828]">Delete this course?</h2>
            <p className="mt-1.5 text-[13px] text-[#64748B]">
              <span className="font-semibold text-[#101828]">{confirmDelete.title}</span> and its materials will be permanently removed. Enrolled students keep access to posts but the course listing disappears.
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

export default AdminCoursesPage;
