import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2, Clock3, FileText, Info, Layers, ListChecks, Lock, PlayCircle, RotateCcw, Search,
} from 'lucide-react';
import { attemptsApi, paymentsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import DashboardPageHeader from '../../components/dashboard/DashboardPageHeader';
import MockTestPayModal from '../../components/MockTestPayModal';
import PlanBundleInfoModal from '../../components/PlanBundleInfoModal';
import PaymentStage, { emptyReceipt, PaymentPhase, PaymentReceipt } from '../../components/PaymentStage';
import { CheckoutClosed, loadRazorpayScript, openSecureCheckout, paymentFailureReason } from '../../utils/razorpayCheckout';

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
  offers?: { _id: string; title: string; price: number; testCount: number; courseCount: number }[];
}

interface PlanCard {
  _id: string;
  title: string;
  description: string;
  price: number;
  hasAccess: boolean;
  testCount: number;
  bundles: {
    _id: string;
    title: string;
    description: string;
    mockTests: { _id: string; title: string; subject: string; durationMinutes: number; questionCount: number }[];
  }[];
}

interface AttemptRow {
  _id: string;
  mockTestId: string;
  testTitle: string;
  attemptNumber: number;
  status: 'in_progress' | 'paused' | 'submitted' | 'auto_submitted';
  submittedAt: string | null;
  createdAt: string;
  durationMinutes: number;
  result: {
    score: number; maxMarks: number; percentage: number; accuracy: number;
    correct: number; incorrect: number; unanswered: number; totalQuestions: number;
  } | null;
}

type Tab = 'available' | 'history';

const DashboardMockTestsPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const openId = params.get('test') || '';
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('available');

  const [tests, setTests] = useState<ListedTest[]>([]);
  const [planCards, setPlanCards] = useState<PlanCard[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planCheckout, setPlanCheckout] = useState<{ id: string; title: string; price: number } | null>(null);
  const [infoPlan, setInfoPlan] = useState<PlanCard | null>(null);

  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(true);
  const [checkoutAvailable, setCheckoutAvailable] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [active, setActive] = useState<ListedTest | null>(null);
  const [detailError, setDetailError] = useState('');
  const [buying, setBuying] = useState(false);
  const [payPhase, setPayPhase] = useState<PaymentPhase>('review');
  const [receipt, setReceipt] = useState<PaymentReceipt>(emptyReceipt);
  const [referralCode, setReferralCode] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const openedRef = useRef('');

  useEffect(() => {
    setTestsLoading(true);
    attemptsApi.catalog({ limit: 50 })
      .then((res) => {
        setTests(res.data || []);
        setPlanCards(res.plans || []);
        setCheckoutAvailable(Boolean(res.checkoutAvailable));
      })
      .catch(() => { setTests([]); setPlanCards([]); })
      .finally(() => setTestsLoading(false));
    setAttemptsLoading(true);
    attemptsApi.myAttempts({ limit: 50 })
      .then((res) => setAttempts(res.data || []))
      .catch(() => setAttempts([]))
      .finally(() => setAttemptsLoading(false));
  }, [reloadKey]);

  const filteredTests = tests.filter((t) =>
    !search.trim() || t.title.toLowerCase().includes(search.trim().toLowerCase()) || t.subject.toLowerCase().includes(search.trim().toLowerCase())
  );
  const filteredPlans = planCards.filter((plan) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return [plan.title, plan.description, ...plan.bundles.flatMap((bundle) => [bundle.title, ...bundle.mockTests.map((test) => test.title)])]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const openTest = (test: ListedTest) => {
    setDetailError('');
    setPayPhase('review');
    if (!test.isFree && !test.hasAccess) {
      setActive(test);
      return;
    }
    navigate(`/mock-tests/${test._id}/instructions?from=dashboard`);
  };

  // Opens the test named in the dashboard link once the list has loaded.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!openId || testsLoading || openedRef.current === openId) return;
    const match = tests.find((test) => test._id === openId);
    if (!match) return;
    openedRef.current = openId;
    openTest(match);
  }, [openId, testsLoading, tests]);

  const closeTest = () => {
    setActive(null);
    setDetailError('');
    if (!params.get('test')) return;
    const next = new URLSearchParams(params);
    next.delete('test');
    setParams(next, { replace: true });
    openedRef.current = '';
  };

  const buy = async (purpose: 'plan' | 'mock_test', id: string, title: string, amountHint = 0) => {
    if (purpose === 'plan') setPlanCheckout({ id, title, price: amountHint });
    setBuying(true);
    setDetailError('');
    setPayPhase('processing');
    setReceipt({ title, amount: amountHint || active?.price || 0, orderId: '', reason: '' });
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
      setReceipt({ title, amount: order.finalAmountInRupees || amountHint || active?.price || 0, orderId, reason: '' });
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
        if (purpose === 'plan') setPlanCheckout(null);
        return;
      }
      setReceipt((current) => ({ ...current, orderId: orderId || current.orderId, reason: paymentFailureReason(err) }));
      setPayPhase('failed');
    } finally {
      setBuying(false);
    }
  };

  return (
    <div>
      <DashboardPageHeader
        eyebrow="Practice"
        title="Mock Tests"
        description="Attempt new mock tests or review your past performance."
      />

      <div className="border-b border-[#E8EDF4] bg-white px-6 lg:px-10">
        <div className="flex gap-6">
          {([
            { key: 'available', label: 'Available Tests' },
            { key: 'history', label: 'My Attempts' },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`border-b-2 px-1 py-3.5 text-[14px] font-semibold transition-colors ${
                tab === t.key ? 'border-[#111827] text-[#101828]' : 'border-transparent text-[#94A3B8] hover:text-[#475569]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-7 lg:px-10">
        {tab === 'available' ? (
          <>
            <div className="relative mb-5 max-w-sm">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title or subject…"
                className="w-full rounded-lg border border-[#D0D5DD] py-2.5 pl-10 pr-4 text-[13.5px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
              />
            </div>

            {testsLoading ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#111827] border-t-transparent" />
              </div>
            ) : filteredPlans.length === 0 && filteredTests.length === 0 ? (
              <div className="rounded-2xl border border-[#E8EDF4] bg-[#F7F9FC] py-16 text-center text-[14px] text-[#64748B]">
                No mock tests match your search.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPlans.map((plan) => (
                  <div key={plan._id} className="flex flex-col rounded-[18px] border border-[#E8EDF4] bg-white p-5 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-[#EEF1FF] px-2.5 py-1 text-[11px] font-semibold text-[#3267f5]">Plan</span>
                      {plan.hasAccess ? (
                        <span className="rounded-full bg-[#E7F8EF] px-2.5 py-1 text-[11px] font-bold text-[#1F9D55]">Unlocked</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF1E8] px-2.5 py-1 text-[11px] font-bold text-[#E07A1F]"><Lock size={10} /> ₹{plan.price}</span>
                      )}
                    </div>

                    <h3 className="mt-3 line-clamp-2 text-[15.5px] font-bold leading-snug text-[#101828]">{plan.title}</h3>
                    {plan.description && <p className="mt-1 line-clamp-2 text-[12.5px] text-[#64748B]">{plan.description}</p>}

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#64748B]">
                      <span className="inline-flex items-center gap-1"><Layers size={12} /> Plan</span>
                      <span className="inline-flex items-center gap-1"><ListChecks size={12} /> {plan.testCount} mock tests</span>
                    </div>

                    <div className="mt-4 flex-1" />

                    <div className="flex items-center gap-2">
                      {!plan.hasAccess ? (
                        <button
                          type="button"
                          disabled={buying || !checkoutAvailable}
                          onClick={() => { setActive(null); buy('plan', plan._id, plan.title, plan.price); }}
                          className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#111827] py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-50"
                        >
                          {buying ? 'Opening…' : 'Buy plan'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setInfoPlan(plan)}
                          className="flex min-w-0 flex-1 items-center justify-center rounded-lg bg-[#111827] py-2.5 text-[13.5px] font-semibold text-white"
                        >
                          View plan
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setInfoPlan(plan)}
                        aria-label="More info"
                        title="More info"
                        className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-[#D0D5DD] text-[#344054] hover:bg-[#F7F9FC]"
                      >
                        <Info size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredTests.map((test) => {
                  const exhausted = test.attemptLimit > 0 && test.attemptsUsed >= test.attemptLimit && !test.inProgressAttemptId;
                  return (
                    <div key={test._id} className="flex flex-col rounded-[18px] border border-[#E8EDF4] bg-white p-5 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-[#EEF0FF] px-2.5 py-1 text-[11px] font-semibold text-[#6B7CFF]">{test.subject}</span>
                        {test.isFree ? (
                          <span className="rounded-full bg-[#E7F8EF] px-2.5 py-1 text-[11px] font-bold text-[#1F9D55]">Free</span>
                        ) : !test.hasAccess ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF1E8] px-2.5 py-1 text-[11px] font-bold text-[#E07A1F]"><Lock size={10} /> ₹{test.price}</span>
                        ) : null}
                      </div>

                      <h3 className="mt-3 line-clamp-2 text-[15.5px] font-bold leading-snug text-[#101828]">{test.title}</h3>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#64748B]">
                        <span className="inline-flex items-center gap-1"><Clock3 size={12} /> {test.durationMinutes} min</span>
                        <span className="inline-flex items-center gap-1"><ListChecks size={12} /> {test.questionCount} questions</span>
                        <span className="inline-flex items-center gap-1"><FileText size={12} /> {test.maxMarks} marks</span>
                      </div>

                      <div className="mt-4 flex-1" />

                      {test.attemptsUsed > 0 && (
                        <p className="mb-2 text-[11.5px] text-[#94A3B8]">
                          {test.attemptsUsed}/{test.attemptLimit === 0 ? '∞' : test.attemptLimit} attempts used
                        </p>
                      )}

                      <button
                        onClick={() => openTest(test)}
                        disabled={exhausted}
                        className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13.5px] font-semibold transition-colors ${
                          exhausted
                            ? 'cursor-not-allowed bg-[#F1F5F9] text-[#94A3B8]'
                            : test.inProgressAttemptId
                            ? 'bg-[#E07A1F] text-white hover:bg-[#C8690F]'
                            : !test.hasAccess
                            ? 'bg-[#111827] text-white hover:bg-[#1F2937]'
                            : 'bg-[#111827] text-white hover:bg-[#1F2937]'
                        }`}
                      >
                        {exhausted ? (
                          'Attempts used'
                        ) : test.inProgressAttemptId ? (
                          <><RotateCcw size={14} /> Resume</>
                        ) : !test.hasAccess ? (
                          <><Lock size={14} /> Unlock Test</>
                        ) : (
                          <><PlayCircle size={14} /> Start Test</>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            {attemptsLoading ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#111827] border-t-transparent" />
              </div>
            ) : attempts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#D0D5DD] bg-white py-16 text-center">
                <ListChecks size={22} className="mx-auto text-[#94A3B8]" />
                <p className="mt-3 text-[15px] font-bold text-[#101828]">No attempts yet</p>
                <p className="mt-1 text-[13px] text-[#64748B]">Your attempt history will show up here once you take a mock test.</p>
              </div>
            ) : (
              <>
                {/* Stacked cards on narrow screens — the app shell clips horizontal
                    overflow globally, so a scrollable table isn't reachable below `sm`. */}
                <div className="space-y-3 sm:hidden">
                  {attempts.map((a) => (
                    <div key={a._id} className="rounded-xl border border-[#E8EDF4] bg-white p-4">
                      <p className="text-[14px] font-semibold text-[#101828]">{a.testTitle}</p>
                      <p className="mt-0.5 text-[12px] text-[#94A3B8]">
                        {new Date(a.submittedAt || a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {a.attemptNumber > 1 && ` · Attempt #${a.attemptNumber}`}
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        {a.result ? (
                          <span className="text-[13.5px] font-semibold text-[#101828]">{a.result.score}/{a.result.maxMarks} · {a.result.accuracy}% accuracy</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF1E8] px-2 py-0.5 text-[11.5px] font-bold text-[#E07A1F]">In progress</span>
                        )}
                        {a.result ? (
                          <Link to={`/mock-tests/result/${a._id}`} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#3267f5]">
                            <CheckCircle2 size={13} /> View
                          </Link>
                        ) : (
                          <button onClick={() => { const match = tests.find((test) => test._id === a.mockTestId); if (match) openTest(match); }} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#E07A1F]">
                            <RotateCcw size={13} /> Resume
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-hidden rounded-2xl border border-[#E8EDF4] bg-white sm:block">
                  <table className="w-full text-left text-[13.5px]">
                    <thead>
                      <tr className="border-b border-[#E8EDF4] text-[11.5px] font-bold uppercase tracking-[1px] text-[#94A3B8]">
                        <th className="px-5 py-3">Test</th>
                        <th className="px-5 py-3">Date</th>
                        <th className="px-5 py-3">Score</th>
                        <th className="px-5 py-3">Accuracy</th>
                        <th className="px-5 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attempts.map((a) => (
                        <tr key={a._id} className="border-b border-[#F1F5F9] last:border-0">
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-[#101828]">{a.testTitle}</p>
                            {a.attemptNumber > 1 && <p className="text-[11.5px] text-[#94A3B8]">Attempt #{a.attemptNumber}</p>}
                          </td>
                          <td className="px-5 py-3.5 text-[#64748B]">
                            {new Date(a.submittedAt || a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-5 py-3.5">
                            {a.result ? (
                              <span className="font-semibold text-[#101828]">{a.result.score}/{a.result.maxMarks}</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF1E8] px-2 py-0.5 text-[11.5px] font-bold text-[#E07A1F]">In progress</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-[#64748B]">
                            {a.result ? `${a.result.accuracy}%` : '—'}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {a.result ? (
                              <Link to={`/mock-tests/result/${a._id}`} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#3267f5] hover:text-[#1d4ed8]">
                                <CheckCircle2 size={13} /> View result
                              </Link>
                            ) : (
                              <button onClick={() => { const match = tests.find((test) => test._id === a.mockTestId); if (match) openTest(match); }} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#E07A1F] hover:text-[#C8690F]">
                                <RotateCcw size={13} /> Resume
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>

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
          onClose={closeTest}
          onBack={() => { setPayPhase('review'); setDetailError(''); }}
          onContinue={() => { setPayPhase('review'); setActive(null); openedRef.current = ''; setReloadKey((value) => value + 1); }}
          onBuy={(purpose, id, title) => buy(purpose, id, title, purpose === 'mock_test' ? active.price : 0)}
        />
      )}
      {infoPlan && (
        <PlanBundleInfoModal
          plan={infoPlan}
          onClose={() => setInfoPlan(null)}
          buying={buying}
          checkoutAvailable={checkoutAvailable}
          onBuy={infoPlan.hasAccess ? undefined : () => {
            const plan = infoPlan;
            setInfoPlan(null);
            setActive(null);
            buy('plan', plan._id, plan.title, plan.price);
          }}
        />
      )}
      {planCheckout && payPhase !== 'review' && !active && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 py-8">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <PaymentStage
              phase={payPhase === 'processing' ? 'processing' : payPhase === 'paid' ? 'paid' : 'failed'}
              receipt={receipt}
              onRetry={() => buy('plan', planCheckout.id, planCheckout.title, planCheckout.price)}
              onBack={() => { setPayPhase('review'); setPlanCheckout(null); setDetailError(''); }}
              onContinue={() => { setPayPhase('review'); setPlanCheckout(null); setReloadKey((value) => value + 1); }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardMockTestsPage;
