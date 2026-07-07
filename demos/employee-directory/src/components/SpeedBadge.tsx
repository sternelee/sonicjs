interface Props {
  ms: number | null
  source: string | null
  edgeMode: boolean
  onToggle: (v: boolean) => void
}

export function SpeedBadge({ ms, source, edgeMode, onToggle }: Props) {
  const isEdge = source === 'edge-cache' || edgeMode
  const color = ms === null ? 'text-slate-400' : ms < 50 ? 'text-emerald-400' : ms < 150 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="flex items-center gap-3">
      {/* Toggle */}
      <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg p-1">
        <button
          onClick={() => onToggle(true)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${edgeMode ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          Edge
        </button>
        <button
          onClick={() => onToggle(false)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${!edgeMode ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          Origin
        </button>
      </div>

      {/* Badge */}
      <div className="flex items-center gap-2 bg-slate-800/80 border border-white/10 rounded-lg px-3 py-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${isEdge ? 'bg-emerald-400' : 'bg-slate-400'} animate-pulse`} />
        <span className={`text-sm font-mono font-bold ${color}`}>
          {ms !== null ? `${ms}ms` : '—'}
        </span>
        <span className="text-slate-500 text-xs">{isEdge ? 'edge' : 'origin'}</span>
      </div>
    </div>
  )
}
