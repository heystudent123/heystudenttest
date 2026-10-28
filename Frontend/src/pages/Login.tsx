import React from 'react';
import { SignIn, useAuth } from '@clerk/clerk-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { BarChart3, BookOpen, FileText } from 'lucide-react';
import SharedNavbar from '../components/SharedNavbar';

const clerkAppearance = {
  layout: {
    socialButtonsPlacement: 'bottom' as const,
    socialButtonsVariant: 'blockButton' as const,
  },
  variables: {
    colorPrimary: '#111827',
    colorBackground: '#ffffff',
    colorText: '#101828',
    colorTextSecondary: '#64748B',
    colorInputBackground: '#ffffff',
    colorInputText: '#101828',
    borderRadius: '10px',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  elements: {
    rootBox: 'w-full',
    cardBox: 'shadow-none rounded-none overflow-visible w-full',
    card: 'shadow-none border-0 p-0 w-full',
    header: 'hidden',
    footer: 'px-0',
    footerAction: 'text-center',
    footerActionText: 'text-[#64748B] text-[13px]',
    footerActionLink: 'text-[#3267f5] font-semibold text-[13px] hover:text-[#1d4ed8]',
    formFieldLabelRow: 'mb-1.5',
    formFieldLabel: 'text-[13px] font-semibold text-[#344054]',
    formFieldInput: 'border border-[#D0D5DD] rounded-lg px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:ring-1 focus:ring-[#111827]',
    formButtonPrimary: 'bg-[#111827] hover:bg-[#1F2937] text-white text-[14px] font-semibold rounded-lg py-3 normal-case shadow-none',
    socialButtonsBlockButton: 'border border-[#D0D5DD] rounded-lg py-2.5 text-[14px] font-semibold text-[#101828] hover:bg-slate-50',
    dividerLine: 'bg-[#E8EDF4]',
    dividerText: 'text-[#94A3B8] text-[12px]',
    identityPreviewEditButton: 'text-[#3267f5]',
    formResendCodeLink: 'text-[#3267f5] font-semibold',
    otpCodeFieldInput: 'border-[#D0D5DD] focus:border-[#111827]',
    alternativeMethodsBlockButton: 'border border-[#D0D5DD] rounded-lg text-[#101828]',
  },
};

const features = [
  { icon: BookOpen, title: 'Practice mock tests', text: 'Get exam-ready with the latest pattern', tint: 'bg-[#EEF0FF] text-[#6B7CFF]' },
  { icon: FileText, title: 'Learn from expert content', text: 'Structured notes and video lessons', tint: 'bg-[#E7F8EF] text-[#1F9D55]' },
  { icon: BarChart3, title: 'Track your progress', text: 'Stay on top of your preparation', tint: 'bg-[#FFF1E8] text-[#E07A1F]' },
];

function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '';
  return value;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const requested = safeNext(params.get('redirect'));
  const after = requested || '/';

  return (
    <div className="hs-page relative min-h-screen overflow-hidden" style={{ background: 'linear-gradient(180deg, #EEF1FF 0%, #F7F9FC 38%, #F7F9FC 100%)' }}>
      <Helmet>
        <title>Log In | HeyStudent</title>
        <meta name="description" content="Log in to your HeyStudent account to access CUET courses, mock tests and your study dashboard." />
        <link rel="canonical" href="https://heystudent.in/login" />
      </Helmet>
      {/* Decorative ring motif — mirrors the homepage CTA band treatment */}
      <svg
        className="pointer-events-none absolute -right-24 -top-24 hidden h-[480px] w-[480px] text-[#C9D2E3] opacity-60 lg:block"
        viewBox="0 0 420 420"
        aria-hidden="true"
      >
        <circle cx="210" cy="210" r="70" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="210" cy="210" r="120" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="210" cy="210" r="170" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="210" cy="210" r="210" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>

      <div className="hs-blob pointer-events-none absolute -left-20 top-[30%] h-72 w-72 rounded-full bg-[#AEBCFF] opacity-40 blur-[90px]" aria-hidden="true" />
      <div className="hs-blob pointer-events-none absolute right-[8%] bottom-[6%] h-80 w-80 rounded-full bg-[#FBC58D] opacity-35 blur-[90px]" style={{ animationDelay: '-4s' }} aria-hidden="true" />

      {/* Dot-grid texture for the upper band */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[360px] opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(#B9C3F5 1.4px, transparent 1.4px)',
          backgroundSize: '26px 26px',
          maskImage: 'linear-gradient(180deg, black 0%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(180deg, black 0%, transparent 100%)',
        }}
        aria-hidden="true"
      />

      <SharedNavbar />

      <main className="relative mx-auto grid min-h-[calc(100vh-92px)] max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-2 lg:gap-16 lg:px-10">
        {/* ── Left: headline + feature list + illustration ── */}
        <div className="hs-fade-up text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF1FF] px-3 py-1.5 text-[12px] font-bold text-[#3267f5]">
            Welcome back
          </span>
          <h1 className="mt-5 text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#101828] lg:text-[42px]">
            Sign in and get back
            <span className="block text-[#3267f5]">to your CUET prep</span>
          </h1>
          <p className="mt-4 max-w-sm text-[16px] leading-relaxed text-[#64748B]">
            Your mock test history and course access are waiting on this account.
          </p>

          <div className="mt-8 space-y-5">
            {features.map((item) => (
              <div key={item.title} className="flex items-center gap-4">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.tint}`}>
                  <item.icon size={22} strokeWidth={2.2} />
                </span>
                <div>
                  <p className="text-[15px] font-bold text-[#101828]">{item.title}</p>
                  <p className="text-[13.5px] text-[#64748B]">{item.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="relative mt-10 hidden max-w-sm overflow-hidden rounded-[22px] border border-[#E8EDF4] bg-white p-6 shadow-[0_10px_30px_rgba(16,24,40,0.05)] lg:block">
            <svg className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 text-[#F4F6FB]" viewBox="0 0 160 160" aria-hidden="true">
              <circle cx="80" cy="80" r="50" fill="none" stroke="currentColor" strokeWidth="10" />
              <circle cx="80" cy="80" r="75" fill="none" stroke="currentColor" strokeWidth="6" />
            </svg>
            <p className="relative text-[14px] leading-relaxed text-[#475569]">
              "HeyStudent helped me track exactly where I was losing marks before the real exam."
            </p>
            <p className="relative mt-3 text-[13px] font-bold text-[#101828]">— A CUET aspirant, Batch 2026</p>
          </div>
        </div>

        {/* ── Right: auth card ── */}
        <div className="flex justify-center hs-fade-up lg:justify-end" style={{ animationDelay: '100ms' }}>
          <div className="w-full max-w-[400px] rounded-[20px] border border-[#E8EDF4] bg-white p-7 shadow-[0_10px_30px_rgba(16,24,40,0.06)] sm:p-8">
            {isLoaded && !isSignedIn && (
              <>
                <h2 className="text-[22px] font-extrabold text-[#101828]">Sign in</h2>
                <p className="mt-1.5 text-[13.5px] text-[#64748B]">
                  Enter your details to access your account.
                </p>
                <div className="mt-6">
                  <SignIn
                    routing="hash"
                    afterSignInUrl={after}
                    signUpUrl={requested ? `/signup?redirect=${encodeURIComponent(requested)}` : '/signup'}
                    appearance={clerkAppearance}
                  />
                </div>
              </>
            )}
            {isLoaded && isSignedIn && (
              <div className="text-center">
                <h2 className="text-[18px] font-bold text-[#101828]">You are already signed in.</h2>
                <button
                  type="button"
                  onClick={() => navigate(requested || '/mock-tests')}
                  className="mt-5 w-full rounded-lg bg-[#111827] px-5 py-3 text-[14px] font-semibold text-white hover:bg-[#1F2937] transition-colors"
                >
                  Go to mock tests
                </button>
                <Link to="/" className="mt-3 block text-[13px] font-medium text-[#3267f5]">Back to home</Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
