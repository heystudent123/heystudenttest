import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, ChevronDown, GraduationCap,
  Layers, PlayCircle, ShieldCheck, Sparkles, Star, TrendingUp, X,
} from 'lucide-react';
import SharedNavbar from '../components/SharedNavbar';
import PaymentStage, { emptyReceipt, PaymentPhase, PaymentReceipt } from '../components/PaymentStage';
import { coursesApi, paymentsApi, enrollmentsApi, plansApi } from '../services/api';
import { CheckoutClosed, loadRazorpayScript, openSecureCheckout, paymentFailureReason } from '../utils/razorpayCheckout';
import { useAuth } from '../context/AuthContext';

// Some course records have long pipe-separated subject lists split across
// multiple `features` entries (a data-entry artifact), leaving an entry like
// "| Psychology | Sociology" orphaned from the line before it. Merge any
// entry starting with "|" into its predecessor so it reads as one list.
const normalizeFeatures = (raw: string[]): string[] => {
  const merged: string[] = [];
  for (const item of raw) {
    const trimmed = item.trim();
    if (trimmed.startsWith('|') && merged.length > 0) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${trimmed}`;
    } else {
      merged.push(trimmed);
    }
  }
  return merged;
};

declare global {
  interface Window { Razorpay: any; }
}

interface Course {
  _id: string;
  title: string;
  description: string;
  subtitle?: string;
  category: string | string[];
  duration: string;
  level: string;
  instructor?: string;
  price: number;
  originalPrice?: number;
  referralPrice?: number;
  isPaid: boolean;
  features?: string[];
  image?: string;
  materials?: CourseMaterial[];
  isActive: boolean;
  enrolledCount?: number;
  rating?: number;
}

interface CourseMaterial {
  _id: string;
  title: string;
  description?: string;
  materialType: 'file' | 'video' | 'link' | 'note' | 'pdf' | 'module';
  fileUrl?: string;
  fileType?: string;
  videoUrl?: string;
  externalUrl?: string;
  noteContent?: string;
}

interface PlanBundle {
  _id: string;
  title: string;
  description: string;
  price: number;
  mockTests: { _id: string; title: string; durationMinutes: number; category: string; chapter: string }[];
  courses: { _id: string; title: string; subtitle: string; category: string; image: string }[];
}

// Rotating accent palette per card — mirrors the tint language used across the homepage
const CARD_TINTS = [
  { chip: 'bg-[#EEF0FF] text-[#6B7CFF]', ring: 'ring-[#DCE2FF]', btn: 'bg-[#111827] hover:bg-[#1F2937]', bar: 'bg-[#6B7CFF]' },
  { chip: 'bg-[#E7F8EF] text-[#1F9D55]', ring: 'ring-[#CFEFDC]', btn: 'bg-[#111827] hover:bg-[#1F2937]', bar: 'bg-[#1F9D55]' },
  { chip: 'bg-[#FFF1E8] text-[#E07A1F]', ring: 'ring-[#FBE3CE]', btn: 'bg-[#111827] hover:bg-[#1F2937]', bar: 'bg-[#E07A1F]' },
  { chip: 'bg-[#F3EEFF] text-[#9B8AF5]', ring: 'ring-[#E4DBFF]', btn: 'bg-[#111827] hover:bg-[#1F2937]', bar: 'bg-[#9B8AF5]' },
];

const CoursesPage: React.FC = () => {
  const { user: clerkUser } = useAuth();
  const { isSignedIn: isClerkSignedIn } = useClerkAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<PlanBundle[]>([]);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [buyingPlanId, setBuyingPlanId] = useState<string | null>(null);
  const [planReferralCode, setPlanReferralCode] = useState('');
  const [planCouponCode, setPlanCouponCode] = useState('');
  const [planPayError, setPlanPayError] = useState('');

  const user = clerkUser;

  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());

  const [purchased, setPurchased] = useState(false);
  const [pendingCourse, setPendingCourse] = useState<Course | null>(null);

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [studentDetails, setStudentDetails] = useState({
    name: '',
    phone: '',
    email: '',
    stream: '',
    referralCode: '',
    couponCode: '',
  });
  const [detailsErrors, setDetailsErrors] = useState<{ name?: string; phone?: string }>({});
  const [savingDetails, setSavingDetails] = useState(false);
  const [payError, setPayError] = useState('');
  const [payPhase, setPayPhase] = useState<PaymentPhase>('review');
  const [receipt, setReceipt] = useState<PaymentReceipt>(emptyReceipt);
  const [planPay, setPlanPay] = useState<null | { phase: Exclude<PaymentPhase, 'review'>; receipt: PaymentReceipt; plan: PlanBundle }>(null);

  const premiumCourse = courses.find(c => c.isPaid) || null;

  const closeDetailsModal = () => {
    if (payPhase === 'processing') return;
    setShowDetailsModal(false);
    setPendingCourse(null);
    setPayPhase('review');
    setPayError('');
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  // Let Escape close the enrollment details modal, same as clicking the backdrop or ×.
  useEffect(() => {
    if (!showDetailsModal) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDetailsModal(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDetailsModal]);

  // Auto-enroll: triggered from homepage "Enroll Now" or after login redirect back to /courses
  useEffect(() => {
    const shouldAutoEnroll = sessionStorage.getItem('autoEnroll') === 'true';
    if (!shouldAutoEnroll) return;
    if (loading) return;
    const isLoggedIn = !!(isClerkSignedIn || user);
    if (!isLoggedIn) {
      sessionStorage.setItem('postLoginRedirect', '/courses');
      navigate('/login');
      return;
    }
    sessionStorage.removeItem('autoEnroll');
    const target = courses.find(c => c.isPaid && c.isActive) || courses[0];
    if (target) {
      setTimeout(() => handleEnrollClick(target), 150);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isClerkSignedIn, user]);

  useEffect(() => {
    if (!user) return;
    enrollmentsApi
      .getMyEnrollments()
      .then((res) => {
        const enrollments = res.data || [];
        setIsEnrolled(enrollments.length > 0);
        const ids = new Set<string>();
        enrollments.forEach((e: any) => {
          if (e.courseId?._id) ids.add(e.courseId._id);
          if (e.courseSlug) ids.add(e.courseSlug);
        });
        setEnrolledCourseIds(ids);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clerkUser]);

  useEffect(() => {
    plansApi.listPublic()
      .then((res: any) => setPlans(res.data || []))
      .catch(() => setPlans([]));
  }, []);

  const buyPlan = async (plan: PlanBundle) => {
    if (!(isClerkSignedIn || user)) {
      sessionStorage.setItem('postLoginRedirect', '/courses');
      navigate('/login');
      return;
    }
    setBuyingPlanId(plan._id);
    setPlanPayError('');
    setPlanPay({ phase: 'processing', plan, receipt: { title: plan.title, amount: plan.price, orderId: '', reason: '' } });
    let orderId = '';
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('The secure payment window could not be opened. Check your connection and retry.');
      const orderRes = await paymentsApi.createOrder({
        amount: plan.price,
        purpose: 'plan',
        purposeId: plan._id,
        purposeModel: 'Plan',
        referralCode: planReferralCode.trim() || undefined,
        couponCode: planCouponCode.trim() || undefined,
      });
      const order = orderRes.data;
      orderId = order.orderId;
      const receiptNext = { title: plan.title, amount: order.finalAmountInRupees || plan.price, orderId, reason: '' };
      setPlanPay({ phase: 'processing', plan, receipt: receiptNext });
      const prefillUser = user || clerkUser;
      await openSecureCheckout({
        orderId,
        amount: order.amount,
        currency: order.currency,
        keyId: order.keyId,
        description: order.rewardDiscount > 0 ? `${plan.title} (₹${order.rewardDiscount} off applied)` : plan.title,
        prefill: {
          name: (prefillUser as any)?.name || (prefillUser as any)?.fullName || '',
          email: (prefillUser as any)?.email || (prefillUser as any)?.primaryEmailAddress?.emailAddress || '',
        },
      });
      setPlanPay({ phase: 'paid', plan, receipt: receiptNext });
    } catch (err: any) {
      if (!orderId && !(err instanceof CheckoutClosed)) {
        setPlanPay(null);
        setPlanPayError(paymentFailureReason(err));
        return;
      }
      setPlanPay((current) => current && ({
        ...current,
        phase: 'failed',
        receipt: { ...current.receipt, orderId: orderId || current.receipt.orderId, reason: paymentFailureReason(err) },
      }));
    } finally {
      setBuyingPlanId(null);
    }
  };

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const response = await coursesApi.getAll({ isActive: true });
      setCourses(response.data || response.courses || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (targetCourse: Course, referralCode?: string, couponCode?: string) => {
    if (!targetCourse) return;

    if (!(isClerkSignedIn || user)) {
      sessionStorage.setItem('postLoginRedirect', '/courses');
      navigate('/login');
      return;
    }

    if (enrolledCourseIds.has(targetCourse._id)) {
      navigate('/student/dashboard');
      return;
    }

    setPayPhase('processing');
    setReceipt({ title: targetCourse.title, amount: targetCourse.price, orderId: '', reason: '' });
    let orderId = '';
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('The secure payment window could not be opened. Check your connection and retry.');

      const orderRes = await paymentsApi.createOrder({
        amount: targetCourse.price,
        purpose: 'course_enrollment',
        courseSlug: targetCourse._id,
        referralCode: referralCode || undefined,
        couponCode: couponCode || undefined,
      });
      const order = orderRes.data;
      orderId = order.orderId;
      const receiptNext = { title: targetCourse.title, amount: order.finalAmountInRupees || targetCourse.price, orderId, reason: '' };
      setReceipt(receiptNext);

      const prefillUser = user || clerkUser;
      await openSecureCheckout({
        orderId,
        amount: order.amount,
        currency: order.currency,
        keyId: order.keyId,
        description: order.rewardDiscount > 0 ? `${targetCourse.title} (₹${order.rewardDiscount} off applied)` : targetCourse.title,
        prefill: {
          name: (prefillUser as any)?.name || (prefillUser as any)?.fullName || '',
          email: (prefillUser as any)?.email || (prefillUser as any)?.primaryEmailAddress?.emailAddress || '',
          contact: (prefillUser as any)?.phone || '',
        },
      });
      setIsEnrolled(true);
      setEnrolledCourseIds(prev => new Set(Array.from(prev).concat(targetCourse._id)));
      setPayPhase('paid');
    } catch (err: any) {
      if (!orderId && !(err instanceof CheckoutClosed)) {
        setPayPhase('review');
        setPayError(paymentFailureReason(err));
        return;
      }
      setReceipt((current) => ({ ...current, orderId: orderId || current.orderId, reason: paymentFailureReason(err) }));
      setPayPhase('failed');
    }
  };

  const handleEnrollClick = (course: Course) => {
    const isLoggedIn = !!(isClerkSignedIn || user);
    if (!isLoggedIn) {
      sessionStorage.setItem('postLoginRedirect', '/courses');
      sessionStorage.setItem('autoEnroll', 'true');
      navigate('/login');
      return;
    }
    if (enrolledCourseIds.has(course._id)) {
      navigate('/student/dashboard');
      return;
    }

    setPendingCourse(course);

    const prefillUser = user || clerkUser;
    setStudentDetails({
      name: (prefillUser as any)?.name || (prefillUser as any)?.fullName || '',
      phone: (prefillUser as any)?.phone || (prefillUser as any)?.whatsapp || '',
      email: (prefillUser as any)?.email || (prefillUser as any)?.primaryEmailAddress?.emailAddress || '',
      stream: '',
      referralCode: '',
      couponCode: '',
    });
    setDetailsErrors({});
    setPayError('');

    setShowDetailsModal(true);
  };

  const handleDetailsSubmit = async () => {
    const errors: { name?: string; phone?: string } = {};
    if (!studentDetails.name.trim()) errors.name = 'Name is required';
    if (!studentDetails.phone.trim()) errors.phone = 'Phone number is required';
    if (Object.keys(errors).length > 0) { setDetailsErrors(errors); return; }
    if (!pendingCourse) return;

    setSavingDetails(true);
    setPayError('');
    try {
      await paymentsApi.savePrePaymentLead({
        name: studentDetails.name.trim(),
        phone: studentDetails.phone.trim(),
        email: studentDetails.email.trim() || undefined,
        college: studentDetails.stream || undefined,
        courseId: pendingCourse._id,
        courseTitle: pendingCourse.title,
        source: 'enrollment_form',
      });
    } catch { /* non-blocking */ }

    try {
      await handleEnroll(
        pendingCourse,
        studentDetails.referralCode.trim() || undefined,
        studentDetails.couponCode.trim() || undefined,
      );
    } finally {
      setSavingDetails(false);
    }
  };

  return (
    <div className="hs-page">
      <Helmet>
        <title>CUET Courses — Commerce, Arts & More | HeyStudent</title>
        <meta name="description" content="Browse CUET courses in Commerce, Arts and more with live classes, recorded lectures and mock tests from top-ranking educators." />
        <link rel="canonical" href="https://heystudent.in/courses" />
      </Helmet>
      <SharedNavbar />

      {/* Purchase success overlay */}
      {purchased && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-[#111827] rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-extrabold text-[#101828] mb-2">You're in! 🎉</h2>
            <p className="text-[#64748B] mb-6">Your enrollment is confirmed. Redirecting you to your dashboard…</p>
            <button
              onClick={() => navigate('/student/dashboard')}
              className="w-full bg-[#111827] hover:bg-[#1F2937] text-white font-bold py-3 rounded-xl transition-colors"
            >
              Go to Dashboard →
            </button>
          </div>
        </div>
      )}

      {/* Enrollment details modal */}
      {showDetailsModal && pendingCourse && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={(e) => { if (e.target === e.currentTarget && payPhase !== 'processing') closeDetailsModal(); }}
        >
          <div className={`relative w-full max-h-[90vh] overflow-y-auto bg-white shadow-2xl ${payPhase === 'review' ? 'max-w-md rounded-3xl p-8' : 'max-w-xl rounded-2xl'}`}>
            {payPhase !== 'processing' && (
            <button
              onClick={closeDetailsModal}
              aria-label="Close"
              className="absolute right-5 top-5 z-10 flex h-8 w-8 items-center justify-center rounded-full text-[#94A3B8] transition-colors hover:bg-[#F1F5F9] hover:text-[#101828]"
            >
              <X size={18} />
            </button>
            )}
            {payPhase !== 'review' ? (
              <PaymentStage
                phase={payPhase}
                receipt={receipt}
                onRetry={handleDetailsSubmit}
                onBack={payPhase === 'failed' ? () => { setPayPhase('review'); setPayError(''); } : undefined}
                onContinue={() => navigate('/student/dashboard')}
              />
            ) : (
            <>
            <h2 className="text-2xl font-extrabold text-[#101828] mb-1 pr-8">Almost there! 🎓</h2>
            <p className="text-[#64748B] text-sm mb-6">
              Fill in your details to get instant course access.
            </p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={studentDetails.name}
                  onChange={e => { setStudentDetails(p => ({ ...p, name: e.target.value })); setDetailsErrors(p => ({ ...p, name: undefined })); }}
                  placeholder="Your full name"
                  className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827] text-sm ${detailsErrors.name ? 'border-red-400' : 'border-slate-300'}`}
                />
                {detailsErrors.name && <p className="text-red-500 text-xs mt-1">{detailsErrors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Phone / WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={studentDetails.phone}
                  onChange={e => { setStudentDetails(p => ({ ...p, phone: e.target.value })); setDetailsErrors(p => ({ ...p, phone: undefined })); }}
                  placeholder="10-digit mobile number"
                  className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827] text-sm ${detailsErrors.phone ? 'border-red-400' : 'border-slate-300'}`}
                />
                {detailsErrors.phone && <p className="text-red-500 text-xs mt-1">{detailsErrors.phone}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={studentDetails.email}
                  onChange={e => setStudentDetails(p => ({ ...p, email: e.target.value }))}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827] text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Stream</label>
                <select
                  value={studentDetails.stream}
                  onChange={e => setStudentDetails(p => ({ ...p, stream: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827] text-sm bg-white"
                >
                  <option value="">Select stream</option>
                  <option value="Science">Science</option>
                  <option value="Commerce">Commerce</option>
                  <option value="Arts">Arts</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Referral code <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={studentDetails.referralCode}
                  onChange={e => { setStudentDetails(p => ({ ...p, referralCode: e.target.value.toUpperCase() })); setPayError(''); }}
                  placeholder="Student or institute code"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827] text-sm font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Coupon code <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={studentDetails.couponCode}
                  onChange={e => { setStudentDetails(p => ({ ...p, couponCode: e.target.value.toUpperCase() })); setPayError(''); }}
                  placeholder="Coupon"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#111827] text-sm font-mono uppercase"
                />
              </div>
              {payError && <p role="alert" className="rounded-lg border border-[#F3D0D0] bg-[#FFF6F6] px-3 py-2.5 text-[13px] leading-relaxed text-[#B42318]">{payError}</p>}
            </div>

            <button
              onClick={handleDetailsSubmit}
              disabled={savingDetails}
              className="mt-6 w-full bg-[#111827] hover:bg-[#1F2937] text-white font-semibold py-3 rounded-full transition-colors disabled:opacity-60"
            >
              {savingDetails ? 'Please wait…' : `Pay ₹${pendingCourse.price.toLocaleString('en-IN')} →`}
            </button>
            </>
            )}
          </div>
        </div>
      )}

      {planPay && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4 py-8">
          <section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <PaymentStage
              phase={planPay.phase}
              receipt={planPay.receipt}
              onRetry={() => buyPlan(planPay.plan)}
              onBack={planPay.phase === 'failed' ? () => setPlanPay(null) : undefined}
              onContinue={() => navigate('/student/dashboard')}
            />
          </section>
        </div>
      )}

      {/* ══════════════════ HERO ══════════════════ */}
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #EEF1FF 0%, #F7F9FC 55%, #FFFFFF 100%)' }}>
        {/* Decorative ring motif */}
        <svg
          className="pointer-events-none absolute -right-28 -top-28 hidden h-[460px] w-[460px] text-[#C9D2E3] opacity-60 lg:block"
          viewBox="0 0 420 420"
          aria-hidden="true"
        >
          <circle cx="210" cy="210" r="70" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="210" cy="210" r="120" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="210" cy="210" r="170" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="210" cy="210" r="210" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <div className="hs-blob pointer-events-none absolute -left-24 top-[10%] h-72 w-72 rounded-full bg-[#AEBCFF] opacity-30 blur-[100px]" aria-hidden="true" />
        <div className="hs-blob pointer-events-none absolute right-[12%] bottom-0 h-64 w-64 rounded-full bg-[#FBC58D] opacity-25 blur-[100px]" style={{ animationDelay: '-4s' }} aria-hidden="true" />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[300px] opacity-[0.35]"
          style={{
            backgroundImage: 'radial-gradient(#B9C3F5 1.4px, transparent 1.4px)',
            backgroundSize: '26px 26px',
            maskImage: 'linear-gradient(180deg, black 0%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(180deg, black 0%, transparent 100%)',
          }}
          aria-hidden="true"
        />

        <div className="relative px-6 pb-16 pt-14 lg:px-10 lg:pb-20 lg:pt-20">
          <div className="mx-auto max-w-5xl text-center">
            <p className="hs-hero-eyebrow inline-flex items-center gap-2 justify-center">
              <Sparkles size={14} className="text-[#6B7CFF]" />
              CUET courses
            </p>
            <h1 className="mt-4">
              Courses built for your
              <span className="accent block">CUET success</span>
            </h1>
            <p className="hs-hero-description mx-auto mt-5 max-w-xl">
              Structured batches for Commerce, Arts and Science — live classes, mock tests, PYQs and mentor support, designed by CUET rankers.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#course-list"
                className="inline-flex items-center gap-2 rounded-md bg-[#111827] px-6 py-3 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(17,24,39,0.18)] hover:bg-[#1F2937] transition-colors"
              >
                Explore Batches <ChevronDown size={16} />
              </a>
              <Link
                to="/mock-tests"
                className="inline-flex items-center gap-2 rounded-md border border-[#D0D5DD] bg-white px-6 py-3 text-[15px] font-semibold text-[#101828] hover:bg-slate-50 transition-colors"
              >
                <PlayCircle size={16} className="text-[#6B7CFF]" /> Try a Free Mock Test
              </Link>
            </div>
          </div>

          {/* Stat strip — distinct cards instead of a plain text row */}
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: GraduationCap, tint: 'bg-[#EEF0FF] text-[#6B7CFF]', label: 'Taught by DU rankers', sub: 'AIR 19 & AIR 63, CUET 2023' },
              { icon: TrendingUp, tint: 'bg-[#E7F8EF] text-[#1F9D55]', label: '1000+ students guided', sub: 'Across Commerce, Arts, Science' },
              { icon: ShieldCheck, tint: 'bg-[#FFF1E8] text-[#E07A1F]', label: 'Secure checkout', sub: 'Razorpay · 100% safe' },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-3 rounded-2xl border border-[#E8EDF4] bg-white/80 px-4 py-3.5 backdrop-blur-sm">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.tint}`}>
                  <stat.icon size={19} strokeWidth={2.2} />
                </span>
                <div className="min-w-0 text-left">
                  <p className="truncate text-[13.5px] font-bold text-[#101828]">{stat.label}</p>
                  <p className="truncate text-[12px] text-[#94A3B8]">{stat.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ COURSE CARDS ══════════════════ */}
      <section id="course-list" className="bg-white px-6 pb-20 pt-4 lg:px-10">
        <div className="mx-auto max-w-6xl">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-[560px] animate-pulse rounded-[22px] border border-[#E8EDF4] bg-slate-50" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="rounded-[22px] border border-[#E8EDF4] bg-slate-50 py-20 text-center text-[#64748B]">
              No courses available right now. Check back soon.
            </div>
          ) : (
            <div className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course, idx) => (
                <CourseCard
                  key={course._id}
                  course={course}
                  tint={CARD_TINTS[idx % CARD_TINTS.length]}
                  isPopular={idx === 0}
                  isEnrolled={enrolledCourseIds.has(course._id)}
                  onEnroll={() => handleEnrollClick(course)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════ PLAN BUNDLES ══════════════════ */}
      {plans.length > 0 && (
        <section className="bg-[#F7F9FC] px-6 py-16 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-xl text-center">
              <p className="inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[2px] text-[#9B8AF5]">
                <Layers size={16} /> Bundles
              </p>
              <h2 className="why-title mt-3">Save more with a plan</h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[#64748B]">
                A plan bundles multiple mock tests and courses at one price — buy once, unlock everything inside.
              </p>
            </div>
            <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
              <label className="block text-left text-[13px] font-semibold text-[#344054]">
                Referral code <span className="font-normal text-[#94A3B8]">(optional)</span>
                <input
                  value={planReferralCode}
                  onChange={(e) => { setPlanReferralCode(e.target.value.toUpperCase()); setPlanPayError(''); }}
                  placeholder="Student or institute code"
                  className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] bg-white px-3.5 py-2.5 font-mono text-[14px] uppercase focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
                />
              </label>
              <label className="block text-left text-[13px] font-semibold text-[#344054]">
                Coupon code <span className="font-normal text-[#94A3B8]">(optional)</span>
                <input
                  value={planCouponCode}
                  onChange={(e) => { setPlanCouponCode(e.target.value.toUpperCase()); setPlanPayError(''); }}
                  placeholder="Coupon"
                  className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] bg-white px-3.5 py-2.5 font-mono text-[14px] uppercase focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
                />
              </label>
            </div>
            {planPayError && <p role="alert" className="mx-auto mt-3 max-w-2xl rounded-lg border border-[#F3D0D0] bg-[#FFF6F6] px-3 py-2.5 text-left text-[13px] leading-relaxed text-[#B42318]">{planPayError}</p>}
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => {
                const expanded = expandedPlanId === plan._id;
                return (
                  <div key={plan._id} className="flex flex-col rounded-[22px] border border-[#E8EDF4] bg-white p-6">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F3EEFF] text-[#9B8AF5]"><Layers size={18} /></span>
                    <h3 className="mt-4 text-[17px] font-extrabold text-[#101828]">{plan.title}</h3>
                    {plan.description && <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#64748B]">{plan.description}</p>}
                    <p className="mt-4 text-[26px] font-extrabold text-[#101828]">₹{plan.price.toLocaleString('en-IN')}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px] font-semibold text-[#64748B]">
                      {plan.mockTests.length > 0 && <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1">{plan.mockTests.length} mock test{plan.mockTests.length === 1 ? '' : 's'}</span>}
                      {plan.courses.length > 0 && <span className="rounded-full bg-[#F1F5F9] px-2.5 py-1">{plan.courses.length} course{plan.courses.length === 1 ? '' : 's'}</span>}
                    </div>

                    <button
                      onClick={() => setExpandedPlanId(expanded ? null : plan._id)}
                      className="mt-4 inline-flex items-center gap-1 self-start text-[12.5px] font-semibold text-[#3267f5]"
                    >
                      {expanded ? 'Hide what’s included' : 'See what’s included'}
                      <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>

                    {expanded && (
                      <div className="mt-3 space-y-3 rounded-xl bg-[#F7F9FC] p-4">
                        {plan.courses.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[1px] text-[#94A3B8]">Courses</p>
                            <ul className="mt-1.5 space-y-1">
                              {plan.courses.map((c) => (
                                <li key={c._id} className="flex items-center gap-2 text-[13px] text-[#344054]">
                                  <CheckCircle2 size={14} className="shrink-0 text-[#1F9D55]" /> {c.title}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {plan.mockTests.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold uppercase tracking-[1px] text-[#94A3B8]">Mock tests</p>
                            <ul className="mt-1.5 space-y-1">
                              {plan.mockTests.map((t) => (
                                <li key={t._id} className="flex items-center gap-2 text-[13px] text-[#344054]">
                                  <CheckCircle2 size={14} className="shrink-0 text-[#1F9D55]" /> {t.title}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => buyPlan(plan)}
                      disabled={buyingPlanId === plan._id}
                      className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-[#111827] py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#1F2937] disabled:opacity-60"
                    >
                      {buyingPlanId === plan._id ? 'Processing…' : 'Buy this plan'} <ArrowRight size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════ BOTTOM CTA ══════════════════ */}
      <section className="px-6 pb-16 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="relative overflow-hidden rounded-[28px] bg-[#EEF1FF] px-8 py-12 text-center sm:px-14">
            <svg className="pointer-events-none absolute -right-20 -top-20 h-[360px] w-[360px] text-white/70" viewBox="0 0 420 420" aria-hidden="true">
              <circle cx="210" cy="210" r="70" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="210" cy="210" r="120" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="210" cy="210" r="170" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <div className="relative">
              <p className="mb-4 inline-flex items-center gap-3 text-[13px] font-bold uppercase tracking-[2px] text-[#94A3B8]">
                <BadgeCheck size={16} className="text-[#6B7CFF]" />
                Still deciding?
              </p>
              <h2 className="why-title mx-auto max-w-xl text-center">
                Start your CUET prep with the right batch today
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[16px] leading-relaxed text-[#64748B]">
                Join a structured course for live classes, full syllabus coverage and mock tests — or take a free mock test first to see where you stand.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => { const c = premiumCourse || courses[0]; if (c) handleEnrollClick(c); }}
                  disabled={!courses.length}
                  className="inline-flex items-center gap-2 rounded-md bg-[#111827] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[#1F2937] transition-colors disabled:opacity-50"
                >
                  {isEnrolled ? 'Go to Dashboard' : 'Enroll Now'} <ArrowRight size={16} />
                </button>
                <Link
                  to="/mock-tests"
                  className="inline-flex items-center rounded-md border border-[#D0D5DD] bg-white px-6 py-3 text-[15px] font-semibold text-[#101828] hover:bg-slate-50 transition-colors"
                >
                  Explore Mock Tests
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

/* ─── CourseCard ─────────────────────────────────────────────────── */
interface Tint { chip: string; ring: string; btn: string; bar: string; }

interface CourseCardProps {
  course: Course;
  tint: Tint;
  isPopular: boolean;
  isEnrolled: boolean;
  onEnroll: () => void;
}

const CourseCard: React.FC<CourseCardProps> = ({ course, tint, isPopular, isEnrolled, onEnroll }) => {
  const cats = Array.isArray(course.category)
    ? course.category
    : course.category ? [course.category] : [];
  const savings = (course.originalPrice && course.originalPrice > course.price)
    ? course.originalPrice - course.price : null;
  const rawFeatures = course.features?.length ? course.features : (course.description ? [course.description] : []);
  const features = normalizeFeatures(rawFeatures);
  const [showAll, setShowAll] = useState(false);
  const SHOW = 5;
  const visibleFeatures = showAll ? features : features.slice(0, SHOW);
  const overflow = features.length - SHOW;

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-[22px] border border-[#E8EDF4] bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(16,24,40,0.1)]">
      <span className={`h-1.5 w-full ${tint.bar}`} />

      <div className="flex flex-1 flex-col p-6">
        {/* Header row: category chip + popular badge */}
        <div className="flex h-7 items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {cats.slice(0, 2).map((cat) => (
              <span key={cat} className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tint.chip}`}>
                {cat}
              </span>
            ))}
          </div>
          {isPopular && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#F6A15A] px-2.5 py-1 text-[11px] font-semibold text-white whitespace-nowrap">
              <Star size={11} className="fill-white" /> Popular
            </span>
          )}
        </div>

        {/* Title + subtitle — fixed-height zone so price/CTA align across cards regardless of text length */}
        <div className="mt-4 min-h-[88px]">
          <h3 className="line-clamp-2 text-[20px] font-bold leading-snug text-[#101828]">{course.title}</h3>
          {course.subtitle && (
            <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-snug text-[#64748B]">{course.subtitle}</p>
          )}
        </div>

        {/* Meta row: duration + level */}
        <div className="flex min-h-[20px] flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-[#64748B]">
          {course.duration && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} className="text-[#94A3B8]" /> {course.duration}
            </span>
          )}
          {course.level && (
            <span className="inline-flex items-center gap-1.5">
              <Layers size={14} className="text-[#94A3B8]" /> {course.level}
            </span>
          )}
        </div>

        {/* Price block — consistent position across all cards */}
        <div className={`mt-5 rounded-2xl bg-[#F8FAFC] px-4 py-4 ring-1 ${tint.ring}`}>
          <div className="flex items-end gap-2.5">
            <span className="text-[30px] font-extrabold leading-none tracking-tight text-[#101828]">
              ₹{course.price.toLocaleString('en-IN')}
            </span>
            {course.originalPrice && course.originalPrice > course.price && (
              <span className="pb-0.5 text-[15px] text-[#94A3B8] line-through">
                ₹{course.originalPrice.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="text-[12px] text-[#64748B]">One-time · Instant access</p>
            {savings && savings > 0 && (
              <span className="whitespace-nowrap rounded-full bg-[#E7F8EF] px-2 py-0.5 text-[11px] font-bold text-[#1F9D55]">
                Save ₹{savings.toLocaleString('en-IN')}
              </span>
            )}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onEnroll}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[15px] font-semibold transition-colors ${
            isEnrolled
              ? 'bg-[#E7F8EF] text-[#1F9D55] hover:bg-[#D7F3E3]'
              : `${tint.btn} text-white`
          }`}
        >
          {isEnrolled ? (
            <>
              <CheckCircle2 size={16} /> Enrolled · Go to Dashboard
            </>
          ) : (
            <>
              Enroll Now <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </>
          )}
        </button>

        {/* Trust row */}
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] text-[#94A3B8]">
          <ShieldCheck size={13} /> Secured by Razorpay
        </p>

        <div className="mt-5 h-px bg-[#E8EDF4]" />

        {/* Features — this is the only zone that's allowed to vary card height */}
        {features.length > 0 && (
          <ul className="mt-5 space-y-2.5">
            {visibleFeatures.map((item, i) => (
              <li key={`${i}-${item.slice(0, 20)}`} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-[#475569]">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#1F9D55]" />
                <span className="min-w-0 flex-1 text-left">{item}</span>
              </li>
            ))}
            {!showAll && overflow > 0 && (
              <li>
                <button
                  onClick={() => setShowAll(true)}
                  className="pl-[26px] text-[12.5px] font-semibold text-[#3267f5] hover:text-[#1d4ed8]"
                >
                  +{overflow} more included
                </button>
              </li>
            )}
            {showAll && features.length > SHOW && (
              <li>
                <button
                  onClick={() => setShowAll(false)}
                  className="pl-[26px] text-[12.5px] font-semibold text-[#94A3B8] hover:text-[#64748B]"
                >
                  Show less
                </button>
              </li>
            )}
          </ul>
        )}

        {/* Faculty footer */}
        {course.instructor && (
          <div className="mt-5 flex items-center gap-2 border-t border-[#E8EDF4] pt-4 text-[13px] text-[#64748B]">
            <GraduationCap size={15} className="text-[#94A3B8]" />
            <span className="font-semibold text-[#101828]">{course.instructor}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoursesPage;
