import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { authApi, coursesApi, mockTestsApi, plansApi } from '../../services/api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';

interface Person {
  _id: string;
  name: string;
  email: string;
  referralCode: string;
  paidCount: number;
}

interface UseRow {
  _id: string;
  buyerName: string;
  buyerEmail: string;
  purpose: string;
  title: string;
  amount: number;
  paidAt: string;
}

interface Product {
  _id: string;
  title: string;
}

interface Coupon {
  _id: string;
  code: string;
  discountType: 'percent' | 'flat';
  discountValue: number;
  courseIds: string[];
  planIds: string[];
  mockTestIds: string[];
  expiresAt: string;
  maxUsesPerUser: number;
  isActive: boolean;
}

const emptyCoupon = {
  code: '',
  discountType: 'percent' as 'percent' | 'flat',
  discountValue: '',
  courseIds: [] as string[],
  planIds: [] as string[],
  mockTestIds: [] as string[],
  expiresAt: '',
  maxUsesPerUser: '1',
  isActive: true,
};

function toLocalInput(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function message(err: any, fallback: string) {
  return err?.response?.data?.message || err?.response?.data?.error || fallback;
}

const PAGE_SIZE = 15;

const AdminReferralsPage: React.FC = () => {
  const [tab, setTab] = useState<'students' | 'institutes' | 'coupons'>('students');
  const [peoplePage, setPeoplePage] = useState(1);
  const [couponPage, setCouponPage] = useState(1);
  const [students, setStudents] = useState<Person[]>([]);
  const [institutes, setInstitutes] = useState<Person[]>([]);
  const [studentPercent, setStudentPercent] = useState('0');
  const [institutePercent, setInstitutePercent] = useState('0');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingRates, setSavingRates] = useState(false);
  const [detail, setDetail] = useState<{ name: string; uses: UseRow[] } | null>(null);
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({});
  const [savingCodeId, setSavingCodeId] = useState<string | null>(null);

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [courses, setCourses] = useState<Product[]>([]);
  const [plans, setPlans] = useState<Product[]>([]);
  const [tests, setTests] = useState<Product[]>([]);
  const [couponForm, setCouponForm] = useState(emptyCoupon);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [savingCoupon, setSavingCoupon] = useState(false);

  const loadCenter = () => {
    setLoading(true);
    authApi.getReferralCenter()
      .then((res) => {
        setStudents(res.data?.students || []);
        setInstitutes(res.data?.institutes || []);
        setStudentPercent(String(res.data?.studentPercent ?? 0));
        setInstitutePercent(String(res.data?.institutePercent ?? 0));
        const drafts: Record<string, string> = {};
        (res.data?.institutes || []).forEach((institute: Person) => { drafts[institute._id] = institute.referralCode || ''; });
        setCodeDrafts(drafts);
      })
      .catch((err) => setError(message(err, 'Could not load referrals.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCenter(); }, []);

  useEffect(() => {
    if (tab !== 'coupons') return;
    authApi.listCoupons().then((res) => setCoupons(res.data || [])).catch(() => setCoupons([]));
    coursesApi.getAll().then((res: any) => setCourses(res.data || res.courses || [])).catch(() => setCourses([]));
    plansApi.list().then((res) => setPlans(res.data || [])).catch(() => setPlans([]));
    mockTestsApi.list({ limit: 50 }).then((res) => setTests(res.data || [])).catch(() => setTests([]));
  }, [tab]);

  const saveRates = async () => {
    setSavingRates(true);
    setError('');
    setNotice('');
    try {
      const res = await authApi.updateReferralSettings({
        studentPercent: Number(studentPercent),
        institutePercent: Number(institutePercent),
      });
      setStudentPercent(String(res.data?.studentPercent ?? 0));
      setInstitutePercent(String(res.data?.institutePercent ?? 0));
      setNotice('Referral percentages saved.');
    } catch (err) {
      setError(message(err, 'Could not save the percentages.'));
    } finally {
      setSavingRates(false);
    }
  };

  const openUses = async (person: Person) => {
    setError('');
    try {
      const res = await authApi.getReferralUses(person._id);
      setDetail({ name: person.name || person.email, uses: res.data?.uses || [] });
    } catch (err) {
      setError(message(err, 'Could not load referral details.'));
    }
  };

  const saveInstituteCode = async (id: string) => {
    setSavingCodeId(id);
    setError('');
    setNotice('');
    try {
      await authApi.updateInstituteReferralCode(id, codeDrafts[id] || '');
      setNotice('Institute code saved.');
      loadCenter();
    } catch (err) {
      setError(message(err, 'Could not save that code.'));
    } finally {
      setSavingCodeId(null);
    }
  };

  const toggleId = (key: 'courseIds' | 'planIds' | 'mockTestIds', id: string) => {
    setCouponForm((current) => {
      const list = current[key];
      return { ...current, [key]: list.includes(id) ? list.filter((item) => item !== id) : [...list, id] };
    });
  };

  const saveCoupon = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingCoupon(true);
    setError('');
    setNotice('');
    try {
      await authApi.saveCoupon({
        ...couponForm,
        discountValue: Number(couponForm.discountValue),
        maxUsesPerUser: Number(couponForm.maxUsesPerUser),
      }, editingCouponId || undefined);
      setNotice(editingCouponId ? 'Coupon updated.' : 'Coupon created.');
      setCouponForm(emptyCoupon);
      setEditingCouponId(null);
      const res = await authApi.listCoupons();
      setCoupons(res.data || []);
    } catch (err) {
      setError(message(err, 'Could not save the coupon.'));
    } finally {
      setSavingCoupon(false);
    }
  };

  const editCoupon = (coupon: Coupon) => {
    setEditingCouponId(coupon._id);
    setCouponForm({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      courseIds: coupon.courseIds || [],
      planIds: coupon.planIds || [],
      mockTestIds: coupon.mockTestIds || [],
      expiresAt: toLocalInput(coupon.expiresAt),
      maxUsesPerUser: String(coupon.maxUsesPerUser),
      isActive: coupon.isActive,
    });
  };

  const removeCoupon = async (id: string) => {
    setError('');
    try {
      await authApi.deleteCoupon(id);
      setCoupons((current) => current.filter((coupon) => coupon._id !== id));
      if (editingCouponId === id) {
        setEditingCouponId(null);
        setCouponForm(emptyCoupon);
      }
    } catch (err) {
      setError(message(err, 'Could not delete the coupon.'));
    }
  };

  const people = tab === 'institutes' ? institutes : students;
  const peoplePages = Math.max(1, Math.ceil(people.length / PAGE_SIZE));
  const peopleRows = people.slice((Math.min(peoplePage, peoplePages) - 1) * PAGE_SIZE, Math.min(peoplePage, peoplePages) * PAGE_SIZE);
  const couponPages = Math.max(1, Math.ceil(coupons.length / PAGE_SIZE));
  const couponRows = coupons.slice((Math.min(couponPage, couponPages) - 1) * PAGE_SIZE, Math.min(couponPage, couponPages) * PAGE_SIZE);

  return (
    <div>
      <AdminPageHeader
        title="Referrals"
        description="Student referrals and institute referrals are tracked from completed payments."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-[13px] font-semibold text-[#344054]">
              Student %
              <input type="number" min={0} max={100} value={studentPercent} onChange={(e) => setStudentPercent(e.target.value)} className="w-16 rounded-lg border border-[#D0D5DD] px-2.5 py-2 text-[13px]" />
            </label>
            <label className="flex items-center gap-2 text-[13px] font-semibold text-[#344054]">
              Institute %
              <input type="number" min={0} max={100} value={institutePercent} onChange={(e) => setInstitutePercent(e.target.value)} className="w-16 rounded-lg border border-[#D0D5DD] px-2.5 py-2 text-[13px]" />
            </label>
            <button type="button" onClick={saveRates} disabled={savingRates} className="rounded-lg bg-[#111827] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60">
              {savingRates ? 'Saving…' : 'Save'}
            </button>
          </div>
        }
      />
      <div className="px-6 py-6 lg:px-10">
        {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-800">{error}</p>}
        {notice && <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3.5 py-2.5 text-[13px] text-green-800">{notice}</p>}

        <div className="mb-4 flex gap-2">
          {(['students', 'institutes', 'coupons'] as const).map((item) => (
            <button key={item} type="button" onClick={() => { setTab(item); setPeoplePage(1); }} className={`rounded-lg px-4 py-2 text-[13px] font-semibold capitalize ${tab === item ? 'bg-[#111827] text-white' : 'border border-[#D0D5DD] text-[#344054]'}`}>
              {item}
            </button>
          ))}
        </div>

        {tab !== 'coupons' && (
          <div className="overflow-hidden rounded-2xl border border-[#E8EDF4] bg-white">
            {loading ? (
              <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#111827] border-t-transparent" /></div>
            ) : (
              <table className="w-full text-left text-[13.5px]">
                <thead>
                  <tr className="border-b border-[#E8EDF4] text-[11.5px] font-bold uppercase tracking-[1px] text-[#94A3B8]">
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Paid referrals</th>
                    <th className="px-5 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {peopleRows.map((person) => (
                    <tr key={person._id} className="border-b border-[#F1F5F9] last:border-0">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-[#101828]">{person.name || '—'}</p>
                        <p className="text-[12px] text-[#94A3B8]">{person.email}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        {tab === 'institutes' ? (
                          <div className="flex items-center gap-2">
                            <input value={codeDrafts[person._id] || ''} onChange={(e) => setCodeDrafts((current) => ({ ...current, [person._id]: e.target.value.toUpperCase() }))} className="w-32 rounded-lg border border-[#D0D5DD] px-2.5 py-1.5 font-mono text-[13px] uppercase" />
                            <button type="button" onClick={() => saveInstituteCode(person._id)} disabled={savingCodeId === person._id} className="text-[12.5px] font-semibold text-[#3267f5] disabled:opacity-50">Save</button>
                          </div>
                        ) : (
                          <span className="font-mono font-semibold text-[#101828]">{person.referralCode || '—'}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">{person.paidCount}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button type="button" onClick={() => openUses(person)} className="text-[12.5px] font-semibold text-[#3267f5]">View</button>
                      </td>
                    </tr>
                  ))}
                  {people.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-[#64748B]">No one in this list yet.</td></tr>}
                </tbody>
              </table>
            )}
            <Pager page={Math.min(peoplePage, peoplePages)} pages={peoplePages} onChange={setPeoplePage} />
          </div>
        )}

        {tab === 'coupons' && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-2xl border border-[#E8EDF4] bg-white">
              <table className="w-full text-left text-[13.5px]">
                <thead>
                  <tr className="border-b border-[#E8EDF4] text-[11.5px] font-bold uppercase tracking-[1px] text-[#94A3B8]">
                    <th className="px-5 py-3">Code</th>
                    <th className="px-5 py-3">Discount</th>
                    <th className="px-5 py-3">Uses / student</th>
                    <th className="px-5 py-3">Expires</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {couponRows.map((coupon) => (
                    <tr key={coupon._id} className="border-b border-[#F1F5F9] last:border-0">
                      <td className="px-5 py-3.5 font-mono font-semibold">{coupon.code}{!coupon.isActive && <span className="ml-2 text-[11px] text-[#94A3B8]">Off</span>}</td>
                      <td className="px-5 py-3.5">{coupon.discountType === 'percent' ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`}</td>
                      <td className="px-5 py-3.5">{coupon.maxUsesPerUser}</td>
                      <td className="px-5 py-3.5">{new Date(coupon.expiresAt).toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button type="button" onClick={() => editCoupon(coupon)} className="mr-3 text-[12.5px] font-semibold text-[#3267f5]">Edit</button>
                        <button type="button" onClick={() => removeCoupon(coupon._id)} className="text-[12.5px] font-semibold text-[#DC2626]">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {coupons.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-[#64748B]">No coupons yet.</td></tr>}
                </tbody>
              </table>
              <Pager page={Math.min(couponPage, couponPages)} pages={couponPages} onChange={setCouponPage} />
            </div>
            <form onSubmit={saveCoupon} className="h-fit rounded-2xl border border-[#E8EDF4] bg-white p-5">
              <h2 className="text-[15px] font-extrabold text-[#101828]">{editingCouponId ? 'Edit coupon' : 'New coupon'}</h2>
              <label className="mt-3 block text-[13px] font-semibold text-[#344054]">Code
                <input required value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] px-3 py-2 font-mono uppercase" />
              </label>
              <label className="mt-3 block text-[13px] font-semibold text-[#344054]">Discount type
                <select value={couponForm.discountType} onChange={(e) => setCouponForm({ ...couponForm, discountType: e.target.value as 'percent' | 'flat' })} className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] bg-white px-3 py-2">
                  <option value="percent">Percentage</option>
                  <option value="flat">Fixed rupees</option>
                </select>
              </label>
              <label className="mt-3 block text-[13px] font-semibold text-[#344054]">{couponForm.discountType === 'percent' ? 'Percent' : 'Rupees'}
                <input required type="number" min={0} step="0.01" value={couponForm.discountValue} onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] px-3 py-2" />
              </label>
              <label className="mt-3 block text-[13px] font-semibold text-[#344054]">Times one student can use it
                <input required type="number" min={1} max={100} value={couponForm.maxUsesPerUser} onChange={(e) => setCouponForm({ ...couponForm, maxUsesPerUser: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] px-3 py-2" />
              </label>
              <label className="mt-3 block text-[13px] font-semibold text-[#344054]">Expires
                <input required type="datetime-local" value={couponForm.expiresAt} onChange={(e) => setCouponForm({ ...couponForm, expiresAt: e.target.value })} className="mt-1.5 w-full rounded-lg border border-[#D0D5DD] px-3 py-2" />
              </label>
              <label className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-[#344054]">
                <input type="checkbox" checked={couponForm.isActive} onChange={(e) => setCouponForm({ ...couponForm, isActive: e.target.checked })} /> Active
              </label>
              <ProductChecks title="Courses" items={courses} selected={couponForm.courseIds} onToggle={(id) => toggleId('courseIds', id)} />
              <ProductChecks title="Plans" items={plans} selected={couponForm.planIds} onToggle={(id) => toggleId('planIds', id)} />
              <ProductChecks title="Mock tests" items={tests} selected={couponForm.mockTestIds} onToggle={(id) => toggleId('mockTestIds', id)} />
              <button type="submit" disabled={savingCoupon} className="mt-4 w-full rounded-lg bg-[#111827] py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-60">
                {savingCoupon ? 'Saving…' : editingCouponId ? 'Save coupon' : 'Create coupon'}
              </button>
            </form>
          </div>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={(e) => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[17px] font-extrabold text-[#101828]">{detail.name}</h2>
              <button type="button" onClick={() => setDetail(null)} className="text-[13px] font-semibold text-[#64748B]">Close</button>
            </div>
            {detail.uses.length === 0 ? (
              <p className="mt-4 text-[13.5px] text-[#64748B]">No completed payments have used this code.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {detail.uses.map((use) => (
                  <li key={use._id} className="rounded-xl border border-[#E8EDF4] px-3 py-2.5 text-[13px]">
                    <p className="font-semibold text-[#101828]">{use.buyerName || use.buyerEmail || 'Student'}</p>
                    <p className="text-[#64748B]">{use.title || use.purpose} · ₹{Number(use.amount || 0).toLocaleString('en-IN')}</p>
                    <p className="text-[12px] text-[#94A3B8]">{use.paidAt ? new Date(use.paidAt).toLocaleString('en-IN') : ''}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Pager: React.FC<{ page: number; pages: number; onChange: (page: number) => void }> = ({ page, pages, onChange }) => {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 border-t border-[#E8EDF4] p-4">
      <button type="button" onClick={() => onChange(Math.max(1, page - 1))} disabled={page <= 1} className="inline-flex items-center gap-1 rounded-full border border-[#D0D5DD] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#475569] disabled:cursor-not-allowed disabled:opacity-40">
        <ChevronLeft size={14} /> Prev
      </button>
      <span className="text-[13px] text-[#64748B]">Page {page} of {pages}</span>
      <button type="button" onClick={() => onChange(Math.min(pages, page + 1))} disabled={page >= pages} className="inline-flex items-center gap-1 rounded-full border border-[#D0D5DD] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#475569] disabled:cursor-not-allowed disabled:opacity-40">
        Next <ChevronRight size={14} />
      </button>
    </div>
  );
};

const ProductChecks: React.FC<{ title: string; items: Product[]; selected: string[]; onToggle: (id: string) => void }> = ({ title, items, selected, onToggle }) => (
  <div className="mt-3">
    <p className="text-[13px] font-semibold text-[#344054]">{title}</p>
    <div className="mt-1.5 max-h-28 space-y-1 overflow-y-auto">
      {items.length === 0 && <p className="text-[12px] text-[#94A3B8]">None found.</p>}
      {items.map((item) => (
        <label key={item._id} className="flex items-center gap-2 text-[12.5px] text-[#344054]">
          <input type="checkbox" checked={selected.includes(item._id)} onChange={() => onToggle(item._id)} />
          <span className="truncate">{item.title}</span>
        </label>
      ))}
    </div>
  </div>
);

export default AdminReferralsPage;
