import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, FileSpreadsheet, HelpCircle, Layers, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { questionBanksApi, questionsApi } from '../../services/api';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminTable from '../../components/admin/AdminTable';

interface Bank {
  _id: string;
  title: string;
  description: string;
  questionCount: number;
}

interface Question {
  _id: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  chapter: string;
  remarks: string;
}

interface PreviewRow {
  rowNumber: number;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  chapter: string;
  remarks: string;
  errors?: string[];
}

interface Preview {
  importId: string;
  fileName: string;
  validCount: number;
  invalidCount: number;
  skippedEmpty: number;
  valid: PreviewRow[];
  invalid: PreviewRow[];
}

const emptyQuestionForm = {
  question: '',
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  correctAnswer: 'A' as Question['correctAnswer'],
  chapter: '',
  remarks: '',
};

const emptyBankForm = { title: '', description: '' };

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function errorMessage(err: any, fallback: string) {
  return err?.response?.data?.error || err?.response?.data?.message || fallback;
}

const AdminQuestionBankPage: React.FC = () => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [activeBank, setActiveBank] = useState<Bank | null>(null);

  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Bank create/edit
  const [bankFormOpen, setBankFormOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [bankForm, setBankForm] = useState(emptyBankForm);
  const [bankFormError, setBankFormError] = useState('');
  const [savingBank, setSavingBank] = useState(false);
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [confirmDeleteBank, setConfirmDeleteBank] = useState<Bank | null>(null);
  const [deletingBank, setDeletingBank] = useState(false);

  // Questions within a bank
  const [questions, setQuestions] = useState<Question[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [uploading, setUploading] = useState(false);
  const [approving, setApproving] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [form, setForm] = useState(emptyQuestionForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<Question | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const loadBanks = useCallback(async () => {
    setBanksLoading(true);
    try {
      const response = await questionBanksApi.list();
      setBanks(response.data || []);
    } catch (err) {
      setError(errorMessage(err, 'Could not load question banks.'));
    } finally {
      setBanksLoading(false);
    }
  }, []);

  useEffect(() => { loadBanks(); }, [loadBanks]);

  const loadQuestions = useCallback(async (bankId: string, nextPage: number, q: string) => {
    setQuestionsLoading(true);
    setError('');
    try {
      const list = await questionsApi.list({ bankId, q, page: nextPage, limit: 20 });
      setQuestions(list.data || []);
      setTotal(list.total || 0);
      setPages(list.pages || 1);
    } catch (err) {
      setError(errorMessage(err, 'Could not load this question bank.'));
    } finally {
      setQuestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeBank) return;
    setSelectedIds(new Set());
    const handle = window.setTimeout(() => loadQuestions(activeBank._id, page, search), 250);
    return () => window.clearTimeout(handle);
  }, [activeBank, page, search, loadQuestions]);

  const openBank = (bank: Bank) => {
    setActiveBank(bank);
    setSearch('');
    setPage(1);
    setNotice('');
    setError('');
  };

  const backToBanks = () => {
    setActiveBank(null);
    loadBanks();
  };

  // ── Bank form ──
  const openCreateBank = () => {
    setEditingBank(null);
    setBankForm(emptyBankForm);
    setBankFormError('');
    setBankFile(null);
    setBankFormOpen(true);
  };

  const openImport = (bank: Bank) => {
    setActiveBank(bank);
    setSearch('');
    setPage(1);
    setNotice('');
    setError('');
    setPreview(null);
    setImportOpen(true);
  };

  const openEditBank = (bank: Bank) => {
    setEditingBank(bank);
    setBankForm({ title: bank.title, description: bank.description || '' });
    setBankFormError('');
    setBankFormOpen(true);
  };

  const onSaveBank = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingBank(true);
    setBankFormError('');
    try {
      if (editingBank) {
        await questionBanksApi.update(editingBank._id, bankForm);
        setBankFormOpen(false);
        await loadBanks();
      } else {
        const created = await questionBanksApi.create(bankForm);
        const bank = created.data as Bank;
        setBankFormOpen(false);
        await loadBanks();
        if (bankFile) {
          setActiveBank(bank);
          setSearch('');
          setPage(1);
          setImportOpen(true);
          setPreview(null);
          setUploading(true);
          try {
            const response = await questionsApi.previewImport(bankFile, bank._id);
            setPreview(response.data);
          } catch (uploadErr) {
            setError(errorMessage(uploadErr, 'The bank was created, but the spreadsheet could not be validated.'));
          } finally {
            setUploading(false);
            setBankFile(null);
          }
        }
      }
    } catch (err) {
      setBankFormError(errorMessage(err, 'Could not save this question bank.'));
    } finally {
      setSavingBank(false);
    }
  };

  const onDeleteBank = async () => {
    if (!confirmDeleteBank) return;
    setDeletingBank(true);
    setError('');
    try {
      await questionBanksApi.remove(confirmDeleteBank._id);
      setNotice('Question bank deleted.');
      setConfirmDeleteBank(null);
      await loadBanks();
    } catch (err) {
      setError(errorMessage(err, 'Could not delete this question bank.'));
      setConfirmDeleteBank(null);
    } finally {
      setDeletingBank(false);
    }
  };

  // ── Questions within a bank ──
  const onUpload = async (file: File | undefined) => {
    if (!file || !activeBank) return;
    setUploading(true);
    setNotice('');
    setError('');
    setPreview(null);
    try {
      const response = await questionsApi.previewImport(file, activeBank._id);
      setPreview(response.data);
    } catch (err) {
      setError(errorMessage(err, 'The spreadsheet could not be validated.'));
    } finally {
      setUploading(false);
    }
  };

  const onApprove = async () => {
    if (!preview || !activeBank) return;
    setApproving(true);
    setError('');
    setNotice('');
    try {
      const response = await questionsApi.approveImport(preview.importId);
      const result = response.data;
      setNotice(
        result.alreadyImported
          ? `This file was already imported. ${result.inserted} question(s) were saved.`
          : `Imported ${result.inserted} question(s). Skipped ${result.skippedDuplicates} duplicate(s). Rejected ${result.rejected} row(s).`
      );
      setPreview(null);
      setImportOpen(false);
      setPage(1);
      loadQuestions(activeBank._id, 1, search);
    } catch (err) {
      setError(errorMessage(err, 'The import could not be saved.'));
    } finally {
      setApproving(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyQuestionForm);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (question: Question) => {
    setEditing(question);
    setForm({
      question: question.question,
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      correctAnswer: question.correctAnswer,
      chapter: question.chapter || '',
      remarks: question.remarks || '',
    });
    setFormError('');
    setFormOpen(true);
  };

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeBank) return;
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await questionsApi.update(editing._id, form);
        setNotice('Question updated. Published test snapshots are unchanged.');
      } else {
        await questionsApi.create({ ...form, bankId: activeBank._id });
        setNotice('Question added to the bank.');
      }
      setFormOpen(false);
      loadQuestions(activeBank._id, page, search);
    } catch (err) {
      setFormError(errorMessage(err, 'Could not save this question.'));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!confirmDelete || !activeBank) return;
    setDeleting(true);
    setError('');
    try {
      await questionsApi.remove(confirmDelete._id);
      setNotice('Question deleted.');
      setConfirmDelete(null);
      loadQuestions(activeBank._id, page, search);
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the question.'));
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const toggleRow = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((current) => {
      if (questions.length > 0 && questions.every((q) => current.has(q._id))) {
        return new Set();
      }
      return new Set(questions.map((q) => q._id));
    });
  };

  const onBulkDelete = async () => {
    if (!activeBank || selectedIds.size === 0) return;
    setBulkDeleting(true);
    setError('');
    try {
      const response = await questionsApi.bulkRemove(Array.from(selectedIds));
      const { deletedCount, skippedCount } = response.data;
      setNotice(
        skippedCount > 0
          ? `Deleted ${deletedCount} question(s). Skipped ${skippedCount} that are used by a mock test.`
          : `Deleted ${deletedCount} question(s).`
      );
      setSelectedIds(new Set());
      setConfirmBulkDelete(false);
      loadQuestions(activeBank._id, page, search);
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the selected questions.'));
      setConfirmBulkDelete(false);
    } finally {
      setBulkDeleting(false);
    }
  };

  // ── Bank list view ──
  if (!activeBank) {
    return (
      <div>
        <AdminPageHeader
          title="Question Banks"
          description="Group questions into named banks, then pick from them when building a mock test."
          actions={
            <button onClick={openCreateBank} className="inline-flex items-center gap-1.5 rounded-lg bg-[#111827] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1F2937]">
              <Plus size={14} /> New Bank
            </button>
          }
        />

        <div className="px-6 py-6 lg:px-10">
          {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-800">{error}</p>}
          {notice && <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3.5 py-2.5 text-[13px] text-green-800">{notice}</p>}

          {banksLoading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#111827] border-t-transparent" />
            </div>
          ) : banks.length === 0 ? (
            <div className="rounded-2xl border border-[#E8EDF4] bg-white py-16 text-center text-[13.5px] text-[#64748B]">
              No question banks yet. Create one to start adding questions.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {banks.map((bank) => (
                <div key={bank._id} className="rounded-2xl border border-[#E8EDF4] bg-white p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF0FF] text-[#6B7CFF]"><Layers size={17} /></span>
                  <button onClick={() => openBank(bank)} className="mt-3 block text-left text-[15px] font-bold text-[#101828] hover:text-[#3267f5]">{bank.title}</button>
                  {bank.description && <p className="mt-1 line-clamp-2 text-[12.5px] text-[#64748B]">{bank.description}</p>}
                  <p className="mt-2 text-[12px] font-semibold text-[#94A3B8]">{bank.questionCount} question{bank.questionCount === 1 ? '' : 's'}</p>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => openBank(bank)} className="flex-1 rounded-lg bg-[#111827] py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#1F2937]">
                      Open
                    </button>
                    <button onClick={() => openImport(bank)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#D0D5DD] px-2 py-2 text-[12.5px] font-semibold text-[#344054] transition-colors hover:bg-[#F7F9FC]">
                      <FileSpreadsheet size={13} /> Excel
                    </button>
                    <button onClick={() => openEditBank(bank)} className="inline-flex items-center justify-center rounded-lg border border-[#D0D5DD] px-3 py-2 text-[12.5px] font-semibold text-[#344054] transition-colors hover:bg-[#F7F9FC]">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setConfirmDeleteBank(bank)} className="inline-flex items-center justify-center rounded-lg border border-[#D0D5DD] px-3 py-2 text-[12.5px] font-semibold text-[#DC2626] transition-colors hover:bg-[#FEF2F2]">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create / edit bank */}
        {bankFormOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
            onClick={(e) => { if (e.target === e.currentTarget) setBankFormOpen(false); }}
          >
            <form onSubmit={onSaveBank} className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <button type="button" onClick={() => setBankFormOpen(false)} aria-label="Close" className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#101828]">
                <X size={16} />
              </button>
              <div className="flex items-center gap-2 pr-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF0FF] text-[#6B7CFF]"><Layers size={17} /></span>
                <h2 className="text-[17px] font-extrabold text-[#101828]">{editingBank ? 'Edit Bank' : 'New Question Bank'}</h2>
              </div>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Title *</label>
                  <input required value={bankForm.title} onChange={(e) => setBankForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. CUET Commerce — Accountancy" className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Description</label>
                  <textarea rows={2} value={bankForm.description} onChange={(e) => setBankForm((p) => ({ ...p, description: e.target.value }))} className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
                </div>
                {!editingBank && (
                  <div>
                    <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Excel file</label>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-3 py-2 text-[12.5px] font-semibold text-[#344054] hover:bg-[#F7F9FC]"
                        onClick={async () => {
                          const blob = await questionsApi.downloadTemplate();
                          downloadBlob(blob, 'heystudents-question-template.xlsx');
                        }}
                      >
                        Download template
                      </button>
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-3 py-2 text-[12.5px] font-semibold text-[#344054] hover:bg-[#F7F9FC]">
                        <Upload size={13} />
                        {bankFile ? bankFile.name : 'Choose .xlsx'}
                        <input
                          type="file"
                          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                          className="sr-only"
                          onChange={(event) => {
                            setBankFile(event.target.files?.[0] || null);
                            event.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                    <p className="mt-1.5 text-[12px] text-[#94A3B8]">Optional. You’ll review the rows before they are saved into this bank.</p>
                  </div>
                )}
              </div>
              {bankFormError && <p className="mt-4 text-[13px] text-red-600">{bankFormError}</p>}
              <button type="submit" disabled={savingBank} className="mt-6 w-full rounded-lg bg-[#111827] py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#1F2937] disabled:opacity-60">
                {savingBank ? 'Saving…' : editingBank ? 'Save Changes' : 'Create Bank'}
              </button>
            </form>
          </div>
        )}

        {/* Delete bank confirmation */}
        {confirmDeleteBank && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
            onClick={(e) => { if (e.target === e.currentTarget) setConfirmDeleteBank(null); }}
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-[17px] font-extrabold text-[#101828]">Delete this bank?</h2>
              <p className="mt-1.5 text-[13px] text-[#64748B]">
                <span className="font-semibold text-[#101828]">{confirmDeleteBank.title}</span>
                {confirmDeleteBank.questionCount > 0
                  ? ` has ${confirmDeleteBank.questionCount} question(s). Remove them first before deleting the bank.`
                  : ' will be permanently removed.'}
              </p>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setConfirmDeleteBank(null)} className="flex-1 rounded-lg border border-[#D0D5DD] py-2.5 text-[13.5px] font-semibold text-[#344054] hover:bg-[#F7F9FC]">Cancel</button>
                <button
                  onClick={onDeleteBank}
                  disabled={deletingBank || confirmDeleteBank.questionCount > 0}
                  className="flex-1 rounded-lg bg-[#DC2626] py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#B91C1C] disabled:opacity-50"
                >
                  {deletingBank ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Inside a bank: question list ──
  return (
    <div>
      <AdminPageHeader
        title={activeBank.title}
        description={activeBank.description || 'Manage the questions in this bank.'}
        actions={
          <>
            <button onClick={backToBanks} className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-4 py-2 text-[13px] font-semibold text-[#344054] transition-colors hover:bg-[#F7F9FC]">
              <ArrowLeft size={14} /> All Banks
            </button>
            <button
              onClick={() => { setImportOpen(true); setPreview(null); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-4 py-2 text-[13px] font-semibold text-[#344054] transition-colors hover:bg-[#F7F9FC]"
            >
              <FileSpreadsheet size={14} /> Import Excel
            </button>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#111827] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1F2937]"
            >
              <Plus size={14} /> New Question
            </button>
          </>
        }
      />

      <div className="px-6 py-6 lg:px-10">
        {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-800">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3.5 py-2.5 text-[13px] text-green-800">{notice}</p>}

        {selectedIds.size > 0 && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#D0D5DD] bg-[#F7F9FC] px-4 py-2.5">
            <p className="text-[13px] font-semibold text-[#344054]">{selectedIds.size} question{selectedIds.size === 1 ? '' : 's'} selected</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedIds(new Set())} className="text-[12.5px] font-semibold text-[#64748B] hover:text-[#101828]">
                Clear
              </button>
              <button
                onClick={() => setConfirmBulkDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#DC2626] px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#B91C1C]"
              >
                <Trash2 size={13} /> Delete Selected
              </button>
            </div>
          </div>
        )}

        <AdminTable
          loading={questionsLoading}
          search={search}
          onSearchChange={(v) => { setPage(1); setSearch(v); }}
          searchPlaceholder="Search question text…"
          emptyMessage="No questions yet. Add one manually or import a spreadsheet."
          rows={questions}
          rowKey={(q) => q._id}
          page={page}
          pages={pages}
          onPageChange={setPage}
          selectedKeys={selectedIds}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          columns={[
            {
              key: 'question', label: 'Question',
              render: (q) => <p className="max-w-md line-clamp-2 text-[#101828]">{q.question}</p>,
            },
            { key: 'answer', label: 'Answer', render: (q) => <span className="font-semibold text-[#101828]">{q.correctAnswer}</span> },
            { key: 'chapter', label: 'Chapter', render: (q) => q.chapter || '—' },
            {
              key: 'actions', label: 'Actions', className: 'text-right',
              render: (q) => (
                <div className="flex items-center justify-end gap-1.5">
                  <button onClick={() => openEdit(q)} className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] px-2.5 py-1.5 text-[12px] font-semibold text-[#344054] transition-colors hover:bg-[#F7F9FC]">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setConfirmDelete(q)} className="inline-flex items-center gap-1 rounded-lg border border-[#D0D5DD] px-2.5 py-1.5 text-[12px] font-semibold text-[#DC2626] transition-colors hover:bg-[#FEF2F2]">
                    <Trash2 size={13} />
                  </button>
                </div>
              ),
            },
          ]}
        />
        <p className="mt-3 text-[12px] text-[#94A3B8]">{total} question{total === 1 ? '' : 's'} in this bank.</p>
      </div>

      {/* Manual add / edit form */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
          onClick={(e) => { if (e.target === e.currentTarget) setFormOpen(false); }}
        >
          <form onSubmit={onSave} className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <button type="button" onClick={() => setFormOpen(false)} aria-label="Close" className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#101828]">
              <X size={16} />
            </button>
            <div className="flex items-center gap-2 pr-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF0FF] text-[#6B7CFF]"><HelpCircle size={17} /></span>
              <h2 className="text-[17px] font-extrabold text-[#101828]">{editing ? 'Edit Question' : 'New Question'}</h2>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Question *</label>
                <textarea required rows={3} value={form.question} onChange={(e) => setForm((p) => ({ ...p, question: e.target.value }))} className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
              </div>
              {(['optionA', 'optionB', 'optionC', 'optionD'] as const).map((field, index) => (
                <div key={field}>
                  <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Option {String.fromCharCode(65 + index)} *</label>
                  <input required value={form[field]} onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))} className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Correct Answer</label>
                  <select value={form.correctAnswer} onChange={(e) => setForm((p) => ({ ...p, correctAnswer: e.target.value as Question['correctAnswer'] }))} className="w-full rounded-lg border border-[#D0D5DD] bg-white px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]">
                    <option>A</option><option>B</option><option>C</option><option>D</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Chapter</label>
                  <input value={form.chapter} onChange={(e) => setForm((p) => ({ ...p, chapter: e.target.value }))} className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-[#344054]">Remarks (internal)</label>
                <textarea rows={2} value={form.remarks} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} className="w-full rounded-lg border border-[#D0D5DD] px-3.5 py-2.5 text-[14px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]" />
              </div>
            </div>

            {formError && <p className="mt-4 text-[13px] text-red-600">{formError}</p>}

            <button
              type="submit"
              disabled={saving}
              className="mt-6 w-full rounded-lg bg-[#111827] py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#1F2937] disabled:opacity-60"
            >
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Question'}
            </button>
          </form>
        </div>
      )}

      {/* Excel import */}
      {importOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
          onClick={(e) => { if (e.target === e.currentTarget) setImportOpen(false); }}
        >
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <button onClick={() => setImportOpen(false)} aria-label="Close" className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#101828]">
              <X size={16} />
            </button>
            <div className="flex items-center gap-2 pr-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EEF0FF] text-[#6B7CFF]"><FileSpreadsheet size={17} /></span>
              <h2 className="text-[17px] font-extrabold text-[#101828]">Import into "{activeBank.title}"</h2>
            </div>
            <ol className="mt-4 list-decimal space-y-1 pl-5 text-[13px] text-[#64748B]">
              <li>Download the template. Keep the column names and their order.</li>
              <li>Put one MCQ on each row. <span className="font-medium text-[#344054]">correct_answer</span> must be A, B, C, or D.</li>
              <li>Delete the example row, upload the file, then approve only the valid rows.</li>
            </ol>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] px-3.5 py-2 text-[13px] font-semibold text-[#344054] hover:bg-[#F7F9FC]"
                onClick={async () => {
                  const blob = await questionsApi.downloadTemplate();
                  downloadBlob(blob, 'heystudents-question-template.xlsx');
                }}
              >
                Download template
              </button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#111827] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#1F2937]">
                <Upload size={14} />
                {uploading ? 'Checking file…' : 'Upload .xlsx'}
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(event) => {
                    onUpload(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </label>
            </div>

            {preview && (
              <div className="mt-6">
                <p className="text-[13.5px] text-[#475569]">
                  {preview.fileName ? `${preview.fileName}: ` : ''}
                  {preview.validCount} ready, {preview.invalidCount} rejected
                  {preview.skippedEmpty ? `, ${preview.skippedEmpty} empty row(s) ignored` : ''}.
                </p>
                {preview.invalidCount > 0 && (
                  <button
                    type="button"
                    className="mt-2 text-[13px] font-semibold text-[#3267f5] underline"
                    onClick={async () => {
                      const blob = await questionsApi.downloadErrorReport(preview.importId);
                      downloadBlob(blob, 'question-import-errors.xlsx');
                    }}
                  >
                    Download error report
                  </button>
                )}
                <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-[#E8EDF4]">
                  <table className="min-w-full text-[13px]">
                    <thead className="sticky top-0 bg-[#F7F9FC] text-left text-[#64748B]">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Row</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 font-semibold">Question</th>
                        <th className="px-3 py-2 font-semibold">Answer</th>
                        <th className="px-3 py-2 font-semibold">Chapter</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.invalid.map((row) => (
                        <tr key={`bad-${row.rowNumber}`} className="border-t border-red-100 bg-red-50">
                          <td className="px-3 py-2">{row.rowNumber}</td>
                          <td className="px-3 py-2 text-red-800">{row.errors?.join(' ')}</td>
                          <td className="px-3 py-2">{row.question || '—'}</td>
                          <td className="px-3 py-2">{row.correctAnswer || '—'}</td>
                          <td className="px-3 py-2">{row.chapter || '—'}</td>
                        </tr>
                      ))}
                      {preview.valid.map((row) => (
                        <tr key={`ok-${row.rowNumber}`} className="border-t border-[#F1F5F9]">
                          <td className="px-3 py-2">{row.rowNumber}</td>
                          <td className="px-3 py-2 text-green-700">Ready</td>
                          <td className="px-3 py-2">{row.question}</td>
                          <td className="px-3 py-2">{row.correctAnswer}</td>
                          <td className="px-3 py-2">{row.chapter || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  disabled={approving || preview.validCount === 0}
                  onClick={onApprove}
                  className="mt-4 rounded-lg bg-[#111827] px-4 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#1F2937] disabled:opacity-50"
                >
                  {approving ? 'Saving…' : `Approve ${preview.validCount} question(s)`}
                </button>
              </div>
            )}
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
            <h2 className="text-[17px] font-extrabold text-[#101828]">Delete this question?</h2>
            <p className="mt-1.5 line-clamp-3 text-[13px] text-[#64748B]">{confirmDelete.question}</p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 rounded-lg border border-[#D0D5DD] py-2.5 text-[13.5px] font-semibold text-[#344054] hover:bg-[#F7F9FC]">
                Cancel
              </button>
              <button
                onClick={onDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-[#DC2626] py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#B91C1C] disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation */}
      {confirmBulkDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmBulkDelete(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-[17px] font-extrabold text-[#101828]">Delete {selectedIds.size} question{selectedIds.size === 1 ? '' : 's'}?</h2>
            <p className="mt-1.5 text-[13px] text-[#64748B]">
              This cannot be undone. Any selected question already used by a mock test will be skipped instead of deleted.
            </p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setConfirmBulkDelete(false)} className="flex-1 rounded-lg border border-[#D0D5DD] py-2.5 text-[13.5px] font-semibold text-[#344054] hover:bg-[#F7F9FC]">
                Cancel
              </button>
              <button
                onClick={onBulkDelete}
                disabled={bulkDeleting}
                className="flex-1 rounded-lg bg-[#DC2626] py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#B91C1C] disabled:opacity-60"
              >
                {bulkDeleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminQuestionBankPage;
