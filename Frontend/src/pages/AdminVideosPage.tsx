import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as tus from 'tus-js-client';
import SharedNavbar from '../components/SharedNavbar';
import { videosApi } from '../services/api';

interface Video {
  _id: string;
  title: string;
  description: string;
  category: string;
  cloudflareVideoId: string;
  thumbnail: string;
  duration: number;
  isPublished: boolean;
  isReady: boolean;
  tags: string[];
  viewCount: number;
  createdAt: string;
  uploadedBy?: { name: string; email: string };
}

const CATEGORIES = [
  'General',
  'Tutorial',
  'Event',
  'News',
  'Campus Tour',
  'Accommodation',
  'Career',
  'Other',
];

const formatDuration = (seconds: number): string => {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const AdminVideosPage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Upload form
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    category: 'General',
    tags: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'uploading' | 'saving' | 'done' | 'error'
  >('idle');
  const [uploadError, setUploadError] = useState('');
  const tusUploadRef = useRef<tus.Upload | null>(null);

  // Edit modal
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    category: 'General',
    tags: '',
    isPublished: false,
  });
  const [editSaving, setEditSaving] = useState(false);

  // Status polling
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const res = await videosApi.getAdminVideos();
      setVideos(res.data || []);
    } catch {
      setError('Failed to load videos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  // ── Upload flow ─────────────────────────────────────────────────────────────
  const handleStartUpload = async () => {
    if (!selectedFile) return setUploadError('Please select a video file.');
    if (!uploadForm.title.trim()) return setUploadError('Please enter a title.');

    setUploadError('');
    setUploadProgress(0);
    setUploadStatus('uploading');

    try {
      // 1. Get a one-time direct upload URL from our backend → Cloudflare
      const urlRes = await videosApi.getUploadUrl();
      const { uploadURL, uid } = urlRes.data;

      // 2. Upload file directly to Cloudflare via TUS
      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(selectedFile, {
          endpoint: uploadURL,
          uploadUrl: uploadURL,
          retryDelays: [0, 1000, 3000, 5000],
          metadata: {
            filename: selectedFile.name,
            filetype: selectedFile.type,
          },
          onProgress: (bytesSent, bytesTotal) => {
            setUploadProgress(Math.round((bytesSent / bytesTotal) * 100));
          },
          onSuccess: () => resolve(),
          onError: (err) => reject(err),
        });

        tusUploadRef.current = upload;
        upload.start();
      });

      // 3. Save video metadata to our DB
      setUploadStatus('saving');
      await videosApi.createVideo({
        ...uploadForm,
        cloudflareVideoId: uid,
      });

      setUploadStatus('done');
      setUploadForm({ title: '', description: '', category: 'General', tags: '' });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchVideos();

      setTimeout(() => {
        setShowUploadForm(false);
        setUploadStatus('idle');
        setUploadProgress(0);
      }, 1500);
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err?.message || 'Upload failed. Please try again.');
      setUploadStatus('error');
    }
  };

  const handleCancelUpload = () => {
    tusUploadRef.current?.abort();
    setUploadStatus('idle');
    setUploadProgress(0);
    setUploadError('');
  };

  // ── Edit ─────────────────────────────────────────────────────────────────────
  const openEdit = (video: Video) => {
    setEditingVideo(video);
    setEditForm({
      title: video.title,
      description: video.description,
      category: video.category,
      tags: video.tags?.join(', ') || '',
      isPublished: video.isPublished,
    });
  };

  const handleEditSave = async () => {
    if (!editingVideo) return;
    setEditSaving(true);
    try {
      await videosApi.updateVideo(editingVideo._id, {
        ...editForm,
        tags: editForm.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setEditingVideo(null);
      fetchVideos();
    } catch {
      alert('Failed to update video.');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this video? This also removes it from Cloudflare Stream.')) return;
    try {
      await videosApi.deleteVideo(id);
      setVideos((prev) => prev.filter((v) => v._id !== id));
    } catch {
      alert('Failed to delete video.');
    }
  };

  // ── Status check ─────────────────────────────────────────────────────────────
  const handleCheckStatus = async (video: Video) => {
    setCheckingStatus(video._id);
    try {
      const res = await videosApi.checkVideoStatus(video._id);
      alert(
        `Processing status: ${res.data.state}\nReady: ${res.data.isReady ? 'Yes' : 'No'}\nDuration: ${formatDuration(res.data.duration)}`
      );
      fetchVideos();
    } catch {
      alert('Failed to check status.');
    } finally {
      setCheckingStatus(null);
    }
  };

  // ── Quick toggle publish ─────────────────────────────────────────────────────
  const togglePublish = async (video: Video) => {
    try {
      await videosApi.updateVideo(video._id, { isPublished: !video.isPublished });
      fetchVideos();
    } catch {
      alert('Failed to update publish status.');
    }
  };

  return (
    <>
      <SharedNavbar />
      <div className="navbar-spacer" />
      <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <Link to="/admin" className="text-sm text-primary hover:underline">
                ← Admin Dashboard
              </Link>
              <h1 className="text-3xl font-bold text-gray-900 mt-1">Video Management</h1>
              <p className="text-gray-500 text-sm mt-1">
                Upload and manage Cloudflare Stream videos
              </p>
            </div>
            <button
              onClick={() => {
                setShowUploadForm(true);
                setUploadStatus('idle');
                setUploadError('');
                setUploadProgress(0);
              }}
              className="bg-primary text-white px-4 py-2 rounded-md font-medium hover:bg-primary-dark transition"
            >
              + Upload Video
            </button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded mb-4">{error}</div>
          )}

          {/* Upload Modal */}
          {showUploadForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
                <div className="px-6 py-4 border-b flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Upload New Video</h2>
                  <button
                    onClick={() => {
                      handleCancelUpload();
                      setShowUploadForm(false);
                    }}
                    className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={uploadForm.title}
                      onChange={(e) =>
                        setUploadForm((f) => ({ ...f, title: e.target.value }))
                      }
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Enter video title"
                      disabled={uploadStatus === 'uploading' || uploadStatus === 'saving'}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={uploadForm.description}
                      onChange={(e) =>
                        setUploadForm((f) => ({ ...f, description: e.target.value }))
                      }
                      rows={3}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Optional description"
                      disabled={uploadStatus === 'uploading' || uploadStatus === 'saving'}
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={uploadForm.category}
                      onChange={(e) =>
                        setUploadForm((f) => ({ ...f, category: e.target.value }))
                      }
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      disabled={uploadStatus === 'uploading' || uploadStatus === 'saving'}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tags{' '}
                      <span className="text-gray-400 font-normal">(comma-separated)</span>
                    </label>
                    <input
                      type="text"
                      value={uploadForm.tags}
                      onChange={(e) =>
                        setUploadForm((f) => ({ ...f, tags: e.target.value }))
                      }
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g. hostel, campus, tutorial"
                      disabled={uploadStatus === 'uploading' || uploadStatus === 'saving'}
                    />
                  </div>

                  {/* File picker */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Video File <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/*"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-primary file:text-white hover:file:bg-primary-dark"
                      disabled={uploadStatus === 'uploading' || uploadStatus === 'saving'}
                    />
                    {selectedFile && (
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedFile.name} (
                        {(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                      </p>
                    )}
                  </div>

                  {/* Progress bar */}
                  {(uploadStatus === 'uploading' || uploadStatus === 'saving') && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>
                          {uploadStatus === 'uploading'
                            ? `Uploading to Cloudflare… ${uploadProgress}%`
                            : 'Saving metadata…'}
                        </span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {uploadStatus === 'done' && (
                    <p className="text-green-600 text-sm font-medium">
                      ✓ Video uploaded successfully! It may take a few minutes for
                      Cloudflare to process it.
                    </p>
                  )}

                  {uploadError && (
                    <p className="text-red-600 text-sm">{uploadError}</p>
                  )}
                </div>

                <div className="px-6 py-4 border-t flex justify-end gap-3">
                  <button
                    onClick={() => {
                      handleCancelUpload();
                      setShowUploadForm(false);
                    }}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                    disabled={uploadStatus === 'uploading' || uploadStatus === 'saving'}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartUpload}
                    disabled={
                      uploadStatus === 'uploading' ||
                      uploadStatus === 'saving' ||
                      uploadStatus === 'done'
                    }
                    className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50"
                  >
                    {uploadStatus === 'uploading'
                      ? 'Uploading…'
                      : uploadStatus === 'saving'
                      ? 'Saving…'
                      : 'Upload'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Modal */}
          {editingVideo && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
                <div className="px-6 py-4 border-b flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Edit Video</h2>
                  <button
                    onClick={() => setEditingVideo(null)}
                    className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, description: e.target.value }))
                      }
                      rows={3}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={editForm.category}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, category: e.target.value }))
                      }
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                    <input
                      type="text"
                      value={editForm.tags}
                      onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                      placeholder="comma-separated"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">Published</label>
                    <button
                      type="button"
                      onClick={() =>
                        setEditForm((f) => ({ ...f, isPublished: !f.isPublished }))
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        editForm.isPublished ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          editForm.isPublished ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="text-sm text-gray-500">
                      {editForm.isPublished ? 'Visible to users' : 'Hidden from users'}
                    </span>
                  </div>
                </div>

                <div className="px-6 py-4 border-t flex justify-end gap-3">
                  <button
                    onClick={() => setEditingVideo(null)}
                    className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditSave}
                    disabled={editSaving}
                    className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50"
                  >
                    {editSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Videos table */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
            </div>
          ) : videos.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              No videos uploaded yet. Click &ldquo;Upload Video&rdquo; to get started.
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">
                      Thumbnail
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Title</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 hidden md:table-cell">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 hidden lg:table-cell">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">
                      Ready
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">
                      Published
                    </th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600 hidden sm:table-cell">
                      Views
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {videos.map((video) => (
                    <tr key={video._id} className="hover:bg-gray-50">
                      {/* Thumbnail */}
                      <td className="px-4 py-3">
                        <img
                          src={
                            video.thumbnail ||
                            `https://videodelivery.net/${video.cloudflareVideoId}/thumbnails/thumbnail.jpg`
                          }
                          alt={video.title}
                          className="w-16 h-10 object-cover rounded bg-gray-200"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://via.placeholder.com/64x40?text=Video';
                          }}
                        />
                      </td>

                      {/* Title */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 line-clamp-1">{video.title}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(video.createdAt).toLocaleDateString()}
                        </p>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                        {video.category}
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-600">
                        {formatDuration(video.duration)}
                      </td>

                      {/* Ready */}
                      <td className="px-4 py-3 text-center">
                        {video.isReady ? (
                          <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                            Ready
                          </span>
                        ) : (
                          <button
                            onClick={() => handleCheckStatus(video)}
                            disabled={checkingStatus === video._id}
                            className="inline-block px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700 hover:bg-yellow-200 cursor-pointer"
                            title="Click to check processing status"
                          >
                            {checkingStatus === video._id ? 'Checking…' : 'Processing'}
                          </button>
                        )}
                      </td>

                      {/* Published toggle */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => togglePublish(video)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            video.isPublished ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                          title={video.isPublished ? 'Click to unpublish' : 'Click to publish'}
                        >
                          <span
                            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                              video.isPublished ? 'translate-x-5' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>

                      {/* Views */}
                      <td className="px-4 py-3 text-center text-gray-600 hidden sm:table-cell">
                        {video.viewCount}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`https://iframe.cloudflarestream.com/${video.cloudflareVideoId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Preview
                          </a>
                          <button
                            onClick={() => openEdit(video)}
                            className="text-xs text-primary hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(video._id)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AdminVideosPage;
