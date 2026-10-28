import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileText, Image as ImageIcon, Link as LinkIcon, Paperclip, Pencil, Pin, Plus, Trash2, Upload, X,
} from 'lucide-react';
import { coursesApi, postsApi } from '../../services/api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTable from '../../components/admin/AdminTable';

interface Course { _id: string; title: string; }

interface Attachment {
  label: string;
  url?: string;
  type: 'image' | 'document' | 'video';
  publicId?: string;
  resourceType?: string;
}

interface Post {
  _id: string;
  title: string;
  content: string;
  courseId: { _id: string; title: string } | string | null;
  tag: 'announcement' | 'resource' | 'assignment' | 'update' | 'general';
  isPinned: boolean;
  isPublished: boolean;
  attachments: Attachment[];
  createdAt: string;
}

const TAGS = ['general', 'announcement', 'resource', 'assignment', 'update'] as const;
const TAG_CHIP: Record<string, string> = {
  announcement: 'bg-[#FFF1E8] text-[#E07A1F]',
  resource: 'bg-[#EEF0FF] text-[#6B7CFF]',
  assignment: 'bg-[#F3EEFF] text-[#9B8AF5]',
  update: 'bg-[#E7F8EF] text-[#1F9D55]',
  general: 'bg-[#F1F5F9] text-[#64748B]',
};

const emptyForm = {
  title: '', content: '', courseId: '', tag: 'general' as typeof TAGS[number],
  isPinned: false, isPublished: true,
};

const AdminPostsPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const courseFilter = params.get('courseId') || '';

  const [courses, setCourses] = useState<Course[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmDelete, setConfirmDelete] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    coursesApi.getAll({}).then((res) => setCourses(res.data || res.courses || [])).catch(() => setCourses([]));
  }, []);

  const fetchPosts = () => {
    setLoading(true);
    postsApi.getAdminPosts(courseFilter || undefined)
      .then((res) => setPosts(res.data || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPosts(); }, [courseFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) => p.title?.toLowerCase().includes(q) || p.content?.toLowerCase().includes(q));
  }, [posts, search]);

  const courseTitle = (c: Post['courseId']) => {
    if (!c) return 'No course';
    if (typeof c === 'string') return c;
    return c.title;
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, courseId: courseFilter });
    setAttachments([]);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (post: Post) => {
    setEditingId(post._id);
    setForm({
      title: post.title,
      content: post.content,
      courseId: typeof post.courseId === 'object' && post.courseId ? post.courseId._id : (post.courseId as string) || '',
      tag: post.tag,
      isPinned: post.isPinned,
      isPublished: post.isPublished,
    });
    setAttachments(post.attachments || []);
    setFormError('');
    setFormOpen(true);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await postsApi.uploadAttachment(file);
      const type: Attachment['type'] = file.type.startsWith('image/') ? 'image' : 'document';
      setAttachments((prev) => [...prev, {
        label: res.data.originalName,
        publicId: res.data.publicId,
        resourceType: res.data.resourceType,
        type,
        url: '',
      }]);
    } catch {
      setFormError('Could not upload that file.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (idx: number) => setAttachments((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!form.title.trim()) { setFormError('Title is required.'); return; }
    if (!form.content.trim()) { setFormError('Content is required.'); return; }
    if (!form.courseId) { setFormError('Select a course.'); return; }
    setSaving(true);
    setFormError('');
    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      courseId: form.courseId,
      tag: form.tag,
      isPinned: form.isPinned,
      isPublished: form.isPublished,
      attachments,
    };
    try {
      if (editingId) {
        await postsApi.updatePost(editingId, payload);
      } else {
        await postsApi.createPost(payload);
      }
      setFormOpen(false);
      fetchPosts();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || 'Could not save this post.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await postsApi.deletePost(confirmDelete._id);
      setConfirmDelete(null);
      fetchPosts();
    } catch {
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const activeCourse = courses.find((c) => c._id === courseFilter);

  return (
    <div>
      <AdminPageHeader
        title="Posts"
        description="Updates and resources shown to enrolled students."
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#111827] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1F2937]"
          >
            <Plus size={14} /> New Post
          </button>
        }
      />

      <div className="px-6 py-6 lg:px-10">
        <div className="mb-4">
          <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Course</label>
          <select
            value={courseFilter}
            onChange={(e) => {
              const v = e.target.value;
              const updated = new URLSearchParams(params);
              if (v) updated.set('courseId', v); else updated.delete('courseId');
              setParams(updated);
            }}
            className="w-full max-w-sm rounded-lg border border-[#D0D5DD] bg-white px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
          >
            <option value="">All courses</option>
            {courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
          </select>
        </div>

        <AdminTable
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search posts…"
          emptyMessage={activeCourse ? `No posts for ${activeCourse.title} yet.` : 'No posts yet.'}
          rows={filtered}
          rowKey={(p) => p._id}
          columns={[
            {
              key: 'title', label: 'Post',
              render: (p) => (
                <div>
                  <div className="flex items-center gap-1.5">
                    {p.isPinned && <Pin size={12} className="text-[#E07A1F]" />}
                    <p className="font-semibold text-[#101828]">{p.title}</p>
                    {!p.isPublished && <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-bold text-[#64748B]">Draft</span>}
                  </div>
                  <p className="line-clamp-1 text-[12px] text-[#94A3B8]">{p.content}</p>
                </div>
              ),
            },
            { key: 'course', label: 'Course', render: (p) => courseTitle(p.courseId) },
            { key: 'tag', label: 'Tag', render: (p) => <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${TAG_CHIP[p.tag]}`}>{p.tag}</span> },
            { key: 'attachments', label: 'Files', render: (p) => p.attachments?.length ? <span className="inline-flex items-center gap-1 text-[12px] text-[#64748B]"><Paperclip size={12} /> {p.attachments.length}</span> : '—' },
            { key: 'date', label: 'Date', render: (p) => new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
            {
              key: 'actions', label: 'Actions', className: 'text-right',
              render: (p) => (
                <div className="flex items-center justify-end gap-1.5">
                  <button onClick={() => openEdit(p)} className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] px-2.5 py-1.5 text-[12px] font-semibold text-[#344054] transition-colors hover:bg-[#F7F9FC]">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setConfirmDelete(p)} className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] px-2.5 py-1.5 text-[12px] font-semibold text-[#DC2626] transition-colors hover:bg-[#FEF2F2]">
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
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F3EEFF] text-[#9B8AF5]"><FileText size={17} /></span>
              <h2 className="text-[17px] font-extrabold text-[#101828]">{editingId ? 'Edit Post' : 'New Post'}</h2>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Course *</label>
                <select value={form.courseId} onChange={(e) => setForm((p) => ({ ...p, courseId: e.target.value }))} className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]">
                  <option value="">Select a course</option>
                  {courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Title *</label>
                <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Content *</label>
                <textarea rows={4} value={form.content} onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Tag</label>
                  <select value={form.tag} onChange={(e) => setForm((p) => ({ ...p, tag: e.target.value as typeof TAGS[number] }))} className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3.5 py-2.5 text-[14px] capitalize focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]">
                    {TAGS.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
                  </select>
                </div>
                <div className="flex items-end gap-4 pb-2.5">
                  <label className="flex items-center gap-2 text-[13.5px] font-medium text-[#344054]">
                    <input type="checkbox" checked={form.isPinned} onChange={(e) => setForm((p) => ({ ...p, isPinned: e.target.checked }))} className="h-4 w-4 rounded border-[#D0D5DD]" /> Pinned
                  </label>
                  <label className="flex items-center gap-2 text-[13.5px] font-medium text-[#344054]">
                    <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((p) => ({ ...p, isPublished: e.target.checked }))} className="h-4 w-4 rounded border-[#D0D5DD]" /> Published
                  </label>
                </div>
              </div>

              {/* Attachments */}
              <div className="rounded-xl border border-[#E8EDF4] p-4">
                <p className="text-[13px] font-semibold text-[#344054]">Attachments</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input ref={fileInputRef} type="file" onChange={handleFileSelected} className="hidden" id="post-file-input" />
                  <label htmlFor="post-file-input" className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-3 py-2 text-[12.5px] font-semibold text-[#344054] hover:bg-[#F7F9FC]">
                    <Upload size={13} /> {uploading ? 'Uploading…' : 'Upload file'}
                  </label>
                </div>
                {attachments.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {attachments.map((a, idx) => (
                      <div key={`${a.url}-${idx}`} className="flex items-center justify-between gap-2 rounded-lg bg-[#F7F9FC] px-3 py-2 text-[12.5px]">
                        <span className="flex items-center gap-1.5 truncate text-[#344054]">
                          {a.type === 'image' ? <ImageIcon size={13} /> : a.type === 'video' ? <LinkIcon size={13} /> : <FileText size={13} />}
                          <span className="truncate">{a.label}</span>
                        </span>
                        <button onClick={() => removeAttachment(idx)} className="shrink-0 text-[#94A3B8] hover:text-[#DC2626]"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {formError && <p className="mt-4 text-[13px] text-red-600">{formError}</p>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-6 w-full rounded-lg bg-[#111827] py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#1F2937] disabled:opacity-60"
            >
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Post'}
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-[17px] font-extrabold text-[#101828]">Delete this post?</h2>
            <p className="mt-1.5 text-[13px] text-[#64748B]">
              <span className="font-semibold text-[#101828]">{confirmDelete.title}</span> will be permanently removed.
            </p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-lg border border-[#D0D5DD] py-2.5 text-[13.5px] font-semibold text-[#344054] hover:bg-[#F7F9FC]">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 rounded-lg bg-[#DC2626] py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#B91C1C] disabled:opacity-60">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPostsPage;
