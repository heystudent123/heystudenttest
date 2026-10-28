import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { CheckCircle2, Instagram, Mail, Phone } from 'lucide-react';
import SharedNavbar from '../components/SharedNavbar';
import { contactApi } from '../services/api';
import { CONTACT_PHONE_DISPLAY } from '../config';

function errorMessage(err: any, fallback: string) {
  return err?.response?.data?.error || err?.response?.data?.message || fallback;
}

const ContactPage: React.FC = () => {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      await contactApi.send(form);
      setSubmitted(true);
      setForm({ name: '', email: '', phone: '', message: '' });
      setTimeout(() => setSubmitted(false), 6000);
    } catch (err) {
      setError(errorMessage(err, 'Your message could not be sent. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="hs-page min-h-screen bg-white">
      <Helmet>
        <title>Contact HeyStudent</title>
        <meta name="description" content="Have a doubt about CUET prep, mock tests, or a course? Send HeyStudent a message and we'll get back to you." />
        <link rel="canonical" href="https://heystudent.in/contact" />
      </Helmet>
      <SharedNavbar />

      <main className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-[12px] font-bold uppercase tracking-[2px] text-[#3267f5]">Get in touch</p>
          <h1 className="mt-3 text-[32px] font-extrabold tracking-[-0.02em] text-[#101828] sm:text-[38px]">
            Have a doubt? Ask us anything.
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#64748B]">
            Fill the form and our team will get back to you — or reach out directly using the details below.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.4fr]">
          {/* ── Get in touch (real details only) ── */}
          <div className="rounded-[22px] border border-[#E8EDF4] bg-[#F7F9FC] p-6 sm:p-7">
            <h2 className="text-[16px] font-bold text-[#101828]">Reach us directly</h2>
            <div className="mt-5 space-y-4">
              <a href={`tel:${CONTACT_PHONE_DISPLAY.replace(/\s+/g, '')}`} className="flex items-center gap-3 rounded-xl bg-white p-3.5 transition-colors hover:bg-[#EEF1FF]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF1FF] text-[#3267f5]"><Phone size={17} /></span>
                <div>
                  <p className="text-[12px] font-semibold text-[#94A3B8]">Phone</p>
                  <p className="text-[14px] font-semibold text-[#101828]">{CONTACT_PHONE_DISPLAY}</p>
                </div>
              </a>
              <a href="mailto:heystudentyt@gmail.com" className="flex items-center gap-3 rounded-xl bg-white p-3.5 transition-colors hover:bg-[#EEF1FF]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF1FF] text-[#3267f5]"><Mail size={17} /></span>
                <div>
                  <p className="text-[12px] font-semibold text-[#94A3B8]">Email</p>
                  <p className="text-[14px] font-semibold text-[#101828]">heystudentyt@gmail.com</p>
                </div>
              </a>
              <a href="https://www.instagram.com/heystudent.ig" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl bg-white p-3.5 transition-colors hover:bg-[#EEF1FF]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF1FF] text-[#3267f5]"><Instagram size={17} /></span>
                <div>
                  <p className="text-[12px] font-semibold text-[#94A3B8]">Instagram</p>
                  <p className="text-[14px] font-semibold text-[#101828]">@heystudent.ig</p>
                </div>
              </a>
            </div>
            <p className="mt-5 text-[12.5px] leading-relaxed text-[#94A3B8]">
              Prefer chatting right away? Use the WhatsApp button in the corner of your screen.
            </p>
          </div>

          {/* ── Contact form ── */}
          <div className="rounded-[22px] border border-[#E8EDF4] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-7">
            <h2 className="text-[16px] font-bold text-[#101828]">Send us a message</h2>

            {submitted && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#E7F8EF] px-4 py-3 text-[13.5px] font-semibold text-[#1F9D55]">
                <CheckCircle2 size={16} /> Thanks! We've received your message and will get back to you soon.
              </div>
            )}
            {error && (
              <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] text-red-700">{error}</p>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Full name</label>
                  <input
                    id="name" name="name" type="text" required
                    value={form.name} onChange={handleChange}
                    className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] outline-none focus:border-[#3267f5] focus:ring-1 focus:ring-[#3267f5]"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Email</label>
                  <input
                    id="email" name="email" type="email" required
                    value={form.email} onChange={handleChange}
                    className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] outline-none focus:border-[#3267f5] focus:ring-1 focus:ring-[#3267f5]"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="phone" className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Phone (optional)</label>
                <input
                  id="phone" name="phone" type="tel"
                  value={form.phone} onChange={handleChange}
                  className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] outline-none focus:border-[#3267f5] focus:ring-1 focus:ring-[#3267f5]"
                />
              </div>
              <div>
                <label htmlFor="message" className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Your doubt or question</label>
                <textarea
                  id="message" name="message" rows={5} required
                  value={form.message} onChange={handleChange}
                  placeholder="Tell us what's on your mind — a course question, a mock test issue, anything."
                  className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] outline-none focus:border-[#3267f5] focus:ring-1 focus:ring-[#3267f5]"
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="w-full rounded-lg bg-[#111827] py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#1F2937] disabled:opacity-60"
              >
                {sending ? 'Sending…' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ContactPage;
