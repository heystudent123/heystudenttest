import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Clapperboard, ExternalLink, FileText, Folder as FolderIcon, Link as LinkIcon, StickyNote,
} from 'lucide-react';
import { coursesApi, postsApi } from '../../services/api';
import { useDashboard } from '../../context/DashboardContext';
import DashboardPageHeader from '../../components/dashboard/DashboardPageHeader';

interface Material {
  _id: string;
  title: string;
  description: string;
  materialType: 'file' | 'video' | 'link' | 'note' | 'pdf' | 'module' | 'pyq' | 'notes';
  fileType?: string;
  fileExtension?: string;
  hasFile: boolean;
  videoUrl?: string;
  videoPlatform?: string;
  externalUrl?: string;
  noteContent?: string;
  order: number;
}

interface PostFile {
  _id: string;
  label: string;
  type?: string;
  protected?: boolean;
  url?: string;
}

interface CoursePost {
  _id: string;
  title: string;
  content?: string;
  attachments?: PostFile[];
  folders?: { _id?: string; name: string; attachments: PostFile[] }[];
}

const TYPE_ICON: Record<string, typeof FileText> = {
  file: FileText, pdf: FileText, module: FolderIcon,
  video: Clapperboard, link: LinkIcon, note: StickyNote, notes: StickyNote, pyq: FileText,
};

const DashboardCourseContentPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { enrollments } = useDashboard();
  const enrollment = enrollments.find((e) => e.courseId?._id === courseId);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [posts, setPosts] = useState<CoursePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.allSettled([
      coursesApi.getMyMaterials(courseId),
      postsApi.getPostsForCourse(courseId),
    ]).then(([materialsResult, postsResult]) => {
      if (cancelled) return;
      if (materialsResult.status === 'fulfilled') setMaterials(materialsResult.value.data || []);
      if (postsResult.status === 'fulfilled') setPosts(postsResult.value.data || []);
      if (materialsResult.status === 'rejected' && postsResult.status === 'rejected') {
        const reason = materialsResult.reason as { response?: { data?: { message?: string } } };
        setError(reason?.response?.data?.message || 'Could not load course materials.');
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [courseId]);

  const openPostFile = (postId: string, file: PostFile) => {
    if (file.url && !file.protected) {
      window.open(file.url, '_blank', 'noopener,noreferrer');
      return;
    }
    postsApi.openAttachment(postId, file._id).catch(() => setError('Could not open this file.'));
  };

  const course = enrollment?.courseId;
  const visiblePosts = posts.filter((post) =>
    (post.attachments || []).length > 0 || (post.folders || []).some((folder) => folder.attachments.length > 0) || Boolean(post.content)
  );
  const isEmpty = materials.length === 0 && visiblePosts.length === 0;

  return (
    <div>
      <DashboardPageHeader
        eyebrow="My Courses"
        title={course?.title || 'Course Materials'}
        description={course?.subtitle}
        actions={
          <Link to="/student/dashboard/courses" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#64748B] hover:text-[#101828]">
            <ArrowLeft size={15} /> Back to My Courses
          </Link>
        }
      />

      <div className="mx-auto max-w-3xl px-6 py-8 lg:px-10">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#111827] border-t-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-[14px] text-red-700">{error}</div>
        ) : isEmpty ? (
          <div className="rounded-2xl border border-[#E8EDF4] bg-[#F7F9FC] py-16 text-center">
            <FolderIcon size={22} className="mx-auto text-[#94A3B8]" />
            <p className="mt-3 text-[15px] font-bold text-[#101828]">No materials yet</p>
            <p className="mt-1 text-[13px] text-[#64748B]">Your instructor hasn't added any content to this course yet. Check back soon.</p>
          </div>
        ) : materials.length > 0 ? (
          <div className="space-y-3">
            {materials.map((m) => {
              const Icon = TYPE_ICON[m.materialType] || FileText;
              const isNote = m.materialType === 'note' || m.materialType === 'notes';
              const isNoteOpen = openNoteId === m._id;
              return (
                <div key={m._id} className="rounded-2xl border border-[#E8EDF4] bg-white p-5">
                  <div className="flex items-start gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#6B7CFF]">
                      <Icon size={18} strokeWidth={2.1} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold text-[#101828]">{m.title}</p>
                      {m.description && <p className="mt-1 text-[13px] text-[#64748B]">{m.description}</p>}

                      <div className="mt-3">
                        {m.hasFile ? (
                          <button
                            type="button"
                            onClick={() => coursesApi.openMaterial(m._id).catch(() => setError('Could not open this file.'))}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#111827] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1F2937]"
                          >
                            <FileText size={14} /> Open file
                          </button>
                        ) : m.materialType === 'video' && m.videoUrl ? (
                          <a
                            href={m.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#111827] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1F2937]"
                          >
                            <Clapperboard size={14} /> Watch video
                          </a>
                        ) : m.materialType === 'link' && m.externalUrl ? (
                          <a
                            href={m.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#111827] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1F2937]"
                          >
                            <ExternalLink size={14} /> Open link
                          </a>
                        ) : isNote && m.noteContent ? (
                          <button
                            onClick={() => setOpenNoteId(isNoteOpen ? null : m._id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-4 py-2 text-[13px] font-semibold text-[#101828] transition-colors hover:bg-[#F7F9FC]"
                          >
                            <StickyNote size={14} /> {isNoteOpen ? 'Hide note' : 'Read note'}
                          </button>
                        ) : (
                          <p className="text-[12.5px] text-[#94A3B8]">No content available for this item.</p>
                        )}
                      </div>

                      {isNote && isNoteOpen && m.noteContent && (
                        <div className="mt-3 whitespace-pre-wrap rounded-xl bg-[#F7F9FC] p-4 text-[13.5px] leading-relaxed text-[#344054]">
                          {m.noteContent}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {!loading && !error && visiblePosts.map((post) => (
          <div key={post._id} className={materials.length ? 'mt-8' : ''}>
            <p className="text-[16px] font-bold text-[#101828]">{post.title}</p>
            {post.content && <p className="mt-1 text-[13.5px] leading-relaxed text-[#64748B]">{post.content}</p>}
            <div className="mt-4 space-y-4">
              {(post.folders || []).map((folder) => (
                <div key={folder._id || folder.name} className="rounded-2xl border border-[#E8EDF4] bg-white p-5">
                  <p className="flex items-center gap-2 text-[14px] font-bold text-[#101828]">
                    <FolderIcon size={16} className="text-[#6B7CFF]" /> {folder.name}
                  </p>
                  <div className="mt-3 space-y-2">
                    {folder.attachments.map((file) => (
                      <button
                        key={file._id}
                        type="button"
                        onClick={() => openPostFile(post._id, file)}
                        className="flex w-full items-center gap-2 rounded-lg border border-[#E8EDF4] px-3 py-2.5 text-left text-[13.5px] font-semibold text-[#101828] transition-colors hover:bg-[#F7F9FC]"
                      >
                        <FileText size={15} className="shrink-0 text-[#64748B]" />
                        <span className="truncate">{file.label || 'File'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {(post.attachments || []).length > 0 && (
                <div className="space-y-2">
                  {(post.attachments || []).map((file) => (
                    <button
                      key={file._id}
                      type="button"
                      onClick={() => openPostFile(post._id, file)}
                      className="flex w-full items-center gap-2 rounded-2xl border border-[#E8EDF4] bg-white px-4 py-3 text-left text-[13.5px] font-semibold text-[#101828] transition-colors hover:bg-[#F7F9FC]"
                    >
                      <FileText size={15} className="shrink-0 text-[#64748B]" />
                      <span className="truncate">{file.label || 'File'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardCourseContentPage;
