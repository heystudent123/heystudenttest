import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Flag, Pause, Star } from 'lucide-react';
import { attemptsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Question {
  order: number;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}

interface ResponseState {
  order: number;
  selected: string | null;
  markedForReview: boolean;
  visited: boolean;
}

interface Attempt {
  _id: string;
  testTitle: string;
  subject?: string;
  isPreview?: boolean;
  status: string;
  deadlineAt: string;
  positiveMarks: number;
  negativeMarks: number;
  questions?: Question[];
  responses: ResponseState[];
  result?: { timeTakenSeconds: number };
}

function remainingSeconds(deadlineAt: string) {
  return Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - Date.now()) / 1000));
}

function clock(total: number) {
  const hours = Math.floor(total / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
  const seconds = Math.floor(total % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');
}

type Status = 'new' | 'seen' | 'answered' | 'review' | 'answered-review';

const MockTestRoomPage: React.FC = () => {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState('');
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmPause, setConfirmPause] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [leaveMessage, setLeaveMessage] = useState('');
  const [needsFullscreen, setNeedsFullscreen] = useState(!document.fullscreenElement);
  const armed = useRef(false);
  const ending = useRef(false);

  const finish = useCallback(async (reason: 'manual' | 'timeout') => {
    if (!attemptId || ending.current) return;
    ending.current = true;
    armed.current = false;
    try {
      await attemptsApi.submit(attemptId, reason);
    } catch {
      setError('The test could not be submitted. Check your connection and submit again.');
      ending.current = false;
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }
    navigate(`/mock-tests/result/${attemptId}`, { replace: true });
  }, [attemptId, navigate]);

  // Single path for every kind of pause (button click or leaving fullscreen).
  // Shows one calm "Test paused" notice, then the only action is OK — leaving
  // this screen for real happens right after, on a short delay, so the
  // message is actually readable instead of flashing by.
  const pauseTest = useCallback(async () => {
    if (!attemptId || ending.current) return;
    ending.current = true;
    armed.current = false;
    setLeaveMessage('Your test has been paused. Everything you’ve answered is saved — resume anytime from Mock Tests.');
    try {
      await attemptsApi.pause(attemptId);
    } catch {
      // Even if the pause call fails, still exit — resuming later will
      // reconcile state server-side (resumeIfPaused only shifts the clock
      // when the doc is actually marked paused, so a failed call here is safe).
    }
  }, [attemptId]);

  useEffect(() => {
    if (!attemptId) return;
    attemptsApi.get(attemptId).then((response) => {
      const data = response.data as Attempt;
      if (data.status !== 'in_progress') {
        navigate(`/mock-tests/result/${attemptId}`, { replace: true });
        return;
      }
      setAttempt(data);
      setSecondsLeft(remainingSeconds(data.deadlineAt));
    }).catch(() => setError('This attempt could not be opened.'));
  }, [attemptId, navigate]);

  useEffect(() => {
    if (!attempt || attempt.status !== 'in_progress') return;
    const timer = window.setInterval(() => {
      const left = remainingSeconds(attempt.deadlineAt);
      setSecondsLeft(left);
      if (left <= 0) finish('timeout');
    }, 500);
    return () => window.clearInterval(timer);
  }, [attempt, finish]);

  useEffect(() => {
    if (document.fullscreenElement) {
      armed.current = true;
      setNeedsFullscreen(false);
    }
    const onFullscreen = () => {
      if (document.fullscreenElement) {
        armed.current = true;
        setNeedsFullscreen(false);
        return;
      }
      setNeedsFullscreen(true);
      if (armed.current) pauseTest();
    };
    const onHide = () => {
      if (document.hidden && armed.current) pauseTest();
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [pauseTest]);

  const question = attempt?.questions?.[index];
  const response = attempt?.responses.find((item) => item.order === question?.order);

  const persist = async (next: ResponseState) => {
    if (!attemptId || !attempt) return;
    setAttempt({
      ...attempt,
      responses: attempt.responses.some((item) => item.order === next.order)
        ? attempt.responses.map((item) => (item.order === next.order ? next : item))
        : [...attempt.responses, next],
    });
    try {
      const saved = await attemptsApi.save(attemptId, {
        order: next.order,
        selected: next.selected,
        markedForReview: next.markedForReview,
      });
      if (saved.timedOut) finish('timeout');
    } catch {
      setError('That answer did not save. Select it once more.');
    }
  };

  const [pendingSelection, setPendingSelection] = useState<string | null>(null);

  useEffect(() => {
    setPendingSelection(response?.selected ?? null);
  }, [index, response?.selected]);

  const choose = (letter: string) => {
    setPendingSelection(letter);
  };

  const goTo = (nextIndex: number) => {
    const nextQuestion = attempt?.questions?.[nextIndex];
    if (!nextQuestion) return;
    setIndex(nextIndex);
  };

  const saveAndNext = () => {
    if (!question) return;
    persist({
      order: question.order,
      selected: pendingSelection,
      markedForReview: Boolean(response?.markedForReview),
      visited: true,
    });
    goTo(index + 1);
  };

  const saveAndMarkReview = () => {
    if (!question) return;
    persist({
      order: question.order,
      selected: pendingSelection,
      markedForReview: true,
      visited: true,
    });
    goTo(index + 1);
  };

  const markReviewAndNext = () => {
    if (!question) return;
    persist({
      order: question.order,
      selected: null,
      markedForReview: true,
      visited: true,
    });
    goTo(index + 1);
  };

  const clearResponse = () => {
    setPendingSelection(null);
    if (!question) return;
    persist({ order: question.order, selected: null, markedForReview: Boolean(response?.markedForReview), visited: true });
  };

  const goToFromPalette = (nextIndex: number) => {
    if (!question) { goTo(nextIndex); return; }
    persist({
      order: question.order,
      selected: pendingSelection,
      markedForReview: Boolean(response?.markedForReview),
      visited: true,
    });
    goTo(nextIndex);
  };

  const resumeFullscreen = async () => {
    await document.documentElement.requestFullscreen();
  };

  if (!attempt || !question) {
    return <div className="min-h-screen flex items-center justify-center bg-white text-sm text-gray-600">{error || 'Loading the test…'}</div>;
  }

  const answered = attempt.responses.filter((item) => item.selected && !item.markedForReview).length;
  const answeredReview = attempt.responses.filter((item) => item.selected && item.markedForReview).length;
  const markedForReview = attempt.responses.filter((item) => item.markedForReview && !item.selected).length;
  const notAnswered = attempt.responses.filter((item) => item.visited && !item.selected && !item.markedForReview).length;
  const totalQuestions = attempt.questions?.length || 0;
  const notVisited = totalQuestions - attempt.responses.filter((item) => item.visited).length;

  const statusOf = (item: Question): Status => {
    const saved = attempt.responses.find((responseItem) => responseItem.order === item.order);
    if (saved?.selected && saved.markedForReview) return 'answered-review';
    if (saved?.markedForReview) return 'review';
    if (saved?.selected) return 'answered';
    if (saved?.visited) return 'seen';
    return 'new';
  };

  const paletteClass: Record<Status, string> = {
    new: 'bg-[#EEF0F2] text-[#344054] border border-[#D7DCE1]',
    seen: 'bg-[#DC5B29] text-white',
    answered: 'bg-[#1AA35A] text-white',
    review: 'bg-[#6E3FC2] text-white',
    'answered-review': 'bg-[#6E3FC2] text-white',
  };

  const subject = attempt.subject || attempt.testTitle;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-white text-[#101828]">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* ── Candidate / exam info bar ── */}
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-[#E2E8F0] px-4 py-4 sm:px-6">
        <div className="flex items-start gap-4">
          <img src="/logo-mark.png" alt="HeyStudent" className="h-12 w-auto shrink-0 sm:h-14" />
          <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-md border border-[#D0D5DD] bg-[#F1F3F5] sm:h-[68px] sm:w-[68px]">
            <span className="text-[22px] font-bold text-[#475569] sm:text-[24px]">{initialsOf(user?.name || 'Candidate')}</span>
          </div>
          <div className="text-[13.5px] leading-[1.9] text-[#344054]">
            <p><span className="font-semibold">Candidate Name :</span> <span className="font-semibold text-[#D4932C]">{user?.name || 'Candidate'}</span></p>
            <p><span className="font-semibold">Exam Name :</span> <span className="font-semibold text-[#D4932C]">{attempt.testTitle}</span></p>
            <p><span className="font-semibold">Subject Name :</span> <span className="font-semibold text-[#D4932C]">{subject}</span></p>
            <p>
              <span className="font-semibold">Remaining Time :</span>{' '}
              <span className="rounded bg-[#1E6FE8] px-2 py-0.5 font-bold tabular-nums text-white" aria-live="polite">{clock(secondsLeft)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start">
          <button
            type="button"
            onClick={() => setConfirmPause(true)}
            disabled={pausing}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1E6FE8] px-3.5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-[#1858BE] disabled:opacity-60"
          >
            <Pause size={14} fill="currentColor" /> Pause Test
          </button>
          <button
            type="button"
            onClick={() => setConfirmSubmit(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1AA35A] px-3.5 py-2 text-[13px] font-bold text-white transition-colors hover:bg-[#15834A]"
          >
            ✓ Submit Test
          </button>
        </div>
      </header>

      {/* ── Subject strip ── */}
      <div className="flex shrink-0 items-center bg-[#F4B23C] px-0 py-0">
        <span className="bg-[#1E6FE8] px-5 py-3 text-[14px] font-bold text-white">{subject}</span>
      </div>

      {needsFullscreen && !leaveMessage && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-md rounded-lg bg-white p-5">
            <h2 className="text-lg font-semibold">Full screen is required</h2>
            <p className="mt-2 text-sm text-gray-700">The test stays in full screen while it's running. If you leave it, the test pauses automatically — everything you've answered is saved, and you can resume anytime.</p>
            <button type="button" onClick={resumeFullscreen} className="mt-4 rounded-md bg-gray-900 px-4 py-2 text-sm text-white">Enter full screen</button>
          </div>
        </div>
      )}

      {leaveMessage && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
          <div role="alert" className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-2xl">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#EEF4FE] text-[#1E6FE8]">
              <Pause size={20} fill="currentColor" />
            </span>
            <p className="mt-3 text-[14.5px] font-semibold leading-relaxed text-[#101828]">{leaveMessage}</p>
            <button
              type="button"
              onClick={async () => {
                if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
                navigate('/mock-tests', { replace: true });
              }}
              className="mt-5 w-full rounded-md bg-[#111827] py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#1F2937]"
            >
              OK
            </button>
          </div>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
        {/* ── Question panel ── */}
        <section className="flex min-h-0 flex-col overflow-hidden bg-white">
          <div className="flex-1 overflow-auto px-6 py-5 sm:px-10 lg:px-14">
            <div className="flex items-center justify-between gap-3 border-b border-[#E8EDF4] pb-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1E6FE8] text-[14px] font-bold text-white">{index + 1}</span>
                <span className="h-6 w-px bg-[#E2E8F0]" />
              </div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2 text-[13px] text-[#64748B]">
                  Marks:
                  <span className="rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-[12px] font-bold text-[#15803D]">+{attempt.positiveMarks}</span>
                  <span className="rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-[12px] font-bold text-[#B91C1C]">-{attempt.negativeMarks}</span>
                </span>
                <Flag size={16} className="text-[#94A3B8]" />
                <Star size={16} className="text-[#94A3B8]" />
              </div>
            </div>

            <div className="max-w-3xl text-left">
              <p className="mt-5 text-[14.5px] font-semibold text-[#101828]">Choose the correct answer from the options given below:</p>
              <p className="mt-4 whitespace-pre-wrap text-[15.5px] font-semibold leading-relaxed text-[#101828]">{question.question}</p>

              <ol className="mt-4 space-y-1.5 text-left text-[14px] text-[#1F2937]">
                {(['A', 'B', 'C', 'D'] as const).map((letter, idx) => (
                  <li key={letter} className="text-left">{idx + 1}. {question[`option${letter}` as 'optionA']}</li>
                ))}
              </ol>

              <div className="mt-6 space-y-3" role="radiogroup" aria-label={`Question ${question.order}`}>
                {(['A', 'B', 'C', 'D'] as const).map((letter, idx) => {
                  const selected = pendingSelection === letter;
                  return (
                    <label
                      key={letter}
                      className={`flex w-full cursor-pointer items-center gap-3 rounded-md border px-4 py-3.5 text-left transition-colors ${
                        selected ? 'border-[#1E6FE8] bg-[#EEF4FE]' : 'border-[#E2E8F0] bg-white hover:bg-[#F7F9FC]'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${question.order}`}
                        checked={selected}
                        onChange={() => choose(letter)}
                        className="h-4 w-4 shrink-0 accent-[#1E6FE8]"
                      />
                      <span className="text-left text-[14px] text-[#101828]">{idx + 1}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {error && <p role="alert" className="px-5 pb-2 text-[12.5px] text-red-700 sm:px-7">{error}</p>}

          {/* ── Action buttons ── */}
          <div className="shrink-0 border-t border-[#E8EDF4] bg-white px-5 py-3.5 sm:px-7">
            <div className="flex flex-wrap gap-2.5">
              <button type="button" onClick={saveAndNext} className="rounded-sm bg-[#1AA35A] px-4 py-2.5 text-[12.5px] font-bold uppercase text-white transition-colors hover:bg-[#15834A]">
                Save &amp; Next
              </button>
              <button type="button" onClick={clearResponse} className="rounded-sm border border-[#D0D5DD] bg-white px-4 py-2.5 text-[12.5px] font-bold uppercase text-[#344054] transition-colors hover:bg-[#F1F5F9]">
                Clear
              </button>
              <button type="button" onClick={saveAndMarkReview} className="rounded-sm bg-[#F4B23C] px-4 py-2.5 text-[12.5px] font-bold uppercase text-white transition-colors hover:bg-[#DE9E2B]">
                Save &amp; Mark for Review
              </button>
              <button type="button" onClick={markReviewAndNext} className="rounded-sm bg-[#1E6FE8] px-4 py-2.5 text-[12.5px] font-bold uppercase text-white transition-colors hover:bg-[#1858BE]">
                Mark for Review &amp; Next
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#E8EDF4] pt-3">
              <button type="button" disabled={index === 0} onClick={() => goToFromPalette(index - 1)} className="rounded-sm border border-[#D0D5DD] bg-[#F1F3F5] px-4 py-2 text-[12.5px] font-bold text-[#344054] transition-colors hover:bg-[#E5E7EB] disabled:opacity-40">
                {'← Back'}
              </button>
              <span className="text-[12.5px] text-[#64748B]">{index + 1} / {totalQuestions}</span>
              <button type="button" disabled={index + 1 === totalQuestions} onClick={() => goToFromPalette(index + 1)} className="rounded-sm bg-[#1E6FE8] px-5 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-[#1858BE] disabled:opacity-40">
                {'Next →'}
              </button>
            </div>
          </div>
        </section>

        {/* ── Palette panel ── */}
        <aside className="flex min-h-0 flex-col overflow-hidden border-t border-[#E2E8F0] bg-white lg:border-l lg:border-t-0">
          <div className="shrink-0 p-4">
            <p className="text-[11.5px] font-bold uppercase tracking-[0.5px] text-[#64748B]">Question Status</p>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 text-[12.5px] text-[#344054]">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-[#EEF0F2] text-[11.5px] font-bold text-[#344054]">{Math.max(notVisited, 0)}</span>
                Not Visited
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-[#DC5B29] text-[11.5px] font-bold text-white">{notAnswered}</span>
                Not Answered
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-sm bg-[#1AA35A] text-[11.5px] font-bold text-white">{answered}</span>
                Attempted
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#6E3FC2] text-[11.5px] font-bold text-white">{markedForReview}</span>
                Marked for Review
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-[#6E3FC2] text-[11.5px] font-bold text-white">
                  {answeredReview}
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[#1AA35A]" />
                </span>
                Attempted &amp; Marked
              </div>
            </div>
          </div>

          <div className="shrink-0 border-y border-[#E8EDF4] bg-[#F1F3F5] px-4 py-2 text-[13px] font-semibold text-[#344054]">
            {subject}
          </div>

          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-6 gap-2">
              {attempt.questions?.map((item, itemIndex) => {
                const status = statusOf(item);
                const isCurrent = itemIndex === index;
                return (
                  <button
                    key={item.order}
                    type="button"
                    onClick={() => goToFromPalette(itemIndex)}
                    className={`h-9 rounded-sm text-[12.5px] font-bold transition-colors focus:outline-none ${
                      isCurrent ? 'border-2 border-[#1E6FE8] bg-[#1AA35A] text-white' : paletteClass[status]
                    }`}
                    aria-label={`Question ${item.order}, ${status}${isCurrent ? ', current' : ''}`}
                  >
                    {item.order}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {confirmSubmit && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5" role="dialog" aria-modal="true" aria-labelledby="submit-title">
            <h2 id="submit-title" className="text-lg font-semibold text-[#101828]">Submit this test?</h2>
            <p className="mt-1 text-[13px] text-[#64748B]">You cannot change any answer after this.</p>
            <dl className="mt-4 grid grid-cols-2 gap-2.5 text-[13px]">
              <div className="rounded-md bg-[#F1F5F9] px-3 py-2">
                <dt className="text-[#64748B]">Total Questions</dt>
                <dd className="text-[16px] font-bold text-[#101828]">{totalQuestions}</dd>
              </div>
              <div className="rounded-md bg-[#DCFCE7] px-3 py-2">
                <dt className="text-[#15803D]">Answered</dt>
                <dd className="text-[16px] font-bold text-[#15803D]">{answered + answeredReview}</dd>
              </div>
              <div className="rounded-md bg-[#F3E8FF] px-3 py-2">
                <dt className="text-[#6E3FC2]">Marked for Review</dt>
                <dd className="text-[16px] font-bold text-[#6E3FC2]">{markedForReview + answeredReview}</dd>
              </div>
              <div className="rounded-md bg-[#FEF2E8] px-3 py-2">
                <dt className="text-[#B45309]">Not Answered</dt>
                <dd className="text-[16px] font-bold text-[#B45309]">{notAnswered + notVisited}</dd>
              </div>
            </dl>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => finish('manual')} className="flex-1 rounded-md bg-[#1AA35A] py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#15834A]">Submit</button>
              <button type="button" onClick={() => setConfirmSubmit(false)} className="flex-1 rounded-md border border-[#D0D5DD] py-2.5 text-[13.5px] font-semibold text-[#344054] hover:bg-[#F7F9FC]">Return to test</button>
            </div>
          </div>
        </div>
      )}

      {confirmPause && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5" role="dialog" aria-modal="true" aria-labelledby="pause-title">
            <h2 id="pause-title" className="text-lg font-semibold">Pause this test?</h2>
            <p className="mt-2 text-sm text-gray-700">You can come back and resume it later — nothing you've answered will be lost.</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  setConfirmPause(false);
                  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
                  pauseTest();
                }}
                className="rounded-md bg-[#1E6FE8] px-4 py-2 text-sm font-semibold text-white"
              >
                Pause &amp; exit
              </button>
              <button type="button" onClick={() => setConfirmPause(false)} className="rounded-md border px-4 py-2 text-sm">Return to test</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MockTestRoomPage;
