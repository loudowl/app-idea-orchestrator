import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Search, Check, Building2 } from "lucide-react";
import clsx from "clsx";

interface Props {
  sectors: string[];
  value: string | null; // null = Any (broad scan)
  onChange: (v: string | null) => void;
  disabled?: boolean;
}

/**
 * Searchable industry-sector picker. Steers the idea generator at one sector,
 * or "Any (broad scan)" (null) for the default cross-industry behavior.
 */
export default function SectorPicker({ sectors, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? sectors.filter((s) => s.toLowerCase().includes(q)) : sectors;
  }, [query, sectors]);

  const select = (v: string | null) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        title="Steer idea generation at an industry sector"
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/8 text-slate-300 hover:border-white/15 disabled:opacity-60 text-xs transition-colors max-w-[220px]"
      >
        <Building2 size={13} className="text-slate-500 shrink-0" />
        <span className="truncate">{value ?? "Any sector"}</span>
        <ChevronDown size={13} className="text-slate-500 shrink-0" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 max-h-80 bg-[#0a0e1a] border border-white/10 rounded-xl shadow-2xl z-30 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-white/8 relative">
            <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sectors…"
              className="w-full bg-[#111827] border border-white/8 rounded-lg pl-7 pr-2 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/60"
            />
          </div>
          <div className="overflow-y-auto py-1">
            <Option label="Any (broad scan)" active={value === null} onClick={() => select(null)} />
            {filtered.map((s) => (
              <Option key={s} label={s} active={value === s} onClick={() => select(s)} />
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-slate-600">No match</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Option({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-left transition-colors",
        active ? "bg-indigo-600/20 text-indigo-200" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
      )}
    >
      <span className="truncate">{label}</span>
      {active && <Check size={13} className="shrink-0" />}
    </button>
  );
}
