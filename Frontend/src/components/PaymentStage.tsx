import React from 'react';
import { CheckCircle2, Loader2, RotateCcw, XCircle } from 'lucide-react';

export type PaymentPhase = 'review' | 'processing' | 'failed' | 'paid';

export interface PaymentReceipt {
  title: string;
  amount: number;
  orderId: string;
  reason: string;
}

export const emptyReceipt: PaymentReceipt = { title: '', amount: 0, orderId: '', reason: '' };

function rupees(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
}

const PaymentStage: React.FC<{
  phase: Exclude<PaymentPhase, 'review'>;
  receipt: PaymentReceipt;
  onRetry?: () => void;
  onBack?: () => void;
  onContinue?: () => void;
}> = ({ phase, receipt, onRetry, onBack, onContinue }) => {
  const failed = phase === 'failed';
  const paid = phase === 'paid';
  const rows = [
    ['Item', receipt.title || '—'],
    ['Amount', rupees(receipt.amount)],
    ['Reference', receipt.orderId || 'Assigned when the order is created'],
    ['Status', failed ? 'Failed' : paid ? 'Paid' : 'In progress'],
  ];

  return (
    <div className="px-6 py-6 sm:px-8">
      <div className="flex items-start gap-3">
        {paid ? (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E7F8EF] text-[#1F9D55]"><CheckCircle2 size={22} /></span>
        ) : failed ? (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FDECEC] text-[#B42318]"><XCircle size={22} /></span>
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EEF3FF] text-[#3267f5]"><Loader2 size={22} className="animate-spin" /></span>
        )}
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[1.6px] text-[#94A3B8]">
            {paid ? 'Payment received' : failed ? 'Payment failed' : 'Payment in progress'}
          </p>
          <h3 className="mt-1 text-[20px] font-extrabold text-[#101828]">
            {paid ? 'This payment is confirmed' : failed ? 'This payment did not go through' : 'Finish payment in the secure window'}
          </h3>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[#475569]">
            {paid
              ? 'Razorpay confirmed the payment and this order is marked paid. Access is unlocked from this payment.'
              : failed
                ? (receipt.reason || 'The bank did not confirm this payment. The order is closed and you have not been charged for it.')
                : 'Razorpay is open for this order. Complete the payment there. If you close that window, this order is marked failed and you can start a new one from here.'}
          </p>
        </div>
      </div>

      <dl className="mt-6 divide-y divide-[#E8EDF4] rounded-xl border border-[#E8EDF4]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 px-4 py-3">
            <dt className="text-[13px] font-semibold text-[#64748B]">{label}</dt>
            <dd className="max-w-[70%] text-right text-[13.5px] font-semibold text-[#101828]">{value}</dd>
          </div>
        ))}
      </dl>

      {failed && (
        <p className="mt-4 text-[13px] leading-relaxed text-[#64748B]">
          Retry starts a new payment for the same item. The failed reference above stays closed. You are charged only if the new payment is confirmed.
        </p>
      )}

      {phase !== 'processing' && (
        <div className="mt-6 flex flex-wrap gap-2">
          {failed && onRetry && (
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-lg bg-[#111827] px-4 py-2.5 text-[14px] font-semibold text-white">
              <RotateCcw size={15} /> Retry payment
            </button>
          )}
          {paid && onContinue && (
            <button type="button" onClick={onContinue} className="rounded-lg bg-[#111827] px-4 py-2.5 text-[14px] font-semibold text-white">
              Continue
            </button>
          )}
          {onBack && (
            <button type="button" onClick={onBack} className="rounded-lg border border-[#D0D5DD] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#344054]">
              {paid ? 'Close' : 'Back to order'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PaymentStage;
