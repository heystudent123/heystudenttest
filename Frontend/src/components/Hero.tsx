import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface HeroProps {
  className?: string;
}

const SLIDES = [
  {
    url: '/Delhi University.png',
    webp: '/delhi-university.webp',
    label: 'University of Delhi',
    width: 1200,
    height: 670,
  },
  {
    url: '/Hindu.jpg',
    webp: '/hindu.webp',
    label: 'Hindu College',
    width: 307,
    height: 164,
  },
  {
    url: '/hansraj.jpg',
    webp: '/hansraj.webp',
    label: 'Hansraj College',
    width: 343,
    height: 147,
  },
];

const Hero: React.FC<HeroProps> = ({ className }) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`relative min-h-[72vh] overflow-hidden flex items-center ${className}`}>

      {/* ── Background carousel ─────────────────────────────────────── */}
      {SLIDES.map((slide, i) => (
        <div
          key={i}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: i === current ? 1 : 0, zIndex: 0 }}
        >
          {/* <picture> serves WebP to supporting browsers, falls back to original */}
          <picture>
            <source srcSet={slide.webp} type="image/webp" />
            <img
              src={slide.url}
              alt={slide.label}
              width={slide.width}
              height={slide.height}
              className="w-full h-full object-cover object-center"
              style={{ filter: 'brightness(0.38)' }}
              /* First slide is the LCP element — load eagerly at high priority */
              loading={i === 0 ? 'eager' : 'lazy'}
              // @ts-ignore — fetchpriority is a valid HTML attribute in modern browsers
              fetchpriority={i === 0 ? 'high' : 'low'}
              decoding={i === 0 ? 'sync' : 'async'}
            />
          </picture>
        </div>
      ))}

      {/* ── Dark gradient overlay ────────────────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.85) 100%)',
          zIndex: 1,
        }}
      />

      {/* ── Content ─────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full text-center px-4 py-16">
        {/* Badge */}
        <div className="inline-flex items-center px-4 py-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm text-white text-sm font-medium mb-7">
          <span className="w-2 h-2 bg-amber-400 rounded-full mr-2 animate-pulse"></span>
          Exam Decoders Batch &middot; Now Enrolling
        </div>

        <h1
          className="font-bold tracking-tight text-white mb-6"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(2.4rem, 6vw, 4.2rem)', lineHeight: 1.15 }}
        >
          Learn From The Ones Who<br />
          <span style={{ fontFamily: "'Montserrat','Inter',sans-serif", fontWeight: 800 }}>
            Actually Did It.
          </span>
        </h1>

        <p
          className="text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed"
          style={{ fontSize: 'clamp(1rem, 2.2vw, 1.2rem)', fontFamily: "'DM Sans','Inter',sans-serif" }}
        >
          HeyStudent is powered by CUET rankers and DU students from SRCC, Hindu &amp; Hansraj.
          Your preparation deserves more than random YouTube videos and outdated notes.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <Link
            to="/courses"
            className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl font-bold text-base transition-all duration-300"
            style={{ background: '#F5A623', color: '#000', boxShadow: '0 4px 24px rgba(245,166,35,0.35)' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#e09515')}
            onMouseLeave={e => (e.currentTarget.style.background = '#F5A623')}
          >
            Enroll Now
          </Link>
          <Link
            to="/courses"
            className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl font-bold text-base border border-white/30 text-white backdrop-blur-sm hover:bg-white/10 transition-all duration-300"
          >
            View Courses →
          </Link>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-white/90">
          <div className="text-center">
            <div className="text-2xl font-extrabold" style={{ fontFamily: "'Montserrat','Inter',sans-serif" }}>AIR 19</div>
            <div className="text-xs text-white/60 mt-0.5">Commerce Ranker</div>
          </div>
          <div className="w-px h-8 bg-white/20 hidden sm:block" />
          <div className="text-center">
            <div className="text-2xl font-extrabold" style={{ fontFamily: "'Montserrat','Inter',sans-serif" }}>AIR 63</div>
            <div className="text-xs text-white/60 mt-0.5">Humanities Ranker</div>
          </div>
          <div className="w-px h-8 bg-white/20 hidden sm:block" />
          <div className="text-center">
            <div className="text-2xl font-extrabold" style={{ fontFamily: "'Montserrat','Inter',sans-serif" }}>1000+</div>
            <div className="text-xs text-white/60 mt-0.5">Students Enrolled</div>
          </div>
          <div className="w-px h-8 bg-white/20 hidden sm:block" />
          <div className="text-center">
            <div className="text-2xl font-extrabold" style={{ fontFamily: "'Montserrat','Inter',sans-serif" }}>4.9★</div>
            <div className="text-xs text-white/60 mt-0.5">Student Rating</div>
          </div>
        </div>

        {/* Slide dots */}
        <div className="flex items-center justify-center gap-2 mt-12">
          {SLIDES.map((slide, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="transition-all duration-300"
              style={{
                width: i === current ? 28 : 8,
                height: 8,
                borderRadius: 99,
                background: i === current ? '#F5A623' : 'rgba(255,255,255,0.35)',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label={slide.label}
            />
          ))}
        </div>

        {/* Slide label */}
        <p className="text-white/40 text-xs mt-3 tracking-widest uppercase" style={{ fontFamily: "'Montserrat','Inter',sans-serif" }}>
          {SLIDES[current].label}
        </p>
      </div>

    </div>
  );
};

export default Hero;