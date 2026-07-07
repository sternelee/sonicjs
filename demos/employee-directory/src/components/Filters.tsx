import type { FilterState, FilterOption } from '../types'

interface Props {
  filters: FilterState
  deptOptions: FilterOption[]
  regionOptions: FilterOption[]
  onChange: (f: FilterState) => void
}

export function Filters({ filters, deptOptions, regionOptions, onChange }: Props) {
  const set = (key: keyof FilterState, val: string) => onChange({ ...filters, [key]: val })

  return (
    <div className="bg-slate-900 border border-white/10 rounded-xl p-4 space-y-4">
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Filters</h2>

      <div>
        <label className="text-xs text-slate-400 mb-1.5 block">Department</label>
        <select
          value={filters.department}
          onChange={(e) => set('department', e.target.value)}
          className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          <option value="">All Departments</option>
          {deptOptions.map((d) => (
            <option key={d.id} value={d.id}>{d.icon ? `${d.icon} ` : ''}{d.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-slate-400 mb-1.5 block">Region</label>
        <select
          value={filters.region}
          onChange={(e) => set('region', e.target.value)}
          className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          <option value="">All Regions</option>
          {regionOptions.map((r) => (
            <option key={r.id} value={r.id}>{r.flag ? `${r.flag} ` : ''}{r.name}</option>
          ))}
        </select>
      </div>

      {(filters.department || filters.region) && (
        <button
          onClick={() => onChange({ department: '', region: '' })}
          className="w-full text-xs text-slate-400 hover:text-white border border-white/10 rounded-lg py-1.5 transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
