import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ArrowRight, Check, Clock3, Compass, ListChecks, Minus, PenLine, Repeat2, ScanSearch, Wallet,
} from 'lucide-react';
import SharedNavbar from '../components/SharedNavbar';

const TEACHING_PILLARS = [
  {
    icon: ScanSearch,
    tint: 'bg-[#EEF0FF] text-[#6B7CFF]',
    title: 'Chapter triage, not full coverage',
    text: 'Before you open a single chapter, we tell you which ones are worth your time and which ones barely show up in the paper. Most courses teach everything equally — we don’t, because the exam doesn’t either.',
  },
  {
    icon: Clock3,
    tint: 'bg-[#E7F8EF] text-[#1F9D55]',
    title: 'Mock tests that match the real clock',
    text: 'Our mock tests run on the exact timing and negative-marking pattern CUET uses, so the first time you feel real exam pressure isn’t on exam day.',
  },
  {
    icon: Repeat2,
    tint: 'bg-[#FFF1E8] text-[#E07A1F]',
    title: 'Review that shows you the “why”',
    text: 'After every mock, you see which questions you missed and why — not just a score. That loop of attempt, review, and correct is what actually moves a percentile.',
  },
];

const COMPARISON_ROWS = [
  { label: 'Who designs the content', coaching: 'Faculty who haven’t sat CUET recently', us: 'Founders who scored AIR 19 and 63 themselves' },
  { label: 'Syllabus approach', coaching: 'Covers every chapter equally', us: 'Prioritizes chapters by how often they’re tested' },
  { label: 'Mock test timing', coaching: 'Generic test-series schedule', us: 'Matches CUET’s real duration and marking scheme' },
  { label: 'Cost of a full batch', coaching: 'Often ₹30,000+', us: 'A fraction of that — see current pricing on Courses' },
  { label: 'Where you study', coaching: 'Fixed classroom timings', us: 'Any device, any time, at your own pace' },
];

const AboutPage: React.FC = () => {
  return (
    <div className="hs-page min-h-screen bg-white">
      <Helmet>
        <title>About HeyStudent — Why Our CUET Prep Is Different</title>
        <meta name="description" content="HeyStudent was built by two CUET 2023 top-100 rankers who prioritize chapters, run exam-accurate mock tests, and review every mistake with you." />
        <link rel="canonical" href="https://heystudent.in/about" />
      </Helmet>
      <SharedNavbar />

      {/* ── Hero — the only photo on this page ── */}
      <section className="px-6 pb-14 pt-14 lg:px-10 lg:pt-20">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[2px] text-[#3267f5]">About HeyStudent</p>
            <h1 className="mt-4 text-[32px] font-extrabold leading-[1.12] tracking-[-0.02em] text-[#101828] sm:text-[40px]">
              We don't teach CUET. We teach how to beat it.
            </h1>
            <p className="mt-5 text-[15.5px] leading-relaxed text-[#64748B]">
              There's a difference between knowing the syllabus and knowing how to score in it. HeyStudent exists because the two of us spent a year closing that gap for ourselves — and decided the shortcuts we found shouldn't stay ours alone.
            </p>
          </div>
          <div className="relative overflow-hidden rounded-[26px] border border-[#E8EDF4] bg-[#F7F9FC]">
            <div className="grid grid-cols-2">
              <img src="/moksh.webp" alt="Moksh Jindal, HeyStudent co-founder, AIR 19 CUET 2023" className="h-full w-full object-cover" loading="eager" width={300} height={380} />
              <img src="/naman.webp" alt="Naman Kumar, HeyStudent co-founder, AIR 63 CUET 2023" className="h-full w-full object-cover" loading="eager" width={300} height={380} />
            </div>
            <div className="border-t border-[#E8EDF4] bg-white px-5 py-4">
              <p className="text-[13px] font-semibold text-[#101828]">Moksh Jindal (AIR 19) & Naman Kumar (AIR 63)</p>
              <p className="mt-0.5 text-[12px] text-[#94A3B8]">CUET 2023 · SRCC & Hindu College, Delhi University</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── The gap we saw ── */}
      <section className="bg-[#F7F9FC] px-6 py-16 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <p className="text-[12px] font-bold uppercase tracking-[2px] text-[#3267f5]">The problem we kept running into</p>
          <h2 className="why-title mt-3 text-[26px] sm:text-[30px]">Coaching gives you a syllabus. The exam rewards strategy.</h2>
          <p className="mt-5 text-[15px] leading-relaxed text-[#475569]">
            After our own CUET results came out, the questions from juniors were never "what's in the syllabus" — they already had that from school. It was always narrower: which sections to actually spend time on, how to not run out of time in the domain paper, and what separates a decent score from one that gets you into a college you actually want.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-[#475569]">
            We kept answering the same questions one-on-one until we realized the answers were worth more as a structured course than as a favor to a handful of juniors. That's the entire reason HeyStudent exists.
          </p>
        </div>
      </section>

      {/* ── How we actually teach ── */}
      <section className="px-6 py-16 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-xl text-center">
            <p className="text-[12px] font-bold uppercase tracking-[2px] text-[#3267f5]">How the course actually works</p>
            <h2 className="why-title mt-3 text-[26px] sm:text-[30px]">Three things we do differently.</h2>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {TEACHING_PILLARS.map((item) => (
              <div key={item.title} className="rounded-[22px] border border-[#E8EDF4] bg-white p-6 transition-shadow hover:shadow-[0_8px_24px_rgba(16,24,40,0.06)]">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.tint}`}>
                  <item.icon size={20} strokeWidth={2.1} />
                </span>
                <h3 className="mt-4 text-[15.5px] font-bold text-[#101828]">{item.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[#64748B]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Coaching vs HeyStudent comparison ── */}
      <section className="bg-[#F7F9FC] px-6 py-16 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="mx-auto max-w-xl text-center">
            <p className="text-[12px] font-bold uppercase tracking-[2px] text-[#3267f5]">The honest comparison</p>
            <h2 className="why-title mt-3 text-[26px] sm:text-[30px]">Typical coaching vs. HeyStudent.</h2>
          </div>

          {/* Stacked cards on narrow screens — a 3-column grid can't fit this much text below sm */}
          <div className="mt-10 space-y-3 sm:hidden">
            {COMPARISON_ROWS.map((row) => (
              <div key={row.label} className="rounded-2xl border border-[#E8EDF4] bg-white p-4">
                <p className="text-[13.5px] font-bold text-[#101828]">{row.label}</p>
                <div className="mt-3 flex items-start gap-2 text-[13px] text-[#94A3B8]">
                  <Minus size={14} className="mt-0.5 shrink-0" />
                  <span>{row.coaching}</span>
                </div>
                <div className="mt-2 flex items-start gap-2 text-[13px] text-[#344054]">
                  <Check size={14} className="mt-0.5 shrink-0 text-[#1F9D55]" />
                  <span>{row.us}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 hidden overflow-hidden rounded-[22px] border border-[#E8EDF4] bg-white sm:block">
            <div className="grid grid-cols-[1.2fr_1fr_1fr] border-b border-[#E8EDF4] bg-white text-[12.5px] font-bold uppercase tracking-[0.5px] text-[#94A3B8]">
              <div className="px-5 py-3.5"></div>
              <div className="flex items-center gap-1.5 border-l border-[#E8EDF4] px-5 py-3.5"><Minus size={13} /> Typical coaching</div>
              <div className="flex items-center gap-1.5 border-l border-[#E8EDF4] px-5 py-3.5 text-[#101828]"><Check size={13} className="text-[#1F9D55]" /> HeyStudent</div>
            </div>
            {COMPARISON_ROWS.map((row, idx) => (
              <div key={row.label} className={`grid grid-cols-[1.2fr_1fr_1fr] text-[13px] ${idx !== COMPARISON_ROWS.length - 1 ? 'border-b border-[#F1F5F9]' : ''}`}>
                <div className="px-5 py-4 font-semibold text-[#101828]">{row.label}</div>
                <div className="border-l border-[#F1F5F9] px-5 py-4 text-[#94A3B8]">{row.coaching}</div>
                <div className="border-l border-[#F1F5F9] px-5 py-4 text-[#344054]">{row.us}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Access philosophy ── */}
      <section className="px-6 py-16 lg:px-10">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFF1E8] text-[#E07A1F]">
              <Wallet size={20} strokeWidth={2.1} />
            </span>
            <p className="mt-5 text-[12px] font-bold uppercase tracking-[2px] text-[#3267f5]">Why it's priced the way it is</p>
            <h2 className="why-title mt-3 text-[26px] sm:text-[30px]">Your rank shouldn't depend on your budget.</h2>
            <p className="mt-5 text-[15px] leading-relaxed text-[#475569]">
              A lot of CUET coaching is priced like it's optional — and for most families, it is, because it's expensive enough to skip. We built HeyStudent to remove that trade-off entirely: the same strategy, notes, and mock tests we used, priced so the decision to prepare seriously isn't a financial one.
            </p>
            <Link to="/courses" className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#3267f5] hover:underline">
              See current course pricing <ArrowRight size={15} />
            </Link>
          </div>
          <div className="order-1 grid grid-cols-1 gap-3 lg:order-2">
            {[
              { icon: ListChecks, text: 'Full-syllabus courses priced well below typical coaching fees' },
              { icon: Compass, text: 'Free mock tests so you can gauge your level before paying anything' },
              { icon: PenLine, text: 'No hidden add-ons — what you see on Courses is what you pay' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-4 rounded-2xl border border-[#E8EDF4] bg-[#F7F9FC] p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#3267f5]">
                  <item.icon size={16} strokeWidth={2.1} />
                </span>
                <p className="text-[13.5px] leading-snug text-[#344054]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 pb-20 pt-4 lg:px-10">
        <div className="mx-auto max-w-4xl rounded-[28px] bg-[#111827] px-8 py-14 text-center sm:px-14">
          <h2 className="text-[26px] font-extrabold text-white sm:text-[32px]">See where you'd score today.</h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[#CBD5E1]">
            Take a free mock test built on the real CUET pattern, no payment required to start.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link to="/mock-tests" className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 text-[15px] font-semibold text-[#101828] transition-colors hover:bg-slate-100">
              Take a free mock test <ArrowRight size={16} />
            </Link>
            <Link to="/courses" className="inline-flex items-center rounded-md border border-white/20 px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-white/10">
              Explore courses
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
