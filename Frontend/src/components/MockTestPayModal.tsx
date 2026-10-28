import React, { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import PaymentStage, { PaymentPhase, PaymentReceipt } from './PaymentStage';

export interface PayOffer {
  _id: string;
  title: string;
  price: number;
  testCount: number;
  courseCount: number;
}

export interface PayTest {
  _id: string;
  title: string;
  subject?: string;
  description?: string;
  durationMinutes: number;
  maxMarks: number;
  questionCount: number;
  price: number;
  attemptLimit: number;
  offers?: PayOffer[];
}

interface Props {
  test: PayTest;
  referralCode: string;
  couponCode: string;
  onReferralCode: (value: string) => void;
  onCouponCode: (value: string) => void;
  buying: boolean;
  checkoutAvailable: boolean;
  error: string;
  phase: PaymentPhase;
  receipt: PaymentReceipt;
  onClose: () => void;
  onBack: () => void;
  onContinue: () => void;
  onBuy: (purpose: 'plan' | 'mock_test', id: string, title: string) => void;
}

function rupees(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function included(test: PayTest, offer: PayOffer | null) {
  if (offer) {
    const lines = [`${offer.testCount} mock ${offer.testCount === 1 ? 'test' : 'tests'}`];
    if (offer.courseCount > 0) lines.push(`${offer.courseCount} ${offer.courseCount === 1 ? 'course' : 'courses'}`);
    lines.push(`Includes ${test.title}`);
    return lines;
  }
  const lines = [];
  if (test.subject) lines.push(`${test.subject} paper`);
  if (test.questionCount > 0) lines.push(`${test.questionCount} questions`);
  if (test.durationMinutes > 0) lines.push(`${test.durationMinutes} minutes`);
  if (test.maxMarks > 0) lines.push(`${test.maxMarks} marks`);
  lines.push(test.attemptLimit > 0 ? `${test.attemptLimit} ${test.attemptLimit === 1 ? 'attempt' : 'attempts'}` : 'Unlimited attempts');
  return lines;
}

const MockTestPayModal: React.FC<Props> = ({
  test, referralCode, couponCode, onReferralCode, onCouponCode,
  buying, checkoutAvailable, error, phase, receipt, onClose, onBack, onContinue, onBuy,
}) => {
  const [choice, setChoice] = useState('test');
  const offers = test.offers || [];
  const offer = offers.find((item) => item._id === choice) || null;
  const title = offer ? offer.title : test.title;
  const price = offer ? offer.price : test.price;
  const lines = included(test, offer);

  useEffect(() => { setChoice('test'); }, [test._id]);

  const pay = () => {
    if (offer) onBuy('plan', offer._id, offer.title);
    else onBuy('mock_test', test._id, test.title);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4 py-8" onClick={(e) => { if (e.target === e.currentTarget && phase === 'review') onClose(); }}>
      <section className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white text-left shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[#E8EDF4] px-6 py-5">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[1.6px] text-[#94A3B8]">Checkout</p>
            <h2 className="mt-1 pr-6 text-[20px] font-extrabold text-[#101828]">{phase === 'review' ? title : receipt.title || title}</h2>
          </div>
          {phase !== 'processing' && (
            <button type="button" onClick={phase === 'review' ? onClose : phase === 'paid' ? onContinue : onBack} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#94A3B8] transition-colors hover:bg-[#F1F5F9] hover:text-[#101828]">
              <X size={18} />
            </button>
          )}
        </header>

        {phase !== 'review' ? (
          <PaymentStage phase={phase} receipt={{ ...receipt, title: receipt.title || title, amount: receipt.amount || price }} onRetry={pay} onBack={phase === 'paid' ? onContinue : onBack} onContinue={onContinue} />
        ) : (
        <>
        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-2">
          <div className="px-6 py-5">
            <p className="text-[12px] font-bold uppercase tracking-[1.6px] text-[#94A3B8]">Billing</p>
            <div className="mt-3 space-y-2">
              <button type="button" onClick={() => setChoice('test')} className={`w-full rounded-xl border px-3.5 py-3 text-left ${choice === 'test' ? 'border-[#111827] bg-white' : 'border-[#E8EDF4] bg-white hover:border-[#C9D2E3]'}`}>
                <span className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-semibold text-[#101828]">This mock test</span>
                  <span className="text-[14px] font-bold text-[#101828]">{rupees(test.price)}</span>
                </span>
                <span className="mt-0.5 block text-[12.5px] text-[#64748B]">{test.title}</span>
              </button>
              {offers.map((item) => (
                <button key={item._id} type="button" onClick={() => setChoice(item._id)} className={`w-full rounded-xl border px-3.5 py-3 text-left ${choice === item._id ? 'border-[#111827] bg-white' : 'border-[#E8EDF4] bg-white hover:border-[#C9D2E3]'}`}>
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-[14px] font-semibold text-[#101828]">{item.title}</span>
                    <span className="text-[14px] font-bold text-[#101828]">{rupees(item.price)}</span>
                  </span>
                  <span className="mt-0.5 block text-[12.5px] text-[#64748B]">{item.testCount} mock tests · {item.courseCount} courses</span>
                </button>
              ))}
            </div>

            <p className="mt-5 text-[12px] font-bold uppercase tracking-[1.6px] text-[#94A3B8]">Included</p>
            <ul className="mt-3 space-y-2">
              {lines.map((line) => (
                <li key={line} className="flex items-start gap-2 text-[14px] text-[#344054]">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E7F8EF] text-[#1F9D55]"><Check size={11} strokeWidth={3} /></span>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-[#E8EDF4] bg-[#F7F9FC] px-6 py-5 md:border-l md:border-t-0">
            <p className="text-[12px] font-bold uppercase tracking-[1.6px] text-[#94A3B8]">Codes</p>
            <label className="mt-3 block text-[13px] font-semibold text-[#344054]">
              Referral code <span className="font-normal text-[#94A3B8]">(optional)</span>
              <input
                value={referralCode}
                onChange={(e) => onReferralCode(e.target.value.toUpperCase())}
                placeholder="Student or institute code"
                className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] bg-white px-3.5 py-2.5 font-mono text-[14px] uppercase focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
              />
            </label>
            <label className="mt-4 block text-[13px] font-semibold text-[#344054]">
              Coupon code <span className="font-normal text-[#94A3B8]">(optional)</span>
              <input
                value={couponCode}
                onChange={(e) => onCouponCode(e.target.value.toUpperCase())}
                placeholder="Coupon"
                className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] bg-white px-3.5 py-2.5 font-mono text-[14px] uppercase focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
              />
            </label>
            <p className="mt-4 text-[12.5px] leading-relaxed text-[#64748B]">
              A valid code is taken off this total when payment opens. An invalid code stops checkout.
            </p>
          </div>
        </div>

        <footer className="border-t border-[#E8EDF4] px-6 py-4">
          {error && <p role="alert" className="mb-3 rounded-lg border border-[#F3D0D0] bg-[#FFF6F6] px-3 py-2.5 text-[13.5px] leading-relaxed text-[#B42318]">{error}</p>}
          {!checkoutAvailable && (
            <p className="mb-3 text-[13px] leading-relaxed text-[#64748B]">Checkout is not configured on the server yet. A verified payment is still required before this test can be attempted.</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[1.2px] text-[#94A3B8]">Total</p>
              <p className="text-[22px] font-extrabold leading-none text-[#101828]">{rupees(price)}</p>
            </div>
            <button type="button" disabled={buying || !checkoutAvailable || price <= 0} onClick={pay} className="rounded-lg bg-[#111827] px-5 py-2.5 text-[14px] font-semibold text-white disabled:bg-[#D0D5DD]">
              {buying ? 'Opening…' : `Pay ${rupees(price)}`}
            </button>
          </div>
        </footer>
        </>
        )}
      </section>
    </div>
  );
};

export default MockTestPayModal;
