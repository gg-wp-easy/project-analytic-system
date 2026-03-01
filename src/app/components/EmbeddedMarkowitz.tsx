import { useMemo, useState } from "react";
import { Calculator, PieChart, TrendingUp } from "lucide-react";
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useFundamentals } from "../context/FundamentalsContext";
import { useAppSettings } from "../context/AppSettingsContext";

type EmbeddedMarkowitzProps = {
  accentClassName?: string;
};

const palette = ["#2563eb", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#06b6d4"];

export function EmbeddedMarkowitz({ accentClassName = "text-indigo-600" }: EmbeddedMarkowitzProps) {
  const { cache, hasData } = useFundamentals();
  const { t } = useAppSettings();
  const [run, setRun] = useState(false);

  const frontier = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        risk: 8 + i * 0.8,
        ret: 7 + Math.sqrt(i + 1) * 1.6,
      })),
    [],
  );

  const weights = useMemo(() => {
    if (!hasData) {
      return [];
    }

    const selected = cache.shares.slice(0, 6);
    if (!selected.length) {
      return [];
    }

    const raw = selected.map((share) => {
      const fundamentals = cache.fundamentalsByFigi[share.figi];
      const score = (fundamentals?.roe ?? 10) / Math.max(fundamentals?.peRatio ?? 10, 1);
      return { share, score: Math.max(score, 0.01) };
    });

    const total = raw.reduce((acc, item) => acc + item.score, 0);
    return raw.map((item, idx) => ({
      name: item.share.ticker,
      value: Number(((item.score / total) * 100).toFixed(1)),
      color: palette[idx % palette.length],
    }));
  }, [cache.fundamentalsByFigi, cache.shares, hasData]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
      <div className="flex items-center gap-2">
        <PieChart className={`w-5 h-5 ${accentClassName}`} />
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">{t("markowitz.title")}</h3>
      </div>

      {!hasData && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-800 dark:text-amber-300">
          {t("markowitz.needFundamentals")}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setRun(true)}
          disabled={!hasData}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Calculator className="w-4 h-4" />
          {t("markowitz.calculate")}
        </button>
        {run && (
          <span className="inline-flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
            <TrendingUp className="w-4 h-4" />
            {t("markowitz.updated")}
          </span>
        )}
      </div>

      {run && hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="risk" type="number" name="risk" unit="%" stroke="#64748b" />
                <YAxis dataKey="ret" type="number" name="return" unit="%" stroke="#64748b" />
                <Tooltip />
                <Scatter data={frontier} fill="#4f46e5" name={t("markowitz.frontier")} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPie>
                <Pie data={weights} dataKey="value" nameKey="name" outerRadius={95} label={(e) => `${e.name}: ${e.value}%`}>
                  {weights.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPie>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
