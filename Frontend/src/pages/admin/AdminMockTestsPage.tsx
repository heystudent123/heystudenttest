import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Eye, Layers, PlayCircle, Plus, Trash2, X } from 'lucide-react';
import { bundlesApi, mockTestsApi, questionBanksApi } from '../../services/api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';

interface QuestionBankOption {
  _id: string;
  title: string;
  questionCount: number;
}

type SaleType = 'free' | 'paid' | 'bundle';
type AdminTab = 'tests' | 'bundles';

interface MockTestSummary {
  _id: string;
  title: string;
  status: 'draft' | 'published' | 'unpublished';
  durationMinutes: number;
  questionCount: number;
  positiveMarks: number;
  negativeMarks: number;
  maxMarks: number;
  saleType?: SaleType;
  isFree: boolean;
  price: number;
  snapshotVersion: number;
}

interface BundleRecord {
  _id: string;
  title: string;
  description: string;
  mockTestIds: string[];
}

interface TestForm {
  title: string;
  description: string;
  category: string;
  chapter: string;
  durationMinutes: string;
  positiveMarks: string;
  negativeMarks: string;
  attemptLimit: string;
  saleType: SaleType;
  price: string;
}

const blankForm = (): TestForm => ({
  title: '',
  description: '',
  category: 'CUET',
  chapter: '',
  durationMinutes: '60',
  positiveMarks: '5',
  negativeMarks: '1',
  attemptLimit: '1',
  saleType: 'free',
  price: '0',
});

function errorMessage(err: any, fallback: string) {
  return err?.response?.data?.error || err?.response?.data?.message || fallback;
}

function saleTypeOf(test: { saleType?: SaleType; isFree?: boolean }): SaleType {
  if (test.saleType === 'free' || test.saleType === 'paid' || test.saleType === 'bundle') return test.saleType;
  return test.isFree ? 'free' : 'paid';
}

function saleLabel(type: SaleType, price = 0) {
  if (type === 'free') return 'Free';
  if (type === 'bundle') return 'Bundle only';
  return `₹${price}`;
}

function toPayload(form: TestForm, questionBankId: string, fallbackIds: string[]) {
  return {
    title: form.title,
    description: form.description,
    category: form.category,
    chapter: form.chapter,
    durationMinutes: Number(form.durationMinutes),
    positiveMarks: Number(form.positiveMarks),
    negativeMarks: Number(form.negativeMarks),
    attemptLimit: Number(form.attemptLimit),
    saleType: form.saleType,
    isFree: form.saleType === 'free',
    price: form.saleType === 'paid' ? Number(form.price) : 0,
    questionBankId: questionBankId || null,
    questionIds: questionBankId ? [] : fallbackIds,
  };
}

const StatusPill: React.FC<{ status: MockTestSummary['status'] }> = ({ status }) => {
  const styles = {
    draft: 'bg-[#F1F5F9] text-[#64748B]',
    published: 'bg-[#E7F8EF] text-[#1F9D55]',
    unpublished: 'bg-[#FFF6D8] text-[#B7860B]',
  } as const;
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${styles[status]}`}>{status}</span>;
};

const AdminMockTestsPage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>('tests');
  const [tests, setTests] = useState<MockTestSummary[]>([]);
  const [bundles, setBundles] = useState<BundleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<MockTestSummary['status'] | null>(null);
  const [form, setForm] = useState<TestForm>(blankForm);
  const [banks, setBanks] = useState<QuestionBankOption[]>([]);
  const [bankId, setBankId] = useState('');
  const [keptIds, setKeptIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<MockTestSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bundleFormOpen, setBundleFormOpen] = useState(false);
  const [editingBundleId, setEditingBundleId] = useState<string | null>(null);
  const [bundleForm, setBundleForm] = useState({ title: '', description: '', mockTestIds: [] as string[] });
  const [confirmDeleteBundle, setConfirmDeleteBundle] = useState<BundleRecord | null>(null);

  const locked = status === 'published';
  const bundleOnlyTests = tests.filter((test) => saleTypeOf(test) === 'bundle');

  const loadTests = useCallback(async () => {
    setLoading(true);
    try {
      const [testRes, bundleRes] = await Promise.all([
        mockTestsApi.list({ limit: 50 } as { page?: number }),
        bundlesApi.list(),
      ]);
      setTests(testRes.data || []);
      setBundles(bundleRes.data || []);
    } catch (err) {
      setError(errorMessage(err, 'Could not load mock tests.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTests(); }, [loadTests]);

  useEffect(() => {
    if (!formOpen) return;
    questionBanksApi.list()
      .then((response) => setBanks(response.data || []))
      .catch(() => setBanks([]));
  }, [formOpen]);

  const startNew = () => {
    setEditingId(null);
    setStatus(null);
    setForm(blankForm());
    setBankId('');
    setKeptIds([]);
    setError('');
    setNotice('');
    setFormOpen(true);
  };

  const openTest = async (id: string) => {
    setError('');
    setNotice('');
    try {
      const response = await mockTestsApi.get(id);
      const test = response.data;
      setEditingId(test._id);
      setStatus(test.status);
      setForm({
        title: test.title || '',
        description: test.description || '',
        category: test.category || 'CUET',
        chapter: test.chapter || '',
        durationMinutes: String(test.durationMinutes ?? 60),
        positiveMarks: String(test.positiveMarks ?? 1),
        negativeMarks: String(test.negativeMarks ?? 0),
        attemptLimit: String(test.attemptLimit ?? 1),
        saleType: saleTypeOf(test),
        price: String(test.price ?? 0),
      });
      setBankId(test.questionBankId ? String(test.questionBankId) : '');
      setKeptIds((test.questions || []).map((question: { _id: string }) => question._id));
      setFormOpen(true);
    } catch (err) {
      setError(errorMessage(err, 'Could not open that test.'));
    }
  };

  const attemptTest = (test: MockTestSummary) => {
    navigate(`/mock-tests/${test._id}/instructions?preview=1&from=admin&title=${encodeURIComponent(test.title)}`);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (editingId && locked) {
        await mockTestsApi.update(editingId, {
          title: form.title,
          description: form.description,
          category: form.category,
          chapter: form.chapter,
        });
        setNotice('Details saved. Questions and scoring stay on the published snapshot.');
      } else if (editingId) {
        await mockTestsApi.update(editingId, toPayload(form, bankId, keptIds));
        setNotice('Draft saved.');
      } else {
        const response = await mockTestsApi.create(toPayload(form, bankId, keptIds));
        setEditingId(response.data._id);
        setStatus(response.data.status);
        setNotice('Draft created.');
      }
      await loadTests();
    } catch (err) {
      setError(errorMessage(err, 'Could not save the test.'));
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    setSaving(true);
    setError('');
    try {
      let id = editingId;
      const payload = toPayload(form, bankId, keptIds);
      if (!id) {
        const created = await mockTestsApi.create(payload);
        id = created.data._id;
        setEditingId(id);
        setStatus(created.data.status);
      } else if (!locked) {
        await mockTestsApi.update(id, payload);
      }
      const response = await mockTestsApi.publish(id as string);
      setStatus('published');
      setNotice(`Published with ${response.data.questionCount} questions. Max marks ${response.data.maxMarks}.`);
      await loadTests();
    } catch (err) {
      setError(errorMessage(err, 'Could not publish the test.'));
    } finally {
      setSaving(false);
    }
  };

  const unpublish = async () => {
    if (!editingId) return;
    setSaving(true);
    setError('');
    try {
      await mockTestsApi.unpublish(editingId);
      setStatus('unpublished');
      setNotice('Test unpublished. The last snapshot is kept until you publish again.');
      await loadTests();
    } catch (err) {
      setError(errorMessage(err, 'Could not unpublish the test.'));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    setError('');
    try {
      await mockTestsApi.remove(confirmDelete._id);
      if (editingId === confirmDelete._id) setFormOpen(false);
      setNotice('Test deleted.');
      setConfirmDelete(null);
      await loadTests();
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the test.'));
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const openCreateBundle = () => {
    setEditingBundleId(null);
    setBundleForm({ title: '', description: '', mockTestIds: [] });
    setError('');
    setBundleFormOpen(true);
  };

  const openEditBundle = (bundle: BundleRecord) => {
    setEditingBundleId(bundle._id);
    setBundleForm({
      title: bundle.title,
      description: bundle.description || '',
      mockTestIds: (bundle.mockTestIds || []).map(String),
    });
    setError('');
    setBundleFormOpen(true);
  };

  const toggleBundleTest = (id: string) => {
    setBundleForm((current) => ({
      ...current,
      mockTestIds: current.mockTestIds.includes(id)
        ? current.mockTestIds.filter((item) => item !== id)
        : [...current.mockTestIds, id],
    }));
  };

  const saveBundle = async () => {
    setSaving(true);
    setError('');
    try {
      if (editingBundleId) await bundlesApi.update(editingBundleId, bundleForm);
      else await bundlesApi.create(bundleForm);
      setNotice(editingBundleId ? 'Bundle saved.' : 'Bundle created.');
      setBundleFormOpen(false);
      await loadTests();
    } catch (err) {
      setError(errorMessage(err, 'Could not save the bundle.'));
    } finally {
      setSaving(false);
    }
  };

  const onDeleteBundle = async () => {
    if (!confirmDeleteBundle) return;
    setDeleting(true);
    setError('');
    try {
      await bundlesApi.remove(confirmDeleteBundle._id);
      setNotice('Bundle deleted.');
      setConfirmDeleteBundle(null);
      await loadTests();
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the bundle.'));
      setConfirmDeleteBundle(null);
    } finally {
      setDeleting(false);
    }
  };

  const field = (key: keyof TestForm, label: string, type = 'text', span = 1) => (
    <div className={span === 2 ? 'sm:col-span-2' : ''}>
      <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">{label}</label>
      <input
        type={type}
        disabled={locked && !['title', 'description', 'category', 'chapter'].includes(key)}
        value={String(form[key] ?? '')}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] disabled:bg-[#F7F9FC]"
      />
    </div>
  );

  return (
    <div>
      <AdminPageHeader
        title="Mock Tests"
        description="Create free, paid, or bundle-only tests. Group bundle tests here, then attach those bundles to a plan."
        actions={
          tab === 'tests' ? (
            <button onClick={startNew} className="inline-flex items-center gap-1.5 rounded-lg bg-[#111827] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1F2937]">
              <Plus size={14} /> New Test
            </button>
          ) : (
            <button onClick={openCreateBundle} className="inline-flex items-center gap-1.5 rounded-lg bg-[#111827] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1F2937]">
              <Plus size={14} /> Create a Bundle
            </button>
          )
        }
      />

      <div className="border-b border-[#E8EDF4] bg-white px-6 lg:px-10">
        <div className="flex gap-6">
          {([
            { key: 'tests', label: 'Tests' },
            { key: 'bundles', label: 'Bundles' },
          ] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`border-b-2 px-1 py-3.5 text-[14px] font-semibold transition-colors ${
                tab === item.key ? 'border-[#111827] text-[#101828]' : 'border-transparent text-[#94A3B8] hover:text-[#475569]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6 lg:px-10">
        {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-800">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3.5 py-2.5 text-[13px] text-green-800">{notice}</p>}

        {tab === 'bundles' ? (
          <div className="rounded-2xl border border-[#E8EDF4] bg-white">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#111827] border-t-transparent" />
              </div>
            ) : bundles.length === 0 ? (
              <div className="py-16 text-center text-[13.5px] text-[#64748B]">No bundles yet. Mark tests as Bundle only, then create a bundle.</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {bundles.map((bundle) => (
                  <div key={bundle._id} className="rounded-xl border border-[#E8EDF4] p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF1FF] text-[#3267f5]"><Layers size={16} /></span>
                      <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-semibold text-[#64748B]">
                        {(bundle.mockTestIds || []).length} test{(bundle.mockTestIds || []).length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <h3 className="mt-3 text-[15px] font-bold text-[#101828]">{bundle.title}</h3>
                    {bundle.description && <p className="mt-1 line-clamp-2 text-[12.5px] text-[#64748B]">{bundle.description}</p>}
                    <div className="mt-4 flex gap-2">
                      <button type="button" onClick={() => openEditBundle(bundle)} className="flex-1 rounded-lg border border-[#D0D5DD] py-2 text-[12.5px] font-semibold text-[#344054] hover:bg-[#F7F9FC]">Edit</button>
                      <button type="button" onClick={() => setConfirmDeleteBundle(bundle)} className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-[12.5px] font-semibold text-[#DC2626] hover:bg-[#FEF2F2]"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
        <div className="rounded-2xl border border-[#E8EDF4] bg-white">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#111827] border-t-transparent" />
            </div>
          ) : tests.length === 0 ? (
            <div className="py-16 text-center text-[13.5px] text-[#64748B]">No mock tests yet. Create one to get started.</div>
          ) : (
            <>
              <div className="space-y-3 p-4 sm:hidden">
                {tests.map((test) => (
                  <div key={test._id} className="rounded-xl border border-[#E8EDF4] p-4">
                    <button onClick={() => openTest(test._id)} className="block w-full text-left font-semibold text-[#101828]">{test.title}</button>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[#64748B]">
                      <StatusPill status={test.status} />
                      <span>{test.questionCount} Qs</span>
                      <span>{test.durationMinutes} min</span>
                      <span>{saleLabel(saleTypeOf(test), test.price)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        onClick={() => attemptTest(test)}
                        disabled={test.questionCount === 0}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#3267f5] disabled:opacity-40"
                      >
                        <PlayCircle size={12} /> Attempt
                      </button>
                      {test.status !== 'published' && (
                        <button onClick={() => setConfirmDelete(test)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#DC2626]"><Trash2 size={12} /> Delete</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <table className="hidden w-full text-left text-[13.5px] sm:table">
                <thead>
                  <tr className="border-b border-[#E8EDF4] text-[11.5px] font-bold uppercase tracking-[1px] text-[#94A3B8]">
                    <th className="px-5 py-3">Test</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Questions</th>
                    <th className="px-5 py-3">Duration</th>
                    <th className="px-5 py-3">Price</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tests.map((test) => (
                    <tr key={test._id} className="border-b border-[#F1F5F9] last:border-0">
                      <td className="px-5 py-3.5">
                        <button onClick={() => openTest(test._id)} className="font-semibold text-[#101828] hover:text-[#3267f5]">{test.title}</button>
                      </td>
                      <td className="px-5 py-3.5"><StatusPill status={test.status} /></td>
                      <td className="px-5 py-3.5">{test.questionCount}</td>
                      <td className="px-5 py-3.5">{test.durationMinutes} min</td>
                      <td className="px-5 py-3.5">{saleLabel(saleTypeOf(test), test.price)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => attemptTest(test)}
                            disabled={test.questionCount === 0}
                            title={test.questionCount === 0 ? 'Add questions before attempting' : 'Attempt this test'}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] px-2.5 py-1.5 text-[12px] font-semibold text-[#3267f5] transition-colors hover:bg-[#EEF1FF] disabled:opacity-40"
                          >
                            <PlayCircle size={13} />
                          </button>
                          <button onClick={() => openTest(test._id)} className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] px-2.5 py-1.5 text-[12px] font-semibold text-[#344054] transition-colors hover:bg-[#F7F9FC]"><Eye size={13} /></button>
                          {test.status !== 'published' && (
                            <button onClick={() => setConfirmDelete(test)} className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] px-2.5 py-1.5 text-[12px] font-semibold text-[#DC2626] transition-colors hover:bg-[#FEF2F2]"><Trash2 size={13} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
        )}
      </div>

      {/* Create / edit test */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
          onClick={(e) => { if (e.target === e.currentTarget) setFormOpen(false); }}
        >
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <button onClick={() => setFormOpen(false)} aria-label="Close" className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#101828]">
              <X size={16} />
            </button>
            <div className="flex items-center justify-between gap-2 pr-6">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF0FF] text-[#6B7CFF]"><ClipboardList size={17} /></span>
                <h2 className="text-[17px] font-extrabold text-[#101828]">{editingId ? 'Edit Test' : 'New Test'}</h2>
              </div>
              {status && <StatusPill status={status} />}
            </div>

            {locked && (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-800">
                This test is published. Unpublish it before changing questions, marks, duration, or price. The current snapshot stays frozen for students mid-attempt.
              </p>
            )}

            <div className="mt-5 space-y-4">
              {field('title', 'Title', 'text', 2)}
              {field('description', 'Description', 'text', 2)}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {field('category', 'Category')}
                {field('chapter', 'Subject')}
                {field('durationMinutes', 'Duration (minutes)', 'number')}
                {field('attemptLimit', 'Attempt limit (0 = unlimited)', 'number')}
                {field('positiveMarks', 'Marks for correct answer', 'number')}
                {field('negativeMarks', 'Marks deducted for wrong answer', 'number')}
              </div>

              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-[#344054]">Sale type</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    { key: 'free', label: 'Free' },
                    { key: 'paid', label: 'Paid' },
                    { key: 'bundle', label: 'Bundle only' },
                  ] as const).map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      disabled={locked}
                      onClick={() => setForm({ ...form, saleType: option.key })}
                      className={`rounded-lg border px-3 py-2 text-[13px] font-semibold disabled:opacity-50 ${
                        form.saleType === option.key
                          ? 'border-[#111827] bg-[#111827] text-white'
                          : 'border-[#D0D5DD] text-[#344054] hover:bg-[#F7F9FC]'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {form.saleType === 'bundle' && (
                  <p className="mt-2 text-[12.5px] text-[#64748B]">This test cannot be sold alone. Add it to a bundle, then attach that bundle to a plan.</p>
                )}
              </div>
              {form.saleType === 'paid' && (
                <div className="max-w-[200px]">
                  {field('price', 'Price (₹)', 'number')}
                </div>
              )}
              <div className="border-t border-[#E8EDF4] pt-4">
                <h3 className="text-[13.5px] font-bold text-[#101828]">Question bank</h3>
                <p className="mt-0.5 text-[12px] text-[#94A3B8]">The whole bank is included. Publishing copies its questions as they are at that moment.</p>
                <select
                  value={bankId}
                  disabled={locked}
                  onChange={(e) => setBankId(e.target.value)}
                  className="mt-3 w-full rounded-lg border border-[#D0D5DD] bg-white px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827] disabled:bg-[#F7F9FC]"
                >
                  <option value="">Select a question bank</option>
                  {bankId && !banks.some((bank) => bank._id === bankId) && (
                    <option value={bankId}>Linked bank</option>
                  )}
                  {banks.map((bank) => (
                    <option key={bank._id} value={bank._id}>
                      {bank.title} ({bank.questionCount} question{bank.questionCount === 1 ? '' : 's'})
                    </option>
                  ))}
                </select>
                {bankId ? (
                  <p className="mt-2 text-[12.5px] text-[#64748B]">
                    Maximum marks on publish: {(banks.find((bank) => bank._id === bankId)?.questionCount || 0) * (Number(form.positiveMarks) || 0)}.
                  </p>
                ) : keptIds.length > 0 ? (
                  <p className="mt-2 text-[12.5px] text-[#64748B]">
                    This test already has {keptIds.length} question{keptIds.length === 1 ? '' : 's'} picked individually. Choose a bank to replace them.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button onClick={save} disabled={saving} className="rounded-lg border border-[#D0D5DD] px-4 py-2.5 text-[13.5px] font-semibold text-[#344054] transition-colors hover:bg-[#F7F9FC] disabled:opacity-50">
                {locked ? 'Save details' : 'Save draft'}
              </button>
              <button onClick={publish} disabled={saving || locked} className="rounded-lg bg-[#111827] px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#1F2937] disabled:opacity-50">
                Publish
              </button>
              {locked && (
                <button onClick={unpublish} disabled={saving} className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-[13.5px] font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50">
                  Unpublish
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-[17px] font-extrabold text-[#101828]">Delete this test?</h2>
            <p className="mt-1.5 text-[13px] text-[#64748B]"><span className="font-semibold text-[#101828]">{confirmDelete.title}</span> will be permanently removed.</p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-lg border border-[#D0D5DD] py-2.5 text-[13.5px] font-semibold text-[#344054] hover:bg-[#F7F9FC]">Cancel</button>
              <button onClick={onDelete} disabled={deleting} className="flex-1 rounded-lg bg-[#DC2626] py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#B91C1C] disabled:opacity-60">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {bundleFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
          onClick={(e) => { if (e.target === e.currentTarget) setBundleFormOpen(false); }}
        >
          <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <button type="button" onClick={() => setBundleFormOpen(false)} aria-label="Close" className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#101828]">
              <X size={16} />
            </button>
            <div className="flex items-center gap-2 pr-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF1FF] text-[#3267f5]"><Layers size={17} /></span>
              <h2 className="text-[17px] font-extrabold text-[#101828]">{editingBundleId ? 'Edit Bundle' : 'Create a Bundle'}</h2>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Title *</label>
                <input value={bundleForm.title} onChange={(e) => setBundleForm({ ...bundleForm, title: e.target.value })} className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Description</label>
                <textarea rows={3} value={bundleForm.description} onChange={(e) => setBundleForm({ ...bundleForm, description: e.target.value })} className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Bundle-only mock tests *</label>
                <div className="max-h-48 space-y-1 overflow-auto rounded-lg border border-[#E8EDF4] p-3">
                  {bundleOnlyTests.length === 0 && (
                    <p className="text-[13px] text-[#94A3B8]">No bundle-only tests yet. Create a test and set sale type to Bundle only.</p>
                  )}
                  {bundleOnlyTests.map((test) => (
                    <label key={test._id} className="flex items-center gap-2 text-[13.5px] text-[#344054]">
                      <input type="checkbox" checked={bundleForm.mockTestIds.includes(test._id)} onChange={() => toggleBundleTest(test._id)} className="h-4 w-4 rounded border-[#D0D5DD]" />
                      {test.title}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setBundleFormOpen(false)} className="rounded-lg border border-[#D0D5DD] px-4 py-2.5 text-[13.5px] font-semibold text-[#344054] hover:bg-[#F7F9FC]">Cancel</button>
              <button type="button" onClick={saveBundle} disabled={saving} className="rounded-lg bg-[#111827] px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#1F2937] disabled:opacity-50">
                {saving ? 'Saving…' : 'Save bundle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteBundle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDeleteBundle(null); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-[17px] font-extrabold text-[#101828]">Delete this bundle?</h2>
            <p className="mt-1.5 text-[13px] text-[#64748B]"><span className="font-semibold text-[#101828]">{confirmDeleteBundle.title}</span> will be permanently removed.</p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setConfirmDeleteBundle(null)} className="flex-1 rounded-lg border border-[#D0D5DD] py-2.5 text-[13.5px] font-semibold text-[#344054] hover:bg-[#F7F9FC]">Cancel</button>
              <button type="button" onClick={onDeleteBundle} disabled={deleting} className="flex-1 rounded-lg bg-[#DC2626] py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-60">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminMockTestsPage;
