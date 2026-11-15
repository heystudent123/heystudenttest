import React from 'react';
import { X } from 'lucide-react';

export interface PlanInfoBundle {
  _id: string;
  title: string;
  description: string;
  mockTests: { _id: string; title: string; subject?: string; durationMinutes?: number; questionCount?: number }[];
}

export interface PlanInfoCard {
  _id: string;
  title: string;
  description: string;
  price: number;
  hasAccess: boolean;
  testCount?: number;
  bundles: PlanInfoBundle[];
}

interface Props {
  plan: PlanInfoCard;
  onClose: () => void;
  onBuy?: () => void;
  buying?: boolean;
  checkoutAvailable?: boolean;
}

const PlanBundleInfoModal: React.FC<Props> = ({
  plan,
  onClose,
  onBuy,
  buying = false,
  checkoutAvailable = true,
}) => {
  const tests = plan.bundles.flatMap((bundle) => bundle.mockTests);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4 py-8"
      style={{ textAlign: 'left' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#101828]"
        >
          <X size={18} />
        </button>

        <h2 className="pr-8 text-left text-[18px] font-extrabold text-[#101828]">{plan.title}</h2>
        {plan.description && (
          <p className="mt-2 text-left text-[14px] leading-relaxed text-[#64748B]">{plan.description}</p>
        )}
        <p className="mt-3 text-left text-[20px] font-extrabold text-[#101828]">
          ₹{plan.price.toLocaleString('en-IN')}
        </p>

        <div className="mt-5 border-t border-[#EEF1F6] pt-4">
          <p className="text-left text-[13px] font-bold uppercase tracking-[0.04em] text-[#101828]">
            Includes
          </p>
          {plan.bundles.map((bundle) => (
            <div key={bundle._id} className="mt-3 text-left">
              <p className="text-[14px] font-bold text-[#101828]">{bundle.title}</p>
              {bundle.description && (
                <p className="mt-0.5 text-[13px] text-[#64748B]">{bundle.description}</p>
              )}
              <ul className="mt-2 list-none space-y-1.5 p-0">
                {bundle.mockTests.map((test) => (
                  <li key={test._id} className="text-[14px] font-bold text-[#101828]">
                    {test.title}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {tests.length === 0 && (
            <p className="mt-2 text-[13px] text-[#64748B]">No mock tests listed in this plan yet.</p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {!plan.hasAccess && onBuy && (
            <button
              type="button"
              disabled={buying || !checkoutAvailable}
              onClick={onBuy}
              className="rounded-md bg-[#111827] px-5 py-2.5 text-[14px] font-semibold text-white disabled:bg-[#D0D5DD]"
            >
              {buying ? 'Opening…' : 'Buy plan'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#E4E7EC] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#344054]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanBundleInfoModal;
