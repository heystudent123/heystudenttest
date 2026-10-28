import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowDown, ArrowUp, CheckCircle2, ChevronDown, Circle, Minus, Scale, X, XCircle,
} from 'lucide-react';
import SharedNavbar from '../components/SharedNavbar';
import { attemptsApi } from '../services/api';

interface ReviewItem {
  order: number;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  chapter: string;
  selected: string | null;
  correctAnswer: string;
  outcome: 'correct' | 'incorrect' | 'unanswered';
  marksAwarded: number;
}

interface ResultStats {
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  score: number;
  maxMarks: number;
  percentage: number;
  accuracy: number;
  timeTakenSeconds: number;
  review: ReviewItem[];
}

interface Result {
  mockTestId: string;
  testTitle: string;
  attemptNumber: number;
  isPreview?: boolean;
  status: string;
  endReason: string | null;
  positiveMarks: number;
  negativeMarks: number;
  result: ResultStats;
}

interface PastAttempt {
  _id: string;
  attemptNumber: number;
  createdAt: string;
  result: {
    score: number;
    maxMarks: number;
    percentage: number;
    accuracy: number;
    correct: number;
    incorrect: number;
    unanswered: number;
    timeTakenSeconds: number;
  } | null;
}

function clockLabel(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const optionText = (item: ReviewItem, letter: string | null) => {
  if (!letter) return 'Not answered';
  return `${letter}. ${item[`option${letter}` as 'optionA']}`;
};

const ScoreRing: React.FC<{ percentage: number }> = ({ percentage }) => {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percentage));
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAnimated(clamped));
    return () => cancelAnimationFrame(frame);
  }, [clamped]);

  return (
    <div className="relative flex h-[132px] w-[132px] shrink-0 items-center justify-center">
      <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
        <circle cx="66" cy="66" r={radius} fill="none" stroke="#EEF1F5" strokeWidth="10" />
        <circle
          cx="66" cy="66" r={radius} fill="none" stroke="#3267f5" strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * animated) / 100}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-[24px] font-extrabold text-[#101828]">{Math.round(clamped)}%</span>
      </div>
    </div>
  );
};

const outcomeStyle: Record<ReviewItem['outcome'], { label: string; chip: string; icon: React.ReactNode }> = {
  correct: { label: 'Correct', chip: 'bg-[#EFF8F1] text-[#2A7D46]', icon: <CheckCircle2 size={13} /> },
  incorrect: { label: 'Incorrect', chip: 'bg-[#FBEFEE] text-[#B3443A]', icon: <XCircle size={13} /> },
  unanswered: { label: 'Unanswered', chip: 'bg-[#F1F3F5] text-[#64748B]', icon: <Circle size={13} /> },
};

function compareRow(label: string, prev: number, curr: number, suffix = '', higherIsBetter = true) {
  const diff = curr - prev;
  const neutral = diff === 0;
  const better = higherIsBetter ? diff > 0 : diff < 0;
  const color = neutral ? 'text-[#64748B]' : better ? 'text-[#2A7D46]' : '#B3443A';
  return { label, prev, curr, diff, neutral, better, suffix, colorClass: neutral ? 'text-[#94A3B8]' : better ? 'text-[#2A7D46]' : 'text-[#B3443A]' };
}

const CompareModal: React.FC<{ current: Result; previous: PastAttempt; onClose: () => void }> = ({ current, previous, onClose }) => {
  if (!previous.result) return null;
  const rows = [
    compareRow('Score', previous.result.score, current.result.score),
    compareRow('Percentage', previous.result.percentage, current.result.percentage, '%'),
    compareRow('Accuracy', previous.result.accuracy, current.result.accuracy, '%'),
    compareRow('Correct', previous.result.correct, current.result.correct),
    compareRow('Incorrect', previous.result.incorrect, current.result.incorrect, '', false),
    compareRow('Unanswered', previous.result.unanswered, current.result.unanswered, '', false),
    compareRow('Time Taken (s)', previous.result.timeTakenSeconds, current.result.timeTakenSeconds, '', false),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-bold text-[#101828]">Compare with previous attempt</h2>
            <p className="mt-0.5 text-[12.5px] text-[#64748B]">
              Attempt {previous.attemptNumber} ({formatDate(previous.createdAt)}) vs. Attempt {current.attemptNumber} (this one)
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#101828]">
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-[#E8EDF4]">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="border-b border-[#E8EDF4] bg-[#F7F9FC] text-left text-[11.5px] font-bold uppercase tracking-[0.5px] text-[#94A3B8]">
                <th className="px-4 py-2.5">Metric</th>
                <th className="px-4 py-2.5 text-right">Previous</th>
                <th className="px-4 py-2.5 text-right">This attempt</th>
                <th className="px-4 py-2.5 text-right">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-[#F1F5F9] last:border-0">
                  <td className="px-4 py-2.5 text-[#344054]">{row.label}</td>
                  <td className="px-4 py-2.5 text-right text-[#64748B]">{row.prev}{row.suffix}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-[#101828]">{row.curr}{row.suffix}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${row.colorClass}`}>
                    <span className="inline-flex items-center gap-1">
                      {row.neutral ? <Minus size={12} /> : row.diff > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                      {row.neutral ? '0' : `${row.diff > 0 ? '+' : ''}${row.diff}${row.suffix}`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const MockTestResultPage: React.FC = () => {
  const { attemptId } = useParams();
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | ReviewItem['outcome']>('all');
  const [pastAttempts, setPastAttempts] = useState<PastAttempt[]>([]);
  const [compareWith, setCompareWith] = useState<PastAttempt | null>(null);

  useEffect(() => {
    if (!attemptId) return;
    attemptsApi.get(attemptId)
      .then((response) => {
        if (!response.data.result) {
          setError('This attempt is still open.');
          return;
        }
        setData(response.data);
      })
      .catch(() => setError('The result could not be loaded.'));
  }, [attemptId]);

  useEffect(() => {
    if (!data?.mockTestId) return;
    attemptsApi.myAttempts({ mockTestId: data.mockTestId, limit: 20 })
      .then((response) => {
        const others = (response.data || []).filter((a: PastAttempt) => a._id !== attemptId && a.result);
        setPastAttempts(others);
      })
      .catch(() => setPastAttempts([]));
  }, [data?.mockTestId, attemptId]);

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F7F9FC]">
        <SharedNavbar />
        <p className="max-w-3xl mx-auto px-4 py-10 text-sm text-slate-600">{error || 'Loading your result…'}</p>
      </div>
    );
  }

  const result = data.result;
  const reason = data.endReason === 'timeout' ? 'Time ran out and the test was submitted automatically.' : 'You submitted the test.';
  const filteredReview = filter === 'all' ? result.review : result.review.filter((item) => item.outcome === filter);
  const mostRecentPast = pastAttempts[0];

  return (
    <div className="min-h-screen bg-[#F7F9FC]">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <SharedNavbar />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-[13px] text-[#64748B]">
          <Link to={data.isPreview ? '/admin/mock-tests' : '/mock-tests'} className="font-semibold text-[#3267f5] hover:underline">
            ← {data.isPreview ? 'Back to admin' : 'Back to Mock Tests'}
          </Link>
        </p>

        {/* ── Header ── */}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[21px] font-extrabold text-[#101828]">{data.testTitle}</h1>
            <p className="mt-1 text-[13px] text-[#64748B]">Attempt {data.attemptNumber} · {reason}</p>
          </div>
          {mostRecentPast && (
            <button
              onClick={() => setCompareWith(mostRecentPast)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#344054] transition-colors hover:bg-[#F7F9FC]"
            >
              <Scale size={14} /> Compare with previous attempt
            </button>
          )}
        </div>

        {/* ── Score summary ── */}
        <section className="mt-5 flex flex-col items-center gap-6 rounded-2xl border border-[#E8EDF4] bg-white p-6 sm:flex-row sm:p-7">
          <ScoreRing percentage={result.percentage} />
          <div className="flex-1 text-center sm:text-left">
            <p className="text-[28px] font-extrabold leading-none text-[#101828]">{result.score} <span className="text-[16px] font-semibold text-[#94A3B8]">/ {result.maxMarks} marks</span></p>
            <p className="mt-2 text-[13px] text-[#64748B]">+{data.positiveMarks} for a correct answer, −{data.negativeMarks} for a wrong one</p>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#F1F5F9] pt-4 text-left">
              <div>
                <p className="text-[18px] font-bold text-[#101828]">{result.accuracy}%</p>
                <p className="text-[12px] text-[#94A3B8]">Accuracy</p>
              </div>
              <div>
                <p className="text-[18px] font-bold text-[#101828]">{result.attempted}/{result.totalQuestions}</p>
                <p className="text-[12px] text-[#94A3B8]">Attempted</p>
              </div>
              <div>
                <p className="text-[18px] font-bold text-[#101828]">{clockLabel(result.timeTakenSeconds)}</p>
                <p className="text-[12px] text-[#94A3B8]">Time Taken</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Answer breakdown ── */}
        <section className="mt-5 rounded-2xl border border-[#E8EDF4] bg-white p-6">
          <p className="text-[13.5px] font-bold text-[#101828]">Answer breakdown</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-[#F3F8F4] p-4 text-center">
              <p className="text-[22px] font-extrabold text-[#2A7D46]">{result.correct}</p>
              <p className="text-[12.5px] font-medium text-[#4D7C5F]">Correct</p>
            </div>
            <div className="rounded-xl bg-[#FBF3F2] p-4 text-center">
              <p className="text-[22px] font-extrabold text-[#B3443A]">{result.incorrect}</p>
              <p className="text-[12.5px] font-medium text-[#A36B64]">Incorrect</p>
            </div>
            <div className="rounded-xl bg-[#F4F5F7] p-4 text-center">
              <p className="text-[22px] font-extrabold text-[#64748B]">{result.unanswered}</p>
              <p className="text-[12.5px] font-medium text-[#94A3B8]">Unanswered</p>
            </div>
          </div>
          <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-[#EEF0F2]">
            <div className="h-full bg-[#4D9A68] transition-all duration-700" style={{ width: `${(result.correct / Math.max(result.totalQuestions, 1)) * 100}%` }} />
            <div className="h-full bg-[#C65A4F] transition-all duration-700" style={{ width: `${(result.incorrect / Math.max(result.totalQuestions, 1)) * 100}%` }} />
            <div className="h-full bg-[#D7DCE1] transition-all duration-700" style={{ width: `${(result.unanswered / Math.max(result.totalQuestions, 1)) * 100}%` }} />
          </div>
        </section>

        {/* ── Review (collapsed by default) ── */}
        <section className="mt-5 overflow-hidden rounded-2xl border border-[#E8EDF4] bg-white">
          <button
            onClick={() => setReviewOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 p-5 text-left"
          >
            <div>
              <p className="text-[13.5px] font-bold text-[#101828]">Question-by-question review</p>
              <p className="mt-0.5 text-[12px] text-[#94A3B8]">See exactly what you got right and wrong</p>
            </div>
            <ChevronDown size={18} className={`shrink-0 text-[#94A3B8] transition-transform ${reviewOpen ? 'rotate-180' : ''}`} />
          </button>

          {reviewOpen && (
            <div className="border-t border-[#E8EDF4] p-5">
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'correct', 'incorrect', 'unanswered'] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`rounded-full px-3 py-1.5 text-[12.5px] font-semibold capitalize transition-colors ${
                      filter === key ? 'bg-[#111827] text-white' : 'border border-[#D0D5DD] text-[#475569] hover:bg-[#F7F9FC]'
                    }`}
                  >
                    {key === 'all' ? `All (${result.totalQuestions})` : `${key} (${result[key]})`}
                  </button>
                ))}
              </div>

              <ol className="mt-4 space-y-3">
                {filteredReview.map((item) => {
                  const style = outcomeStyle[item.outcome];
                  return (
                    <li key={item.order} className="rounded-xl border border-[#E8EDF4] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11.5px] font-bold uppercase tracking-[0.5px] text-[#94A3B8]">
                          Question {item.order}{item.chapter ? ` · ${item.chapter}` : ''}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${style.chip}`}>
                          {style.icon} {style.label} · {item.marksAwarded > 0 ? '+' : ''}{item.marksAwarded}
                        </span>
                      </div>
                      <p className="mt-2 text-[14px] font-semibold leading-relaxed text-[#101828]">{item.question}</p>
                      <div className="mt-3 grid gap-2 text-[13px] sm:grid-cols-2">
                        <p className={`rounded-lg px-3 py-2 ${item.outcome === 'incorrect' ? 'bg-[#FBEFEE] text-[#B3443A]' : item.outcome === 'unanswered' ? 'bg-[#F7F9FC] text-[#64748B]' : 'bg-[#F0FBF4] text-[#2A7D46]'}`}>
                          <span className="font-semibold">Your answer:</span> {optionText(item, item.selected)}
                        </p>
                        {item.outcome !== 'correct' && (
                          <p className="rounded-lg bg-[#F0FBF4] px-3 py-2 text-[#2A7D46]">
                            <span className="font-semibold">Correct answer:</span> {optionText(item, item.correctAnswer)}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
                {filteredReview.length === 0 && (
                  <li className="rounded-xl border border-[#E8EDF4] py-10 text-center text-[13px] text-[#94A3B8]">No questions in this category.</li>
                )}
              </ol>
            </div>
          )}
        </section>
      </main>

      {compareWith && <CompareModal current={data} previous={compareWith} onClose={() => setCompareWith(null)} />}
    </div>
  );
};

export default MockTestResultPage;
