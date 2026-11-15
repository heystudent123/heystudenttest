import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft } from 'lucide-react';
import { attemptsApi, authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface InstructionsData {
  title: string;
  hasAccess: boolean;
  profileMissing: string[];
}

function errorMessage(err: any, fallback: string) {
  return err?.response?.data?.error || err?.response?.data?.message || fallback;
}

const GENERAL_INSTRUCTIONS: { title: string; body: string }[] = [
  {
    title: 'Saving answers',
    body: 'Select an option and click "Submit & Next" or "Mark for Review & Next". Both are evaluated. Answers that are not saved will not be evaluated.',
  },
  {
    title: 'Final submission',
    body: 'Clicking "SUBMIT" (not "Submit & Next") ends your entire test. Click it only when you have finished.',
  },
  {
    title: 'Timer',
    body: 'The test is timed, and the countdown is shown on the screen. The test is submitted automatically when time runs out.',
  },
  {
    title: 'Marking scheme',
    body: 'You get +5 for each correct answer and −1 for each wrong answer. Unattempted questions carry no marks and no penalty.',
  },
  {
    title: 'Question navigation',
    body: 'Use the question palette to jump to any question. You can change your answer or revisit any question before final submission.',
  },
  { title: 'Not Visited', body: 'You have not opened the question yet.' },
  { title: 'Not Answered', body: 'You opened the question but did not answer it.' },
  { title: 'Answered', body: 'You saved an answer.' },
  {
    title: 'Marked for Review',
    body: 'You flagged the question to revisit later. If an answer is selected, it is still evaluated.',
  },
  {
    title: 'Errors in questions',
    body: 'The actual CUET exam often has incorrect questions. If none of the four options is correct, attempt any option or move on. Such questions are cancelled.',
  },
  {
    title: 'No calculator',
    body: 'CUET does not have a virtual calculator. Keep a rough sheet and pen ready, and double-check your calculations.',
  },
  {
    title: 'Environment',
    body: 'Sit in a quiet place and avoid distractions. More instructions appear on your actual exam day.',
  },
  {
    title: 'Fair practice',
    body: 'Treat this mock like the real exam. Do not use books, notes, or other devices, so your score reflects your actual preparation.',
  },
];

const PATTERN = [
  'Total Questions: 50',
  'Duration: 60 minutes',
  'Correct Answer: +5 marks',
  'Wrong Answer: −1 mark',
  'Unattempted: 0 marks',
  'Maximum Marks: 250',
];

const TIPS = [
  'Attempt the questions you are sure about first, then return to the harder ones.',
  'Do not spend too long on a single question.',
  'Avoid random guessing, since each wrong answer costs you 1 mark.',
  'Stay calm and confident. Calm students make fewer mistakes and score higher.',
];

const MockTestInstructionsPage: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, updateUserProfile } = useAuth();
  const isPreview = params.get('preview') === '1';
  const from = params.get('from') || '';
  const [details, setDetails] = useState<InstructionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState({
    name: user?.name || '',
    city: user?.city || '',
    whatsapp: user?.whatsapp || user?.phone || '',
  });

  const backPath = from === 'dashboard'
    ? '/student/dashboard/mock-tests'
    : from === 'admin'
    ? '/admin/mock-tests'
    : '/mock-tests';

  useEffect(() => {
    let cancelled = false;
    if (!testId) return;

    if (isPreview) {
      setDetails({
        title: params.get('title') || 'Preview',
        hasAccess: true,
        profileMissing: [],
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    attemptsApi.instructions(testId)
      .then((res) => {
        if (cancelled) return;
        const data = res.data as InstructionsData;
        if (!data.hasAccess) {
          navigate(backPath, { replace: true });
          return;
        }
        setDetails(data);
        setProfile({
          name: user?.name || '',
          city: user?.city || '',
          whatsapp: user?.whatsapp || user?.phone || '',
        });
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not open this test.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [testId, isPreview, backPath, navigate, params, user?.name, user?.city, user?.whatsapp, user?.phone]);

  useEffect(() => {
    const root = document.documentElement;
    if (root.requestFullscreen && !document.fullscreenElement) {
      root.requestFullscreen().catch(() => {});
    }
  }, []);

  const goBack = async () => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    navigate(backPath);
  };

  const start = async () => {
    if (!testId || !details?.hasAccess) return;
    setStarting(true);
    setError('');
    try {
      if (!isPreview && details.profileMissing?.length) {
        await authApi.updateProfile('', profile);
        await updateUserProfile(profile);
      }
      const root = document.documentElement;
      if (root.requestFullscreen && !document.fullscreenElement) {
        await root.requestFullscreen();
      }
      const response = isPreview
        ? await attemptsApi.startPreview(testId)
        : await attemptsApi.start(testId);
      navigate(`/mock-tests/attempt/${response.data._id}`, { replace: true });
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'PROFILE_INCOMPLETE') setError('Enter your name, city, and a 10-digit WhatsApp number.');
      else setError(errorMessage(err, 'The test could not start. Allow full screen and try again.'));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-white"
      style={{ textAlign: 'left' }}
    >
      <Helmet>
        <title>CUET Mock Test Instructions | HeyStudent</title>
      </Helmet>

      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#E8EDF4] bg-white px-4 py-3 sm:px-8">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#475569] hover:text-[#101828]"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <p className="truncate text-[13px] font-medium text-[#64748B]">
          {details?.title || 'CUET Mock Test'}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-8">
          {loading ? (
            <p className="text-[14px] text-[#64748B]">Loading instructions…</p>
          ) : error && !details ? (
            <div>
              <p role="alert" className="text-[14px] text-[#B42318]">{error}</p>
              <button type="button" onClick={goBack} className="mt-4 rounded-md bg-[#111827] px-4 py-2.5 text-[14px] font-semibold text-white">
                Go back
              </button>
            </div>
          ) : (
            <div className="text-left">
              <h1 className="m-0 text-left text-[22px] font-extrabold leading-tight text-[#101828] sm:text-[26px]">
                CUET Mock Test: Instructions
              </h1>
              <p className="mt-2 text-left text-[14px] leading-relaxed text-[#475569]">
                Please read these instructions carefully before you begin.
              </p>

              <section className="mt-6 border-t border-[#EEF1F6] pt-5">
                <h2 className="m-0 text-left text-[15px] font-bold uppercase tracking-[0.04em] text-[#101828]">
                  Test Pattern
                </h2>
                <ul className="mt-3 list-none space-y-1.5 p-0 text-left text-[14px] leading-relaxed text-[#344054]">
                  {PATTERN.map((row) => (
                    <li key={row} className="flex gap-2">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#101828]" />
                      <span>{row}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-left text-[14px] leading-relaxed text-[#475569]">
                  All questions carry equal marks, so choose them wisely. If a question is taking too long, skip it and come back later.
                </p>
              </section>

              <section className="mt-6 border-t border-[#EEF1F6] pt-5">
                <h2 className="m-0 text-left text-[15px] font-bold uppercase tracking-[0.04em] text-[#101828]">
                  General Instructions
                </h2>
                <ol className="mt-3 list-none space-y-3 p-0 text-left">
                  {GENERAL_INSTRUCTIONS.map((item, index) => (
                    <li key={item.title} className="flex gap-3 text-[14px] leading-relaxed text-[#344054]">
                      <span className="w-6 shrink-0 font-bold text-[#101828]">{index + 1}.</span>
                      <span>
                        <span className="font-semibold text-[#101828]">{item.title}:</span>{' '}
                        {item.body}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="mt-6 border-t border-[#EEF1F6] pt-5">
                <h2 className="m-0 text-left text-[15px] font-bold uppercase tracking-[0.04em] text-[#101828]">
                  Tips for a Better Score
                </h2>
                <ul className="mt-3 list-none space-y-1.5 p-0 text-left text-[14px] leading-relaxed text-[#344054]">
                  {TIPS.map((tip) => (
                    <li key={tip} className="flex gap-2">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#101828]" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <p className="mt-6 text-left text-[14px] font-semibold text-[#101828]">
                All the best! Click &quot;Start Test&quot; when you are ready.
              </p>

              {!isPreview && details?.profileMissing?.length ? (
                <div className="mt-5 grid max-w-md gap-2 rounded-xl border border-[#E8EDF4] bg-[#F8FAFC] p-4 text-left">
                  <p className="text-[14px] font-semibold text-[#101828]">Finish your profile to start</p>
                  {details.profileMissing.includes('name') && (
                    <input
                      aria-label="Full name"
                      placeholder="Full name"
                      value={profile.name}
                      onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                      className="rounded-md border border-[#E4E7EC] px-3 py-2 text-left text-[14px] outline-none focus:border-[#3267f5]"
                    />
                  )}
                  {details.profileMissing.includes('city') && (
                    <input
                      aria-label="City"
                      placeholder="City"
                      value={profile.city}
                      onChange={(event) => setProfile({ ...profile, city: event.target.value })}
                      className="rounded-md border border-[#E4E7EC] px-3 py-2 text-left text-[14px] outline-none focus:border-[#3267f5]"
                    />
                  )}
                  {details.profileMissing.includes('whatsapp') && (
                    <input
                      aria-label="WhatsApp number"
                      placeholder="10-digit WhatsApp number"
                      value={profile.whatsapp}
                      onChange={(event) => setProfile({ ...profile, whatsapp: event.target.value })}
                      className="rounded-md border border-[#E4E7EC] px-3 py-2 text-left text-[14px] outline-none focus:border-[#3267f5]"
                    />
                  )}
                </div>
              ) : null}

              {error && (
                <p role="alert" className="mt-4 text-left text-[14px] text-[#B42318]">{error}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {!loading && details && (
        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#E8EDF4] bg-white px-4 py-3 sm:px-8">
          <button
            type="button"
            onClick={goBack}
            className="rounded-md border border-[#E4E7EC] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#344054]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={starting}
            onClick={start}
            className="rounded-md bg-[#111827] px-6 py-2.5 text-[14px] font-semibold text-white disabled:bg-[#D0D5DD]"
          >
            {starting ? 'Starting…' : 'Start Test'}
          </button>
        </footer>
      )}
    </div>
  );
};

export default MockTestInstructionsPage;
