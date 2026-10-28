import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BookOpen, CheckCircle2, ClipboardList, Flame, GraduationCap,
  PlayCircle, Target, TrendingUp,
} from 'lucide-react';
import { attemptsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useDashboard } from '../../context/DashboardContext';
import DashboardPageHeader from '../../components/dashboard/DashboardPageHeader';

interface AttemptSummary {
  _id: string;
  mockTestId: string;
  testTitle: string;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  result: { score: number; maxMarks: number; percentage: number } | null;
}

interface CatalogProgress { total: number; unlocked: number; attempted: number; }

const DashboardOverviewPage: React.FC = () => {
  const { user } = useAuth();
  const { enrollments, hasAnyCourse } = useDashboard();
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [progress, setProgress] = useState<CatalogProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      attemptsApi.myAttempts({ limit: 5 }).catch(() => ({ data: [] })),
      attemptsApi.catalog({ limit: 1 }).catch(() => ({ progress: null })),
    ]).then(([attemptsRes, catalogRes]) => {
      if (!active) return;
      setAttempts(attemptsRes.data || []);
      setProgress(catalogRes.progress || null);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const firstName = user?.name ? user.name.split(' ')[0] : 'there';
  const finishedAttempts = attempts.filter((a) => a.result);
  const avgPercentage = finishedAttempts.length
    ? Math.round(finishedAttempts.reduce((sum, a) => sum + (a.result?.percentage || 0), 0) / finishedAttempts.length)
    : null;
  const bestAttempt = finishedAttempts.reduce<AttemptSummary | null>((best, a) => {
    if (!a.result) return best;
    if (!best || !best.result) return a;
    return a.result.percentage > best.result.percentage ? a : best;
  }, null);

  const statTiles = [
    { icon: BookOpen, tint: 'bg-[#EEF0FF] text-[#6B7CFF]', label: 'Courses owned', value: enrollments.length },
    { icon: ClipboardList, tint: 'bg-[#E7F8EF] text-[#1F9D55]', label: 'Mock tests unlocked', value: progress ? progress.unlocked : '—' },
    { icon: CheckCircle2, tint: 'bg-[#FFF1E8] text-[#E07A1F]', label: 'Tests attempted', value: progress ? progress.attempted : '—' },
    { icon: TrendingUp, tint: 'bg-[#F3EEFF] text-[#9B8AF5]', label: 'Average score', value: avgPercentage !== null ? `${avgPercentage}%` : '—' },
  ];

  return (
    <div>
      <DashboardPageHeader
        eyebrow="Dashboard"
        title={`Welcome back, ${firstName}`}
        description="Here's where your preparation stands today."
      />

      <div className="px-6 py-7 lg:px-10">
        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statTiles.map((tile) => (
            <div key={tile.label} className="rounded-2xl border border-[#E8EDF4] bg-white p-5">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tile.tint}`}>
                <tile.icon size={19} strokeWidth={2.2} />
              </span>
              <p className="mt-4 text-[28px] font-extrabold leading-none text-[#101828]">{tile.value}</p>
              <p className="mt-1.5 text-[12.5px] font-medium text-[#64748B]">{tile.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Continue preparing — primary CTA block */}
          <div className="lg:col-span-2 rounded-2xl border border-[#E8EDF4] bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[1.5px] text-[#3267f5]">Keep going</p>
                <h2 className="mt-1 text-[19px] font-extrabold text-[#101828]">Recent mock test activity</h2>
              </div>
              <Link to="/student/dashboard/mock-tests" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#3267f5] hover:text-[#1d4ed8]">
                View all <ArrowRight size={14} />
              </Link>
            </div>

            {loading ? (
              <div className="mt-6 flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-[#111827] border-t-transparent" />
              </div>
            ) : attempts.length === 0 ? (
              <div className="mt-6 rounded-xl border border-dashed border-[#D0D5DD] py-10 text-center">
                <Target size={22} className="mx-auto text-[#94A3B8]" />
                <p className="mt-3 text-[14px] font-semibold text-[#101828]">No mock tests attempted yet</p>
                <p className="mt-1 text-[13px] text-[#64748B]">Take your first test to see your progress here.</p>
                <Link
                  to="/student/dashboard/mock-tests"
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#111827] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#1F2937]"
                >
                  <PlayCircle size={15} /> Browse mock tests
                </Link>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {attempts.map((a) => (
                  <Link
                    key={a._id}
                    to={a.result ? `/mock-tests/result/${a._id}` : `/student/dashboard/mock-tests?test=${a.mockTestId}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#E8EDF4] px-4 py-3 transition-colors hover:border-[#C9D2E3] hover:bg-[#F7F9FC]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-[#101828]">{a.testTitle}</p>
                      <p className="mt-0.5 text-[12px] text-[#94A3B8]">
                        {a.status === 'in_progress' ? 'In progress' : new Date(a.submittedAt || a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    {a.result ? (
                      <span className="shrink-0 rounded-full bg-[#EEF0FF] px-3 py-1 text-[13px] font-bold text-[#6B7CFF]">
                        {a.result.score}/{a.result.maxMarks}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-[#FFF1E8] px-3 py-1 text-[12px] font-bold text-[#E07A1F]">Resume</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Side column: best score + quick links */}
          <div className="space-y-5">
            <div className="rounded-2xl bg-[#111827] p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#FBC58D]">
                <Flame size={19} strokeWidth={2.2} />
              </span>
              <p className="mt-4 text-[12px] font-bold uppercase tracking-[1.5px] text-[#94A3B8]">Personal best</p>
              {bestAttempt && bestAttempt.result ? (
                <>
                  <p className="mt-1 text-[22px] font-extrabold text-white">{bestAttempt.result.percentage}%</p>
                  <p className="mt-1 truncate text-[13px] text-[#94A3B8]">{bestAttempt.testTitle}</p>
                </>
              ) : (
                <p className="mt-1 text-[14px] text-[#94A3B8]">Attempt a test to set your first score.</p>
              )}
            </div>

            <div className="rounded-2xl border border-[#E8EDF4] bg-white p-6">
              <p className="text-[12px] font-bold uppercase tracking-[1.5px] text-[#94A3B8]">Quick links</p>
              <div className="mt-3 space-y-2">
                <Link to="/student/dashboard/courses" className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13.5px] font-semibold text-[#344054] hover:bg-[#F7F9FC]">
                  <GraduationCap size={16} className="text-[#6B7CFF]" /> My Courses
                </Link>
                <Link to="/student/dashboard/mock-tests" className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13.5px] font-semibold text-[#344054] hover:bg-[#F7F9FC]">
                  <ClipboardList size={16} className="text-[#1F9D55]" /> Mock Tests
                </Link>
                <Link to="/courses" className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13.5px] font-semibold text-[#344054] hover:bg-[#F7F9FC]">
                  <ArrowRight size={16} className="text-[#E07A1F]" /> Browse new courses
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Empty-state nudge if no courses purchased */}
        {!hasAnyCourse && (
          <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#E8EDF4] bg-[#F7F9FC] px-6 py-6 sm:flex-row">
            <div>
              <p className="text-[14.5px] font-bold text-[#101828]">You haven't purchased any courses yet</p>
              <p className="mt-0.5 text-[13px] text-[#64748B]">Explore structured CUET batches with live classes and mentor support.</p>
            </div>
            <Link to="/courses" className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#111827] px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#1F2937]">
              Explore Courses <ArrowRight size={15} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardOverviewPage;
