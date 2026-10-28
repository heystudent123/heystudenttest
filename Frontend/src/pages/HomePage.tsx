import React from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, BarChart3, BookOpen, Clock3, FileText, GraduationCap, LineChart, List, Smartphone, Star, Trophy } from 'lucide-react';
import SharedNavbar from '../components/SharedNavbar';

const features = [
  { icon: FileText, title: 'Real Exam Pattern', text: 'Questions as per latest CUET pattern', tint: 'bg-[#EEF0FF] text-[#6B7CFF]' },
  { icon: Clock3, title: 'Timed Tests', text: 'Improve speed and accuracy', tint: 'bg-[#E7F8EF] text-[#3CB371]' },
  { icon: BarChart3, title: 'Instant Results', text: 'Detailed analysis and AI insights', tint: 'bg-[#FDECEC] text-[#F08A8A]' },
  { icon: List, title: 'Topic-wise Tests', text: 'Practice by subject and chapter', tint: 'bg-[#FFF6D8] text-[#D4A017]' },
];

const courses = [
  { id: 'humanities', title: 'CUET Humanities', text: 'Complete preparation for Domain + Language', image: '/hindu.webp', rating: '4.8', reviews: '2.1K', popular: true, faces: ['/reviews/as.jpg', '/reviews/bs.jpg', '/reviews/cs.jpg'] },
  { id: 'commerce', title: 'CUET Commerce', text: 'Concepts, practice and previous year questions', image: '/hansraj.webp', rating: '4.8', reviews: '1.6K', popular: false, faces: ['/reviews/ds.jpg', '/reviews/es.jpg', '/reviews/fs.jpg'] },
  { id: 'science', title: 'CUET Science', text: 'Full coverage with concepts and MCQs', image: '/delhi-university.webp', rating: '4.7', reviews: '1.8K', popular: false, faces: ['/reviews/cs.jpg', '/reviews/fs.jpg', '/reviews/as.jpg'] },
];

const reasons = [
  { icon: GraduationCap, title: 'Expert Guidance', text: 'Learn from experienced CUET mentors', tint: 'bg-[#EEF0FF] text-[#7B88F5]' },
  { icon: FileText, title: 'Comprehensive Content', text: 'Covers all subjects and topics', tint: 'bg-[#EAF1FF] text-[#6B8CFF]' },
  { icon: BarChart3, title: 'Performance Analysis', text: 'Track progress and identify weak areas', tint: 'bg-[#FFF1E8] text-[#F0A06A]' },
  { icon: Smartphone, title: 'Learn Anywhere', text: 'Study on web or mobile, anytime, anywhere', tint: 'bg-[#F3EEFF] text-[#9B8AF5]' },
];

const founders = [
  {
    name: 'Moksh Jindal',
    role: 'Co-founder and Commerce Faculty',
    air: 'AIR 19',
    year: 'CUET 2023',
    college: 'SRCC, Delhi University',
    quote: "We started HeyStudent because we kept seeing the same questions in juniors' CUET exams. Our goal is to make CUET preparation simpler and more effective for every student.",
    photo: '/moksh.webp',
    badge: 'bg-[#EAF2FF]',
    trophy: '#3267f5',
  },
  {
    name: 'Naman Kumar',
    role: 'Co-founder and Humanities Faculty',
    air: 'AIR 63',
    year: 'CUET 2023',
    college: 'Hindu College, Delhi University',
    quote: 'Having gone through the entire CUET journey ourselves, we understand what students actually need. HeyStudent is our way of giving back and helping you prepare smarter.',
    photo: '/naman.webp',
    badge: 'bg-[#FBF6E8]',
    trophy: '#E8A317',
  },
];

const HomePage: React.FC = () => {
  return (
    <div className="hs-page">
      <Helmet>
        <title>HeyStudent — CUET Mock Tests & Expert Courses</title>
        <meta name="description" content="Prepare for CUET with real exam-pattern mock tests, instant results, and expert-led courses in Commerce, Arts and more." />
        <link rel="canonical" href="https://heystudent.in/" />
      </Helmet>
      <SharedNavbar />

      <section className="hs-hero flex w-full max-w-full items-center bg-white px-6 pb-6 pt-4 lg:px-10">
        <div className="grid w-full min-w-0 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0 text-left lg:pl-16 xl:pl-24">
            <p className="hs-hero-eyebrow">CUET preparation made simple</p>
            <h1 className="mt-4">
              <span className="block whitespace-nowrap">Your CUET</span>
              <span className="accent block whitespace-nowrap">Success Partner</span>
            </h1>
            <p className="hs-hero-description mt-5 max-w-[520px]">
              Practice with real exam pattern mock tests, learn from expert courses, and track your progress — all in one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/mock-tests" className="hs-hero-button inline-flex items-center gap-2 rounded-md bg-[#111827] px-5 py-3 text-white">
                Explore Mock Tests <ArrowRight size={16} />
              </Link>
              <Link to="/courses" className="hs-hero-button inline-flex items-center rounded-md border border-[#D0D5DD] bg-white px-5 py-3 text-[#101828]">
                View Courses
              </Link>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <div className="flex -space-x-2">
                {founders.map((person) => (
                  <img key={person.name} src={person.photo} alt="" width={32} height={32} className="h-8 w-8 rounded-full border-2 border-white object-cover" />
                ))}
              </div>
              <p className="hs-hero-proof">Built by AIR 19 and AIR 63 CUET rankers</p>
            </div>
          </div>

          <div className="hero-visual-slot justify-self-end">
            <div className="hero-visual">
              <img
                src="/girl%20image.png"
                alt="Student with books and a backpack"
                width={310}
                height={440}
                fetchPriority="high"
                className="hero-portrait"
              />
              <div className="hero-feature-card hero-feature-card--tests">
                <span className="hero-feature-icon bg-[#EEF3FF] text-[#4778F5]"><BookOpen size={22} /></span>
                <span>
                  <span className="hero-feature-title block">Mock Tests</span>
                  <span className="hero-feature-description block">Real exam pattern</span>
                </span>
              </div>
              <div className="hero-feature-card hero-feature-card--courses">
                <span className="hero-feature-icon bg-[#E9F8EF] text-[#1F9D55]"><GraduationCap size={22} /></span>
                <span>
                  <span className="hero-feature-title block">Expert Courses</span>
                  <span className="hero-feature-description block">Learn at your pace</span>
                </span>
              </div>
              <div className="hero-feature-card hero-feature-card--progress">
                <span className="hero-feature-icon bg-[#FFF4E8] text-[#E07A1F]"><LineChart size={22} /></span>
                <span>
                  <span className="hero-feature-title block">Progress Tracking</span>
                  <span className="hero-feature-description block">Know where you stand</span>
                </span>
              </div>
              <p className="hero-script">Same Goal<br />Higher<br />Possibilities</p>
            </div>
          </div>
        </div>
      </section>

      <section className="w-full bg-white px-8 py-10 sm:px-14 lg:px-24">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(280px,420px)_1fr]">
          <div className="text-left">
            <p className="mb-3 flex items-center gap-3 text-[13px] font-bold uppercase tracking-[2px] text-[#94A3B8]">
              <span>01</span>
              <span className="h-px w-16 bg-[#D5Dbe3]" />
              <span>Mock tests</span>
            </p>
            <h2 className="mock-title">Practice Like the Real Exam</h2>
            <p className="mt-4 max-w-[420px] text-left text-[16px] leading-relaxed text-[#64748B]">
              Full-length and topic-wise mock tests based on the latest CUET pattern with instant results and detailed analysis.
            </p>
            <Link to="/mock-tests" className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#111827] px-5 py-3 text-[15px] font-semibold text-white">
              Explore Mock Tests <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {features.map((item) => (
              <div key={item.title} className="text-center">
                <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${item.tint}`}><item.icon size={28} strokeWidth={2.2} /></span>
                <p className="mt-4 text-[16px] font-bold leading-snug text-[#101828]">{item.title}</p>
                <p className="mt-1 text-[14px] leading-snug text-[#64748B]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full bg-white px-8 py-10 sm:px-14 lg:px-24">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(280px,420px)_1fr]">
          <div className="text-left">
            <p className="mb-3 flex items-center gap-3 text-[13px] font-bold uppercase tracking-[2px] text-[#94A3B8]">
              <span>02</span>
              <span className="h-px w-16 bg-[#D5Dbe3]" />
              <span>CUET courses</span>
            </p>
            <h2 className="mock-title">Learn from Expert Courses</h2>
            <p className="mt-4 max-w-[420px] text-left text-[16px] leading-relaxed text-[#64748B]">
              Well-structured courses for all CUET subjects, designed by experienced mentors to help you build strong concepts and score higher.
            </p>
            <Link to="/courses" className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#111827] px-5 py-3 text-[15px] font-semibold text-white">
              View Courses <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => (
              <article key={course.id} className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#E8EDF4] bg-white">
                <div className="relative">
                  <img src={course.image} alt="" width={640} height={420} loading="lazy" className="h-48 w-full object-cover" />
                  {course.popular && <span className="absolute left-3 top-3 rounded-full bg-[#F6A15A] px-2.5 py-1 text-[11px] font-semibold text-white">Popular</span>}
                </div>
                <div className="flex flex-1 flex-col p-4 text-left">
                  <p className="text-[16px] font-bold text-[#101828]">{course.title}</p>
                  <p className="mt-1 flex-1 text-[14px] leading-snug text-[#64748B]">{course.text}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {course.faces.map((src) => (
                        <img key={src} src={src} alt="" width={22} height={22} className="h-[22px] w-[22px] rounded-full border-2 border-white object-cover" />
                      ))}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#101828]">
                      <Star size={14} className="fill-[#F5B400] text-[#F5B400]" />
                      {course.rating}
                      <span className="font-normal text-[#94A3B8]">({course.reviews})</span>
                    </span>
                  </div>
                  <Link to="/courses" className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-[#111827] bg-white px-4 py-2 text-[14px] font-semibold text-[#101828]">
                    View Course
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full bg-white px-8 py-16 text-left sm:px-14 lg:px-24">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(320px,520px)_1fr]">
          <div className="text-left">
            <p className="mb-4 flex items-center gap-3 text-[14px] font-bold uppercase tracking-[2px] text-[#94A3B8]">
              <span>03</span>
              <span className="h-px w-16 bg-[#D5Dbe3]" />
              <span>Why choose us</span>
            </p>
            <h2 className="why-title">Everything You Need for CUET Preparation</h2>
            <p className="mt-5 max-w-[460px] text-left text-[18px] leading-relaxed text-[#64748B]">
              A complete and focused platform to help you prepare better, practice smarter and stay ahead.
            </p>
          </div>
          <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {reasons.map((item) => (
              <div key={item.title} className="flex items-start gap-5 text-left">
                <span className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl ${item.tint}`}>
                  <item.icon size={36} strokeWidth={2.1} />
                </span>
                <div className="text-left">
                  <p className="text-left text-[20px] font-bold leading-snug text-[#101828]">{item.title}</p>
                  <p className="mt-1 text-left text-[16px] leading-snug text-[#64748B]">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative bg-[#F4F6FB] px-8 py-16 sm:px-14 lg:px-24">
        <div className="grid items-center gap-8 xl:grid-cols-[minmax(240px,300px)_1fr]">
          <div className="relative text-left">
            <span aria-hidden="true" className="pointer-events-none absolute -bottom-10 left-0 select-none font-serif text-[180px] leading-none text-[#E4EAF3]">“</span>
            <p className="mb-4 flex items-center gap-3 text-[14px] font-bold uppercase tracking-[2px] text-[#94A3B8]">
              <span>04</span>
              <span className="h-px w-16 bg-[#D5Dbe3]" />
              <span>Student stories</span>
            </p>
            <h2 className="why-title relative">
              Built by
              <span className="block text-[#3267f5]">CUET rankers</span>
            </h2>
            <p className="relative mt-5 max-w-[300px] text-left text-[16px] leading-relaxed text-[#64748B]">
              HeyStudent was started by Moksh Jindal and Naman Kumar after they sat CUET and kept getting the same questions from juniors.
            </p>
          </div>
          <div>
            <div className="grid gap-5 xl:grid-cols-2">
              {founders.map((person) => (
                <article key={person.name} className="flex min-h-[280px] gap-4 rounded-[22px] bg-white p-4 text-left shadow-[0_10px_30px_rgba(16,24,40,0.06)]">
                  <img
                    src={person.photo}
                    alt={person.name}
                    width={220}
                    height={280}
                    loading="lazy"
                    className="h-auto w-[176px] shrink-0 self-stretch rounded-2xl object-cover object-top sm:w-[196px]"
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className={`rounded-xl px-3 py-3 ${person.badge}`}>
                      <div className="flex items-start gap-2">
                        <Trophy size={18} className="mt-0.5 shrink-0" color={person.trophy} fill={person.trophy} />
                        <div>
                          <p className="text-[18px] font-bold leading-none text-[#101828]">{person.air}</p>
                          <p className="mt-1.5 whitespace-nowrap text-[13px] leading-snug text-[#64748B]">{person.year}</p>
                          <p className="whitespace-nowrap text-[13px] leading-snug text-[#64748B]">{person.college}</p>
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 flex-1 text-[14px] leading-relaxed text-[#475569]">“{person.quote}”</p>
                    <p className="mt-4 text-[16px] font-bold text-[#101828]">{person.name}</p>
                    <p className="text-[13px] text-[#94A3B8]">{person.role}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-8 py-14 sm:px-14 lg:px-24">
        <div className="relative overflow-hidden rounded-[28px] bg-[#EEF1FF] px-8 py-10 sm:px-12 lg:px-14 lg:py-12">
          <svg className="pointer-events-none absolute -left-16 top-1/2 h-[420px] w-[420px] -translate-y-1/2 text-white/70" viewBox="0 0 420 420" aria-hidden="true">
            <circle cx="210" cy="210" r="70" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="210" cy="210" r="120" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="210" cy="210" r="170" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="210" cy="210" r="210" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <div className="relative grid items-center gap-8 lg:grid-cols-[minmax(280px,1fr)_minmax(320px,1.05fr)]">
            <div className="text-left">
              <p className="mb-4 flex items-center gap-3 text-[14px] font-bold uppercase tracking-[2px] text-[#94A3B8]">
                <span>05</span>
                <span className="h-px w-16 bg-[#C9D2E3]" />
                <span>Get started</span>
              </p>
              <h2 className="why-title max-w-[520px]">Start Your CUET Preparation Today</h2>
              <p className="mt-5 max-w-[420px] text-left text-[16px] leading-relaxed text-[#64748B]">
                Join thousands of students and take a step closer to your dream university.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/signup" className="inline-flex items-center gap-2 rounded-md bg-[#111827] px-5 py-3 text-[15px] font-semibold text-white">
                  Create Free Account <ArrowRight size={16} />
                </Link>
                <Link to="/mock-tests" className="inline-flex items-center rounded-md border border-[#D0D5DD] bg-white px-5 py-3 text-[15px] font-semibold text-[#101828]">
                  Explore Mock Tests
                </Link>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 sm:gap-4">
              <img
                src="/Last%20section%20image.png"
                alt="Student at a laptop with a checklist: Learn, Practice, Improve, Succeed"
                className="h-auto w-full max-w-[460px]"
              />
              <p className="shrink-0 text-left text-[28px] leading-[1.05] text-[#334155] sm:text-[32px]" style={{ fontFamily: 'Caveat, cursive' }}>
                Better
                <br />
                Practice
                <br />
                Brighter
                <br />
                Tomorrow
                <svg className="mt-1 h-3 w-20 text-[#3267f5]" viewBox="0 0 80 12" aria-hidden="true">
                  <path d="M2 8c10-6 18 4 28-1s16 5 26 0 16-2 22 1" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
