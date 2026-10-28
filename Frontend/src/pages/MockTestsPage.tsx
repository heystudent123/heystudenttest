import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { Helmet } from 'react-helmet-async';
import { Clock3, FileText, ListChecks, Maximize, Search, ShieldAlert, X } from 'lucide-react';
import SharedNavbar from '../components/SharedNavbar';
import MockTestPayModal from '../components/MockTestPayModal';
import { emptyReceipt, PaymentPhase, PaymentReceipt } from '../components/PaymentStage';
import { attemptsApi, authApi, paymentsApi } from '../services/api';
import { CheckoutClosed, loadRazorpayScript, openSecureCheckout, paymentFailureReason } from '../utils/razorpayCheckout';
import { useAuth } from '../context/AuthContext';

interface SubjectRow {
  subject: string;
  count: number;
}

interface Offer {
  _id: string;
  title: string;
  price: number;
  testCount: number;
  courseCount: number;
}

interface ListedTest {
  _id: string;
  title: string;
  description: string;
  subject: string;
  durationMinutes: number;
  maxMarks: number;
  questionCount: number;
  isFree: boolean;
  price: number;
  attemptLimit: number;
  hasAccess: boolean;
  attemptsUsed: number;
  inProgressAttemptId: string | null;
  offers: Offer[];
}

interface CatalogResponse {
  data: ListedTest[];
  total: number;
  page: number;
  pages: number;
  checkoutAvailable: boolean;
  progress?: { total: number; unlocked: number; attempted: number };
}

interface Instructions {
  title: string;
  description: string;
  instructions: string;
  durationMinutes: number;
  positiveMarks: number;
  negativeMarks: number;
  maxMarks: number;
  questionCount: number;
  attemptLimit: number;
  isFree: boolean;
  price: number;
  hasAccess: boolean;
  checkoutAvailable: boolean;
  profileMissing: string[];
}

const TINTS = [
  'bg-[#EEF0FF] text-[#6B7CFF]',
  'bg-[#E7F8EF] text-[#3CB371]',
  'bg-[#FFF6D8] text-[#D4A017]',
  'bg-[#FDECEC] text-[#E07A7A]',
  'bg-[#F3EEFF] text-[#9B8AF5]',
];

function errorMessage(err: any, fallback: string) {
  return err?.response?.data?.error || err?.response?.data?.message || fallback;
}

function rupees(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

const ProgressPanel: React.FC<{ total: number; unlocked: number; attempted: number; signedIn: boolean }> = ({ total, unlocked, attempted, signedIn }) => {
  const pct = unlocked > 0 ? Math.round((attempted / unlocked) * 100) : 0;
  const radius = 34;
  const circ = 2 * Math.PI * radius;
  return (
    <section className="rounded-2xl border border-[#E8EDF4] bg-white p-4 text-left">
      <p className="text-[15px] font-bold text-[#101828]">Your Progress</p>
      <div className="mt-4 flex items-center gap-4">
        <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true">
          <circle cx="44" cy="44" r={radius} fill="none" stroke="#EEF2F6" strokeWidth="8" />
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke="#12B76A"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ - (circ * pct) / 100}
            transform="rotate(-90 44 44)"
          />
          <text x="44" y="49" textAnchor="middle" fontSize="16" fontWeight="700" fill="#101828">{pct}%</text>
        </svg>
        <div>
          <p className="text-[22px] font-bold leading-none text-[#101828]">{attempted}<span className="text-[16px] text-[#98A2B3]"> / {unlocked}</span></p>
          <p className="mt-1 text-[13px] text-[#64748B]">Attempted of unlocked</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-[13px] text-[#475569]">
        <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#12B76A]" /> Unlocked</span><span className="font-semibold text-[#101828]">{unlocked}</span></li>
        <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#3267f5]" /> Attempted</span><span className="font-semibold text-[#101828]">{attempted}</span></li>
        <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#D0D5DD]" /> Still locked</span><span className="font-semibold text-[#101828]">{Math.max(total - unlocked, 0)}</span></li>
      </ul>
      {!signedIn && <p className="mt-3 text-[12px] leading-relaxed text-[#94A3B8]">Sign in to track the tests you attempt.</p>}
    </section>
  );
};

const MockTestsPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { isLoaded, isSignedIn } = useClerkAuth();
  const { user, updateUserProfile } = useAuth();
  const subject = params.get('subject') || '';
  const query = params.get('q') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const openId = params.get('test') || '';

  const [searchInput, setSearchInput] = useState(query);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [subjectTotal, setSubjectTotal] = useState(0);
  const [subjectsError, setSubjectsError] = useState('');
  const [tests, setTests] = useState<ListedTest[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [checkoutAvailable, setCheckoutAvailable] = useState(false);
  const [progress, setProgress] = useState({ total: 0, unlocked: 0, attempted: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [active, setActive] = useState<ListedTest | null>(null);
  const [details, setDetails] = useState<Instructions | null>(null);
  const [detailError, setDetailError] = useState('');
  const [profile, setProfile] = useState({ name: '', city: '', whatsapp: '' });
  const [starting, setStarting] = useState(false);
  const [buying, setBuying] = useState(false);
  const [payPhase, setPayPhase] = useState<PaymentPhase>('review');
  const [receipt, setReceipt] = useState<PaymentReceipt>(emptyReceipt);
  const [referralCode, setReferralCode] = useState('');
  const [couponCode, setCouponCode] = useState('');

  useEffect(() => {
    setSearchInput(query);
  }, [query]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = searchInput.trim();
      if (next === query) return;
      const updated = new URLSearchParams(params);
      if (next) updated.set('q', next);
      else updated.delete('q');
      updated.delete('page');
      setParams(updated, { replace: true });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput, query, params, setParams]);

  useEffect(() => {
    let cancelled = false;
    attemptsApi.subjects()
      .then((response) => {
        if (cancelled) return;
        setSubjects(response.data || []);
        setSubjectTotal(response.total || 0);
        setSubjectsError('');
      })
      .catch((err) => {
        if (!cancelled) setSubjectsError(errorMessage(err, 'Could not load subjects.'));
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    attemptsApi.catalog({ subject: subject || undefined, q: query || undefined, page, limit: 20 })
      .then((response: CatalogResponse) => {
        if (cancelled) return;
        setTests(response.data || []);
        setTotal(response.total || 0);
        setPages(response.pages || 1);
        setCheckoutAvailable(Boolean(response.checkoutAvailable));
        setProgress(response.progress || { total: 0, unlocked: 0, attempted: 0 });
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err, 'Could not load mock tests.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [subject, query, page, reloadKey, isSignedIn]);

  const setSubject = (value: string) => {
    const updated = new URLSearchParams(params);
    if (value) updated.set('subject', value);
    else updated.delete('subject');
    updated.delete('page');
    updated.delete('test');
    setParams(updated);
    setActive(null);
    setDetails(null);
  };

  const closeDetails = useCallback(() => {
    setActive(null);
    setDetails(null);
    const updated = new URLSearchParams(params);
    updated.delete('test');
    setParams(updated, { replace: true });
  }, [params, setParams]);

  const openTest = useCallback(async (test: ListedTest) => {
    setDetailError('');
    setPayPhase('review');
    setActive(test);
    setDetails(null);
    const updated = new URLSearchParams(params);
    updated.set('test', test._id);
    setParams(updated, { replace: true });
    if (!isLoaded) return;
    if (!isSignedIn) {
      if (!test.isFree && !test.hasAccess) return;
      navigate(`/login?redirect=${encodeURIComponent(`/mock-tests?${updated.toString()}`)}`);
      return;
    }
    if (!test.isFree && !test.hasAccess) return;
    try {
      const response = await attemptsApi.instructions(test._id);
      setDetails(response.data);
    } catch (err) {
      setDetailError(errorMessage(err, 'Could not open this test.'));
    }
  }, [isLoaded, isSignedIn, navigate, params, setParams]);

  useEffect(() => {
    if (!openId || !isLoaded || loading) return;
    const match = tests.find((test) => test._id === openId);
    if (!match || active?._id === openId) return;
    openTest(match);
  }, [openId, isLoaded, loading, tests, active, openTest]);

  const buy = async (purpose: 'plan' | 'mock_test', id: string, title: string) => {
    if (!isSignedIn) {
      const updated = new URLSearchParams(params);
      if (active) updated.set('test', active._id);
      navigate(`/login?redirect=${encodeURIComponent(`/mock-tests?${updated.toString()}`)}`);
      return;
    }
    setBuying(true);
    setDetailError('');
    setPayPhase('processing');
    setReceipt({ title, amount: active?.price || 0, orderId: '', reason: '' });
    let orderId = '';
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('The secure payment window could not be opened. Check your connection and retry.');
      const orderRes = await paymentsApi.createOrder({
        amount: 1,
        purpose,
        purposeId: id,
        purposeModel: purpose === 'plan' ? 'Plan' : 'MockTest',
        referralCode: referralCode.trim() || undefined,
        couponCode: couponCode.trim() || undefined,
      });
      const order = orderRes.data;
      orderId = order.orderId;
      setReceipt({ title, amount: order.finalAmountInRupees || active?.price || 0, orderId, reason: '' });
      await openSecureCheckout({
        orderId,
        amount: order.amount,
        currency: order.currency,
        keyId: order.keyId,
        description: order.rewardDiscount > 0 ? `${title} (₹${order.rewardDiscount} off applied)` : title,
        prefill: { name: user?.name || '', email: user?.email || '' },
      });
      setPayPhase('paid');
    } catch (err: any) {
      if (!orderId && !(err instanceof CheckoutClosed)) {
        setPayPhase('review');
        setDetailError(paymentFailureReason(err));
        return;
      }
      setReceipt((current) => ({ ...current, orderId: orderId || current.orderId, reason: paymentFailureReason(err) }));
      setPayPhase('failed');
    } finally {
      setBuying(false);
    }
  };

  const start = async () => {
    if (!active || !details?.hasAccess) return;
    setStarting(true);
    setDetailError('');
    try {
      if (details.profileMissing?.length) {
        await authApi.updateProfile('', profile);
        await updateUserProfile(profile);
      }
      const root = document.documentElement;
      if (root.requestFullscreen) await root.requestFullscreen();
      if (active.inProgressAttemptId) {
        navigate(`/mock-tests/attempt/${active.inProgressAttemptId}`);
        return;
      }
      const response = await attemptsApi.start(active._id);
      navigate(`/mock-tests/attempt/${response.data._id}`);
    } catch (err: any) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      const code = err?.response?.data?.code;
      if (code === 'PROFILE_INCOMPLETE') setDetailError('Enter your name, city, and a 10-digit WhatsApp number.');
      else if (code === 'CHECKOUT_UNAVAILABLE') setDetailError(errorMessage(err, 'This test is still locked.'));
      else setDetailError(errorMessage(err, 'The test could not start. Allow full screen and try again.'));
    } finally {
      setStarting(false);
    }
  };

  const attemptsLeft = (test: ListedTest) => test.attemptLimit === 0 || test.attemptsUsed < test.attemptLimit || Boolean(test.inProgressAttemptId);

  const buttonLabel = (test: ListedTest) => {
    if (test.inProgressAttemptId) return 'Resume';
    if (!test.isFree && !test.hasAccess) return 'Unlock Test';
    if (!attemptsLeft(test)) return 'Attempts used';
    if (!test.isFree && test.hasAccess) return 'Attempt';
    return 'Start Test';
  };

  return (
    <div className="hs-page min-h-screen bg-white">
      <Helmet>
        <title>CUET Mock Tests — Practice Online | HeyStudent</title>
        <meta name="description" content="Attempt CUET mock tests in the real exam pattern, track your progress and review detailed results after every attempt." />
        <link rel="canonical" href="https://heystudent.in/mock-tests" />
      </Helmet>
      <SharedNavbar />
      <div className="flex min-h-[calc(100vh-92px)] bg-white">
        <aside className="sticky top-[92px] hidden h-[calc(100vh-92px)] w-[240px] shrink-0 overflow-y-auto border-r border-[#EEF1F6] bg-white px-4 py-6 lg:block">
          <p className="px-3 pb-2 text-[12px] font-bold uppercase tracking-[1.6px] text-[#94A3B8]">Subjects</p>
          {subjectsError ? (
            <p className="px-3 py-2 text-[13px] text-[#B42318]">{subjectsError}</p>
          ) : (
            <div className="flex flex-col gap-1">
              <button type="button" onClick={() => setSubject('')} className={`rounded-lg px-3 py-2 text-left text-[14px] ${subject ? 'text-[#475569] hover:bg-[#F8FAFC]' : 'bg-[#EEF3FF] font-semibold text-[#3267f5]'}`}>
                <span className="flex items-center justify-between gap-2">All Subjects <span className="text-[12px] font-medium text-[#94A3B8]">{subjectTotal}</span></span>
              </button>
              {subjects.map((row) => (
                <button key={row.subject} type="button" onClick={() => setSubject(row.subject)} className={`rounded-lg px-3 py-2 text-left text-[14px] ${subject.toLowerCase() === row.subject.toLowerCase() ? 'bg-[#EEF3FF] font-semibold text-[#3267f5]' : 'text-[#475569] hover:bg-[#F8FAFC]'}`}>
                  <span className="flex items-center justify-between gap-2">{row.subject} <span className="text-[12px] font-medium text-[#94A3B8]">{row.count}</span></span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="text-left">
              <h1 className="mock-title">{subject ? `${subject} Mock Tests` : 'CUET Mock Tests'}</h1>
              <p className="mt-2 max-w-[520px] text-[15px] leading-relaxed text-[#64748B]">
                Practice with published CUET papers and review your performance after each attempt.
              </p>
              <p className="mt-2 text-[13px] font-medium text-[#94A3B8]">{loading ? 'Loading tests' : `${total} ${total === 1 ? 'test' : 'tests'}`}</p>
            </div>
            <label className="relative block w-full sm:w-[280px]">
              <span className="sr-only">Search mock tests</span>
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search mock tests..."
                className="w-full rounded-lg border border-[#E4E7EC] bg-white py-2.5 pl-9 pr-3 text-[14px] text-[#101828] outline-none focus:border-[#3267f5]"
              />
            </label>
          </div>

          <div className="mt-4 lg:hidden">
            <ProgressPanel total={progress.total} unlocked={progress.unlocked} attempted={progress.attempted} signedIn={Boolean(isSignedIn)} />
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            <button type="button" onClick={() => setSubject('')} className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] ${subject ? 'bg-white text-[#475569]' : 'bg-[#111827] font-semibold text-white'}`}>All Subjects</button>
            {subjects.map((row) => (
              <button key={row.subject} type="button" onClick={() => setSubject(row.subject)} className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] ${subject.toLowerCase() === row.subject.toLowerCase() ? 'bg-[#111827] font-semibold text-white' : 'bg-white text-[#475569]'}`}>
                {row.subject} ({row.count})
              </button>
            ))}
          </div>

          {error && (
            <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F3D0D0] bg-[#FFF6F6] px-4 py-3 text-[14px] text-[#B42318]">
              <span className="flex items-center gap-2"><ShieldAlert size={16} /> {error}</span>
              <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="rounded-md border border-[#F3D0D0] bg-white px-3 py-1.5 text-[13px] font-semibold">Retry</button>
            </div>
          )}

          {loading ? (
            <div className="mt-5 space-y-3">
              {[0, 1, 2, 3].map((key) => <div key={key} className="h-[92px] animate-pulse rounded-2xl bg-[#F4F6FB]" />)}
            </div>
          ) : tests.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-[#E4E7EC] bg-white px-6 py-12 text-center text-[14px] text-[#64748B]">
              No published mock tests match this search.
            </div>
          ) : (
            <ul className="mt-5 space-y-3">
              {tests.map((test, index) => {
                const locked = !test.isFree && !test.hasAccess;
                const disabled = !locked && !attemptsLeft(test);
                return (
                  <li key={test._id}>
                    <article className="flex flex-col gap-4 rounded-2xl border border-[#E8EDF4] bg-white p-4 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:flex-row sm:items-center">
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${TINTS[index % TINTS.length]}`}>
                        <FileText size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[16px] font-bold text-[#101828]">{test.title}</p>
                          {test.isFree && (
                            <span className="rounded-full bg-[#E7F8EF] px-2 py-0.5 text-[11px] font-semibold text-[#1F8A4C]">Free</span>
                          )}
                        </div>
                        <p className="mt-1 text-[13px] text-[#64748B]">{test.subject}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#64748B]">
                          <span className="inline-flex items-center gap-1"><ListChecks size={13} /> {test.questionCount} questions</span>
                          <span className="inline-flex items-center gap-1"><Clock3 size={13} /> {test.durationMinutes} min</span>
                          {test.maxMarks > 0 && <span>{test.maxMarks} marks</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => openTest(test)}
                        className="inline-flex shrink-0 items-center justify-center rounded-md bg-[#111827] px-4 py-2.5 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#D0D5DD]"
                      >
                        {buttonLabel(test)}
                      </button>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}

          {pages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-2 text-[13px]">
              <button type="button" disabled={page <= 1} onClick={() => { const updated = new URLSearchParams(params); updated.set('page', String(page - 1)); setParams(updated); }} className="rounded-md border border-[#E4E7EC] bg-white px-3 py-1.5 disabled:opacity-40">Previous</button>
              <span className="text-[#64748B]">{page} / {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => { const updated = new URLSearchParams(params); updated.set('page', String(page + 1)); setParams(updated); }} className="rounded-md border border-[#E4E7EC] bg-white px-3 py-1.5 disabled:opacity-40">Next</button>
            </div>
          )}

          {active && !active.isFree && !active.hasAccess && (
            <MockTestPayModal
              test={active}
              referralCode={referralCode}
              couponCode={couponCode}
              onReferralCode={setReferralCode}
              onCouponCode={setCouponCode}
              buying={buying}
              checkoutAvailable={checkoutAvailable}
              error={detailError}
              phase={payPhase}
              receipt={receipt}
              onClose={closeDetails}
              onBack={() => { setPayPhase('review'); setDetailError(''); }}
              onContinue={() => { setPayPhase('review'); setActive(null); setDetails(null); setReloadKey((value) => value + 1); }}
              onBuy={buy}
            />
          )}
          {active && (active.isFree || active.hasAccess) && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
              onClick={(e) => { if (e.target === e.currentTarget) closeDetails(); }}
            >
              <section className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E8EDF4] bg-white p-5 text-left shadow-2xl sm:p-6">
                <button type="button" onClick={closeDetails} aria-label="Close" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[#94A3B8] transition-colors hover:bg-[#F1F5F9] hover:text-[#101828]">
                  <X size={18} />
                </button>
                <p className="pr-8 text-[20px] font-bold text-[#101828]">{active.title}</p>
                {details ? (
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-3 text-[13px] text-[#64748B]">
                      <span>{details.questionCount} questions</span>
                      <span>{details.durationMinutes} min</span>
                      {details.maxMarks > 0 && <span>{details.maxMarks} marks</span>}
                      <span>+{details.positiveMarks} / −{details.negativeMarks}</span>
                    </div>
                    {details.instructions && (
                      <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-[#475569]">
                        <Maximize size={14} className="mb-0.5 mr-1 inline" />{details.instructions}
                      </p>
                    )}
                    {details.profileMissing.length > 0 && (
                      <div className="mt-4 grid gap-2 rounded-xl bg-[#F8FAFC] p-4">
                        <p className="text-[14px] font-semibold text-[#101828]">Finish your profile to start</p>
                        {details.profileMissing.includes('name') && <input aria-label="Full name" placeholder="Full name" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} className="rounded-md border border-[#E4E7EC] px-3 py-2 text-[14px] outline-none focus:border-[#3267f5]" />}
                        {details.profileMissing.includes('city') && <input aria-label="City" placeholder="City" value={profile.city} onChange={(event) => setProfile({ ...profile, city: event.target.value })} className="rounded-md border border-[#E4E7EC] px-3 py-2 text-[14px] outline-none focus:border-[#3267f5]" />}
                        {details.profileMissing.includes('whatsapp') && <input aria-label="WhatsApp number" placeholder="10-digit WhatsApp number" value={profile.whatsapp} onChange={(event) => setProfile({ ...profile, whatsapp: event.target.value })} className="rounded-md border border-[#E4E7EC] px-3 py-2 text-[14px] outline-none focus:border-[#3267f5]" />}
                      </div>
                    )}
                    <button type="button" disabled={starting || !attemptsLeft(active)} onClick={start} className="mt-4 rounded-md bg-[#111827] px-5 py-2.5 text-[14px] font-semibold text-white disabled:bg-[#D0D5DD]">
                      {starting ? 'Opening…' : active.inProgressAttemptId ? 'Resume test' : 'Start test in full screen'}
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-[14px] text-[#64748B]">{detailError || 'Loading test details…'}</p>
                )}
                {detailError && active.hasAccess && <p role="alert" className="mt-3 text-[14px] text-[#B42318]">{detailError}</p>}
              </section>
            </div>
          )}
        </main>
        <aside className="sticky top-[92px] hidden h-[calc(100vh-92px)] w-[280px] shrink-0 overflow-y-auto border-l border-[#EEF1F6] bg-white p-5 lg:block">
          <ProgressPanel total={progress.total} unlocked={progress.unlocked} attempted={progress.attempted} signedIn={Boolean(isSignedIn)} />
        </aside>
      </div>
    </div>
  );
};

export default MockTestsPage;
