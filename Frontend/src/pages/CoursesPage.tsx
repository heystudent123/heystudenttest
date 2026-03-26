import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import SharedNavbar from '../components/SharedNavbar';
import { coursesApi, paymentsApi, enrollmentsApi, authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

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

const loadRazorpayScript = (): Promise<boolean> =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });


const CoursesPage: React.FC = () => {
  const { user: clerkUser } = useAuth();
  const { isSignedIn: isClerkSignedIn } = useClerkAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Use the authenticated backend user from AuthContext only.
  const user = clerkUser;

  // Track which specific course IDs the user has already purchased
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());

  const [purchased, setPurchased] = useState(false);
  const [pendingCourse, setPendingCourse] = useState<Course | null>(null);

  // Student details modal state (shown before payment)
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [studentDetails, setStudentDetails] = useState({
    name: '',
    phone: '',
    email: '',
    stream: '',
    referralCode: '',
  });
  const [detailsErrors, setDetailsErrors] = useState<{ name?: string; phone?: string }>({});
  const [savingDetails, setSavingDetails] = useState(false);
  const [inlineReferralInfo, setInlineReferralInfo] = useState<{ name: string; _id: string } | null>(null);
  const [inlineReferralError, setInlineReferralError] = useState('');
  const [inlineReferralPrice, setInlineReferralPrice] = useState<number | null>(null);
  const [validatingInlineReferral, setValidatingInlineReferral] = useState(false);

  // Derive the featured paid course from what the backend returns
  const premiumCourse = courses.find(c => c.isPaid) || null;

  useEffect(() => {
    fetchCourses();
  }, []);

  // Auto-enroll: triggered from homepage "Enroll Now" or after login redirect back to /courses
  useEffect(() => {
    const shouldAutoEnroll = sessionStorage.getItem('autoEnroll') === 'true';
    if (!shouldAutoEnroll) return;
    if (loading) return; // wait for courses to load first
    const isLoggedIn = !!(isClerkSignedIn || user);
    if (!isLoggedIn) {
      // Not logged in yet — keep the flag, redirect to login
      sessionStorage.setItem('postLoginRedirect', '/courses');
      navigate('/login');
      return;
    }
    // Logged in — clear flag and kick off the flow
    sessionStorage.removeItem('autoEnroll');
    const target = courses.find(c => c.isPaid && c.isActive) || courses[0];
    if (target) {
      // Small delay so page render settles before modal opens
      setTimeout(() => handleEnrollClick(target), 150);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isClerkSignedIn, user]);

  // Check enrollment status when user is available
  useEffect(() => {
    if (!user) return;
    enrollmentsApi
      .getMyEnrollments()
      .then((res) => {
        const enrollments = res.data || [];
        setIsEnrolled(enrollments.length > 0);
        // Build set of enrolled course IDs (courseSlug or courseId._id)
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

  const handleEnroll = async (targetCourse: Course, referralCode?: string) => {
    if (!targetCourse) return;

    // 1. Must be logged in (use Clerk state to avoid false negatives from backend sync delays)
    if (!(isClerkSignedIn || user)) {
      sessionStorage.setItem('postLoginRedirect', '/courses');
      navigate('/login');
      return;
    }

    // 2. Already enrolled in THIS specific course → go to dashboard
    if (enrolledCourseIds.has(targetCourse._id)) {
      navigate('/student/dashboard');
      return;
    }

    try {
      // 3. Load Razorpay SDK
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        console.error('Could not load payment gateway.');
        return;
      }

      // 4. Create order on backend
      const effectivePrice = referralCode && targetCourse.referralPrice && targetCourse.referralPrice > 0
        ? targetCourse.referralPrice
        : targetCourse.price;

      const orderRes = await paymentsApi.createOrder({
        amount: effectivePrice,
        purpose: 'course_enrollment',
        courseSlug: targetCourse._id,
        referralCode: referralCode || undefined,
      });
      const { orderId, amount, currency, keyId } = orderRes.data;

      // 5. Open Razorpay checkout
      // user may be null if backend sync is delayed — fall back to clerkUser fields
      const prefillUser = user || clerkUser;
      await new Promise<void>((resolve, reject) => {
        const options = {
          key: keyId || process.env.REACT_APP_RAZORPAY_KEY_ID,
          amount,
          currency,
          name: 'Heystudent',
          description: targetCourse.title,
          order_id: orderId,
          prefill: {
            name: (prefillUser as any)?.name || (prefillUser as any)?.fullName || '',
            email: (prefillUser as any)?.email || (prefillUser as any)?.primaryEmailAddress?.emailAddress || '',
            contact: (prefillUser as any)?.phone || '',
          },
          theme: { color: '#f59e0b' },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled')),
          },
          handler: async (response: any) => {
            try {
              // 6. Verify payment on backend (auto-enrolls)
              await paymentsApi.verifyPayment({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              setIsEnrolled(true);
              setEnrolledCourseIds(prev => new Set(Array.from(prev).concat(targetCourse._id)));
              setPurchased(true);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (response: any) => {
          reject(new Error(response.error?.description || 'Payment failed'));
        });
        rzp.open();
      });

      // 7. Payment done → show confirmation then go to student dashboard
      setTimeout(() => navigate('/student/dashboard'), 3000);
    } catch (err: any) {
      if (err?.message !== 'Payment cancelled') {
        console.error('Payment error:', err?.message || 'Payment failed.');
      }
    }
  };

  // Open referral modal before purchase
  const handleEnrollClick = (course: Course) => {
    // Use Clerk sign-in state as the source of truth so a failed backend
    // sync never redirects an already-signed-in user to /login
    const isLoggedIn = !!(isClerkSignedIn || user);
    if (!isLoggedIn) {
      sessionStorage.setItem('postLoginRedirect', '/courses');
      sessionStorage.setItem('autoEnroll', 'true'); // resume flow after login
      navigate('/login');
      return;
    }
    // Only block if this specific course is already purchased
    if (enrolledCourseIds.has(course._id)) {
      navigate('/student/dashboard');
      return;
    }

    // Set the pending course
    setPendingCourse(course);

    // Pre-fill student details from the logged-in user profile
    const prefillUser = user || clerkUser;
    setStudentDetails({
      name: (prefillUser as any)?.name || (prefillUser as any)?.fullName || '',
      phone: (prefillUser as any)?.phone || (prefillUser as any)?.whatsapp || '',
      email: (prefillUser as any)?.email || (prefillUser as any)?.primaryEmailAddress?.emailAddress || '',
      stream: '',
      referralCode: '',
    });
    setDetailsErrors({});
    setInlineReferralInfo(null);
    setInlineReferralError('');
    setInlineReferralPrice(null);

    // Show student details modal first
    setShowDetailsModal(true);
  };

  // Handle student details form submission → save lead → proceed straight to payment
  const handleDetailsSubmit = async () => {
    const errors: { name?: string; phone?: string } = {};
    if (!studentDetails.name.trim()) errors.name = 'Name is required';
    if (!studentDetails.phone.trim()) errors.phone = 'Phone number is required';
    if (Object.keys(errors).length > 0) { setDetailsErrors(errors); return; }

    setSavingDetails(true);
    try {
      await paymentsApi.savePrePaymentLead({
        name: studentDetails.name.trim(),
        phone: studentDetails.phone.trim(),
        email: studentDetails.email.trim() || undefined,
        // Keep backend compatibility: existing model uses `college`, we store selected stream there.
        college: studentDetails.stream || undefined,
        courseId: pendingCourse?._id,
        courseTitle: pendingCourse?.title,
        source: 'enrollment_form',
      });
    } catch { /* non-blocking */ }

    // Validate referral code inline if provided
    let appliedCode: string | undefined;
    if (studentDetails.referralCode.trim()) {
      setValidatingInlineReferral(true);
      try {
        const res = await authApi.verifyReferralCode(studentDetails.referralCode.trim().toUpperCase());
        if (res?.data?.valid && res?.data?.institute) {
          appliedCode = studentDetails.referralCode.trim().toUpperCase();
          setInlineReferralInfo(res.data.institute);
          if (pendingCourse?.referralPrice && pendingCourse.referralPrice > 0) {
            setInlineReferralPrice(pendingCourse.referralPrice);
          }
        } else {
          setInlineReferralError('Invalid referral code. Proceeding without discount.');
        }
      } catch {
        setInlineReferralError('Could not validate referral code. Proceeding without discount.');
      } finally {
        setValidatingInlineReferral(false);
      }
    }

    setSavingDetails(false);
    setShowDetailsModal(false);
    if (pendingCourse) await handleEnroll(pendingCourse, appliedCode);
  };

  return (
    <div className="min-h-screen bg-[#fff9ed]">
      <SharedNavbar />

      {/* Purchase success banner */}
      {purchased && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-amber-400 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-black" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-2xl font-extrabold text-black mb-2">You're in! 🎉</h2>
            <p className="text-neutral-500 mb-6">Your enrollment is confirmed. Redirecting you to your dashboard…</p>
            <button
              onClick={() => navigate('/student/dashboard')}
              className="w-full bg-amber-400 hover:bg-amber-300 text-black font-bold py-3 rounded-xl transition-colors"
            >
              Go to Dashboard →
            </button>
          </div>
        </div>
      )}

      {/* ── Single Enrollment Form Modal ─────────────────────────── */}
      {showDetailsModal && pendingCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-extrabold text-black mb-1">Almost there! 🎓</h2>
            <p className="text-neutral-500 text-sm mb-6">
              Fill in your details to get instant course access.
            </p>

            <div className="flex flex-col gap-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={studentDetails.name}
                  onChange={e => { setStudentDetails(p => ({ ...p, name: e.target.value })); setDetailsErrors(p => ({ ...p, name: undefined })); }}
                  placeholder="Your full name"
                  className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm ${detailsErrors.name ? 'border-red-400' : 'border-neutral-300'}`}
                />
                {detailsErrors.name && <p className="text-red-500 text-xs mt-1">{detailsErrors.name}</p>}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1">
                  Phone / WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={studentDetails.phone}
                  onChange={e => { setStudentDetails(p => ({ ...p, phone: e.target.value })); setDetailsErrors(p => ({ ...p, phone: undefined })); }}
                  placeholder="10-digit mobile number"
                  className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm ${detailsErrors.phone ? 'border-red-400' : 'border-neutral-300'}`}
                />
                {detailsErrors.phone && <p className="text-red-500 text-xs mt-1">{detailsErrors.phone}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1">Email</label>
                <input
                  type="email"
                  value={studentDetails.email}
                  onChange={e => setStudentDetails(p => ({ ...p, email: e.target.value }))}
                  placeholder="your@email.com"
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm"
                />
              </div>

              {/* Stream */}
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1">Stream</label>
                <select
                  value={studentDetails.stream}
                  onChange={e => setStudentDetails(p => ({ ...p, stream: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm bg-white"
                >
                  <option value="">Select stream</option>
                  <option value="Science">Science</option>
                  <option value="Commerce">Commerce</option>
                  <option value="Arts">Arts</option>
                </select>
              </div>

              {/* Referral Code */}
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-1">
                  Referral Code <span className="text-neutral-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={studentDetails.referralCode}
                  onChange={e => { setStudentDetails(p => ({ ...p, referralCode: e.target.value.toUpperCase() })); setInlineReferralError(''); setInlineReferralInfo(null); }}
                  placeholder="e.g. INST1234"
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm font-mono uppercase"
                />
                {inlineReferralError && <p className="text-amber-600 text-xs mt-1">{inlineReferralError}</p>}
                {inlineReferralInfo && <p className="text-green-600 text-xs mt-1">✓ Code from <span className="font-semibold">{inlineReferralInfo.name}</span> applied{inlineReferralPrice ? `: ₹${inlineReferralPrice}` : ''}.</p>}
              </div>
            </div>

            <button
              onClick={handleDetailsSubmit}
              disabled={savingDetails || validatingInlineReferral}
              className="mt-6 w-full bg-amber-400 hover:bg-amber-300 text-black font-bold py-3 rounded-xl transition-colors disabled:opacity-60"
            >
              {savingDetails || validatingInlineReferral ? 'Please wait…' : `Pay ₹${pendingCourse.price} →`}
            </button>
          </div>
        </div>
      )}

      {/* ── WhatsApp Free Resources Banner ────────────────────────── */}
      <div className="w-full bg-[#25D366] px-4 py-3 mt-16">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-white shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            <p className="text-white font-bold text-sm">Join our <span className="underline underline-offset-2">Free Resources</span> WhatsApp group — notes, PYQs &amp; more!</p>
          </div>
          <a
            href="https://chat.whatsapp.com/Jiy3lsVbecL52QoQwNVl03?mode=hqctcli"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 bg-white text-[#25D366] font-extrabold text-xs px-4 py-2 rounded-xl hover:bg-green-50 transition-colors whitespace-nowrap"
          >
            Join Free Group →
          </a>
        </div>
      </div>

      {/* Header Section */}
      <div className="pt-8 pb-10 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs font-bold tracking-widest uppercase text-amber-600 mb-3">Courses</p>
          <h1 className="text-3xl md:text-4xl font-extrabold text-black mb-3">Find Your Course</h1>
          <p className="text-neutral-500 text-base">
            Curated by All India Rankers. Built for serious students.
          </p>
        </div>
      </div>

      {/* ── COURSE CAROUSEL ──────────────────────────────────── */}
      <CourseCarousel
        courses={courses}
        loading={loading}
        isEnrolled={isEnrolled}
        enrolledCourseIds={Array.from(enrolledCourseIds)}
        onEnroll={handleEnrollClick}
      />

      {/* CTA Section */}
      <div className="py-14 px-4 mb-10">
        <div className="max-w-3xl mx-auto">
          <div className="bg-black rounded-2xl p-8 md:p-10 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Ready to Start Learning?</h2>
            <p className="text-neutral-400 max-w-xl mx-auto mb-6 text-sm">
              Join thousands of students already enhancing their skills with our curated courses.
            </p>
            <button
              onClick={() => { const c = premiumCourse || courses[0]; if (c) handleEnrollClick(c); }}
              className="inline-flex items-center justify-center px-8 py-3.5 text-sm font-bold rounded-xl text-black bg-amber-400 hover:bg-amber-300 transition-colors focus:outline-none"
            >
              {isEnrolled ? 'Go to Dashboard →' : 'Enroll Now →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── CourseCarousel component ──────────────────────────────────────── */
interface CourseCarouselProps {
  courses: Course[];
  loading: boolean;
  isEnrolled: boolean;
  enrolledCourseIds: string[];
  onEnroll: (course: Course) => void;
}

const CourseCarousel: React.FC<CourseCarouselProps> = ({ courses, loading, isEnrolled, enrolledCourseIds, onEnroll }) => {
  const [active, setActive] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const prev = useCallback(() => setActive(i => (i === 0 ? courses.length - 1 : i - 1)), [courses.length]);
  const next = useCallback(() => setActive(i => (i === courses.length - 1 ? 0 : i + 1)), [courses.length]);

  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchMove  = (e: React.TouchEvent) => { touchEndX.current = e.touches[0].clientX; };
  const onTouchEnd   = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 40) diff > 0 ? next() : prev();
    touchStartX.current = touchEndX.current = null;
  };

  if (loading) {
    return (
      <div className="px-4 pb-16 max-w-2xl mx-auto">
        <div className="bg-[#111] rounded-3xl h-[520px] animate-pulse border border-white/5" />
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="text-center py-24 text-neutral-400">No courses available right now.</div>
    );
  }

  return (
    <div className="pb-16 px-4">
      <div className="max-w-2xl mx-auto relative">
        {/* Cards */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="relative"
        >
          {courses.map((course, idx) => {
            const isCurrent = idx === active;
            if (!isCurrent) return null;
            const cats = Array.isArray(course.category)
              ? course.category
              : course.category ? [course.category] : [];
            const isPopular = idx === 0;
            const savings = (course.originalPrice && course.originalPrice > course.price)
              ? course.originalPrice - course.price : null;
            const features = course.features?.length ? course.features : [course.description];

            return (
              <PricingCard
                key={course._id}
                course={course}
                cats={cats}
                isPopular={isPopular}
                savings={savings}
                features={features}
              isEnrolled={enrolledCourseIds.includes(course._id)}
                onEnroll={() => onEnroll(course)}
              />
            );
          })}
        </div>

        {/* Navigation arrows — only show when >1 course */}
        {courses.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute -left-4 md:-left-12 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white border border-neutral-200 rounded-full shadow-md hover:bg-neutral-50 transition-colors z-10"
              aria-label="Previous course"
            >
              <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={next}
              className="absolute -right-4 md:-right-12 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white border border-neutral-200 rounded-full shadow-md hover:bg-neutral-50 transition-colors z-10"
              aria-label="Next course"
            >
              <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Dots */}
            <div className="flex justify-center gap-2 mt-6">
              {courses.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`rounded-full transition-all duration-300 ${
                    i === active
                      ? 'w-6 h-2.5 bg-amber-400'
                      : 'w-2.5 h-2.5 bg-neutral-300 hover:bg-neutral-400'
                  }`}
                  aria-label={`Go to course ${i + 1}`}
                />
              ))}
            </div>

            {/* Counter */}
            <p className="text-center text-xs text-neutral-400 mt-2">
              {active + 1} of {courses.length} courses
            </p>
          </>
        )}
      </div>
    </div>
  );
};

/* ─── PricingCard component ─────────────────────────────────────────── */
interface PricingCardProps {
  course: Course;
  cats: string[];
  isPopular: boolean;
  savings: number | null;
  features: string[];
  isEnrolled: boolean;
  onEnroll: () => void;
}

const PricingCard: React.FC<PricingCardProps> = ({
  course, cats, isPopular, savings, features, isEnrolled, onEnroll
}) => {
  return (
    <div
      className="group relative bg-[#0d0d0d] rounded-3xl overflow-hidden border border-white/10 hover:border-amber-400/40 transition-all duration-300 hover:shadow-[0_0_40px_rgba(251,191,36,0.12)]"
      style={{ boxShadow: '0 4px 32px rgba(0,0,0,0.4)' }}
    >
      {/* Top amber accent stripe */}
      <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500" />

      {/* Most Popular badge */}
      {isPopular && (
        <div className="absolute top-5 right-5 z-10">
          <span className="bg-amber-400 text-black text-[10px] font-extrabold tracking-widest uppercase px-3 py-1 rounded-full shadow">
            🔥 Most Popular
          </span>
        </div>
      )}

      <div className="p-6 md:p-10">
        {/* Course title */}
        <h2 className="text-white font-extrabold text-xl md:text-2xl leading-tight mb-1 text-center">
          {course.title}
        </h2>
        {course.subtitle && (
          <p className="text-neutral-400 text-sm mb-5">{course.subtitle}</p>
        )}

        {/* ── PRICE (dominant visual) ── */}
        <div className="mb-5 rounded-2xl bg-white/[0.03] border border-white/[0.07] px-5 py-4">
          <div
            className="flex items-end gap-3 mb-1"
            style={{ filter: 'drop-shadow(0 0 18px rgba(251,191,36,0.25))' }}
          >
            <span className="text-5xl md:text-6xl font-black text-white tracking-tight">
              ₹{course.price.toLocaleString('en-IN')}
            </span>
            {course.originalPrice && course.originalPrice > course.price && (
              <span className="text-xl text-neutral-500 line-through mb-2">
                ₹{course.originalPrice.toLocaleString('en-IN')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <p className="text-neutral-500 text-xs">One-time · Instant access · No subscription</p>
            {savings && savings > 0 && (
              <span className="ml-auto text-xs font-bold text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                Save ₹{savings.toLocaleString('en-IN')}
              </span>
            )}
          </div>
        </div>

        {/* ── CTA BUTTON (before features — critical for mobile) ── */}
        <button
          onClick={onEnroll}
          className={`group/btn w-full font-extrabold text-base py-4 rounded-2xl transition-all duration-200 mb-3 flex items-center justify-center gap-2 ${
            isEnrolled
              ? 'bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20'
              : 'bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-black shadow-[0_4px_20px_rgba(251,191,36,0.3)] hover:shadow-[0_6px_28px_rgba(251,191,36,0.45)]'
          }`}
        >
          {isEnrolled ? (
            <>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Already Enrolled · Go to Dashboard</span>
            </>
          ) : (
            <>
              <span>Enroll Now</span>
              <svg className="w-4 h-4 transition-transform duration-200 group-hover/btn:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>

        {/* Trust row */}
        <div className="flex items-center justify-center gap-1.5 text-neutral-600 text-xs mb-6">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
          </svg>
          Secured by Razorpay · 100% Safe Checkout
        </div>

        {/* Divider */}
        <div className="h-px bg-white/[0.07] mb-6" />

        {/* ── FEATURES ── */}
        <FeatureList features={features} />

        {/* Course meta footer */}
        {course.instructor && (
          <div className="mt-6 pt-5 border-t border-white/[0.06] text-center">
            <div className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5">Faculty</div>
            <div className="text-white text-base font-extrabold tracking-wide">{course.instructor}</div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Expandable feature list ───────────────────────────────── */
const FeatureList: React.FC<{ features: string[] }> = ({ features }) => {
  const [showAll, setShowAll] = React.useState(false);
  const SHOW = 6;
  const visible = showAll ? features : features.slice(0, SHOW);
  const overflow = features.length - SHOW;
  return (
    <ul className="space-y-3">
      {visible.map((item: string) => (
        <li key={item} className="flex items-start gap-3 text-neutral-300 text-sm leading-snug">
          <span className="w-4 h-4 flex-shrink-0 mt-0.5 rounded-full bg-amber-400/15 flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </span>
          {item}
        </li>
      ))}
      {!showAll && overflow > 0 && (
        <li>
          <button
            onClick={() => setShowAll(true)}
            className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs font-semibold pl-7 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
            +{overflow} more included
          </button>
        </li>
      )}
      {showAll && (
        <li>
          <button
            onClick={() => setShowAll(false)}
            className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-400 text-xs font-semibold pl-7 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
            Show less
          </button>
        </li>
      )}
    </ul>
  );
};

export default CoursesPage;
