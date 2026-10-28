import React, { useEffect, useState } from 'react';
import {
  CheckCircle2, Copy, CreditCard, Mail, MapPin, Phone, Save, School, ShieldCheck, Users, User as UserIcon,
} from 'lucide-react';
import { authApi, paymentsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import DashboardPageHeader from '../../components/dashboard/DashboardPageHeader';

interface PaymentRow {
  _id: string;
  amountInRupees: number;
  amount: number;
  currency: string;
  status: string;
  purpose: string;
  purposeTitle: string | null;
  paidAt: string | null;
  createdAt: string;
}

const STATUS_CHIP: Record<string, string> = {
  paid: 'bg-[#E7F8EF] text-[#1F9D55]',
  created: 'bg-[#F1F5F9] text-[#64748B]',
  attempted: 'bg-[#FFF1E8] text-[#E07A1F]',
  failed: 'bg-[#FEF2F2] text-[#DC2626]',
  refunded: 'bg-[#EEF0FF] text-[#6B7CFF]',
  partially_refunded: 'bg-[#EEF0FF] text-[#6B7CFF]',
};

const DashboardProfilePage: React.FC = () => {
  const { user, updateUserProfile } = useAuth();

  const [form, setForm] = useState({ name: '', phone: '', city: '', whatsapp: '', college: '', course: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

  const [referralCode, setReferralCode] = useState('');
  const [referralCount, setReferralCount] = useState<number | null>(null);
  const [rewardPerUse, setRewardPerUse] = useState(0);
  const [pendingDiscount, setPendingDiscount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [referralLoading, setReferralLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || '',
      phone: user.phone || '',
      city: user.city || '',
      whatsapp: user.whatsapp || '',
      college: user.college || '',
      course: (user as any).course || '',
    });
  }, [user]);

  useEffect(() => {
    paymentsApi.getMyPayments({ limit: 20 })
      .then((res) => setPayments(res.data || []))
      .catch(() => setPayments([]))
      .finally(() => setPaymentsLoading(false));
  }, []);

  useEffect(() => {
    authApi.getMyReferralCode().catch(() => null).then((codeRes) => {
      setReferralCode(codeRes?.data?.referralCode || '');
      setRewardPerUse(Number(codeRes?.data?.rewardPerUse) || 0);
      setPendingDiscount(Number(codeRes?.data?.pendingDiscount) || 0);
      setPendingCount(Number(codeRes?.data?.pendingCount) || 0);
      setReferralCount(typeof codeRes?.data?.referralsCount === 'number' ? codeRes.data.referralsCount : null);
      setReferralLoading(false);
    });
  }, []);

  const copyReferralCode = () => {
    if (!referralCode) return;
    navigator.clipboard?.writeText(referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setError('');
    if (!form.name.trim()) { setError('Full name is required.'); return; }
    setSaving(true);
    try {
      await updateUserProfile({
        name: form.name.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        whatsapp: form.whatsapp.trim(),
        college: form.college.trim(),
      } as any);
      setSaved(true);
    } catch {
      setError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const fields: { key: keyof typeof form; label: string; icon: typeof UserIcon; placeholder: string }[] = [
    { key: 'name', label: 'Full Name', icon: UserIcon, placeholder: 'Your full name' },
    { key: 'phone', label: 'Phone', icon: Phone, placeholder: '10-digit mobile number' },
    { key: 'whatsapp', label: 'WhatsApp Number', icon: Phone, placeholder: '10-digit WhatsApp number' },
    { key: 'city', label: 'City', icon: MapPin, placeholder: 'e.g. Delhi, Mumbai' },
    { key: 'college', label: 'College', icon: School, placeholder: 'Your college (optional)' },
  ];

  return (
    <div>
      <DashboardPageHeader
        eyebrow="Account"
        title="Profile"
        description="Manage your personal details and view your purchase history."
      />

      <div className="grid grid-cols-1 gap-6 px-6 py-7 lg:grid-cols-3 lg:px-10">
        {/* Profile form */}
        <div className="lg:col-span-2 rounded-2xl border border-[#E8EDF4] bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-extrabold text-[#101828]">Personal details</h2>
            {user?.role && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF1FF] px-2.5 py-1 text-[11px] font-bold capitalize text-[#3267f5]">
                <ShieldCheck size={11} /> {user.role}
              </span>
            )}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-[#344054]">
                  <f.icon size={13} className="text-[#94A3B8]" /> {f.label}
                </label>
                <input
                  type="text"
                  value={form[f.key]}
                  onChange={handleChange(f.key)}
                  placeholder={f.placeholder}
                  className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
                />
              </div>
            ))}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-[#344054]">
                <Mail size={13} className="text-[#94A3B8]" /> Email
              </label>
              <input
                type="text"
                value={user?.email || ''}
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-[#E8EDF4] bg-[#F7F9FC] px-3.5 py-2.5 text-[14px] text-[#94A3B8]"
              />
            </div>
          </div>

          {error && <p className="mt-4 text-[13px] text-red-500">{error}</p>}

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#1F2937] disabled:opacity-60"
            >
              <Save size={14} /> {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1F9D55]">
                <CheckCircle2 size={14} /> Saved
              </span>
            )}
          </div>
        </div>

        {/* Referral card */}
        <div className="rounded-2xl border border-[#E8EDF4] bg-white p-6">
          <h2 className="text-[16px] font-extrabold text-[#101828]">Your referral code</h2>
          <p className="mt-1.5 text-[13px] text-[#64748B]">
            {rewardPerUse > 0
              ? `Share this code. Each purchase that uses it gives you ${rewardPerUse}% off your next purchase.`
              : 'Share this code. When someone uses it on a purchase, that use is counted here.'}
          </p>
          {pendingDiscount > 0 && (
            <p className="mt-3 rounded-lg bg-[#E7F8EF] px-3.5 py-2.5 text-[13px] font-semibold text-[#1F9D55]">
              {pendingDiscount}% comes off your next purchase
              {pendingCount > 1 ? `. ${pendingCount} rewards are waiting, and each purchase uses one.` : '.'}
            </p>
          )}

          {referralLoading ? (
            <div className="mt-4 flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-[#111827] border-t-transparent" />
            </div>
          ) : (
            <>
              <button
                onClick={copyReferralCode}
                disabled={!referralCode}
                className="mt-4 flex w-full items-center justify-between gap-2 rounded-xl bg-[#F7F9FC] px-4 py-3 text-left transition-colors hover:bg-[#EEF1FF] disabled:cursor-default disabled:hover:bg-[#F7F9FC]"
              >
                <p className="font-mono text-[18px] font-bold tracking-wider text-[#101828]">
                  {referralCode || '—'}
                </p>
                {referralCode && (
                  <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#3267f5]">
                    <Copy size={13} /> {copied ? 'Copied' : 'Copy'}
                  </span>
                )}
              </button>

              <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-[#E8EDF4] px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E7F8EF] text-[#1F9D55]">
                  <Users size={15} />
                </span>
                <div>
                  <p className="text-[18px] font-extrabold leading-none text-[#101828]">{referralCount ?? 0}</p>
                  <p className="mt-0.5 text-[12px] text-[#64748B]">{referralCount === 1 ? 'person has' : 'people have'} used your code</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Purchase history */}
      <div className="px-6 pb-10 lg:px-10">
        <div className="rounded-2xl border border-[#E8EDF4] bg-white p-6">
          <div className="flex items-center gap-2">
            <CreditCard size={17} className="text-[#6B7CFF]" />
            <h2 className="text-[16px] font-extrabold text-[#101828]">Purchase history</h2>
          </div>

          {paymentsLoading ? (
            <div className="flex justify-center py-10">
              <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#111827] border-t-transparent" />
            </div>
          ) : payments.length === 0 ? (
            <p className="mt-4 py-6 text-center text-[13.5px] text-[#64748B]">No purchases yet.</p>
          ) : (
            <>
              {/* Stacked cards on narrow screens — the app shell clips horizontal
                  overflow globally, so a scrollable table isn't reachable below `sm`. */}
              <div className="mt-4 space-y-3 sm:hidden">
                {payments.map((p) => (
                  <div key={p._id} className="rounded-xl border border-[#E8EDF4] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[14px] font-semibold text-[#101828]">{p.purposeTitle || p.purpose.replace(/_/g, ' ')}</p>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${STATUS_CHIP[p.status] || 'bg-[#F1F5F9] text-[#64748B]'}`}>
                        {p.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[13px]">
                      <span className="text-[#94A3B8]">
                        {new Date(p.paidAt || p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="font-semibold text-[#101828]">₹{(p.amountInRupees ?? p.amount / 100).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ))}
              </div>

              <table className="mt-4 hidden w-full text-left text-[13.5px] sm:table">
                <thead>
                  <tr className="border-b border-[#E8EDF4] text-[11.5px] font-bold uppercase tracking-[1px] text-[#94A3B8]">
                    <th className="py-2.5 pr-4">Item</th>
                    <th className="py-2.5 pr-4">Date</th>
                    <th className="py-2.5 pr-4">Amount</th>
                    <th className="py-2.5 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p._id} className="border-b border-[#F1F5F9] last:border-0">
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-[#101828]">{p.purposeTitle || p.purpose.replace(/_/g, ' ')}</p>
                      </td>
                      <td className="py-3 pr-4 text-[#64748B]">
                        {new Date(p.paidAt || p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 pr-4 font-semibold text-[#101828]">
                        ₹{(p.amountInRupees ?? p.amount / 100).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-bold capitalize ${STATUS_CHIP[p.status] || 'bg-[#F1F5F9] text-[#64748B]'}`}>
                          {p.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardProfilePage;
