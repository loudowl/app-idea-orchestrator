import { useQuery } from "@tanstack/react-query";
import { fetchStats } from "../api/client";
import { Lightbulb, Zap, BarChart3, TrendingUp } from "lucide-react";
import clsx from "clsx";

const COMPLEXITY_COLORS: Record<string, string> = {
  simple:  "text-emerald-400",
  medium:  "text-amber-400",
  complex: "text-rose-400",
};

export default function StatsBar() {
  const { data } = useQuery({ queryKey: ["stats"], queryFn: fetchStats, staleTime: 30_000 });

  const simple  = data?.byComplexity.find(b => b._id === "simple")?.count ?? 0;
  const medium  = data?.byComplexity.find(b => b._id === "medium")?.count ?? 0;
  const complex = data?.byComplexity.find(b => b._id === "complex")?.count ?? 0;
  const total   = data?.total ?? 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { icon: <Lightbulb size={15} />, label: "Total Ideas", value: total, color: "text-indigo-400" },
        { icon: <Zap size={15} />,       label: "Simple",      value: simple,  color: COMPLEXITY_COLORS.simple  },
        { icon: <BarChart3 size={15} />, label: "Medium",      value: medium,  color: COMPLEXITY_COLORS.medium  },
        { icon: <TrendingUp size={15} />,label: "Complex",     value: complex, color: COMPLEXITY_COLORS.complex  },
      ].map(({ icon, label, value, color }) => (
        <div key={label} className="bg-[#0f1623] border border-white/8 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className={clsx(color)}>{icon}</span>
          <div>
            <div className={clsx("text-xl font-bold font-mono", color)}>{value}</div>
            <div className="text-[11px] text-slate-500">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
