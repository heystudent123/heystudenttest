import React, { useState, useMemo, useEffect, useRef } from 'react';
import SharedNavbar from '../components/SharedNavbar';
import { cuetPredictorApi } from '../services/api';
import { DU_COLLEGES, DU_PROGRAMS } from '../data/duCutoffLists';

// Searchable combobox — renders a text input + filtered dropdown list
interface ComboboxProps {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  error?: boolean;
}
const Combobox: React.FC<ComboboxProps> = ({ options, value, onChange, placeholder, error }) => {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sync query when value is cleared externally
  useEffect(() => { if (!value) setQuery(''); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.toLowerCase().includes(q));
  }, [query, options]);

  const select = (opt: string) => {
    onChange(opt);
    setQuery(opt);
    setOpen(false);
  };

  const clear = () => { onChange(''); setQuery(''); };

  return (
    <div ref={ref} className="relative w-full">
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (!e.target.value) onChange(''); }}
        className={`w-full rounded-xl border bg-amber-50/40 py-3 pl-4 pr-9 text-sm text-black outline-none transition-all focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200 ${error ? 'border-rose-300 bg-rose-50' : 'border-neutral-200'}`}
      />
      {/* Clear button */}
      {query && (
        <button type="button" onClick={clear} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg">
          {filtered.map(opt => (
            <li
              key={opt}
              onMouseDown={() => select(opt)}
              className={`cursor-pointer px-4 py-2.5 text-sm transition-colors hover:bg-amber-50 ${opt === value ? 'bg-amber-100 font-semibold text-amber-800' : 'text-neutral-800'}`}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface PredictedCollege {
  college_name: string;
  cutoffScore: number;
  chance: 'High' | 'Medium' | 'Low' | null;
}

const CATEGORIES = [
  { value: 'UR',   label: 'General', sub: 'UR' },
  { value: 'OBC',  label: 'OBC',     sub: 'NCL' },
  { value: 'SC',   label: 'SC',      sub: '' },
  { value: 'ST',   label: 'ST',      sub: '' },
  { value: 'EWS',  label: 'EWS',     sub: '' },
  { value: 'PwBD', label: 'PwBD',    sub: '' },
];

const CHANCE_CONFIG = {
  High: {
    label: 'High Chance',
    pill: 'High',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    bar: 'bg-emerald-500',
    card: 'border-emerald-100 hover:border-emerald-300',
  },
  Medium: {
    label: 'Good Chance',
    pill: 'Good',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    bar: 'bg-amber-500',
    card: 'border-amber-100 hover:border-amber-300',
  },
  Low: {
    label: 'Reach',
    pill: 'Reach',
    text: 'text-rose-600',
    badge: 'bg-rose-100 text-rose-600',
    bar: 'bg-rose-400',
    card: 'border-rose-100 hover:border-rose-300',
  },
};

// Fallback styling for colleges that are out of reach (chance === null in search)
const NONE_CONFIG = {
  pill: 'Out of reach',
  badge: 'bg-neutral-100 text-neutral-500',
  bar: 'bg-neutral-300',
  card: 'border-neutral-100 hover:border-neutral-300',
};
const cfgFor = (chance: PredictedCollege['chance']) =>
  chance ? CHANCE_CONFIG[chance] : { ...CHANCE_CONFIG.Low, ...NONE_CONFIG };

const SERIF = "'Playfair Display', Georgia, serif";
const SANS = "'Montserrat','Inter',sans-serif";

const CuetPredictorPage: React.FC = () => {
  const [form, setForm] = useState({ name: '', mobile: '', score: '', category: '', gender: '', college: '', course: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PredictedCollege[] | null>(null);
  const [submittedMeta, setSubmittedMeta] = useState({ score: '', category: '', gender: '' });
  const [submitError, setSubmitError] = useState('');
  const [activeChance, setActiveChance] = useState<'all' | 'High' | 'Medium' | 'Low'>('all');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<PredictedCollege[]>([]);
  const [searching, setSearching] = useState(false);
  const filterCollege = form.college;
  const filterCourse = form.course;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Please enter your name';
    if (!form.mobile.trim()) e.mobile = 'Mobile number is required';
    else if (!/^\d{10}$/.test(form.mobile.trim())) e.mobile = 'Enter a valid 10-digit number';
    if (!form.score) e.score = 'Score is required';
    else if (isNaN(Number(form.score)) || Number(form.score) < 0 || Number(form.score) > 1000)
      e.score = 'Score must be 0–1000';
    if (!form.category) e.category = 'Select your category';
    if (!form.gender) e.gender = 'Select your gender';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    setSubmitError('');
    setResults(null);
    setActiveChance('all');
    setSearch('');

    try {
      const res = await cuetPredictorApi.submit({
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        score: Number(form.score),
        category: form.category,
        gender: form.gender,
      });
      setResults(res.predictions || []);
      setSubmittedMeta({ score: form.score, category: form.category, gender: form.gender });
      setTimeout(() => {
        document.getElementById('results-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Whether the user is actively searching the full college list
  const isSearchMode = search.trim().length > 0;

  // Debounced search against the FULL cutoff dataset (not just the predictions)
  useEffect(() => {
    const q = search.trim();
    if (!q) { setSearchResults([]); setSearching(false); return; }

    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await cuetPredictorApi.searchColleges({
          q,
          category: submittedMeta.category || form.category || 'UR',
          score: submittedMeta.score ? Number(submittedMeta.score) : undefined,
          gender: submittedMeta.gender || form.gender || 'F',
        });
        setSearchResults(res.results || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [search, submittedMeta.category, submittedMeta.score, submittedMeta.gender, form.category, form.gender]);

  const counts = useMemo(() => ({
    all:    results?.length ?? 0,
    High:   results?.filter(r => r.chance === 'High').length ?? 0,
    Medium: results?.filter(r => r.chance === 'Medium').length ?? 0,
    Low:    results?.filter(r => r.chance === 'Low').length ?? 0,
  }), [results]);

  // In search mode, show colleges fetched live from the JSON; otherwise show predictions.
  const displayed = useMemo(() => {
    const source = isSearchMode ? searchResults : (results || []);
    const fc = filterCollege.trim().toLowerCase();
    const fco = filterCourse.trim().toLowerCase();
    return source.filter(r => {
      if (activeChance !== 'all' && r.chance !== activeChance) return false;
      const [colPart = '', coursePart = ''] = r.college_name.split(' — ');
      if (fc && !colPart.toLowerCase().includes(fc)) return false;
      if (fco && !coursePart.toLowerCase().includes(fco)) return false;
      return true;
    });
  }, [results, searchResults, isSearchMode, activeChance, filterCollege, filterCourse]);


  const resetForm = () => {
    setResults(null);
    setForm({ name: '', mobile: '', score: '', category: '', gender: '', college: '', course: '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen w-full" style={{ background: '#fff9ed' }}>
      <SharedNavbar />

      <div style={{ paddingTop: '64px' }}>

        {/* ───────── HERO ───────── */}
        <section className="relative overflow-hidden">
          {/* Background image with dark overlay — matches site Hero */}
          <div className="absolute inset-0 z-0">
            <picture>
              <source srcSet="/delhi-university.webp" type="image/webp" />
              <img
                src="/Delhi University.png"
                alt="University of Delhi"
                className="h-full w-full object-cover object-center"
                style={{ filter: 'brightness(0.38)' }}
              />
            </picture>
          </div>
          <div
            className="absolute inset-0 z-[1]"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.55) 55%, rgba(255,249,237,1) 100%)' }}
          />

          <div className="relative z-10 mx-auto max-w-4xl px-4 py-12 text-center sm:py-20">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm sm:px-4 sm:py-2 sm:text-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
              Most Accurate
              <span className="h-3 w-px bg-white/30" />
              Made by DU Alumni
            </div>

            <h1
              className="mb-4 font-bold tracking-tight text-white"
              style={{ fontFamily: SERIF, fontSize: 'clamp(2rem, 8vw, 4.2rem)', lineHeight: 1.12 }}
            >
              CUET College<br />
              <span style={{ fontFamily: SANS, fontWeight: 800, color: '#F5A623' }}>Predictor</span>
            </h1>

            <p
              className="mx-auto mb-2 max-w-2xl px-2 leading-relaxed text-white/80"
              style={{ fontSize: 'clamp(0.875rem, 3vw, 1.2rem)', fontFamily: "'DM Sans','Inter',sans-serif" }}
            >
              Enter your CUET score and category to instantly see every Delhi University college
              within your reach — ranked by your real chances of admission.
            </p>

            <div className="mt-7 flex items-center justify-center gap-5 text-white/90 sm:mt-9 sm:gap-10">
              {[
                { n: '90+', l: 'DU Colleges' },
                { n: '1,500+', l: 'Programs' },
                { n: 'Instant', l: 'Results' },
              ].map((s, i) => (
                <React.Fragment key={s.l}>
                  {i > 0 && <div className="h-7 w-px bg-white/20" />}
                  <div className="text-center">
                    <div className="text-xl font-extrabold sm:text-2xl" style={{ fontFamily: SANS }}>{s.n}</div>
                    <div className="mt-0.5 text-[10px] text-white/60 sm:text-xs">{s.l}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── PREDICTOR FORM ───────── */}
        <section className="relative z-10 px-3 pb-14 -mt-4 sm:px-4 sm:pb-16 sm:-mt-6">
          <div className="mx-auto max-w-2xl">
            <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-xl shadow-amber-900/5 sm:rounded-3xl sm:p-9">
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold text-black" style={{ fontFamily: SANS }}>Check Your Chances</h2>
                <p className="mt-1 text-sm text-neutral-500">Takes 20 seconds · 100% free</p>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                  {/* Name */}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-neutral-700">Full Name</label>
                    <input
                      type="text"
                      placeholder="Rahul Sharma"
                      value={form.name}
                      onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: '' })); }}
                      className={`w-full rounded-xl border bg-amber-50/40 px-4 py-3 text-sm text-black outline-none transition-all focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200 ${errors.name ? 'border-rose-300 bg-rose-50' : 'border-neutral-200'}`}
                    />
                    {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
                  </div>

                  {/* Mobile */}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-neutral-700">Mobile Number</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-neutral-400">+91</span>
                      <input
                        type="tel"
                        placeholder="98765 43210"
                        value={form.mobile}
                        onChange={e => { setForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })); setErrors(er => ({ ...er, mobile: '' })); }}
                        className={`w-full rounded-xl border bg-amber-50/40 py-3 pl-12 pr-4 text-sm text-black outline-none transition-all focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200 ${errors.mobile ? 'border-rose-300 bg-rose-50' : 'border-neutral-200'}`}
                      />
                    </div>
                    {errors.mobile && <p className="mt-1 text-xs text-rose-500">{errors.mobile}</p>}
                  </div>

                  {/* Score */}
                  <div className="sm:col-span-2">
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="block text-sm font-semibold text-neutral-700">CUET Score</label>
                      <span className="text-xs text-neutral-400">out of 1000</span>
                    </div>
                    <input
                      type="number"
                      placeholder="720"
                      min={0}
                      max={1000}
                      value={form.score}
                      onChange={e => { setForm(f => ({ ...f, score: e.target.value })); setErrors(er => ({ ...er, score: '' })); }}
                      className={`w-full rounded-xl border bg-amber-50/40 px-4 py-3 text-2xl font-bold text-black outline-none transition-all focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-200 ${errors.score ? 'border-rose-300 bg-rose-50' : 'border-neutral-200'}`}
                    />
                    {errors.score && <p className="mt-1 text-xs text-rose-500">{errors.score}</p>}
                  </div>

                  {/* Category pills */}
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-neutral-700">Category</label>
                    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
                      {CATEGORIES.map(c => {
                        const active = form.category === c.value;
                        return (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => { setForm(f => ({ ...f, category: c.value })); setErrors(er => ({ ...er, category: '' })); }}
                            className={`flex flex-col items-center justify-center rounded-xl border px-2 py-2.5 text-center transition-all ${
                              active
                                ? 'border-amber-400 bg-amber-100 shadow-sm'
                                : 'border-neutral-200 bg-white hover:border-amber-200 hover:bg-amber-50'
                            }`}
                          >
                            <span className={`text-sm font-bold ${active ? 'text-amber-700' : 'text-neutral-700'}`}>{c.label}</span>
                            {c.sub && <span className={`text-[10px] ${active ? 'text-amber-600' : 'text-neutral-400'}`}>{c.sub}</span>}
                          </button>
                        );
                      })}
                    </div>
                    {errors.category && <p className="mt-2 text-xs text-rose-500">{errors.category}</p>}
                  </div>

                  {/* Gender */}
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-neutral-700">Gender</label>
                    <div className="flex gap-3">
                      {[
                        { value: 'M', label: 'Male', icon: '♂' },
                        { value: 'F', label: 'Female', icon: '♀' },
                      ].map(g => {
                        const active = form.gender === g.value;
                        return (
                          <button
                            key={g.value}
                            type="button"
                            onClick={() => { setForm(f => ({ ...f, gender: g.value })); setErrors(er => ({ ...er, gender: '' })); }}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-all ${
                              active
                                ? 'border-amber-400 bg-amber-100 text-amber-700 shadow-sm'
                                : 'border-neutral-200 bg-white text-neutral-600 hover:border-amber-200 hover:bg-amber-50'
                            }`}
                          >
                            <span className="text-base">{g.icon}</span>
                            {g.label}
                          </button>
                        );
                      })}
                    </div>
                    {errors.gender && <p className="mt-1 text-xs text-rose-500">{errors.gender}</p>}
                    {form.gender === 'M' && (
                      <p className="mt-1.5 text-xs text-neutral-400">Women-only colleges will be excluded from your results</p>
                    )}
                  </div>

                  {/* College filter */}
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-semibold text-neutral-700">
                      College <span className="font-normal text-neutral-400">(optional)</span>
                    </label>
                    <Combobox
                      options={DU_COLLEGES}
                      value={form.college}
                      onChange={v => setForm(f => ({ ...f, college: v, course: '' }))}
                      placeholder="Search college name…"
                    />
                  </div>

                  {/* Course filter */}
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-semibold text-neutral-700">
                      Course <span className="font-normal text-neutral-400">(optional)</span>
                    </label>
                    <Combobox
                      options={DU_PROGRAMS}
                      value={form.course}
                      onChange={v => setForm(f => ({ ...f, course: v }))}
                      placeholder="Search course or program…"
                    />
                  </div>
                </div>

                {submitError && (
                  <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{submitError}</div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="group mt-7 flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-bold transition-all duration-300 disabled:opacity-70"
                  style={{ background: '#F5A623', color: '#000', boxShadow: '0 4px 24px rgba(245,166,35,0.35)' }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#e09515'; }}
                  onMouseLeave={e => (e.currentTarget.style.background = '#F5A623')}
                >
                  {loading ? (
                    <>
                      <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-black/30 border-t-black" />
                      Analysing your chances…
                    </>
                  ) : (
                    <>
                      Predict My Colleges
                      <svg className="h-5 w-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>

                <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-neutral-400">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Based on official DU Round 1 cutoffs · Indicative only
                </p>
              </form>
            </div>
          </div>
        </section>

        <div id="results-anchor" className="scroll-mt-24" />

        {/* ───────── RESULTS ───────── */}
        {results !== null && (
          <section className="px-3 pb-16 sm:px-4 sm:pb-24">
            <div className="mx-auto max-w-4xl">
              {results.length === 0 ? (
                <div className="mx-auto max-w-md rounded-3xl border border-amber-100 bg-white p-10 text-center shadow-lg">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-3xl">🔍</div>
                  <h3 className="text-xl font-bold text-black" style={{ fontFamily: SANS }}>No colleges found</h3>
                  <p className="mt-2 text-sm text-neutral-500">
                    Your score didn't clear the Round 1 cutoffs in this category. Try a different category, or watch for later rounds with relaxed cutoffs.
                  </p>
                  <button onClick={resetForm} className="mt-6 rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-amber-50">
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-6 text-center sm:mb-8">
                    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-amber-600">Your Results</p>
                    <h2 className="text-2xl font-bold text-black sm:text-4xl" style={{ fontFamily: SERIF }}>
                      You have a shot at {results.length} programs
                    </h2>
                    <p className="mt-2 text-sm text-neutral-500">
                      Score <span className="font-bold text-black">{submittedMeta.score}</span> · {CATEGORIES.find(c => c.value === submittedMeta.category)?.label} category
                    </p>
                  </div>

                  {/* Summary cards */}
                  <div className="mx-auto mb-6 grid max-w-2xl grid-cols-3 gap-2 sm:mb-8 sm:gap-4">
                    {(['High', 'Medium', 'Low'] as const).map(key => {
                      const cfg = CHANCE_CONFIG[key];
                      return (
                        <button
                          key={key}
                          onClick={() => setActiveChance(activeChance === key ? 'all' : key)}
                          className={`relative overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:shadow-md ${
                            activeChance === key ? 'border-amber-400 ring-2 ring-amber-200' : 'border-neutral-100'
                          }`}
                        >
                          <div className={`absolute left-0 top-0 h-full w-1 ${cfg.bar}`} />
                          <div className="pl-1 text-2xl font-black text-black sm:text-3xl">{counts[key]}</div>
                          <div className={`pl-1 text-[10px] font-semibold sm:text-xs ${cfg.text}`}>{cfg.label}</div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Chance filter tabs */}
                  <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
                    {(['all', 'High', 'Medium', 'Low'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveChance(tab)}
                        className={`flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                          activeChance === tab
                            ? 'bg-black text-white'
                            : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-amber-50'
                        }`}
                      >
                        {tab === 'all'
                          ? (isSearchMode ? 'All' : `All (${counts.all})`)
                          : (isSearchMode ? CHANCE_CONFIG[tab].label : `${CHANCE_CONFIG[tab].label} (${counts[tab]})`)}
                      </button>
                    ))}
                  </div>

                  {/* Search-mode banner */}
                  {isSearchMode && (
                    <p className="mb-4 text-center text-xs text-neutral-500">
                      {searching
                        ? 'Searching all DU colleges…'
                        : `Showing ${displayed.length} college${displayed.length !== 1 ? 's' : ''} matching "${search.trim()}" across all DU programs`}
                    </p>
                  )}

                  {/* College cards */}
                  {searching ? (
                    <div className="flex justify-center py-12">
                      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-amber-400 border-t-transparent" />
                    </div>
                  ) : displayed.length === 0 ? (
                    <div className="py-12 text-center text-sm text-neutral-400">
                      {isSearchMode ? `No DU colleges match "${search.trim()}".` : 'No colleges match your filter.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
                      {displayed.map((college, i) => {
                        const cfg = cfgFor(college.chance);
                        const hasScore = submittedMeta.score !== '';
                        const margin = Number(submittedMeta.score) - college.cutoffScore;
                        return (
                          <div
                            key={i}
                            className={`relative overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md sm:rounded-2xl sm:p-5 ${cfg.card}`}
                          >
                            <div className={`absolute left-0 top-0 h-full w-1 ${cfg.bar}`} />
                            <div className="flex items-start justify-between gap-2 pl-2">
                              <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-bold leading-snug text-black break-words">{college.college_name}</h3>
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                  <span className="text-neutral-500">
                                    Cutoff <span className="font-bold text-neutral-800">{college.cutoffScore.toFixed(1)}</span>
                                  </span>
                                  {hasScore && (
                                    <>
                                      <span className="h-3 w-px bg-neutral-200" />
                                      <span className={margin >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-500'}>
                                        {margin >= 0 ? '+' : ''}{margin.toFixed(1)} margin
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold sm:px-2.5 sm:py-1 sm:text-[11px] ${cfg.badge}`}>
                                {cfg.pill}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-12 text-center">
                    <button onClick={resetForm} className="rounded-xl border border-neutral-200 bg-white px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-amber-50">
                      ↻ Check another score
                    </button>
                    <p className="mt-5 text-xs text-neutral-400">
                      <span className="font-semibold text-emerald-600">High</span> = score ≥ cutoff + 10 ·{' '}
                      <span className="font-semibold text-amber-600">Good</span> = score ≥ cutoff ·{' '}
                      <span className="font-semibold text-rose-500">Reach</span> = within 15 pts below cutoff
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>
        )}
      </div>

      <style>{`
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>
    </div>
  );
};

export default CuetPredictorPage;
