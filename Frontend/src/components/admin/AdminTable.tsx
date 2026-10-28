import React, { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  page?: number;
  pages?: number;
  onPageChange?: (page: number) => void;
  selectedKeys?: Set<string>;
  onToggleRow?: (key: string) => void;
  onToggleAll?: () => void;
}

function AdminTable<T>({
  columns, rows, rowKey, loading, emptyMessage = 'Nothing here yet.',
  search, onSearchChange, searchPlaceholder = 'Search…',
  page, pages, onPageChange,
  selectedKeys, onToggleRow, onToggleAll,
}: Props<T>) {
  const selectable = Boolean(selectedKeys && onToggleRow && onToggleAll);
  const allSelected = selectable && rows.length > 0 && rows.every((row) => selectedKeys!.has(rowKey(row)));

  return (
    <div className="rounded-2xl border border-[#E8EDF4] bg-white">
      {onSearchChange && (
        <div className="border-b border-[#E8EDF4] p-4">
          <div className="relative max-w-sm">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-[#D0D5DD] py-2.5 pl-10 pr-4 text-[13.5px] focus:border-[#111827] focus:outline-none focus:ring-1 focus:ring-[#111827]"
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#111827] border-t-transparent" />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center text-[13.5px] text-[#64748B]">{emptyMessage}</div>
      ) : (
        <>
          {/* Stacked cards on narrow screens — avoids horizontal scroll being
              unreachable under the app shell's overflow-x-hidden wrapper. */}
          <div className="space-y-3 p-4 sm:hidden">
            {rows.map((row) => {
              const key = rowKey(row);
              return (
                <div key={key} className="rounded-xl border border-[#E8EDF4] p-4">
                  {selectable && (
                    <div className="mb-2 flex items-center justify-between border-b border-[#F1F5F9] pb-2">
                      <label className="flex items-center gap-2 text-[12px] font-semibold text-[#64748B]">
                        <input
                          type="checkbox"
                          checked={selectedKeys!.has(key)}
                          onChange={() => onToggleRow!(key)}
                          className="h-4 w-4 rounded border-[#D0D5DD]"
                        />
                        Select
                      </label>
                    </div>
                  )}
                  {columns.map((col) => (
                    <div key={col.key} className="flex items-center justify-between gap-3 py-1 text-[13px]">
                      <span className="shrink-0 font-semibold text-[#94A3B8]">{col.label}</span>
                      <span className="text-right text-[#101828]">{col.render(row)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <table className="hidden w-full text-left text-[13.5px] sm:table">
            <thead>
              <tr className="border-b border-[#E8EDF4] text-[11.5px] font-bold uppercase tracking-[1px] text-[#94A3B8]">
                {selectable && (
                  <th className="w-10 px-5 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={onToggleAll}
                      className="h-4 w-4 rounded border-[#D0D5DD]"
                      aria-label="Select all"
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th key={col.key} className={`px-5 py-3 ${col.className || ''}`}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = rowKey(row);
                return (
                  <tr key={key} className="border-b border-[#F1F5F9] last:border-0">
                    {selectable && (
                      <td className="px-5 py-3.5">
                        <input
                          type="checkbox"
                          checked={selectedKeys!.has(key)}
                          onChange={() => onToggleRow!(key)}
                          className="h-4 w-4 rounded border-[#D0D5DD]"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className={`px-5 py-3.5 ${col.className || ''}`}>{col.render(row)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {pages !== undefined && pages > 1 && onPageChange && (
        <div className="flex items-center justify-center gap-2 border-t border-[#E8EDF4] p-4">
          <button
            onClick={() => onPageChange(Math.max(1, (page || 1) - 1))}
            disabled={(page || 1) <= 1}
            className="inline-flex items-center gap-1 rounded-full border border-[#D0D5DD] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#475569] transition-colors hover:border-[#111827] hover:text-[#101828] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-[13px] text-[#64748B]">Page {page} of {pages}</span>
          <button
            onClick={() => onPageChange(Math.min(pages, (page || 1) + 1))}
            disabled={(page || 1) >= pages}
            className="inline-flex items-center gap-1 rounded-full border border-[#D0D5DD] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#475569] transition-colors hover:border-[#111827] hover:text-[#101828] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default AdminTable;
