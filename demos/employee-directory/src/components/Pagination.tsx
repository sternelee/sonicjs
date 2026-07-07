interface Props {
  page: number
  totalPages: number
  total: number
  onPrev: () => void
  onNext: () => void
}

export function Pagination({ page, totalPages, total, onPrev, onNext }: Props) {
  return (
    <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
      <span className="text-slate-400 text-sm">
        {total.toLocaleString()} employees · Page {page + 1} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          onClick={onPrev}
          disabled={page === 0}
          className="px-4 py-2 text-sm bg-slate-800 border border-white/10 rounded-lg disabled:opacity-30 hover:bg-slate-700 transition-colors disabled:cursor-not-allowed"
        >
          ← Prev
        </button>
        <button
          onClick={onNext}
          disabled={page >= totalPages - 1}
          className="px-4 py-2 text-sm bg-slate-800 border border-white/10 rounded-lg disabled:opacity-30 hover:bg-slate-700 transition-colors disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
