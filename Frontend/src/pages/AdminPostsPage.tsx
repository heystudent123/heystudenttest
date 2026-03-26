import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { postsApi, coursesApi } from '../services/api';

interface Attachment {
  label: string;
  url: string;
  type?: 'image' | 'document' | 'video';
  cloudflareVideoId?: string;
}

interface Folder {
  id: string;           // client-side only — stripped before save
  name: string;
  attachments: Attachment[];
}

interface Post {
  _id: string;
  title: string;
  content: string;
  courseSlug: string;
  tag: string;
  isPinned: boolean;
  isPublished: boolean;
  attachments: Attachment[];
  folders?: Folder[];
  coverImage?: string;
  createdAt: string;
}

const TAGS = ['general', 'announcement', 'resource', 'assignment', 'update'];

interface CourseOption {
  _id: string;
  title: string;
}

const emptyForm = {
  title: '',
  content: '',
  courseSlug: '',
  tag: 'general',
  isPinned: false,
  isPublished: true,
  coverImage: '',
  attachments: [] as Attachment[],
  folders: [] as Folder[],
};

const AdminPostsPage: React.FC = () => {
  const navigate = useNavigate();

  const [posts, setPosts] = useState<Post[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [videoReadyUids, setVideoReadyUids] = useState<Set<string>>(new Set());
  const [cfUidInput, setCfUidInput] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const docFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);

  // ── Folder states ──────────────────────────────────────────────────────
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderUploadTarget, setFolderUploadTarget] = useState<string | null>(null);
  const [uploadingFolderImage, setUploadingFolderImage] = useState(false);
  const [uploadingFolderDoc, setUploadingFolderDoc] = useState(false);
  const [cfFolderUidInputs, setCfFolderUidInputs] = useState<Record<string, string>>({});
  const folderImageRef = useRef<HTMLInputElement>(null);
  const folderDocRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPosts();
    coursesApi.getAll({ limit: 100 }).then((res) => {
      setCourses(res.data || []);
    }).catch(() => {});
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await postsApi.getAdminPosts();
      setPosts(res.data || res.posts || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load posts.');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowNewFolderInput(false);
    setNewFolderName('');
    setExpandedFolders(new Set());
    setFolderUploadTarget(null);
    setCfFolderUidInputs({});
    setShowModal(true);
  };

  const openEdit = (post: Post) => {
    const initFolders: Folder[] = (post.folders || []).map((f: any, i: number) => ({
      ...f,
      id: `f-${Date.now()}-${i}`,
    }));
    setForm({
      title: post.title,
      content: post.content,
      courseSlug: post.courseSlug,
      tag: post.tag,
      isPinned: post.isPinned,
      isPublished: post.isPublished,
      coverImage: post.coverImage || '',
      attachments: post.attachments || [],
      folders: initFolders,
    });
    setEditingId(post._id);
    setShowNewFolderInput(false);
    setNewFolderName('');
    setExpandedFolders(new Set());
    setFolderUploadTarget(null);
    const initCfInputs: Record<string, string> = {};
    initFolders.forEach(f => { initCfInputs[f.id] = ''; });
    setCfFolderUidInputs(initCfInputs);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError('Title and content are required.');
      return;
    }
    if (!form.courseSlug) {
      setError('Please select a course.');
      return;
    }

    // Auto-flush any UID that was pasted but not yet added via the "Add video" button
    let finalForm = form;
    if (cfUidInput.trim()) {
      const uid = cfUidInput.trim();
      finalForm = {
        ...form,
        attachments: [
          ...form.attachments,
          {
            label: uid,
            url: `https://iframe.cloudflarestream.com/${uid}`,
            type: 'video' as const,
            cloudflareVideoId: uid,
          },
        ],
      };
      setForm(finalForm);
      setVideoReadyUids((prev) => new Set(Array.from(prev).concat(uid)));
      setCfUidInput('');
    }

    setSaving(true);
    setError('');
    try {
      // Strip client-only 'id' from folders before saving
      const { folders, ...restForm } = finalForm;
      const savePayload = {
        ...restForm,
        folders: folders.map(({ id: _id, ...rest }) => rest),
      };
      if (editingId) {
        await postsApi.updatePost(editingId, savePayload);
      } else {
        await postsApi.createPost(savePayload);
      }
      setShowModal(false);
      fetchPosts();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await postsApi.deletePost(id);
      setDeleteConfirm(null);
      fetchPosts();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Delete failed.');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setError('');
    try {
      const res = await postsApi.uploadAttachment(file);
      setForm((f) => ({
        ...f,
        attachments: [...f.attachments, { label: res.data.originalName, url: res.data.url, type: 'image' as const }],
      }));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Image upload failed.');
    } finally {
      setUploadingImage(false);
      if (imageFileRef.current) imageFileRef.current.value = '';
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    setError('');
    try {
      const res = await postsApi.uploadAttachment(file);
      setForm((f) => ({
        ...f,
        attachments: [...f.attachments, { label: res.data.originalName, url: res.data.url, type: 'document' as const }],
      }));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Document upload failed.');
    } finally {
      setUploadingDoc(false);
      if (docFileRef.current) docFileRef.current.value = '';
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    setError('');
    try {
      const res = await postsApi.uploadAttachment(file);
      setForm((f) => ({ ...f, coverImage: res.data.url }));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Cover image upload failed.');
    } finally {
      setUploadingCover(false);
      if (coverFileRef.current) coverFileRef.current.value = '';
    }
  };

  const removeAttachment = (idx: number) => {
    setForm((f) => ({
      ...f,
      attachments: f.attachments.filter((_, i) => i !== idx),
    }));
  };

  // ── Folder helpers ────────────────────────────────────────────────────────
  const addFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    const id = `f-${Date.now()}`;
    setForm((f) => ({ ...f, folders: [...f.folders, { id, name, attachments: [] }] }));
    setExpandedFolders((prev) => new Set(Array.from(prev).concat(id)));
    setCfFolderUidInputs((prev) => ({ ...prev, [id]: '' }));
    setNewFolderName('');
    setShowNewFolderInput(false);
  };

  const removeFolder = (folderId: string) => {
    setForm((f) => ({ ...f, folders: f.folders.filter((fl) => fl.id !== folderId) }));
    setExpandedFolders((prev) => { const s = new Set(prev); s.delete(folderId); return s; });
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const s = new Set(prev);
      s.has(folderId) ? s.delete(folderId) : s.add(folderId);
      return s;
    });
  };

  const removeFolderAttachment = (folderId: string, idx: number) => {
    setForm((f) => ({
      ...f,
      folders: f.folders.map((fl) =>
        fl.id === folderId
          ? { ...fl, attachments: fl.attachments.filter((_, i) => i !== idx) }
          : fl,
      ),
    }));
  };

  const handleFolderImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !folderUploadTarget) return;
    const targetId = folderUploadTarget;
    setUploadingFolderImage(true);
    setError('');
    try {
      const res = await postsApi.uploadAttachment(file);
      setForm((f) => ({
        ...f,
        folders: f.folders.map((fl) =>
          fl.id === targetId
            ? { ...fl, attachments: [...fl.attachments, { label: res.data.originalName, url: res.data.url, type: 'image' as const }] }
            : fl,
        ),
      }));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Image upload failed.');
    } finally {
      setUploadingFolderImage(false);
      setFolderUploadTarget(null);
      if (folderImageRef.current) folderImageRef.current.value = '';
    }
  };

  const handleFolderDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !folderUploadTarget) return;
    const targetId = folderUploadTarget;
    setUploadingFolderDoc(true);
    setError('');
    try {
      const res = await postsApi.uploadAttachment(file);
      setForm((f) => ({
        ...f,
        folders: f.folders.map((fl) =>
          fl.id === targetId
            ? { ...fl, attachments: [...fl.attachments, { label: res.data.originalName, url: res.data.url, type: 'document' as const }] }
            : fl,
        ),
      }));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Document upload failed.');
    } finally {
      setUploadingFolderDoc(false);
      setFolderUploadTarget(null);
      if (folderDocRef.current) folderDocRef.current.value = '';
    }
  };

  const addFolderVideo = (folderId: string) => {
    const uid = (cfFolderUidInputs[folderId] || '').trim();
    if (!uid) return;
    setForm((f) => ({
      ...f,
      folders: f.folders.map((fl) =>
        fl.id === folderId
          ? {
              ...fl,
              attachments: [
                ...fl.attachments,
                { label: uid, url: `https://iframe.cloudflarestream.com/${uid}`, type: 'video' as const, cloudflareVideoId: uid },
              ],
            }
          : fl,
      ),
    }));
    setVideoReadyUids((prev) => new Set(Array.from(prev).concat(uid)));
    setCfFolderUidInputs((prev) => ({ ...prev, [folderId]: '' }));
  };

  const TAG_COLORS: Record<string, string> = {
    announcement: 'bg-red-100 text-red-700',
    resource: 'bg-blue-100 text-blue-700',
    assignment: 'bg-purple-100 text-purple-700',
    update: 'bg-green-100 text-green-700',
    general: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin')}
              className="text-gray-500 hover:text-gray-700"
            >
              ←
            </button>
            <h1 className="text-xl font-bold text-gray-900">Resource Management</h1>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              All Courses
            </span>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm transition-colors"
          >
            <span className="text-lg leading-none">+</span> New Resource
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-6 text-sm">
            {error}
            <button className="ml-2 underline" onClick={() => setError('')}>Dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <div className="text-5xl mb-4">📝</div>
            <p className="text-lg font-medium">No resources yet</p>
            <button onClick={openCreate} className="mt-4 px-6 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors">
              Create first resource
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div key={post._id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${TAG_COLORS[post.tag] || TAG_COLORS.general}`}>
                      {post.tag}
                    </span>
                    {post.isPinned && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">📌 Pinned</span>}
                    {!post.isPublished && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Draft</span>}
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(post.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 truncate">{post.title}</h3>
                  <p className="text-xs text-amber-600 font-medium mt-0.5 truncate">
                    {courses.find(c => c._id === post.courseSlug)?.title || post.courseSlug}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{post.content}</p>
                  {post.attachments?.length > 0 && (
                    <p className="text-xs text-blue-500 mt-1">📎 {post.attachments.length} attachment{post.attachments.length > 1 ? 's' : ''}</p>
                  )}
                  {(post.folders?.length ?? 0) > 0 && (
                    <p className="text-xs text-amber-500 mt-0.5">📁 {post.folders!.length} folder{post.folders!.length > 1 ? 's' : ''}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => openEdit(post)}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(post._id)}
                    className="px-3 py-1.5 text-sm bg-red-50 hover:bg-red-100 rounded-lg text-red-600 font-medium transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-10 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? 'Edit Resource' : 'Create Resource'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <p className="text-red-600 text-sm bg-red-50 p-2 rounded-lg">{error}</p>
              )}
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  placeholder="Post title"
                />
              </div>
              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
                <textarea
                  rows={6}
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                  placeholder="Write your post content here…"
                />
              </div>
              {/* Tag + Course Slug */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tag</label>
                  <select
                    value={form.tag}
                    onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {TAGS.map((t) => (
                      <option key={t} value={t} className="capitalize">{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Course *</label>
                  <select
                    value={form.courseSlug}
                    onChange={(e) => setForm((f) => ({ ...f, courseSlug: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="">— Select a course —</option>
                    {courses.map((c) => (
                      <option key={c._id} value={c._id}>{c.title}</option>
                    ))}
                  </select>
                </div>
              </div>
              {/* Cover Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image <span className="text-gray-400">(optional)</span></label>
                {form.coverImage ? (
                  <div className="relative">
                    <img src={form.coverImage} alt="Cover" className="w-full h-36 object-cover rounded-lg border border-gray-200" />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, coverImage: '' }))}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    uploadingCover ? 'border-amber-300 bg-amber-50 pointer-events-none' : 'border-gray-300 hover:border-amber-400 hover:bg-amber-50'
                  }`}>
                    {uploadingCover ? (
                      <><div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /><span className="text-sm text-amber-600">Uploading…</span></>
                    ) : (
                      <><span className="text-lg">🖼️</span><span className="text-sm text-gray-500">Click to upload cover image</span></>
                    )}
                    <input ref={coverFileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={uploadingCover} />
                  </label>
                )}
              </div>
              {/* Toggles */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPinned}
                    onChange={(e) => setForm((f) => ({ ...f, isPinned: e.target.checked }))}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <span className="text-sm text-gray-700">Pin post</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPublished}
                    onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <span className="text-sm text-gray-700">Published</span>
                </label>
              </div>
              {/* ── Folders ──────────────────────────────────────────────── */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">📁 Content Folders</span>
                  <button
                    type="button"
                    onClick={() => setShowNewFolderInput((v) => !v)}
                    className="text-xs px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold transition-colors"
                  >
                    + Add Folder
                  </button>
                </div>

                {/* New folder input */}
                {showNewFolderInput && (
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 bg-amber-50">
                    <input
                      type="text"
                      autoFocus
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addFolder(); if (e.key === 'Escape') { setShowNewFolderInput(false); setNewFolderName(''); } }}
                      placeholder="Folder name e.g. Week 1 · Physics"
                      className="flex-1 border border-amber-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button type="button" onClick={addFolder} disabled={!newFolderName.trim()} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors">
                      Create
                    </button>
                    <button type="button" onClick={() => { setShowNewFolderInput(false); setNewFolderName(''); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                  </div>
                )}

                {form.folders.length === 0 && !showNewFolderInput && (
                  <div className="px-4 py-5 text-center text-sm text-gray-400">
                    No folders yet. Click <strong>+ Add Folder</strong> to organise content by subject or week.
                  </div>
                )}

                {/* Hidden file inputs for folder uploads */}
                <input ref={folderImageRef} type="file" accept="image/*" className="hidden" onChange={handleFolderImageUpload} />
                <input ref={folderDocRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={handleFolderDocUpload} />

                {/* Folder list */}
                {form.folders.map((folder) => {
                  const isExpanded = expandedFolders.has(folder.id);
                  return (
                    <div key={folder.id} className="border-b border-gray-100 last:border-b-0">
                      {/* Folder header */}
                      <div className="flex items-center gap-2 px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
                        <button type="button" onClick={() => toggleFolder(folder.id)} className="flex-1 flex items-center gap-2 text-left">
                          <span className="text-base">{isExpanded ? '📂' : '📁'}</span>
                          <span className="text-sm font-semibold text-gray-800">{folder.name}</span>
                          <span className="text-xs text-gray-400 ml-1">({folder.attachments.length} file{folder.attachments.length !== 1 ? 's' : ''})</span>
                          <svg className={`ml-auto w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button type="button" onClick={() => removeFolder(folder.id)} className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors text-xs px-2 py-1 rounded-lg hover:bg-red-50">
                          🗑
                        </button>
                      </div>

                      {/* Folder contents */}
                      {isExpanded && (
                        <div className="bg-gray-50 px-4 pb-4 pt-2 space-y-3">
                          {/* Uploaded folder items */}
                          {folder.attachments.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 mb-2">
                              {folder.attachments.map((att, idx) => (
                                <div key={idx} className="relative border border-gray-200 rounded-lg overflow-hidden bg-white group">
                                  {att.type === 'image' && (
                                    <a href={att.url} target="_blank" rel="noopener noreferrer">
                                      <img src={att.url} alt={att.label} className="w-full h-20 object-cover hover:opacity-90 transition-opacity" />
                                    </a>
                                  )}
                                  {att.type === 'video' && (
                                    <div className="w-full h-20 bg-gray-900 flex items-center justify-center gap-1">
                                      <span className="text-purple-400 text-xs font-mono truncate px-2">▶ {att.cloudflareVideoId}</span>
                                    </div>
                                  )}
                                  {att.type === 'document' && (
                                    <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center h-20 gap-1 hover:bg-gray-100 transition-colors">
                                      <span className="text-2xl">📄</span>
                                      <span className="text-xs text-blue-500 font-medium">View</span>
                                    </a>
                                  )}
                                  <div className="flex items-center gap-1 px-2 py-1.5 bg-white border-t border-gray-200">
                                    <span className="text-xs text-gray-600 flex-1 truncate">{att.label || 'File'}</span>
                                    <button onClick={() => removeFolderAttachment(folder.id, idx)} className="flex-shrink-0 text-red-400 hover:text-red-600 text-xs" title="Remove">✕</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Folder upload controls */}
                          {/* Video */}
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">🎥 Video · Cloudflare Stream</p>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={cfFolderUidInputs[folder.id] || ''}
                                onChange={(e) => setCfFolderUidInputs((prev) => ({ ...prev, [folder.id]: e.target.value.trim() }))}
                                placeholder="Cloudflare Video UID"
                                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-400"
                              />
                              <button type="button" disabled={!cfFolderUidInputs[folder.id]} onClick={() => addFolderVideo(folder.id)}
                                className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap">
                                Add video
                              </button>
                            </div>
                          </div>
                          {/* Images */}
                          <label
                            className={`flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                              uploadingFolderImage && folderUploadTarget === folder.id
                                ? 'border-blue-300 bg-blue-50 pointer-events-none'
                                : 'border-blue-200 hover:border-blue-400 hover:bg-blue-50'
                            }`}
                            onClick={(e) => { e.preventDefault(); setFolderUploadTarget(folder.id); setTimeout(() => folderImageRef.current?.click(), 0); }}
                          >
                            {uploadingFolderImage && folderUploadTarget === folder.id ? (
                              <><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /><span className="text-sm text-blue-600">Uploading…</span></>
                            ) : (
                              <><span>🖼️</span><span className="text-sm text-gray-500">Upload image to folder</span></>
                            )}
                          </label>
                          {/* Documents */}
                          <label
                            className={`flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                              uploadingFolderDoc && folderUploadTarget === folder.id
                                ? 'border-green-300 bg-green-50 pointer-events-none'
                                : 'border-green-200 hover:border-green-400 hover:bg-green-50'
                            }`}
                            onClick={(e) => { e.preventDefault(); setFolderUploadTarget(folder.id); setTimeout(() => folderDocRef.current?.click(), 0); }}
                          >
                            {uploadingFolderDoc && folderUploadTarget === folder.id ? (
                              <><div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /><span className="text-sm text-green-600">Uploading…</span></>
                            ) : (
                              <><span>📄</span><span className="text-sm text-gray-500">Upload document to folder</span></>
                            )}
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── Attachments (hidden when folders exist OR when creating new) ─────── */}
              {form.folders.length === 0 && !!editingId ? (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                  <span className="text-sm font-semibold text-gray-700">📎 Attachments</span>
                </div>

                {/* Uploaded items preview */}
                {form.attachments.length > 0 && (
                  <div className="px-4 pt-3 pb-3 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      Uploaded ({form.attachments.length})
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {form.attachments.map((att, idx) => (
                        <div key={idx} className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50 group">
                          {/* Image preview */}
                          {att.type === 'image' && (
                            <a href={att.url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={att.url}
                                alt={att.label}
                                className="w-full h-24 object-cover hover:opacity-90 transition-opacity"
                              />
                            </a>
                          )}
                          {/* Video preview — Cloudflare Stream embed */}
                          {att.type === 'video' && (
                            <div className="w-full h-24 bg-black overflow-hidden relative">
                              {videoReadyUids.has(att.cloudflareVideoId || '') ? (
                                <iframe
                                  src={`https://iframe.cloudflarestream.com/${att.cloudflareVideoId}?poster=https%3A%2F%2Fvideodelivery.net%2F${att.cloudflareVideoId}%2Fthumbnails%2Fthumbnail.jpg`}
                                  className="w-full h-full"
                                  allow="autoplay; fullscreen"
                                  title={att.label}
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gray-900">
                                  <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                  <span className="text-xs text-purple-300">Processing…</span>
                                </div>
                              )}
                            </div>
                          )}
                          {/* Document preview */}
                          {(att.type === 'document' || (!att.type && att.url)) && (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex flex-col items-center justify-center h-24 gap-1 hover:bg-gray-100 transition-colors"
                            >
                              <span className="text-3xl">📄</span>
                              <span className="text-xs text-blue-500 font-medium">View file</span>
                            </a>
                          )}
                          {/* Label bar + remove */}
                          <div className="flex items-center gap-1 px-2 py-1.5 bg-white border-t border-gray-200">
                            <span className="text-xs text-gray-600 flex-1 truncate">{att.label || 'Attachment'}</span>
                            <button
                              onClick={() => removeAttachment(idx)}
                              className="flex-shrink-0 text-red-400 hover:text-red-600 text-xs leading-none"
                              title="Remove"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 space-y-3">
                  {/* VIDEO — Cloudflare Stream (paste UID) */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">🎥 Video · Cloudflare Stream</p>
                    <p className="text-xs text-gray-400 mb-1.5">Paste a Video UID from the Cloudflare dashboard:</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={cfUidInput}
                        onChange={(e) => setCfUidInput(e.target.value.trim())}
                        placeholder="ee03bbe381032427d689a2d5919ccbfd"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                      <button
                        type="button"
                        disabled={!cfUidInput}
                        onClick={() => {
                          const uid = cfUidInput;
                          if (!uid) return;
                          setForm((f) => ({
                            ...f,
                            attachments: [
                              ...f.attachments,
                              {
                                label: uid,
                                url: `https://iframe.cloudflarestream.com/${uid}`,
                                type: 'video' as const,
                                cloudflareVideoId: uid,
                              },
                            ],
                          }));
                          setVideoReadyUids((prev) => new Set(Array.from(prev).concat(uid)));
                          setCfUidInput('');
                        }}
                        className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                      >
                        Add video
                      </button>
                    </div>
                  </div>

                  {/* IMAGES — Cloudinary */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">🖼️ Images · Cloudinary</p>
                    <label className={`flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                      uploadingImage ? 'border-blue-300 bg-blue-50 pointer-events-none' : 'border-blue-200 hover:border-blue-400 hover:bg-blue-50'
                    }`}>
                      {uploadingImage ? (
                        <><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /><span className="text-sm text-blue-600">Uploading…</span></>
                      ) : (
                        <><span>🖼️</span><span className="text-sm text-gray-500">Click to upload image</span></>
                      )}
                      <input ref={imageFileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                    </label>
                  </div>

                  {/* DOCUMENTS — Cloudinary */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">📄 Documents · Cloudinary</p>
                    <label className={`flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                      uploadingDoc ? 'border-green-300 bg-green-50 pointer-events-none' : 'border-green-200 hover:border-green-400 hover:bg-green-50'
                    }`}>
                      {uploadingDoc ? (
                        <><div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /><span className="text-sm text-green-600">Uploading…</span></>
                      ) : (
                        <><span>📄</span><span className="text-sm text-gray-500">Click to upload PDF or document</span></>
                      )}
                      <input ref={docFileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={handleDocUpload} disabled={uploadingDoc} />
                    </label>
                  </div>
                </div>
              </div>
              ) : null}
            </div>
            {/* Footer */}
            <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || uploadingImage || uploadingDoc || uploadingCover}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Resource'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Resource?</h3>
            <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPostsPage;
