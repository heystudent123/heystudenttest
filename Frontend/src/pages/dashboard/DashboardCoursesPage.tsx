import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarDays, GraduationCap, Layers, ShoppingBag } from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';
import DashboardPageHeader from '../../components/dashboard/DashboardPageHeader';

const CARD_TINTS = [
  { chip: 'bg-[#EEF0FF] text-[#6B7CFF]', bar: 'bg-[#6B7CFF]' },
  { chip: 'bg-[#E7F8EF] text-[#1F9D55]', bar: 'bg-[#1F9D55]' },
  { chip: 'bg-[#FFF1E8] text-[#E07A1F]', bar: 'bg-[#E07A1F]' },
  { chip: 'bg-[#F3EEFF] text-[#9B8AF5]', bar: 'bg-[#9B8AF5]' },
];

const DashboardCoursesPage: React.FC = () => {
  const { enrollments, hasAnyCourse } = useDashboard();

  return (
    <div>
      <DashboardPageHeader
        eyebrow="Learning"
        title="My Courses"
        description="Courses you've purchased, and more you can add to your preparation."
      />

      <div className="px-6 py-7 lg:px-10">
        {/* ── Purchased courses ───────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E7F8EF] text-[#1F9D55]">
            <BookOpen size={15} />
          </span>
          <h2 className="text-[17px] font-extrabold text-[#101828]">Purchased Courses</h2>
        </div>

        {!hasAnyCourse ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D0D5DD] bg-white py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F1F5F9]">
              <ShoppingBag size={24} className="text-[#94A3B8]" />
            </span>
            <p className="mt-4 text-[16px] font-bold text-[#101828]">You haven't purchased any courses yet</p>
            <p className="mt-1.5 max-w-sm text-[13.5px] text-[#64748B]">
              Enroll in a structured CUET batch to unlock live classes, notes, and instructor support — it'll show up here instantly.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {enrollments.map((enr, idx) => {
              const course = enr.courseId;
              const tint = CARD_TINTS[idx % CARD_TINTS.length];
              const cats = Array.isArray(course?.category) ? course?.category : [];
              // Some older enrollments point at a course that's since been
              // removed — never fall back to showing the raw slug/ObjectId.
              const displayTitle = course?.title || 'Course unavailable';
              const CardInner = (
                <>
                  <span className={`h-1.5 w-full shrink-0 ${tint.bar}`} />
                  <div className="flex flex-1 flex-col p-5">
                    {cats && cats.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {cats.slice(0, 2).map((cat) => (
                          <span key={cat} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tint.chip}`}>{cat}</span>
                        ))}
                      </div>
                    )}
                    <h3 className="text-[16px] font-bold leading-snug text-[#101828]">
                      {displayTitle}
                    </h3>
                    {course?.subtitle && (
                      <p className="mt-1.5 text-[13px] leading-snug text-[#64748B]">{course.subtitle}</p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-[#64748B]">
                      {course?.duration && (
                        <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} className="text-[#94A3B8]" /> {course.duration}</span>
                      )}
                      {course?.level && (
                        <span className="inline-flex items-center gap-1.5"><Layers size={13} className="text-[#94A3B8]" /> {course.level}</span>
                      )}
                    </div>

                    <div className="mt-4 flex-1" />

                    {course?.instructor && (
                      <div className="mb-4 flex items-center gap-2 text-[12.5px] text-[#64748B]">
                        <GraduationCap size={14} className="text-[#94A3B8]" />
                        <span className="font-semibold text-[#101828]">{course.instructor}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-[#E8EDF4] pt-3 text-[12px] text-[#94A3B8]">
                      <span>Enrolled {new Date(enr.enrolledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F8EF] px-2 py-0.5 font-bold text-[#1F9D55]">Active</span>
                    </div>

                    {course?._id ? (
                      <p className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#3267f5]">
                        View course materials <ArrowRight size={13} />
                      </p>
                    ) : (
                      <p className="mt-3 text-[12px] text-[#94A3B8]">
                        Materials aren't available for this enrollment. Contact support if this looks wrong.
                      </p>
                    )}
                  </div>
                </>
              );
              return course?._id ? (
                <Link
                  key={enr._id}
                  to={`/student/dashboard/courses/${course._id}`}
                  className="group flex flex-col overflow-hidden rounded-[18px] border border-[#E8EDF4] bg-white transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_32px_rgba(16,24,40,0.1)]"
                >
                  {CardInner}
                </Link>
              ) : (
                <div key={enr._id} className="flex flex-col overflow-hidden rounded-[18px] border border-[#E8EDF4] bg-white">
                  {CardInner}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Explore more courses ─────────────────────────────────── */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#E8EDF4] bg-[#F7F9FC] px-6 py-6 sm:flex-row">
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEF0FF] text-[#6B7CFF]">
              <ShoppingBag size={20} strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-[14.5px] font-bold text-[#101828]">Want to add another batch?</p>
              <p className="mt-0.5 text-[13px] text-[#64748B]">Browse all available CUET courses and enroll in more subjects.</p>
            </div>
          </div>
          <Link
            to="/courses"
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#111827] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#1F2937]"
          >
            Explore More Courses <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DashboardCoursesPage;
